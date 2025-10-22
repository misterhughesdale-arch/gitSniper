#!/usr/bin/env node
/**
 * ENHANCED TEST WITH PROFITABILITY TRACKING
 * 
 * - Buys tokens as detected (0.01 SOL each)
 * - Sells after 5 seconds
 * - Reclaims rent every 4 buys
 * - Tracks individual token performance
 * - Exports to CSV with hourly/daily aggregates
 */

import "dotenv/config";
import bs58 from "bs58";
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { buildBuyTransaction, buildSellTransaction } from "../../packages/transactions/src/pumpfun/builders";
import { readFileSync, appendFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const GRPC_URL = process.env.GRPC_URL!;
const X_TOKEN = process.env.X_TOKEN!;
const RPC_URL = process.env.SOLANA_RPC_PRIMARY!;
const TRADER_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";
const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

const keypairData = JSON.parse(readFileSync(TRADER_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));
const connection = new Connection(RPC_URL, "confirmed");

// Config
const TEST_DURATION_MS = 555 * 60 * 1000; // 15 minutes
const BUY_AMOUNT = 0.01; // SOL
const BUY_PRIORITY_FEE = 50033; // microlamports per unit
const SELL_DELAY_MS = 10000; // 10 seconds
const SELL_PRIORITY_FEE = 1000; // minimal
const MIN_BALANCE_SOL = 0.01;
const BUY_COOLDOWN_MS = 20000; // 20 seconds between buys
const RECLAIM_EVERY_N_BUYS = 4; // Reclaim rent every 4 buys
const MAX_TOKEN_AGE_MS = 10; // Only buy tokens younger than 10ms

const startTime = Date.now();
const sessionId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
const csvFile = resolve(process.cwd(), `results/trades-${sessionId}.csv`);
const sessionFile = resolve(process.cwd(), `results/session-${sessionId}.csv`);

// Trade tracking
interface TradeRecord {
  mint: string;
  buyTx: string;
  buyTime: number;
  buyAmountSOL: number;
  buyFeeLamports: number;
  tokensBought: number;
  sellTx?: string;
  sellTime?: number;
  sellAmountSOL?: number;
  sellFeeLamports?: number;
  holdTimeSeconds?: number;
  pnlSOL?: number;
  pnlPercent?: number;
  status: "pending" | "sold" | "failed";
}

const trades: TradeRecord[] = [];
const pendingSells: Array<{ mint: PublicKey; buyTime: number; buyTx: string; tradeIndex: number }> = [];
const processedMints = new Set<string>();

let cachedBlockhash: string | null = null;
let tokensDetected = 0;
let buyAttempts = 0;
let buySuccess = 0;
let sellAttempts = 0;
let sellSuccess = 0;
let lastBuyTime = 0;
let completedBuys = 0;
let rentReclaimed = 0;

// Initialize CSV files
import { mkdirSync } from "fs";
try {
  mkdirSync(resolve(process.cwd(), "results"), { recursive: true });
} catch {}

// CSV headers
const csvHeader = "timestamp,mint,buy_tx,buy_amount_sol,buy_fee_lamports,tokens_bought,sell_tx,sell_amount_sol,sell_fee_lamports,hold_time_sec,pnl_sol,pnl_percent,status\n";
const sessionHeader = "hour,trades,buys,sells,total_spent_sol,total_received_sol,total_fees_sol,net_pnl_sol,rent_reclaimed_sol,success_rate\n";

writeFileSync(csvFile, csvHeader);
writeFileSync(sessionFile, sessionHeader);

console.log("🧪 ENHANCED PROFITABILITY TEST");
console.log("==============================\n");
console.log(`Wallet: ${trader.publicKey.toBase58()}`);
console.log(`Buy: ${BUY_AMOUNT} SOL`);
console.log(`Sell: After ${SELL_DELAY_MS / 1000}s`);
console.log(`Rent reclaim: Every ${RECLAIM_EVERY_N_BUYS} buys`);
console.log(`CSV output: ${csvFile}`);
console.log(`Session log: ${sessionFile}\n`);

/**
 * Reclaim rent from empty ATAs
 */
async function reclaimRent(): Promise<number> {
  console.log(`\n💸 Reclaiming rent from empty ATAs...`);
  
  try {
    const { Transaction } = await import("@solana/web3.js");
    const { createCloseAccountInstruction } = await import("@solana/spl-token");
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    });
    
    const emptyATAs = tokenAccounts.value.filter(acc => 
      parseFloat(acc.account.data.parsed.info.tokenAmount.uiAmount) === 0
    );
    
    if (emptyATAs.length === 0) {
      console.log(`   No empty ATAs to close`);
      return 0;
    }
    
    const expectedReclaim = emptyATAs.length * 0.00203928;
    console.log(`   Closing ${emptyATAs.length} empty ATAs (~${expectedReclaim.toFixed(5)} SOL)`);
    
    const tx = new Transaction();
    for (const ata of emptyATAs) {
      tx.add(createCloseAccountInstruction(
        ata.pubkey,
        trader.publicKey,
        trader.publicKey,
      ));
    }
    
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = trader.publicKey;
    tx.sign(trader);
    
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    
    console.log(`   ✅ Reclaimed: ${expectedReclaim.toFixed(5)} SOL`);
    return expectedReclaim;
  } catch (error) {
    console.log(`   ❌ Reclaim error: ${(error as Error).message}`);
    return 0;
  }
}

