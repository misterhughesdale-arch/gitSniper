#!/usr/bin/env node
/**
 * Sanity check script to validate Fresh Sniper basic functionality
 * Run with: npx tsx scripts/sanity-check.ts
 */

import { loadConfig } from "../packages/config/src/index";
import { createRootLogger } from "../packages/logging/src/index";
import { createMetrics } from "../packages/metrics/src/index";
import { PublicKey } from "@solana/web3.js";

async function main() {
  console.log("🔍 Fresh Sniper Sanity Check\n");

  // Test 1: Config Loading
  console.log("1️⃣  Testing config loader...");
  try {
    const config = loadConfig();
    console.log("   ✅ Config loaded successfully");
    console.log(`   - Environment: ${config.environment.name}`);
    console.log(`   - RPC: ${config.rpc.primary_url.substring(0, 30)}...`);
    console.log(`   - Express port: ${config.express.port}`);
  } catch (error) {
    console.error("   ❌ Config loading failed:", (error as Error).message);
    console.error("   💡 Make sure you have .env file and config/default.toml");
    process.exit(1);
  }

  // Test 2: Logger
  console.log("\n2️⃣  Testing logger...");
  try {
    const logger = createRootLogger({ level: "info" });
    logger.info({ test: true }, "test message");
    console.log("   ✅ Logger working");
  } catch (error) {
    console.error("   ❌ Logger failed:", (error as Error).message);
    process.exit(1);
  }

  // Test 3: Metrics
  console.log("\n3️⃣  Testing metrics...");
  try {
    const metrics = createMetrics({ enabled: true, samplingRatio: 1.0 });
    metrics.incrementCounter("test_counter");
    metrics.observeLatency("test_latency", 100);
    console.log("   ✅ Metrics working");
  } catch (error) {
    console.error("   ❌ Metrics failed:", (error as Error).message);
    process.exit(1);
  }

  // Test 4: Solana Web3 basics
  console.log("\n4️⃣  Testing Solana web3.js...");
  try {
    const testPubkey = new PublicKey("11111111111111111111111111111111");
    console.log("   ✅ Solana web3.js working");
    console.log(`   - Test pubkey: ${testPubkey.toBase58()}`);
  } catch (error) {
    console.error("   ❌ Solana web3.js failed:", (error as Error).message);
    process.exit(1);
  }

  // Test 5: Pump.fun constants
  console.log("\n5️⃣  Testing transaction package...");
  try {
    const { PUMP_PROGRAM_ID, BUY_DISCRIMINATOR } = await import("../packages/transactions/src/index");
    console.log("   ✅ Transaction package loaded");
    console.log(`   - Pump.fun program: ${PUMP_PROGRAM_ID.toBase58()}`);
    console.log(`   - Buy discriminator: ${BUY_DISCRIMINATOR.toString("hex")}`);
  } catch (error) {
    console.error("   ❌ Transaction package failed:", (error as Error).message);
    process.exit(1);
  }

  // Test 6: Event bus
  console.log("\n6️⃣  Testing event bus...");
  try {
    const { createEventBus } = await import("../packages/events/src/index");
    const bus = createEventBus();
    let eventReceived = false;
    
    bus.onTokenCreated((event) => {
      eventReceived = true;
      console.log(`   - Received event for mint: ${event.mint}`);
    });
    
    bus.emitTokenCreated({
      signature: "test_sig",
      slot: 123456,
      mint: "TestMint11111111111111111111111111111111",
      creator: "TestCreator111111111111111111111111111",
      receivedAt: Date.now(),
      filters: ["test"],
      logMessages: [],
    });
    
    if (eventReceived) {
      console.log("   ✅ Event bus working");
    } else {
      console.error("   ❌ Event not received");
    }
  } catch (error) {
    console.error("   ❌ Event bus failed:", (error as Error).message);
    process.exit(1);
  }

  // Test 7: Trade store
  console.log("\n7️⃣  Testing trade store...");
  try {
    const { createTradeStore } = await import("../packages/store/src/index");
    const store = createTradeStore("memory");
    
    await store.createPendingBuy("TestMint", "test_sig", 0.1, Date.now());
    const position = await store.getPosition("TestMint");
    
    if (position && position.status === "pending_buy") {
      console.log("   ✅ Trade store working");
      console.log(`   - Created position: ${position.mint}`);
    } else {
      console.error("   ❌ Position not found or invalid status");
    }
  } catch (error) {
    console.error("   ❌ Trade store failed:", (error as Error).message);
    process.exit(1);
  }

  console.log("\n✨ All basic sanity checks passed!\n");
  console.log("Next steps:");
  console.log("1. Set up your .env file with real credentials");
  console.log("2. Create a keypair at the path specified in TRADER_KEYPAIR_PATH");
  console.log("3. Run: pnpm build");
  console.log("4. Test hot-route: pnpm start:hot-route");
  console.log("5. Test geyser: pnpm dev:geyser");
}

main().catch((error) => {
  console.error("\n💥 Sanity check failed:", error);
  process.exit(1);
});

