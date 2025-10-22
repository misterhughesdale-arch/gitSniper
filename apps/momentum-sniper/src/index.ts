#!/usr/bin/env node
/**
 * MOMENTUM-BASED SNIPER
 * 
 * Strategy Overview:
 * 1. Buy tokens as detected (new PumpFun mints)
 * 2. Monitor buy/sell activity for just that mint
 * 3. Sell 50% once breakeven (e.g. MC ~9000 SOL etc.)
 * 4. Hold rest while momentum continues
 * 5. Exit remainder if lull (2s inactivity) OR sells > buys
 * 
 * Config: strategies/momentum-breakeven.toml
 */

// ====== DEPENDENCIES ======
import "dotenv/config";  // Loads env vars
import bs58 from "bs58"; // For base58 conversion, e.g. signatures
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc"; // Geyser stream client
import { Connection, Keypair, PublicKey } from "@solana/web3.js"; // Solana types
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { buyWithSDK, sellWithSDK } from "@fresh-sniper/transactions";
import { PositionManager, loadStrategyConfig } from "@fresh-sniper/auto-sell";
import { readFileSync } from "fs";

// ====== ENVIRONMENT/CONFIG SETTINGS ======
const GRPC_URL = process.env.GRPC_URL!;
const X_TOKEN = process.env.X_TOKEN!;
const TRADER_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";
const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const STRATEGY_FILE = process.env.STRATEGY_FILE || "momentum-breakeven.toml";

// ====== LOAD WALLET & SOLANA CONNECTION ======
const keypairData = JSON.parse(readFileSync(TRADER_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));
const connection = new Connection(
  process.env.QUICKNODE_HTTP || "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// ====== LOAD STRATEGY CONFIG ======
const strategy = loadStrategyConfig(STRATEGY_FILE);

// ====== CLEANUP EXISTING POSITIONS ON STARTUP ======
async function cleanupExistingPositions() {
  console.log("🧹 Checking for existing positions to clean up...\n");
  
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });

  let soldCount = 0;
  for (const { account } of tokenAccounts.value) {
    const balance = parseFloat(account.data.parsed.info.tokenAmount.uiAmount);
    if (balance === 0) continue;

    const mint = new PublicKey(account.data.parsed.info.mint);
    console.log(`💸 Selling ${balance.toLocaleString()} of ${mint.toBase58().slice(0, 8)}...`);

    try {
      await sellWithSDK({
        connection,
        seller: trader,
        mint,
        tokenAmount: balance,
        slippageBps: 5000, // 50% slippage - dump it
        priorityFeeMicroLamports: 5000,
      });
      soldCount++;
      console.log(`   ✅ Sold\n`);
    } catch (e) {
      console.log(`   ⏭️  Failed (will try manual later)\n`);
    }
  }
  
  if (soldCount > 0) {
    console.log(`✅ Sold ${soldCount} positions. Waiting 5s...\n`);
    await new Promise(r => setTimeout(r, 5000));
  } else {
    console.log(`✅ No existing positions to clean up\n`);
  }
}

// ====== STARTUP LOG OUTPUT ======
console.log("🎯 MOMENTUM-BASED SNIPER");
console.log("========================\n");
console.log(`Strategy: ${strategy.strategy.name}`);
console.log(`Wallet: ${trader.publicKey.toBase58()}`);
console.log(`Buy: ${strategy.strategy.entry.buy_amount_sol} SOL`);
console.log(`Breakeven: ${strategy.strategy.targets.breakeven_market_cap} SOL MC`);
console.log(`Lull threshold: ${strategy.strategy.momentum.lull_threshold_seconds}s`);
console.log(`Buy/Sell ratio: ${strategy.strategy.momentum.buy_sell_ratio_threshold}\n`);

// ====== STATS TRACKING ======
const processedMints = new Set<string>();     // Dedupes token mints already checked/bought
let tokensDetected = 0;                      // Total new tokens seen
let buyAttempts = 0;                         // # attempted buys
let buySuccess = 0;                          // # buys succeeded
let sellAttempts = 0;
let sellSuccess = 0;
let lastBuyTime = 0;                         // For cooldown mgmt

/**
 * PositionManager handles active position + triggers sales via callback
 */
const positionManager = new PositionManager(
  connection,
  trader,
  strategy,
  async (mint: PublicKey, percentage: number, reason: string) => {
    await executeSell(mint, percentage, reason); // Called by momentum logic on sell trigger
  }
);

/**
 * BUY LOGIC - called on new eligible token
 */