/**
 * Buy token
 */
async function buyToken(mintStr: string, receivedAt: number) {
  // Deduplication check - don't buy same token twice
  if (processedMints.has(mintStr)) {
    return;
  }
  processedMints.add(mintStr);
  
  tokensDetected++;
  
  const tokenAge = Date.now() - receivedAt;
  
  // Cooldown check - wait 20s between buys
  const now = Date.now();
  const timeSinceLastBuy = now - lastBuyTime;
  if (lastBuyTime > 0 && timeSinceLastBuy < BUY_COOLDOWN_MS) {
    const waitTime = Math.ceil((BUY_COOLDOWN_MS - timeSinceLastBuy) / 1000);
    console.log(`\n⏸️  Cooldown: waiting ${waitTime}s before next buy (token age: ${tokenAge}ms)...`);
    return;
  }
  
  // Safety check
  const balance = await connection.getBalance(trader.publicKey);
  const balanceSOL = balance / 1e9;
  
  if (balanceSOL < MIN_BALANCE_SOL) {
    console.log(`\n🛑 Balance too low (${balanceSOL.toFixed(4)} SOL), stopping`);
    process.exit(0);
  }
  
  console.log(`\n🪙 Token #${tokensDetected}: ${mintStr.slice(0, 8)}... (age: ${tokenAge}ms, balance: ${balanceSOL.toFixed(4)} SOL)`);
  
  try {
    const mint = new PublicKey(mintStr);
    buyAttempts++;
    lastBuyTime = now;
    
    const { transaction } = await buildBuyTransaction({
      connection,
      buyer: trader.publicKey,
      mint,
      amountSol: BUY_AMOUNT,
      slippageBps: 500,
      priorityFeeLamports: BUY_PRIORITY_FEE,
    });
    
    transaction.sign(trader);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
    });
    
    console.log(`   📤 Buy TX: ${signature}`);
    console.log(`   🔗 https://solscan.io/tx/${signature}`);
    
    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    
    if (confirmation.value.err) {
      console.log(`   ❌ Buy FAILED: ${JSON.stringify(confirmation.value.err)}`);
      return;
    }
    
    buySuccess++;
    completedBuys++;
    console.log(`   ✅ Buy CONFIRMED ON-CHAIN - selling in ${SELL_DELAY_MS / 1000}s`);
    
    // Get actual tokens bought
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
      mint,
      programId: TOKEN_PROGRAM_ID,
    });
    const tokensBought = tokenAccounts.value[0]
      ? parseFloat(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount)
      : 0;
    
    // Create trade record
    const tradeRecord: TradeRecord = {
      mint: mintStr,
      buyTx: signature,
      buyTime: Date.now(),
      buyAmountSOL: BUY_AMOUNT,
      buyFeeLamports: BUY_PRIORITY_FEE,
      tokensBought,
      status: "pending",
    };
    
    const tradeIndex = trades.length;
    trades.push(tradeRecord);
    
    // Schedule sell
    pendingSells.push({
      mint,
      buyTime: Date.now(),
      buyTx: signature,
      tradeIndex,
    });
    
    // Reclaim rent every 4 buys
    if (completedBuys % RECLAIM_EVERY_N_BUYS === 0) {
      console.log(`\n📊 Checkpoint: ${completedBuys} buys complete`);
      const reclaimed = await reclaimRent();
      rentReclaimed += reclaimed;
      
      // Calculate profitability for last 4 trades
      const recentTrades = trades.slice(-RECLAIM_EVERY_N_BUYS);
      const recentPnL = recentTrades
        .filter(t => t.pnlSOL !== undefined)
        .reduce((sum, t) => sum + (t.pnlSOL || 0), 0);
      
      console.log(`   Last ${RECLAIM_EVERY_N_BUYS} trades P&L: ${recentPnL >= 0 ? '+' : ''}${recentPnL.toFixed(6)} SOL`);
      console.log(`   Rent reclaimed so far: ${rentReclaimed.toFixed(5)} SOL`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${(error as Error).message}`);
  }
}

/**
 * Get actual SOL received from sell transaction
 */
async function getActualSellRevenue(signature: string, sellerPubkey: PublicKey): Promise<number> {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx || !tx.meta) return 0;
    
    // Get pre/post balances for seller
    const sellerIndex = tx.transaction.message.accountKeys.findIndex(
      key => key.pubkey.equals(sellerPubkey)
    );
    
    if (sellerIndex === -1) return 0;
    
    const preBalance = tx.meta.preBalances[sellerIndex];
    const postBalance = tx.meta.postBalances[sellerIndex];
    const fee = tx.meta.fee;
    
    // SOL received = (postBalance - preBalance) + fee
    const solReceived = ((postBalance - preBalance) + fee) / 1e9;
    
    return Math.max(0, solReceived);
  } catch (error) {
    console.error(`   Failed to parse sell revenue: ${error.message}`);
    return 0;
  }
}

/**
 * Sell token and update trade record
 */
async function sellToken(position: { mint: PublicKey; buyTime: number; buyTx: string; tradeIndex: number }) {
  console.log(`\n💰 Selling ${position.mint.toBase58().slice(0, 8)}...`);
  
  const trade = trades[position.tradeIndex];
  
  try {
    sellAttempts++;
    
    // Get balance
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    });
    
    const tokenAccount = tokenAccounts.value.find(
      acc => acc.account.data.parsed.info.mint === position.mint.toBase58()
    );
    
    if (!tokenAccount) {
      console.log(`   ⏭️  No token account`);
      trade.status = "failed";
      saveTrade(trade);
      return;
    }
    
    const balance = parseFloat(tokenAccount.account.data.parsed.info.tokenAmount.uiAmount);
    if (balance === 0) {
      console.log(`   ⏭️  Zero balance`);
      trade.status = "failed";
      saveTrade(trade);
      return;
    }
    
    const { transaction } = await buildSellTransaction({
      connection,
      seller: trader.publicKey,
      mint: position.mint,
      tokenAmount: balance,
      slippageBps: 1000,
      priorityFeeLamports: SELL_PRIORITY_FEE,
    });
    
    transaction.sign(trader);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });
    
    console.log(`   📤 Sell TX: ${signature}`);
    console.log(`   🔗 https://solscan.io/tx/${signature}`);
    
    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    
    if (confirmation.value.err) {
      console.log(`   ❌ Sell FAILED: ${JSON.stringify(confirmation.value.err)}`);
      trade.status = "failed";
      saveTrade(trade);
      return;
    }
    
    sellSuccess++;
    const holdTime = Math.floor((Date.now() - position.buyTime) / 1000);
    
    // Get ACTUAL SOL received
    await new Promise(r => setTimeout(r, 2000)); // Wait 2s for tx to be parsed
    const sellRevenue = await getActualSellRevenue(signature, trader.publicKey);
    
    // Update trade record
    trade.sellTx = signature;
    trade.sellTime = Date.now();
    trade.sellAmountSOL = sellRevenue;
    trade.sellFeeLamports = SELL_PRIORITY_FEE;
    trade.holdTimeSeconds = holdTime;
    trade.pnlSOL = sellRevenue - trade.buyAmountSOL - ((trade.buyFeeLamports + trade.sellFeeLamports) / 1e9);
    trade.pnlPercent = ((sellRevenue / trade.buyAmountSOL) - 1) * 100;
    trade.status = "sold";
    
    console.log(`   ✅ Sell CONFIRMED (held ${holdTime}s)`);
    console.log(`   💵 Revenue: ${sellRevenue.toFixed(6)} SOL`);
    console.log(`   📊 P&L: ${trade.pnlSOL >= 0 ? '+' : ''}${trade.pnlSOL.toFixed(6)} SOL (${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%)`);
    
    // Save to CSV
    saveTrade(trade);
    
  } catch (error) {
    console.log(`   ❌ Sell error: ${(error as Error).message}`);
    trade.status = "failed";
    saveTrade(trade);
  }
}

