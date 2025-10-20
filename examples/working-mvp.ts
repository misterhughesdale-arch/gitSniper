#!/usr/bin/env node
/**
 * WORKING MVP - Based on stream_pump_fun_new_minted_tokens
 * Stream → Detect → Build → Simulate → Track Metrics
 */

import "dotenv/config";
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { readFileSync } from "fs";

// Pump.fun program address
const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// Load keypair if available (optional for stream-only mode)
let trader: Keypair | null = null;
if (process.env.TRADER_KEYPAIR_PATH) {
  try {
    const keypairData = JSON.parse(readFileSync(process.env.TRADER_KEYPAIR_PATH, "utf-8"));
    trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    console.log(`✅ Loaded trader: ${trader.publicKey.toBase58()}\n`);
  } catch (e) {
    console.log("⚠️  Failed to load trader keypair (stream-only mode)\n");
  }
} else {
  console.log("⚠️  No TRADER_KEYPAIR_PATH set (stream-only mode)\n");
}

// RPC connection - use env var or skip if not set
let connection: Connection | null = null;
if (process.env.SOLANA_RPC_PRIMARY) {
  connection = new Connection(process.env.SOLANA_RPC_PRIMARY, "confirmed");
  console.log(`✅ RPC: ${process.env.SOLANA_RPC_PRIMARY}\n`);
} else {
  console.log("⚠️  No SOLANA_RPC_PRIMARY set (detection only, no tx building)\n");
}

// Metrics
const metrics = {
  tokensDetected: 0,
  txBuilt: 0,
  simSuccess: 0,
  simFailed: 0,
  startTime: Date.now(),
};

/**
 * Handle stream data
 */
async function handleStream(client: Client, args: any) {
  const stream = await client.subscribe();
  console.log("✅ Stream connected - watching for Pump.fun tokens...\n");

  const streamClosed = new Promise<void>((resolve, reject) => {
    stream.on("error", (error) => {
      console.error("❌ Stream error:", error);
      reject(error);
      stream.end();
    });
    stream.on("end", resolve);
    stream.on("close", resolve);
  });

  // Handle data
  stream.on("data", async (data) => {
    const receivedAt = Date.now();

    try {
      if (!data?.transaction) return;
      
      const txInfo = data.transaction.transaction ?? data.transaction;
      const meta = txInfo.meta ?? data.transaction.meta;
      if (!meta) return;

      // Extract newly minted token
      const postBalances = meta.postTokenBalances || [];
      const preBalances = meta.preTokenBalances || [];
      
      // Find new tokens (in post but not in pre)
      const preMints = new Set(preBalances.map((b: any) => b.mint).filter(Boolean));
      const newTokens = postBalances
        .filter((b: any) => b.mint && !preMints.has(b.mint))
        .map((b: any) => ({
          mint: b.mint,
          owner: b.owner,
          amount: b.uiTokenAmount?.amount,
        }));

      if (newTokens.length === 0) return;

      // Process each new token
      for (const token of newTokens) {
        metrics.tokensDetected++;
        const detectionLatency = Date.now() - receivedAt;
        
        console.log(`🪙 TOKEN #${metrics.tokensDetected} DETECTED`);
        console.log(`   Mint: ${token.mint}`);
        console.log(`   Owner: ${token.owner}`);
        console.log(`   Detection: ${detectionLatency}ms`);

        // Build transaction if we have a trader
        if (trader) {
          const buildStart = Date.now();
          
          try {
            // Simple transaction (just for testing)
            const tx = new Transaction();
            tx.feePayer = trader.publicKey;
            
            // Get recent blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            
            const buildTime = Date.now() - buildStart;
            metrics.txBuilt++;
            
            console.log(`   ✅ TX Built: ${buildTime}ms`);
            
            // Simulate
            const simStart = Date.now();
            const simulation = await connection.simulateTransaction(tx);
            const simTime = Date.now() - simStart;
            
            if (simulation.value.err) {
              metrics.simFailed++;
              console.log(`   ❌ Sim Failed: ${JSON.stringify(simulation.value.err)}`);
            } else {
              metrics.simSuccess++;
              console.log(`   ✅ Sim Success: ${simTime}ms | Units: ${simulation.value.unitsConsumed}`);
            }
            
            const totalLatency = Date.now() - receivedAt;
            console.log(`   📊 Total: ${totalLatency}ms`);
            
          } catch (error) {
            console.log(`   ❌ Error: ${(error as Error).message}`);
          }
        }
        
        console.log("");
      }

    } catch (error) {
      console.error("Error processing event:", error);
    }
  });

  // Send subscribe request
  await new Promise<void>((resolve, reject) => {
    stream.write(args, (err: any) => {
      err ? reject(err) : resolve();
    });
  });

  await streamClosed;
}

/**
 * Subscribe with auto-restart
 */
async function subscribeCommand(client: Client, args: any) {
  while (true) {
    try {
      await handleStream(client, args);
    } catch (error) {
      console.error("⚠️  Stream error, restarting in 1 second...", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// Main
async function main() {
  console.log("🚀 WORKING MVP - Pump.fun Token Sniper");
  console.log("======================================\n");

  if (!process.env.GRPC_URL || !process.env.X_TOKEN) {
    console.error("❌ Missing env vars:");
    console.error("   GRPC_URL=grpc.ny.shyft.to:443");
    console.error("   X_TOKEN=your-shyft-api-key");
    process.exit(1);
  }

  console.log(`🔗 RPC: ${process.env.SOLANA_RPC_PRIMARY || "mainnet-beta"}`);
  console.log(`📡 Geyser: ${process.env.GRPC_URL}`);
  console.log(`🎯 Watching: ${PUMPFUN_PROGRAM}\n`);

  const client = new Client(
    process.env.GRPC_URL,
    process.env.X_TOKEN,
    undefined
  );

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

  await subscribeCommand(client, request);
}

// Handle shutdown
process.on("SIGINT", () => {
  console.log("\n\n📊 Final Stats:");
  console.log(`   Tokens Detected: ${metrics.tokensDetected}`);
  console.log(`   TX Built: ${metrics.txBuilt}`);
  console.log(`   Sim Success: ${metrics.simSuccess}`);
  console.log(`   Sim Failed: ${metrics.simFailed}`);
  console.log(`   Runtime: ${Math.floor((Date.now() - metrics.startTime) / 1000)}s`);
  console.log("\n👋 Shutting down...");
  process.exit(0);
});

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});

