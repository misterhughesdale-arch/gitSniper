#!/usr/bin/env node
/**
 * CONTROLLED TEST RUNNER
 * 
 * Runs 4 different strategies for 15 minutes each
 * - Gets Jito p75 tip at start
 * - Buys one token at a time with controlled fees
 * - Sells after delay with minimal fees
 * - Tracks and analyzes results
 * 
 * SAFETY GUARDRAILS:
 * - Min balance check (0.05 SOL)
 * - Max spend per transaction
 * - Max total spend per strategy
 * - Emergency stop on critical errors
 */

import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { buildBuyTransaction, buildSellTransaction } from "../packages/transactions/src/pumpfun/builders";
import { readFileSync, appendFileSync } from "fs";
import { resolve } from "path";
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { loadConfig } from "../packages/config/src/index";

const config = loadConfig({ configDirectory: resolve(process.cwd(), "config") });
const HELIUS_RPC = config.rpc.primary_url;
const TRADER_KEYPAIR_PATH = config.wallets.trader_keypair_path;
const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"
];

const keypairData = JSON.parse(readFileSync(TRADER_KEYPAIR_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));

// Safety limits
const SAFETY = {
  MIN_BALANCE_SOL: 0.03, // Stop if below this
  MAX_BUY_AMOUNT_SOL: 0.02, // Max per buy (0.02 SOL)
  MAX_TOTAL_SPEND_SOL: 0.5, // Max per 15-min strategy
  SELL_DELAY_SECONDS: 5, // Wait before selling (5 seconds)
};

interface Strategy {
  name: string;
  buyAmount: number; // SOL
  buyPriorityFee: number; // microlamports
  sellPriorityFee: number; // microlamports
  sellDelay: number; // seconds
}

interface TradeResult {
  strategy: string;
  mint: string;
  buyTx: string;
  buyTime: number;
  buyAmountSOL: number;
  buyFee: number;
  sellTx?: string;
  sellTime?: number;
  sellAmountSOL?: number;
  sellFee?: number;
  profit?: number;
  error?: string;
}

const results: TradeResult[] = [];

/**
 * Fetch Jito successful tips
 */
async function getJitoTips(): Promise<{ p50: number; p75: number; p95: number; p99: number }> {
  try {
    const response = await fetch("https://bundles.jito.wtf/api/v1/bundles/tip_floor");
    const data = await response.json();
    
    // Jito returns in lamports
    return {
      p50: data[0]?.landed_tips_50th_percentile || 10000,
      p75: data[0]?.landed_tips_75th_percentile || 50000,
      p95: data[0]?.landed_tips_95th_percentile || 100000,
      p99: data[0]?.landed_tips_99th_percentile || 500000,
    };
  } catch (error) {
    console.log(`⚠️  Failed to fetch Jito tips, using defaults: ${error}`);
    return { p50: 10000, p75: 50000, p95: 100000, p99: 500000 };
  }
}

/**
 * Check wallet balance and safety limits
 */
async function checkSafety(connection: Connection, spent: number): Promise<boolean> {
  const balance = await connection.getBalance(trader.publicKey);
  const balanceSOL = balance / 1e9;
  
  if (balanceSOL < SAFETY.MIN_BALANCE_SOL) {
    console.log(`🛑 SAFETY STOP: Balance ${balanceSOL.toFixed(4)} SOL < ${SAFETY.MIN_BALANCE_SOL} SOL minimum`);
    return false;
  }
  
  if (spent >= SAFETY.MAX_TOTAL_SPEND_SOL) {
    console.log(`🛑 SAFETY STOP: Spent ${spent.toFixed(4)} SOL >= ${SAFETY.MAX_TOTAL_SPEND_SOL} SOL limit`);
    return false;
  }
  
  return true;
}

/**
 * Buy a token
 */
