#!/usr/bin/env node
/**
 * TEST SELL - Buy a tiny amount then immediately sell
 * 
 * This validates the sell transaction builder works end-to-end
 */

import "dotenv/config";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { buildSellTransaction } from "../packages/transactions/src/pumpfun/builders";
import { readFileSync } from "fs";

const HELIUS_RPC = process.env.SOLANA_RPC_PRIMARY!;
const JITO_URL = "https://mainnet.block-engine.jito.wtf/api/v1/transactions";
const TRADER_KEYPAIR_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";

// Load trader
const keypairData = JSON.parse(readFileSync(TRADER_KEYPAIR_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));

console.log(`🎯 Test Sell Execution`);
console.log(`Trader: ${trader.publicKey.toBase58()}\n`);

/**
 * Get token balance for a specific mint
 */
async function getTokenBalance(connection: Connection, wallet: PublicKey, mint: PublicKey): Promise<number> {
  try {
    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
    
    const [ata] = PublicKey.findProgramAddressSync(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const account = await getAccount(connection, ata);
    return Number(account.amount) / 1e6; // 6 decimals
  } catch (error) {
    return 0;
  }
}

/**
 * Send transaction via Jito
 */
async function sendViaJito(signedTx: Buffer): Promise<string> {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [signedTx.toString("base64"), { encoding: "base64" }],
  };

  const response = await fetch(JITO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function testSell(mintAddress: string) {
  const connection = new Connection(HELIUS_RPC, "confirmed");
  const mint = new PublicKey(mintAddress);
  
  console.log(`🪙 Mint: ${mintAddress}`);
  
  // Check balance
  const balance = await getTokenBalance(connection, trader.publicKey, mint);
  console.log(`💰 Current Balance: ${balance.toLocaleString()} tokens\n`);
  
  if (balance === 0) {
    console.log("❌ No tokens to sell!");
    return;
  }
  
  // Build sell transaction
  console.log("⚙️  Building sell transaction...");
  const start = Date.now();
  
  const { transaction, metadata } = await buildSellTransaction({
    connection,
    seller: trader.publicKey,
    mint,
    tokenAmount: balance, // Sell ALL tokens
    slippageBps: 500, // 5% slippage
    priorityFeeLamports: 10000, // 10k microlamports = 0.00001 SOL
    computeUnits: 250000,
  });
  
  const buildTime = Date.now() - start;
  console.log(`   ✅ Built in ${buildTime}ms`);
  console.log(`   📊 Selling: ${balance.toLocaleString()} tokens`);
  console.log(`   📊 Min SOL out: ${metadata.estimatedFee} SOL (fee)`);
  
  // Simulate
  console.log("\n🧪 Simulating...");
  const simStart = Date.now();
  const simulation = await connection.simulateTransaction(transaction);
  const simTime = Date.now() - simStart;
  
  if (simulation.value.err) {
    console.log(`   ❌ Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    return;
  }
  
  const units = simulation.value.unitsConsumed || 0;
  console.log(`   ✅ Sim OK in ${simTime}ms | Units: ${units.toLocaleString()}`);
  
  // Sign and send
  console.log("\n📤 Sending via Jito...");
  transaction.sign(trader);
  const serialized = transaction.serialize();
  
  const sendStart = Date.now();
  const signature = await sendViaJito(serialized);
  const sendTime = Date.now() - sendStart;
  
  console.log(`   ✅ Sent in ${sendTime}ms`);
  console.log(`   📝 Signature: ${signature}`);
  
  // Wait for confirmation
  console.log("\n⏳ Waiting for confirmation...");
  const confirmStart = Date.now();
  const confirmation = await connection.confirmTransaction(signature, "confirmed");
  const confirmTime = Date.now() - confirmStart;
  
  if (confirmation.value.err) {
    console.log(`   ❌ Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  } else {
    console.log(`   🎉 CONFIRMED in ${confirmTime}ms`);
    
    // Check new balance
    const newBalance = await getTokenBalance(connection, trader.publicKey, mint);
    console.log(`   💰 New Balance: ${newBalance.toLocaleString()} tokens`);
    console.log(`   📊 Sold: ${(balance - newBalance).toLocaleString()} tokens`);
  }
  
  const totalTime = Date.now() - start;
  console.log(`\n⏱️  Total Time: ${totalTime}ms`);
  console.log(`   Build: ${buildTime}ms`);
  console.log(`   Sim: ${simTime}ms`);
  console.log(`   Send: ${sendTime}ms`);
  console.log(`   Confirm: ${confirmTime}ms`);
}

// Get mint from command line or use a recent buy
const mintArg = process.argv[2];
if (!mintArg) {
  console.log("❌ Usage: pnpm test:sell <mint_address>");
  console.log("\nExample:");
  console.log("  pnpm test:sell 2cGpKGaww7xYMH5ybMxrV9gcHnm9NyCbESKAE24wT8HiA7XLpEsDnCcmbuQDw7rqZaYLYSevZmUqDLRR8UMSum2i");
  process.exit(1);
}

testSell(mintArg).catch(console.error);