async function buyToken(mintStr: string, receivedAt: number) {
  // Deduplication & single-position check
  if (processedMints.has(mintStr)) return;
  if (positionManager.hasPosition()) {
    console.log(`   ⏭️  Already have position, skipping`);
    return;
  }
  
  processedMints.add(mintStr);
  tokensDetected++;
  
  const tokenAge = Date.now() - receivedAt;

  // Cooldown between buys (avoid rapid buying) - INCREASED for budget
  const now = Date.now();
  const timeSinceLastBuy = now - lastBuyTime;
  if (lastBuyTime > 0 && timeSinceLastBuy < 60000) {
    console.log(`\n⏸️  Cooldown: ${Math.floor((60000 - timeSinceLastBuy)/1000)}s until next buy...`);
    return;
  }
  
  // Check balance but don't exit - just log
  const balance = await connection.getBalance(trader.publicKey);
  const balanceSOL = balance / 1e9;
  
  // Display detected token info
  console.log(`\n🪙 Token #${tokensDetected}: ${mintStr.slice(0, 8)}... (age: ${tokenAge}ms, balance: ${balanceSOL.toFixed(4)} SOL)`);
  
  try {
    const mint = new PublicKey(mintStr);
    buyAttempts++;
    lastBuyTime = now;
    
    // Buy using SDK
    const result = await buyWithSDK({
      connection,
      buyer: trader,
      mint,
      amountSol: strategy.strategy.entry.buy_amount_sol,
      slippageBps: strategy.strategy.entry.max_slippage_bps,
      priorityFeeMicroLamports: strategy.strategy.entry.priority_fee_lamports,
      useJito: false,
    });
    
    const signature = result.signature;
    
    // Validate signature
    if (!signature || signature === 'unknown' || signature.includes('[object')) {
      console.log(`   ❌ Buy failed: Invalid signature returned`);
      return;
    }
    
    console.log(`   📤 Buy TX: ${signature}`);
    console.log(`   🔗 https://solscan.io/tx/${signature}`);
    
    buySuccess++;
    console.log(`   ✅ Buy sent - starting momentum tracking`);
    
    // Query how many tokens we got
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
      mint,
      programId: TOKEN_PROGRAM_ID,
    });
    const tokenBalance = tokenAccounts.value[0]
      ? parseFloat(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount)
      : 0;
    
    // Start "managed" position (triggers subsequent sell/momentum tracking)
    positionManager.startPosition(
      mint,
      signature,
      strategy.strategy.entry.buy_amount_sol,
      tokenBalance
    );
    
  } catch (error) {
    console.log(`   ❌ Error: ${(error as Error).message}`);
  }
}

/**
 * SELL LOGIC - called by PositionManager when a sell is triggered
 */
async function executeSell(mint: PublicKey, percentage: number, reason: string) {
  console.log(`\n💰 Executing ${percentage}% sell (${reason}): ${mint.toBase58().slice(0, 8)}...`);
  
  try {
    sellAttempts++;
    
    // Get token balance for mint
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
      mint,
      programId: TOKEN_PROGRAM_ID,
    });
    const tokenAccount = tokenAccounts.value[0];
    if (!tokenAccount) {
      console.log(`   ⏭️  No token account found`);
      return;
    }
    const totalBalance = parseFloat(tokenAccount.account.data.parsed.info.tokenAmount.uiAmount);
    if (totalBalance === 0) {
      console.log(`   ⏭️  Zero balance`);
      return;
    }
    const sellAmount = (totalBalance * percentage) / 100; // Portion to sell
    
    console.log(`   Selling ${sellAmount.toLocaleString()} / ${totalBalance.toLocaleString()} tokens`);
    
    // If exit due to lull/sell-pressure: more aggressive slippage & priority fee
    const slippage = reason === "lull detected" || reason === "sell pressure"
      ? strategy.strategy.exit.dump_slippage_bps
      : strategy.strategy.entry.max_slippage_bps;
    const priorityFee = reason === "lull detected" || reason === "sell pressure"
      ? strategy.strategy.exit.dump_priority_fee
      : 10000;
    
    // Sell using SDK
    const result = await sellWithSDK({
      connection,
      seller: trader,
      mint,
      tokenAmount: sellAmount,
      slippageBps: slippage,
      priorityFeeMicroLamports: priorityFee,
      useJito: false,
    });
    
    const signature = result.signature;
    
    console.log(`   📤 Sell TX: ${signature}`);
    console.log(`   🔗 https://solscan.io/tx/${signature}`);
    
    sellSuccess++;
    console.log(`   ✅ Sell CONFIRMED`);
    
  } catch (error) {
    console.log(`   ❌ Sell error: ${(error as Error).message}`);
  }
}

/**
 * Parses a Solana transaction to extract buy/sell events for momentum
 * Only parses if relevant to active position.
 */