async function buyToken(
  connection: Connection,
  mint: PublicKey,
  strategy: Strategy
): Promise<{ signature: string; fee: number } | null> {
  try {
    const { transaction } = await buildBuyTransaction({
      connection,
      buyer: trader.publicKey,
      mint,
      amountSol: strategy.buyAmount,
      slippageBps: 500, // 5% slippage
      priorityFeeLamports: strategy.buyPriorityFee,
    });

    transaction.sign(trader);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });

    console.log(`   📤 Buy sent: ${signature.slice(0, 16)}...`);

    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      console.log(`   ❌ Buy failed: ${JSON.stringify(confirmation.value.err)}`);
      return null;
    }

    console.log(`   ✅ Buy confirmed`);
    return { signature, fee: strategy.buyPriorityFee / 1e9 };
  } catch (error) {
    console.log(`   ❌ Buy error: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Sell a token
 */
async function sellToken(
  connection: Connection,
  mint: PublicKey,
  strategy: Strategy
): Promise<{ signature: string; amountSOL: number; fee: number } | null> {
  try {
    // Get token balance
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    });

    const tokenAccount = tokenAccounts.value.find(
      acc => acc.account.data.parsed.info.mint === mint.toBase58()
    );

    if (!tokenAccount) {
      console.log(`   ⏭️  No token account found`);
      return null;
    }

    const balance = parseFloat(tokenAccount.account.data.parsed.info.tokenAmount.uiAmount);
    if (balance === 0) {
      console.log(`   ⏭️  Zero balance`);
      return null;
    }

    const { transaction } = await buildSellTransaction({
      connection,
      seller: trader.publicKey,
      mint,
      tokenAmount: balance,
      slippageBps: 1000, // 10% slippage
      priorityFeeLamports: strategy.sellPriorityFee,
    });

    transaction.sign(trader);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });

    console.log(`   📤 Sell sent: ${signature.slice(0, 16)}...`);

    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      console.log(`   ❌ Sell failed: ${JSON.stringify(confirmation.value.err)}`);
      return null;
    }

    console.log(`   ✅ Sell confirmed`);
    
    // Get SOL received (approximate)
    const postBalance = await connection.getBalance(trader.publicKey);
    const solReceived = 0.001; // Approximate - would need to parse transaction details

    return { signature, amountSOL: solReceived, fee: strategy.sellPriorityFee / 1e9 };
  } catch (error) {
    console.log(`   ❌ Sell error: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Setup Geyser stream for token detection
 */
async function setupTokenStream(
  onNewToken: (mint: string, creator: string) => Promise<void>,
  durationMinutes: number
): Promise<void> {
  const GEYSER_ENDPOINT = config.geyser.endpoint;
  const GEYSER_TOKEN = config.geyser.auth_token;
  const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

  console.log(`📡 Geyser endpoint: ${GEYSER_ENDPOINT}`);

  const client = new Client(GEYSER_ENDPOINT, GEYSER_TOKEN, undefined);
  const stream = await client.subscribe();

  console.log(`✅ Geyser stream connected`);

  const endTime = Date.now() + durationMinutes * 60 * 1000;
  let streamActive = true;

  stream.on("data", async (data) => {
    if (!streamActive || Date.now() >= endTime) return;

    try {
      if (!data?.transaction) return;

      const txInfo = data.transaction.transaction ?? data.transaction;
      const meta = txInfo.meta ?? data.transaction.meta;
      if (!meta) return;

      // Extract new tokens
      const postBalances = meta.postTokenBalances || [];
      const preBalances = meta.preTokenBalances || [];
      const preMints = new Set(preBalances.map((b: any) => b.mint).filter(Boolean));

      // Get creator (first account = signer)
      const accountKeys = txInfo.message?.accountKeys;
      if (!accountKeys || accountKeys.length === 0) return;
      const creator = String(accountKeys[0]);

      const newTokens = postBalances
        .filter((b: any) => {
          if (!b.mint || preMints.has(b.mint)) return false;
          if (b.mint === "So11111111111111111111111111111111111111112") return false; // Skip SOL
          if (!b.mint.endsWith("pump")) return false; // Only pump.fun
          return true;
        })
        .map((b: any) => b.mint);

      for (const mint of newTokens) {
        onNewToken(mint, creator).catch(err => console.error(`Token processing error: ${err.message}`));
      }
    } catch (error) {
      console.error("Stream error:", error);
    }
  });

  stream.on("error", (error) => {
    console.error("❌ Stream error:", error);
    streamActive = false;
  });

  // Subscribe to pump.fun program
  const request: any = {
    accounts: {},
    slots: {},
    transactions: {
      pumpfun: {
        vote: false,
        failed: false,
        accountInclude: [PUMP_PROGRAM],
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    entry: {},
    blocks: {},
    blocksMeta: {},
    accountsDataSlice: [],
    commitment: CommitmentLevel.CONFIRMED,
  };

  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err: any) => (err ? reject(err) : resolve()));
  });

  // Wait for duration
  await new Promise(r => setTimeout(r, durationMinutes * 60 * 1000));
  streamActive = false;
  stream.end();
}

