#!/usr/bin/env node
/**
 * SELL ALL POSITIONS - Liquidate everything
 * 
 * Sells ALL token balances using PumpFun SDK
 * Ultra-low fees, high slippage for dust
 * 
 * Run: npx tsx scripts/utils/sell-all-positions.ts
 */

import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { sellWithSDK } from "../../packages/transactions/src/pumpfun/sdk-wrapper";
import { readFileSync } from "fs";

// Config
const TRADER_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";
const RPC_URL = process.env.QUICKNODE_HTTP || process.env.SOLANA_RPC_PRIMARY || "https://api.mainnet-beta.solana.com";

// Load wallet
const keypairData = JSON.parse(readFileSync(TRADER_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));
const connection = new Connection(RPC_URL, "confirmed");

console.log("💸 SELL ALL POSITIONS - Liquidate Everything\n");
console.log(`Wallet: ${trader.publicKey.toBase58()}\n`);

async function main() {
  // Get current balance
  const startBalance = await connection.getBalance(trader.publicKey);
  const startSOL = startBalance / 1e9;
  console.log(`💰 Starting balance: ${startSOL.toFixed(6)} SOL\n`);

  // Get all token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });

  console.log(`📊 Found ${tokenAccounts.value.length} token accounts\n`);

  let sellCount = 0;
  let skipCount = 0;

  // Sell each position
  for (const { pubkey, account } of tokenAccounts.value) {
    const tokenAmount = account.data.parsed.info.tokenAmount;
    const balance = parseFloat(tokenAmount.uiAmount);
    const mint = new PublicKey(account.data.parsed.info.mint);

    console.log(`\n🪙 Token: ${mint.toBase58().slice(0, 8)}...`);
    console.log(`   Balance: ${balance.toLocaleString()}`);

    // Skip if empty
    if (balance === 0) {
      console.log(`   ⏭️  Empty - skip`);
      skipCount++;
      continue;
    }

    // Sell with high slippage + low fees
    try {
      console.log(`   💸 Selling ${balance.toLocaleString()} tokens...`);
      
      const result = await sellWithSDK({
        connection,
        seller: trader,
        mint,
        tokenAmount: balance,
        slippageBps: 5000, // 50% slippage for dust (take whatever we can get)
        priorityFeeMicroLamports: 10000, // Ultra-low priority (0.00001 SOL)
        computeUnits: 80000,
      });

      console.log(`   ✅ Sold! TX: ${result.signature.slice(0, 16)}...`);
      console.log(`   🔗 https://solscan.io/tx/${result.signature}`);
      sellCount++;

      // Wait 2s between sells
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.log(`   ❌ Sell failed: ${(error as Error).message}`);
    }
  }

  // Wait for confirmations
  console.log(`\n⏳ Waiting 3s for confirmations...`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Final balance
  const endBalance = await connection.getBalance(trader.publicKey);
  const endSOL = endBalance / 1e9;
  const gained = endSOL - startSOL;

  console.log(`\n\n📊 RESULTS`);
  console.log(`=`.repeat(50));
  console.log(`Positions sold: ${sellCount}`);
  console.log(`Empty accounts: ${skipCount}`);
  console.log(`\n💰 Starting: ${startSOL.toFixed(6)} SOL`);
  console.log(`💰 Ending:   ${endSOL.toFixed(6)} SOL`);
  console.log(`💰 Gained:   ${gained >= 0 ? '+' : ''}${gained.toFixed(6)} SOL\n`);

  if (skipCount > 0) {
    console.log(`💡 Run rent reclaim next:`);
    console.log(`   npx tsx scripts/utils/reclaim-all.ts\n`);
  }
}

main().catch(console.error);