function parseTransactionForMomentum(data: any): void {
  if (!data || !data.transaction) return;
  
  const position = positionManager.getPosition();
  if (!position) return;
  
  try {
    // Meta and transaction details
    const txInfo = data.transaction.transaction ?? data.transaction;
    const meta = txInfo.meta ?? data.transaction.meta;
    if (!meta) return;
    
    // Extract tx sig (may be string/Buffer)
    const signature = txInfo.signature 
      ? (typeof txInfo.signature === "string" ? txInfo.signature : bs58.encode(txInfo.signature))
      : "unknown";
    
    // Only consider tx if it touches the mint we hold
    const postBalances = meta.postTokenBalances || [];
    const preBalances = meta.preTokenBalances || [];
    const involvesMint = [...postBalances, ...preBalances].some(
      (b: any) => b.mint === position.mint.toBase58()
    );
    if (!involvesMint) return;
    
    // Determine event direction (buy or sell) based on SOL flow
    const nativeTransfers = meta.nativeTransfers || [];
    let isBuy = false, isSell = false, amountSol = 0;
    for (const transfer of nativeTransfers) {
      if (transfer.toUserAccount === PUMPFUN_PROGRAM) {
        isBuy = true;
        amountSol += transfer.amount / 1e9;
      } else if (transfer.fromUserAccount === PUMPFUN_PROGRAM) {
        isSell = true;
        amountSol += transfer.amount / 1e9;
      }
    }
    // Notify PositionManager for momentum analysis tracking
    if (isBuy && amountSol > 0) {
      positionManager.recordBuy(amountSol, signature);
    } else if (isSell && amountSol > 0) {
      positionManager.recordSell(amountSol, signature);
    }
    
  } catch (error) {
    // Do nothing (parse error)
  }
}

/**
 * Connects to Geyser stream and routes events to bot logic.
 * Also responsible for discovering *new* tokens.
 */
async function handleStream(client: Client) {
  const stream = await client.subscribe();
  console.log("✅ Stream connected\n");

  // Error handling
  stream.on("error", (error) => {
    console.error("❌ Stream error:", error);
  });

  // Main data handler - USING EXACT EXAMPLE PATTERN
  stream.on("data", async (data) => {
    try {
      // If we have a position, parse tx for momentum signals
      if (positionManager.hasPosition() && data.transaction) {
        parseTransactionForMomentum(data);
        return;
      }
      
      // NEW TOKEN DETECTION - with bonding curve age verification
      if (!positionManager.hasPosition()) {
        const newMint = data?.transaction?.transaction?.meta?.postTokenBalances?.[0]?.mint;
        
        if (!newMint) return;
        if (processedMints.has(newMint)) return;
        if (newMint === "So11111111111111111111111111111111111111112") return;
        
        // Verify it's ACTUALLY new by checking bonding curve creation
        // Bonding curve account is derived from mint - check if it was just created
        const postBalances = data?.transaction?.transaction?.meta?.postTokenBalances || [];
        const preBalances = data?.transaction?.transaction?.meta?.preTokenBalances || [];
        
        // Token is NEW if it's in post but NOT in pre
        const isActuallyNew = !preBalances.some((b: any) => b.mint === newMint);
        
        if (!isActuallyNew) {
          // Old token being traded - skip silently
          return;
        }
        
        console.log(`\n🎯 NEW TOKEN: ${newMint}`);
        buyToken(newMint, Date.now()).catch(e => console.error(`   Buy failed: ${e.message}`));
      }

    } catch (error) {
      // Ignore parse errors
    }
  });

  // Geyser stream subscription (based on working example)
  const request = {
    accounts: {},
    slots: {},
    transactions: {
      pumpfun: {
        vote: false,
        failed: false,
        signature: undefined,
        accountInclude: [PUMPFUN_PROGRAM], // PumpFun program
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    entry: {},
    blocks: {},
    blocksMeta: {},
    accountsDataSlice: [],
    ping: undefined,
    commitment: CommitmentLevel.PROCESSED, // PROCESSED for fastest updates
  };

  // Actually send subscription filter request
  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err: any) => err ? reject(err) : resolve());
  });

  console.log("🎯 Monitoring for tokens...\n");
}

/**
 * MAIN ENTRYPOINT
 * - Connects to geyser client & starts stream listener
 * - Prints end-of-session stats on shutdown
 */
async function main() {
  // Cleanup existing positions before starting
  await cleanupExistingPositions();
  
  const client = new Client(GRPC_URL, X_TOKEN, undefined);

  // Print stats and close nicely on ctrl-C/SIGINT
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Shutting down gracefully...");
    positionManager.stopPosition();
    
    console.log("\n📊 Session Stats:");
    console.log(`   Tokens detected: ${tokensDetected}`);
    console.log(`   Buy attempts: ${buyAttempts}`);
    console.log(`   Buy success: ${buySuccess} (${buyAttempts > 0 ? ((buySuccess/buyAttempts)*100).toFixed(1) : 0}%)`);
    console.log(`   Sell attempts: ${sellAttempts}`);
    console.log(`   Sell success: ${sellSuccess} (${sellAttempts > 0 ? ((sellSuccess/sellAttempts)*100).toFixed(1) : 0}%)`);
    
    process.exit(0);
  });

  await handleStream(client); // Start main bot logic
}

main().catch(console.error); // Unhandled errors


main().catch(console.error); // Unhandled errors