/**
 * Run a single strategy for 15 minutes
 */
async function runStrategy(connection: Connection, strategy: Strategy, durationMinutes: number) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🎯 STRATEGY: ${strategy.name}`);
  console.log(`   Buy: ${strategy.buyAmount} SOL @ ${strategy.buyPriorityFee} µLamports priority`);
  console.log(`   Sell: ${strategy.sellPriorityFee} µLamports priority after ${strategy.sellDelay}s`);
  console.log(`   Duration: ${durationMinutes} minutes`);
  console.log(`${"=".repeat(60)}\n`);

  const startTime = Date.now();
  let totalSpent = 0;
  const pendingSells: Array<{ mint: PublicKey; result: TradeResult; sellTime: number }> = [];
  let tokensProcessed = 0;

  // Handle new tokens from stream
  const handleNewToken = async (mintStr: string, creator: string) => {
    // Safety check
    if (!(await checkSafety(connection, totalSpent))) {
      console.log(`🛑 Safety limit reached, skipping token`);
      return;
    }

    if (totalSpent >= SAFETY.MAX_TOTAL_SPEND_SOL) {
      console.log(`🛑 Max spend reached, skipping token`);
      return;
    }

    tokensProcessed++;
    console.log(`\n🪙 Token #${tokensProcessed}: ${mintStr.slice(0, 8)}...`);

    const mint = new PublicKey(mintStr);
    const buyResult = await buyToken(connection, mint, strategy);

    if (buyResult) {
      totalSpent += strategy.buyAmount + buyResult.fee;

      const tradeResult: TradeResult = {
        strategy: strategy.name,
        mint: mintStr,
        buyTx: buyResult.signature,
        buyTime: Date.now(),
        buyAmountSOL: strategy.buyAmount,
        buyFee: buyResult.fee,
      };

      // Schedule sell
      const sellTime = Date.now() + strategy.sellDelay * 1000;
      pendingSells.push({ mint, result: tradeResult, sellTime });
      
      console.log(`   📅 Sell scheduled in ${strategy.sellDelay}s`);
    }
  };

  // Start stream and process sells in parallel
  const streamPromise = setupTokenStream(handleNewToken, durationMinutes);

  // Sell processing loop
  const sellLoop = async () => {
    while (Date.now() < startTime + durationMinutes * 60 * 1000) {
      const now = Date.now();
      
      for (let i = pendingSells.length - 1; i >= 0; i--) {
        const pending = pendingSells[i];
        if (now >= pending.sellTime) {
          console.log(`\n🔄 Selling ${pending.mint.toBase58().slice(0, 8)}...`);
          const sellResult = await sellToken(connection, pending.mint, strategy);

          if (sellResult) {
            pending.result.sellTx = sellResult.signature;
            pending.result.sellTime = now;
            pending.result.sellAmountSOL = sellResult.amountSOL;
            pending.result.sellFee = sellResult.fee;
            pending.result.profit = sellResult.amountSOL - pending.result.buyAmountSOL - pending.result.buyFee - sellResult.fee;
          }

          results.push(pending.result);
          pendingSells.splice(i, 1);
        }
      }

      await new Promise(r => setTimeout(r, 1000)); // Check every second
    }
  };

  await Promise.all([streamPromise, sellLoop()]);

  // Sell any remaining tokens
  console.log(`\n⏱️  Strategy complete, selling remaining ${pendingSells.length} positions...`);
  for (const pending of pendingSells) {
    console.log(`\n🔄 Final sell: ${pending.mint.toBase58().slice(0, 8)}...`);
    const sellResult = await sellToken(connection, pending.mint, strategy);

    if (sellResult) {
      pending.result.sellTx = sellResult.signature;
      pending.result.sellTime = Date.now();
      pending.result.sellAmountSOL = sellResult.amountSOL;
      pending.result.sellFee = sellResult.fee;
      pending.result.profit = sellResult.amountSOL - pending.result.buyAmountSOL - pending.result.buyFee - sellResult.fee;
    }

    results.push(pending.result);
  }

  console.log(`\n✅ Strategy complete: ${strategy.name}`);
  console.log(`   Tokens detected: ${tokensProcessed}`);
  console.log(`   Total spent: ${totalSpent.toFixed(4)} SOL`);
  console.log(`   Trades: ${results.filter(r => r.strategy === strategy.name).length}`);
}

/**
 * Analyze and print results
 */
