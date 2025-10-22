#!/usr/bin/env node
/**
 * TX LATENCY TEST
 * 
 * Measures actual transaction landing time and success rate:
 * - Time from send → confirmed on-chain
 * - Success rate per provider
 * - Comparison: Helius Sender vs Standard RPC
 * - Different priority fee levels
 * 
 * Run: npx tsx scripts/monitoring/tx-latency-test.ts
 */

import "dotenv/config";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  sendAndConfirmTransaction,
  PublicKey,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { createHeliusSenderConnection } from "../../packages/transactions/src/helius-sender";
import { readFileSync } from "fs";

// ====== CONFIG ======
const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const RPC_URL = process.env.SOLANA_RPC_PRIMARY || "https://api.mainnet-beta.solana.com";
const QUICKNODE_HTTP = process.env.QUICKNODE_HTTP;
const TRADER_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";
const NUM_TESTS = parseInt(process.env.NUM_TX_TESTS || "1");
const TEST_AMOUNT_SOL = 0.0001; // Tiny amount for testing
const DELAY_BETWEEN_TX = 2000; // 2s between tests

// ====== LOAD WALLET ======
const keypairData = JSON.parse(readFileSync(TRADER_PATH, "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));

// ====== METRICS ======
interface TxResult {
  method: string;
  signature: string;
  sendTime: number;
  confirmTime?: number;
  latencyMs?: number;
  success: boolean;
  error?: string;
  priorityFeeMicroLamports: number;
}

const results: TxResult[] = [];

// ====== TEST FUNCTIONS ======

/**
 * Send a tiny transfer TX and measure latency
 */
async function testTransaction(
  connection: Connection,
  method: string,
  priorityFeeMicroLamports: number,
  skipHeliusTip: boolean = false
): Promise<TxResult> {
  const result: TxResult = {
    method,
    signature: "",
    sendTime: Date.now(),
    success: false,
    priorityFeeMicroLamports,
  };

  try {
    // Get recent blockhash (exactly like Helius docs)
    const { value: { blockhash, lastValidBlockHeight } } = await connection.getLatestBlockhashAndContext("confirmed");

    const TIP_ACCOUNTS = [
      "4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE",
      "D2L6yPZ2FmmmTKPgzaMKdhu6EWZcTpLy1Vhx8uvZe7NZ",
    ];

    // Build instructions array (exactly like Helius docs)
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeMicroLamports }),
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: Math.floor(TEST_AMOUNT_SOL * LAMPORTS_PER_SOL),
      }),
    ];

    // Add tip transfer if not skipping (must be included for Helius Sender)
    if (!skipHeliusTip) {
      const tipAccount = TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(tipAccount),
          lamports: 0.001 * LAMPORTS_PER_SOL, // 0.001 SOL tip
        })
      );
    }

    // Build VersionedTransaction (exactly like Helius docs)
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        instructions,
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
      }).compileToV0Message()
    );

    // Sign transaction
    transaction.sign([wallet]);

    // Send and start timer
    const sendTime = Date.now();
    result.sendTime = sendTime;

    // Send directly via RPC endpoint
    // For HeliusSenderConnection, use the sender endpoint; otherwise use standard RPC
    const endpoint = (connection as any).getSenderUrl 
      ? (connection as any).getSenderUrl() 
      : ((connection as any).rpcEndpoint || connection['_rpcEndpoint']);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method: 'sendTransaction',
        params: [
          Buffer.from(transaction.serialize()).toString('base64'),
          {
            encoding: 'base64',
            skipPreflight: true,
            maxRetries: 0,
          }
        ]
      })
    });

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message);
    }

    const signature = json.result;
    result.signature = signature;

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, "confirmed");

    const confirmTime = Date.now();
    result.confirmTime = confirmTime;
    result.latencyMs = confirmTime - sendTime;
    result.success = !confirmation.value.err;

    if (confirmation.value.err) {
      result.error = JSON.stringify(confirmation.value.err);
    }

  } catch (error) {
    result.success = false;
    result.error = (error as Error).message;
    result.confirmTime = Date.now();
    result.latencyMs = result.confirmTime - result.sendTime;
  }

  return result;
}

/**
 * Run test suite
 */