/**
 * Save trade to CSV
 */
function saveTrade(trade: TradeRecord): void {
  const row = [
    new Date(trade.buyTime).toISOString(),
    trade.mint,
    trade.buyTx,
    trade.buyAmountSOL.toFixed(6),
    trade.buyFeeLamports,
    trade.tokensBought,
    trade.sellTx || "",
    trade.sellAmountSOL?.toFixed(6) || "",
    trade.sellFeeLamports || "",
    trade.holdTimeSeconds || "",
    trade.pnlSOL?.toFixed(6) || "",
    trade.pnlPercent?.toFixed(2) || "",
    trade.status,
  ].join(",") + "\n";
  
  appendFileSync(csvFile, row);
}

/**
 * Process sells in background
 */
async function sellProcessor() {
  while (Date.now() < startTime + TEST_DURATION_MS + 60000) { // Run extra minute to finish sells
    const now = Date.now();
    
    for (let i = pendingSells.length - 1; i >= 0; i--) {
      const position = pendingSells[i];
      if (now - position.buyTime >= SELL_DELAY_MS) {
        await sellToken(position);
        pendingSells.splice(i, 1);
      }
    }
    
    await new Promise(r => setTimeout(r, 1000)); // Check every second
  }
}

/**
 * Handle Geyser stream
 */