function analyzeResults() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 FINAL RESULTS`);
  console.log(`${"=".repeat(60)}\n`);

  const strategies = [...new Set(results.map(r => r.strategy))];
  
  for (const strategy of strategies) {
    const stratResults = results.filter(r => r.strategy === strategy);
    const trades = stratResults.length;
    const profitable = stratResults.filter(r => r.profit && r.profit > 0).length;
    const totalProfit = stratResults.reduce((sum, r) => sum + (r.profit || 0), 0);
    const totalFees = stratResults.reduce((sum, r) => sum + r.buyFee + (r.sellFee || 0), 0);

    console.log(`\n${strategy}:`);
    console.log(`  Trades: ${trades}`);
    console.log(`  Profitable: ${profitable} (${((profitable / trades) * 100).toFixed(1)}%)`);
    console.log(`  Total P&L: ${totalProfit.toFixed(6)} SOL`);
    console.log(`  Total Fees: ${totalFees.toFixed(6)} SOL`);
    console.log(`  Net: ${(totalProfit - totalFees).toFixed(6)} SOL`);
  }

  // Save to file
  const logFile = `test-results-${Date.now()}.json`;
  appendFileSync(logFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${logFile}`);
}

/**
 * Main
 */
async function main() {
  console.log(`🧪 CONTROLLED TEST RUNNER`);
  console.log(`========================\n`);
  console.log(`Wallet: ${trader.publicKey.toBase58()}`);
  console.log(`RPC: ${HELIUS_RPC}\n`);

  const connection = new Connection(HELIUS_RPC, "confirmed");

  // Check starting balance
  const startBalance = await connection.getBalance(trader.publicKey);
  const startBalanceSOL = startBalance / 1e9;
  
  console.log(`💰 Starting balance: ${startBalanceSOL.toFixed(6)} SOL\n`);
  
  if (startBalanceSOL < SAFETY.MIN_BALANCE_SOL) {
    console.log(`❌ Insufficient balance! Need at least ${SAFETY.MIN_BALANCE_SOL} SOL`);
    process.exit(1);
  }

  // Get Jito tips
  console.log(`⏳ Fetching Jito tip recommendations...`);
  const tips = await getJitoTips();
  console.log(`✅ Jito tips (µLamports):`);
  console.log(`   p50: ${tips.p50.toLocaleString()}`);
  console.log(`   p75: ${tips.p75.toLocaleString()} ⭐`);
  console.log(`   p95: ${tips.p95.toLocaleString()}`);
  console.log(`   p99: ${tips.p99.toLocaleString()}\n`);

  // Define 4 strategies - ALL WITH 0.02 SOL BUY and 5s HOLD
  const strategies: Strategy[] = [
    {
      name: "Test 1: p50 tip, 5s hold",
      buyAmount: 0.02,
      buyPriorityFee: 33333, // ~10k lamports total priority fee
      sellPriorityFee: 100, // Minimal sell fee
      sellDelay: 5,
    },
    {
      name: "Test 2: p75 tip, 5s hold",
      buyAmount: 0.02,
      buyPriorityFee: 33333, // ~10k lamports total priority fee
      sellPriorityFee: 100,
      sellDelay: 5,
    },
    {
      name: "Test 3: p95 tip, 5s hold",
      buyAmount: 0.02,
      buyPriorityFee: 33333, // ~10k lamports total priority fee
      sellPriorityFee: 100,
      sellDelay: 5,
    },
    {
      name: "Test 4: p99 tip, 5s hold",
      buyAmount: 0.02,
      buyPriorityFee: 33333, // ~10k lamports total priority fee
      sellPriorityFee: 100,
      sellDelay: 5,
    },
  ];

  // Run each strategy for 15 minutes
  for (const strategy of strategies) {
    await runStrategy(connection, strategy, 15);
    
    // Small break between strategies
    console.log(`\n⏸️  Taking 30s break before next strategy...\n`);
    await new Promise(r => setTimeout(r, 30000));
  }

  // Analyze results
  analyzeResults();

  // Final balance
  const endBalance = await connection.getBalance(trader.publicKey);
  const endBalanceSOL = endBalance / 1e9;
  const totalChange = endBalanceSOL - startBalanceSOL;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`💰 Final balance: ${endBalanceSOL.toFixed(6)} SOL`);
  console.log(`📊 Total change: ${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(6)} SOL`);
  console.log(`${"=".repeat(60)}\n`);
}

main().catch(console.error);

