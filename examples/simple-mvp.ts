#!/usr/bin/env node
/**
 * SIMPLE MVP - Based on working gRPC example
 * Just stream → detect → log (no simulation, no sending yet)
 */

require('dotenv').config();
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc";

const PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// Simple metrics tracking
const metrics = {
  eventsReceived: 0,
  tokensDetected: 0,
  startTime: Date.now(),
};

/**
 * Extract minted tokens from transaction metadata
 */
function extractMintedTokens(meta: any): Array<{ mint: string; owner: string }> {
  const preMints = new Set<string>();
  for (const entry of meta.preTokenBalances ?? []) {
    const mint = typeof entry?.mint === "string" ? entry.mint : undefined;
    if (mint) preMints.add(mint);
  }

  const minted: Array<{ mint: string; owner: string }> = [];
  for (const entry of meta.postTokenBalances ?? []) {
    const mint = typeof entry?.mint === "string" ? entry.mint : undefined;
    if (!mint || preMints.has(mint)) continue;

    minted.push({
      mint,
      owner: typeof entry?.owner === "string" ? entry.owner : "",
    });
  }

  return minted;
}

/**
 * Handle stream data
 */
async function handleStream(client: Client) {
  const stream = await client.subscribe();

  console.log("✅ Connected to Geyser stream");
  console.log("🎯 Listening for Pump.fun token creations...\n");

  // Handle errors
  stream.on("error", (error) => {
    console.error("❌ Stream error:", error);
    process.exit(1);
  });

  stream.on("end", () => {
    console.log("⚠️ Stream ended");
  });

  stream.on("close", () => {
    console.log("⚠️ Stream closed");
  });

  // Handle data - REAL EVENTS
  stream.on("data", (data) => {
    const receivedAt = Date.now();
    metrics.eventsReceived++;

    try {
      if (!data?.transaction) return;

      const txInfo = data.transaction.transaction ?? data.transaction;
      const meta = txInfo.meta ?? data.transaction.meta;
      if (!meta) return;

      // Extract minted tokens
      const mintedTokens = extractMintedTokens(meta);
      if (mintedTokens.length === 0) return;

      const slot = data.transaction.slot ?? 0;
      const signature = txInfo.signature ? Buffer.from(txInfo.signature).toString('base64').substring(0, 20) + '...' : 'unknown';

      // Log REAL token creation
      for (const token of mintedTokens) {
        metrics.tokensDetected++;
        
        const detectionLatency = Date.now() - receivedAt;
        const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);

        console.log(`🪙 NEW TOKEN #${metrics.tokensDetected}`);
        console.log(`   Mint: ${token.mint}`);
        console.log(`   Owner: ${token.owner}`);
        console.log(`   Slot: ${slot}`);
        console.log(`   Signature: ${signature}`);
        console.log(`   Detection Latency: ${detectionLatency}ms`);
        console.log(`   Uptime: ${uptime}s | Events: ${metrics.eventsReceived}`);
        console.log('');
      }

    } catch (error) {
      console.error("Error processing event:", error);
    }
  });

  // Send subscription request
  const request = {
    accounts: {},
    slots: {},
    transactions: {
      pumpfun: {
        vote: false,
        failed: false,
        signature: undefined,
        accountInclude: [PUMP_FUN_PROGRAM],
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    blocks: {},
    blocksMeta: {},
    entry: {},
    accountsDataSlice: [],
    ping: undefined,
    commitment: CommitmentLevel.CONFIRMED,
  };

  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err: any) => {
      err ? reject(err) : resolve();
    });
  });

  console.log("📡 Subscription active - watching mainnet...\n");

  // Keep alive
  return new Promise(() => {});
}

// Main
async function main() {
  console.log("🚀 Simple MVP - Pump.fun Token Stream");
  console.log("=====================================\n");

  if (!process.env.GRPC_URL || !process.env.X_TOKEN) {
    console.error("❌ Missing GRPC_URL or X_TOKEN in environment");
    console.error("Set in .env file:");
    console.error("  GRPC_URL=grpc.ny.shyft.to:443");
    console.error("  X_TOKEN=your-shyft-api-key");
    process.exit(1);
  }

  console.log(`🔗 Connecting to: ${process.env.GRPC_URL}`);
  console.log(`🎯 Watching: ${PUMP_FUN_PROGRAM}\n`);

  const client = new Client(
    process.env.GRPC_URL,
    process.env.X_TOKEN,
    undefined
  );

  await handleStream(client);
}

// Handle shutdown
process.on("SIGINT", () => {
  console.log("\n\n📊 Final Stats:");
  console.log(`   Events Received: ${metrics.eventsReceived}`);
  console.log(`   Tokens Detected: ${metrics.tokensDetected}`);
  console.log(`   Runtime: ${Math.floor((Date.now() - metrics.startTime) / 1000)}s`);
  console.log("\n👋 Shutting down...");
  process.exit(0);
});

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});