async function handleStream(client: Client) {
  // Get initial blockhash BEFORE starting stream
  const { blockhash } = await connection.getLatestBlockhash();
  cachedBlockhash = blockhash;
  console.log(`✅ Initial blockhash: ${blockhash.slice(0, 16)}...\n`);

  const stream = await client.subscribe();
  console.log("✅ Stream connected\n");

  stream.on("error", (error) => {
    console.error("❌ Stream error:", error);
  });

  // Handle data
  stream.on("data", async (data) => {
    const receivedAt = Date.now();
    if (receivedAt > startTime + TEST_DURATION_MS) return; // Stop after 15 min

    try {
      // Update blockhash from stream
      // Update cachedBlockhash from data.blockMeta.blockhash if present and valid
      if (data && data.blockMeta && data.blockMeta.blockhash) {
        const hashField = data.blockMeta.blockhash;
        if (typeof hashField === "string") {
          cachedBlockhash = hashField;
        } else if (Array.isArray(hashField) || Buffer.isBuffer(hashField)) {
          // Handle possible Uint8Array/Buffer formats
          cachedBlockhash = bs58.encode(Buffer.from(hashField));
        } else {
          // Unknown format - skip updating
        }
      }

      if (!data || !data.transaction) return;

      const txInfo = data.transaction.transaction ?? data.transaction;
      const meta = txInfo.meta ?? data.transaction.meta;
      if (!meta) return;

      // Extract new tokens
      const postBalances = meta.postTokenBalances || [];
      const preBalances = meta.preTokenBalances || [];
      const preMints = new Set(preBalances.map((b: any) => b.mint).filter(Boolean));

      const newTokens = postBalances
        .filter((b: any) => b.mint && !preMints.has(b.mint))
        .map((b: any) => b.mint);

      for (const mint of newTokens) {
        buyToken(mint, receivedAt).catch(e => console.error(`Buy failed: ${e.message}`));
      }

    } catch (error) {
      // Silent
    }
  });

  // Subscribe
  const request = {
    accounts: {},
    slots: {},
    transactions: {
      pumpfun: {
        vote: false,
        failed: false,
        accountInclude: [PUMPFUN_PROGRAM],
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    entry: {},
    blocks: {},
    blocksMeta: {
      blockmeta: {},
    },
    accountsDataSlice: [],
    commitment: CommitmentLevel.CONFIRMED,
  };

  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err: any) => err ? reject(err) : resolve());
  });

  // Wait for duration
  await new Promise(r => setTimeout(r, TEST_DURATION_MS));
  stream.end();
  
  console.log("\n⏱️  Test period complete, finishing remaining sells...");
}

/**
 * Calculate hourly and daily aggregates
 */
function calculateAggregates(): void {
  const completedTrades = trades.filter(t => t.status === "sold");
  
  if (completedTrades.length === 0) return;
  
  // Group by hour
  const hourlyData = new Map<number, TradeRecord[]>();
  
  for (const trade of completedTrades) {
    const hour = Math.floor((trade.buyTime - startTime) / (60 * 60 * 1000));
    if (!hourlyData.has(hour)) {
      hourlyData.set(hour, []);
    }
    hourlyData.get(hour)!.push(trade);
  }
  
  // Write hourly aggregates
  for (const [hour, hourTrades] of hourlyData) {
    const totalSpent = hourTrades.reduce((sum, t) => sum + t.buyAmountSOL, 0);
    const totalReceived = hourTrades.reduce((sum, t) => sum + (t.sellAmountSOL || 0), 0);
    const totalFees = hourTrades.reduce((sum, t) => 
      sum + ((t.buyFeeLamports + (t.sellFeeLamports || 0)) / 1e9), 0
    );
    const netPnL = totalReceived - totalSpent - totalFees;
    const successRate = hourTrades.length > 0 
      ? (hourTrades.filter(t => (t.pnlSOL || 0) > 0).length / hourTrades.length * 100)
      : 0;
    
    const row = [
      hour,
      hourTrades.length,
      hourTrades.length,
      hourTrades.length,
      totalSpent.toFixed(6),
      totalReceived.toFixed(6),
      totalFees.toFixed(6),
      netPnL.toFixed(6),
      (rentReclaimed / Math.max(hourlyData.size, 1)).toFixed(6),
      successRate.toFixed(1),
    ].join(",") + "\n";
    
    appendFileSync(sessionFile, row);
  }
}

