#!/usr/bin/env node
/**
 * SDK SNIPER - Using Official PumpDotFun SDK
 * 
 * Stream → Detect → Buy via Official SDK → Track
 * 
 * Uses the official pumpdotfun-sdk which handles all account complexity
 */

import "dotenv/config";
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PumpFunSDK } from "pumpdotfun-sdk";
import { AnchorProvider } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { readFileSync } from "fs";

const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// Load trader keypair
const keypairData = JSON.parse(readFileSync(process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json", "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));

console.log(`✅ Trader: ${trader.publicKey.toBase58()}`);

// Setup Anchor provider
const connection = new Connection(process.env.SOLANA_RPC_PRIMARY!, "confirmed");
const wallet = new NodeWallet(trader);
const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

// Initialize SDK
const sdk = new PumpFunSDK(provider);

// Config
const config = {
  buyAmountSol: parseFloat(process.env.BUY_AMOUNT_SOL || "0.001"),
  slippageBps: parseInt(process.env.SLIPPAGE_BPS || "500"),
  priorityFee: parseInt(process.env.PRIORITY_FEE || "100000"),
};

// Metrics
const metrics = {
  tokensDetected: 0,
  buyAttempts: 0,
  buySuccess: 0,
  buyFailed: 0,
  startTime: Date.now(),
};

/**
 * Buy token using official SDK
 * Gets creator from transaction to derive bonding curve - NO WAITING
 */
async function buyToken(mintAddress: string, owner: string, creatorAddress: string, receivedAt: number) {
  metrics.tokensDetected++;
  
  console.log(`\n🪙 TOKEN #${metrics.tokensDetected} - ${mintAddress}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Creator: ${creatorAddress}`);
  
  try {
    const mintPubkey = new (await import("@solana/web3.js")).PublicKey(mintAddress);
    
    const buyStart = Date.now();
    metrics.buyAttempts++;
    
    // Use official SDK to buy
    const buyAmountLamports = BigInt(config.buyAmountSol * LAMPORTS_PER_SOL);
    const slippageBasisPoints = BigInt(config.slippageBps);
    
    const result = await sdk.buy(
      trader,
      mintPubkey,
      buyAmountLamports,
      slippageBasisPoints,
      {
        unitLimit: 250000,
        unitPrice: config.priorityFee,
      }
    );
    
    const buyTime = Date.now() - buyStart;
    const totalLatency = Date.now() - receivedAt;
    
    if (result.success) {
      metrics.buySuccess++;
      console.log(`   ✅ BUY SUCCESS: ${result.signature} (${buyTime}ms)`);
      console.log(`   📊 Total: ${totalLatency}ms | Detection → Confirmed`);
    } else {
      metrics.buyFailed++;
      console.log(`   ❌ Buy failed: ${result.error || "unknown"}`);
    }
    
  } catch (error) {
    metrics.buyFailed++;
    metrics.buyAttempts++;
    console.log(`   💥 Error: ${(error as Error).message}`);
  }
}

/**
 * Handle Geyser stream
 */
async function handleStream(client: Client) {
  const stream = await client.subscribe();
  console.log("✅ Stream connected\n");
  
  stream.on("error", (error) => {
    console.error("❌ Stream error:", error);
  });
  
  // Handle data
  stream.on("data", async (data) => {
    const receivedAt = Date.now();
    
    try {
      if (!data?.transaction) return;
      
      const txInfo = data.transaction.transaction ?? data.transaction;
      const meta = txInfo.meta ?? data.transaction.meta;
      if (!meta) return;
      
      // Extract new tokens
      const postBalances = meta.postTokenBalances || [];
      const preBalances = meta.preTokenBalances || [];
      const preMints = new Set(preBalances.map((b: any) => b.mint).filter(Boolean));
      
      // Extract creator from transaction (first account key = signer)
      const accountKeys = txInfo.message?.accountKeys;
      if (!accountKeys || accountKeys.length === 0) return;
      const creator = String(accountKeys[0]);
      
      const newTokens = postBalances
        .filter((b: any) => b.mint && !preMints.has(b.mint))
        .map((b: any) => ({
          mint: b.mint,
          owner: b.owner || "unknown",
        }));
      
      if (newTokens.length === 0) return;
      
      // Process each token with creator (async)
      for (const token of newTokens) {
        buyToken(token.mint, token.owner, creator, receivedAt).catch(e => 
          console.error(`Buy failed: ${e.message}`)
        );
      }
      
    } catch (error) {
      console.error("Stream error:", error);
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
        signature: undefined,
        accountInclude: [PUMPFUN_PROGRAM],
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
    commitment: CommitmentLevel.CONFIRMED,
  };
  
  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err: any) => err ? reject(err) : resolve());
  });
  
  return new Promise(() => {}); // Keep alive
}

// Main
async function main() {
  console.log("🚀 SDK SNIPER - Using Official PumpDotFun SDK");
  console.log("==============================================\n");
  console.log(`💰 Buy Amount: ${config.buyAmountSol} SOL`);
  console.log(`📊 Slippage: ${config.slippageBps / 100}%`);
  console.log(`⚡ Priority Fee: ${config.priorityFee} microlamports`);
  console.log(`🎯 Trader: ${trader.publicKey.toBase58()}`);
  console.log(`🔗 RPC: ${process.env.SOLANA_RPC_PRIMARY}`);
  console.log(`📡 Watching: ${PUMPFUN_PROGRAM}\n`);
  
  const client = new Client(process.env.GRPC_URL!, process.env.X_TOKEN!, undefined);
  await handleStream(client);
}

// Shutdown
process.on("SIGINT", () => {
  const runtime = Math.floor((Date.now() - metrics.startTime) / 1000);
  console.log("\n\n📊 FINAL STATS");
  console.log("==============");
  console.log(`Runtime: ${runtime}s`);
  console.log(`Tokens Detected: ${metrics.tokensDetected}`);
  console.log(`Buy Attempts: ${metrics.buyAttempts}`);
  console.log(`  - Success: ${metrics.buySuccess}`);
  console.log(`  - Failed: ${metrics.buyFailed}`);
  console.log(`Success Rate: ${metrics.buyAttempts ? Math.round((metrics.buySuccess / metrics.buyAttempts) * 100) : 0}%`);
  process.exit(0);
});

main().catch(error => {
  console.error("💥 Fatal:", error);
  process.exit(1);
});

