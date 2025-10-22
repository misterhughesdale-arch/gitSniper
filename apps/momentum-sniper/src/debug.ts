#!/usr/bin/env node
/**
 * DEBUG SCRIPT - Test Yellowstone gRPC connection
 * 
 * Run: npx tsx apps/momentum-sniper/src/debug.ts
 */

import "dotenv/config";
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc";

const GRPC_URL = process.env.GRPC_URL!;
const X_TOKEN = process.env.X_TOKEN!;
const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

console.log("🔧 DEBUG MODE - Yellowstone gRPC Test\n");
console.log(`GRPC_URL: ${GRPC_URL}`);
console.log(`X_TOKEN: ${X_TOKEN ? "✅ Set" : "❌ Missing"}`);
console.log(`PumpFun Program: ${PUMPFUN_PROGRAM}\n`);

async function main() {
  const client = new Client(GRPC_URL, X_TOKEN, undefined);
  
  console.log("📡 Connecting to Yellowstone gRPC...");
  const stream = await client.subscribe();
  
  console.log("✅ Stream connected\n");

  let txCount = 0;
  let pumpfunCount = 0;

  stream.on("error", (error) => {
    console.error("❌ Stream error:", error);
  });

  stream.on("data", (data) => {
    txCount++;
    
    // Log every 10th transaction
    if (txCount % 10 === 0) {
      console.log(`📊 Received ${txCount} transactions (${pumpfunCount} PumpFun)`);
    }

    try {
      if (data && data.transaction) {
        const txInfo = data.transaction.transaction ?? data.transaction;
        const meta = txInfo.meta ?? data.transaction.meta;
        
        if (!meta) return;

        // Check if involves PumpFun
        const postBalances = meta.postTokenBalances || [];
        const preBalances = meta.preTokenBalances || [];
        const allBalances = [...postBalances, ...preBalances];
        
        // Check account keys
        const accountKeys = txInfo.message?.accountKeys || [];
        const involvesPumpFun = accountKeys.some((key: any) => {
          const keyStr = typeof key === 'string' ? key : key.toString();
          return keyStr === PUMPFUN_PROGRAM;
        });

        if (involvesPumpFun) {
          pumpfunCount++;
          console.log(`\n🎯 PumpFun TX #${pumpfunCount}`);
          console.log(`   Account keys: ${accountKeys.length}`);
          console.log(`   Post token balances: ${postBalances.length}`);
          console.log(`   Pre token balances: ${preBalances.length}`);
          
          // Check for new mints
          const preMints = new Set(preBalances.map((b: any) => b.mint).filter(Boolean));
          const newMints = postBalances
            .filter((b: any) => b.mint && !preMints.has(b.mint))
            .map((b: any) => b.mint);
          
          if (newMints.length > 0) {
            console.log(`   🪙 NEW TOKENS: ${newMints.join(", ")}`);
          }
        }
      }
    } catch (error) {
      // Ignore parse errors
    }
  });

  // Subscribe to all transactions (no filter)
  const request = {
    accounts: {},
    slots: {},
    transactions: {
      all: {
        vote: false,
        failed: false,
        accountInclude: [], // No filter - get everything
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
    stream.write(request, (err: any) => err ? reject(err) : resolve());
  });

  console.log("🎯 Monitoring ALL transactions (20 seconds)...\n");
  
  // Run for 20 seconds
  setTimeout(() => {
    console.log(`\n\n📊 RESULTS:`);
    console.log(`   Total transactions: ${txCount}`);
    console.log(`   PumpFun transactions: ${pumpfunCount}`);
    console.log(`   Detection rate: ${txCount > 0 ? ((pumpfunCount/txCount)*100).toFixed(2) : 0}%`);
    process.exit(0);
  }, 20000);
}

main().catch(console.error);

