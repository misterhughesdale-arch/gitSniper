#!/usr/bin/env node
/**
 * EMERGENCY SELL ALL
 * 
 * Sells ALL tokens from all ATAs in the wallet
 * Use when you need to exit positions quickly
 */

import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { buildSellTransaction } from "../packages/transactions/src/pumpfun/builders";
import { readFileSync } from "fs";

const HELIUS_RPC = process.env.SOLANA_RPC_PRIMARY!;
const JITO_URL = "https://mainnet.block-engine.jito.wtf/api/v1/transactions";
const TRADER_KEYPAIR_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";

const keypairData = JSON.parse(readFileSync(TRADER_KEYPAIR_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));

console.log("🚨 EMERGENCY SELL ALL");
console.log("====================\n");
console.log(`Wallet: ${trader.publicKey.toBase58()}\n`);

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

async function main() {
  const connection = new Connection(HELIUS_RPC, "confirmed");

  // Get all token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });

  const positions = tokenAccounts.value
    .map(acc => {
      const info = acc.account.data.parsed.info;
      return {
        mint: new PublicKey(info.mint),
        mintStr: info.mint,
        balance: parseFloat(info.tokenAmount.uiAmount),
      };
    })
    .filter(p => p.balance > 0);

  console.log(`Found ${positions.length} tokens with balance to sell`);
  console.log(`⏱️  Rate limited: 1 tx/second = ${positions.length} seconds total\n`);

  let sold = 0;
  let failed = 0;

  // Sell ONE AT A TIME with 1 second delay
  for (let i = 0; i < positions.length; i++) {
    const { mint, mintStr, balance } = positions[i];
    
    console.log(`${i + 1}/${positions.length}. ${mintStr.slice(0, 8)}... - ${balance.toLocaleString()} tokens`);

    try {
      // Build sell
      const { transaction } = await buildSellTransaction({
        connection,
        seller: trader.publicKey,
        mint,
        tokenAmount: balance,
        slippageBps: 1000, // 10% slippage for emergency
        priorityFeeLamports: 10000000, // 0.01 SOL priority (high)
      });

      // Sign and send
      transaction.sign(trader);
      const signature = await sendViaJito(transaction.serialize());

      console.log(`   ✅ Sent: ${signature.slice(0, 16)}...`);
      sold++;
    } catch (error) {
      console.log(`   ❌ Error: ${(error as Error).message}`);
      failed++;
    }

    // Wait 1 second before next sell (Jito rate limit)
    if (i < positions.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n📊 Results: ${sold}/${positions.length} sold, ${failed} failed`);
}

main().catch(console.error);