/**
 * Print final statistics
 */
function printFinalStats(): void {
  const completedTrades = trades.filter(t => t.status === "sold");
  const failedTrades = trades.filter(t => t.status === "failed");
  
  const totalBuySpent = completedTrades.reduce((sum, t) => sum + t.buyAmountSOL, 0);
  const totalSellReceived = completedTrades.reduce((sum, t) => sum + (t.sellAmountSOL || 0), 0);
  const totalBuyFees = completedTrades.reduce((sum, t) => sum + (t.buyFeeLamports / 1e9), 0);
  const totalSellFees = completedTrades.reduce((sum, t) => sum + ((t.sellFeeLamports || 0) / 1e9), 0);
  const totalFees = totalBuyFees + totalSellFees;
  
  const grossPnL = totalSellReceived - totalBuySpent;
  const netPnL = grossPnL - totalFees + rentReclaimed;
  
  const profitableTrades = completedTrades.filter(t => (t.pnlSOL || 0) > 0);
  const winRate = completedTrades.length > 0
    ? (profitableTrades.length / completedTrades.length * 100)
    : 0;
  
  const avgHoldTime = completedTrades.length > 0
    ? completedTrades.reduce((sum, t) => sum + (t.holdTimeSeconds || 0), 0) / completedTrades.length
    : 0;
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 FINAL RESULTS");
  console.log("=".repeat(60));
  
  console.log(`\n📈 Trading Activity:`);
  console.log(`  Tokens detected: ${tokensDetected}`);
  console.log(`  Buy attempts: ${buyAttempts}`);
  console.log(`  Buy success: ${buySuccess} (${buyAttempts > 0 ? ((buySuccess/buyAttempts)*100).toFixed(1) : 0}%)`);
  console.log(`  Sell attempts: ${sellAttempts}`);
  console.log(`  Sell success: ${sellSuccess}`);
  console.log(`  Failed trades: ${failedTrades.length}`);
  
  console.log(`\n💰 Profitability:`);
  console.log(`  Total buy spent: ${totalBuySpent.toFixed(6)} SOL`);
  console.log(`  Total sell received: ${totalSellReceived.toFixed(6)} SOL`);
  console.log(`  Buy fees: ${totalBuyFees.toFixed(6)} SOL`);
  console.log(`  Sell fees: ${totalSellFees.toFixed(6)} SOL`);
  console.log(`  Rent reclaimed: +${rentReclaimed.toFixed(6)} SOL`);
  
  console.log(`\n📊 Summary:`);
  console.log(`  Gross P&L: ${grossPnL >= 0 ? '+' : ''}${grossPnL.toFixed(6)} SOL`);
  console.log(`  Net P&L: ${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(6)} SOL (${((netPnL / totalBuySpent) * 100).toFixed(2)}%)`);
  console.log(`  Win rate: ${winRate.toFixed(1)}% (${profitableTrades.length}/${completedTrades.length})`);
  console.log(`  Avg hold time: ${avgHoldTime.toFixed(1)}s`);
  
  console.log(`\n💵 At $200/SOL:`);
  console.log(`  Net P&L: ${netPnL >= 0 ? '+' : ''}$${(netPnL * 200).toFixed(2)}`);
  
  console.log(`\n📂 Output Files:`);
  console.log(`  Trades: ${csvFile}`);
  console.log(`  Session: ${sessionFile}`);
  console.log("=".repeat(60));
}

/**
 * Main
 */
async function main() {
  const client = new Client(GRPC_URL, X_TOKEN, undefined);

  // Start sell processor in background
  const sellTask = sellProcessor();

  // Run stream
  await handleStream(client);

  // Wait for sells to finish
  await sellTask;
  
  // Final rent reclaim
  console.log(`\n💸 Final rent reclaim...`);
  const finalReclaim = await reclaimRent();
  rentReclaimed += finalReclaim;

  // Calculate aggregates
  calculateAggregates();
  
  // Print final stats
  printFinalStats();
}

main().catch(console.error);