async function runTests() {
  console.log("🚀 TX LATENCY BENCHMARK");
  console.log("======================\n");
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Tests per method: ${NUM_TESTS}`);
  console.log(`Test amount: ${TEST_AMOUNT_SOL} SOL`);
  console.log(`Delay between TX: ${DELAY_BETWEEN_TX}ms\n`);

  // Check balance
  const standardConnection = new Connection(RPC_URL, "confirmed");
  const balance = await standardConnection.getBalance(wallet.publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;
  
  if (balanceSOL < 0.01) {
    console.error(`❌ Insufficient balance: ${balanceSOL.toFixed(4)} SOL`);
    console.error(`   Need at least 0.01 SOL for testing`);
    process.exit(1);
  }
  
  console.log(`Balance: ${balanceSOL.toFixed(4)} SOL\n`);

  // Test configurations
  const testConfigs = [
    {
      name: "Standard RPC (50k priority)",
      connection: standardConnection,
      priorityFee: 50000,
      skipTip: true,
    },
    {
      name: "Helius Sender + 0.001 SOL tip (50k priority)",
      connection: createHeliusSenderConnection(HELIUS_API_KEY, {
        rpcEndpoint: RPC_URL,
        commitment: "confirmed",
      }),
      priorityFee: 50000,
      skipTip: false,
    },
    {
      name: "Helius Sender no tip (50k priority)",
      connection: createHeliusSenderConnection(HELIUS_API_KEY, {
        rpcEndpoint: RPC_URL,
        commitment: "confirmed",
      }),
      priorityFee: 50000,
      skipTip: true,
    },
  ];

  // Add QuickNode if configured
  if (QUICKNODE_HTTP) {
    testConfigs.push({
      name: "QuickNode RPC (50k priority)",
      connection: new Connection(QUICKNODE_HTTP, "confirmed"),
      priorityFee: 50000,
      skipTip: true,
    });
  }

  // Run tests for each configuration
  for (const config of testConfigs) {
    console.log(`\n📊 Testing: ${config.name}`);
    console.log("─".repeat(60));

    for (let i = 0; i < NUM_TESTS; i++) {
      const result = await testTransaction(
        config.connection,
        config.name,
        config.priorityFee,
        config.skipTip
      );

      results.push(result);

      const statusIcon = result.success ? "✅" : "❌";
      const latency = result.latencyMs ? `${result.latencyMs}ms` : "timeout";
      
      console.log(`   ${statusIcon} TX ${i + 1}/${NUM_TESTS}: ${latency} ${result.success ? "" : `(${result.error})`}`);
      console.log(`      Signature: ${result.signature.slice(0, 16)}...`);

      // Wait between transactions
      if (i < NUM_TESTS - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TX));
      }
    }
  }

  // Print summary
  printSummary();
}

/**
 * Calculate and print statistics
 */
function printSummary() {
  console.log("\n\n📈 SUMMARY");
  console.log("=".repeat(80));

  // Group by method
  const byMethod = new Map<string, TxResult[]>();
  for (const result of results) {
    if (!byMethod.has(result.method)) {
      byMethod.set(result.method, []);
    }
    byMethod.get(result.method)!.push(result);
  }

  // Calculate stats per method
  for (const [method, methodResults] of byMethod) {
    const successful = methodResults.filter(r => r.success);
    const successRate = (successful.length / methodResults.length) * 100;
    
    const latencies = successful
      .map(r => r.latencyMs!)
      .filter(l => l !== undefined)
      .sort((a, b) => a - b);

    if (latencies.length === 0) {
      console.log(`\n❌ ${method}`);
      console.log(`   Success rate: 0%`);
      console.log(`   No successful transactions`);
      continue;
    }

    const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const median = latencies[Math.floor(latencies.length / 2)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const min = latencies[0];
    const max = latencies[latencies.length - 1];

    console.log(`\n✅ ${method}`);
    console.log(`   Success rate: ${successRate.toFixed(1)}% (${successful.length}/${methodResults.length})`);
    console.log(`   Latency (ms):`);
    console.log(`      Min:    ${min.toFixed(0)}ms`);
    console.log(`      Median: ${median.toFixed(0)}ms`);
    console.log(`      Avg:    ${avg.toFixed(0)}ms`);
    console.log(`      p95:    ${p95.toFixed(0)}ms`);
    console.log(`      p99:    ${p99.toFixed(0)}ms`);
    console.log(`      Max:    ${max.toFixed(0)}ms`);
  }

  // Recommendation
  console.log("\n\n💡 RECOMMENDATION");
  console.log("=".repeat(80));
  
  const heliusTip = byMethod.get("Helius Sender + 0.001 SOL tip (50k priority)");
  const heliusNoTip = byMethod.get("Helius Sender no tip (50k priority)");
  const standardRpc = byMethod.get("Standard RPC (50k priority)");

  if (heliusTip && heliusNoTip && standardRpc) {
    const heliusTipAvg = heliusTip.filter(r => r.success).reduce((sum, r) => sum + r.latencyMs!, 0) / heliusTip.filter(r => r.success).length;
    const standardAvg = standardRpc.filter(r => r.success).reduce((sum, r) => sum + r.latencyMs!, 0) / standardRpc.filter(r => r.success).length;
    
    const improvement = standardAvg - heliusTipAvg;
    const improvementPercent = (improvement / standardAvg) * 100;

    if (improvement > 0) {
      console.log(`Helius Sender + tip is ${improvement.toFixed(0)}ms faster (${improvementPercent.toFixed(1)}% improvement)`);
      console.log(`Use for: BUYS (time-sensitive, worth the 0.001 SOL tip)`);
    } else {
      console.log(`Standard RPC is comparable to Helius Sender`);
    }
    
    console.log(`\nFor SELLS: Use Helius Sender WITHOUT tip (save 0.001 SOL, similar speed)`);
  }

  console.log("\n");
}

// ====== RUN ======
runTests().catch(console.error);

