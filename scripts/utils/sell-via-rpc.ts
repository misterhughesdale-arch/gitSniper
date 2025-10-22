#!/usr/bin/env node
/**
 * SELL VIA REGULAR RPC (NOT JITO)
 * 
 * Sells all tokens using standard Helius/Shyft RPC
 * No Jito needed for sells - only buys need Jito
 */

import "dotenv/config";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { buildSellTransaction } from "../packages/transactions/src/pumpfun/builders";
import { readFileSync } from "fs";

const HELIUS_RPC = process.env.SOLANA_RPC_PRIMARY!;
const TRADER_KEYPAIR_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";

const keypairData = JSON.parse(readFileSync(TRADER_KEYPAIR_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));

console.log("💰 SELL VIA REGULAR RPC");
console.log("======================\n");
console.log(`Wallet: ${trader.publicKey.toBase58()}`);
console.log(`RPC: ${HELIUS_RPC}\n`);

async function main() {
  const connection = new Connection(HELIUS_RPC, "confirmed");

  // Check SOL balance first
  const balance = await connection.getBalance(trader.publicKey);
  const balanceSol = balance / 1e9;
  console.log(`SOL Balance: ${balanceSol.toFixed(6)} SOL`);
  
  const MIN_SOL = 0.0001; // Only need ~0.0001 SOL per tx
  if (balanceSol < MIN_SOL) {
    console.log(`\n❌ Insufficient SOL for gas fees! Need at least ${MIN_SOL} SOL`);
    console.log(`   Please deposit SOL to: ${trader.publicKey.toBase58()}`);
    process.exit(1);
  }
  
  // Calculate how many sells we can afford
  const maxSells = Math.floor(balanceSol / 0.0001);
  console.log(`Can afford ~${maxSells} sell transactions\n`);

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

  console.log(`Found ${positions.length} tokens with balance to sell\n`);

  let sold = 0;
  let failed = 0;

  for (let i = 0; i < positions.length; i++) {
    const { mint, mintStr, balance } = positions[i];
    
    console.log(`${i + 1}/${positions.length}. ${mintStr.slice(0, 8)}... - ${balance.toLocaleString()} tokens`);

    try {
      // Build sell transaction  
      const { transaction } = await buildSellTransaction({
        connection,
        seller: trader.publicKey,
        mint,
        tokenAmount: balance,
        slippageBps: 5000, // 50% slippage (emergency mode - just get out)
        priorityFeeLamports: 1, // Absolute minimum priority fee
      });

      // Sign transaction
      transaction.sign(trader);

      // Send via REGULAR RPC (not Jito)
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      console.log(`   📤 Sent: ${signature}`);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      
      if (confirmation.value.err) {
        console.log(`   ❌ Failed: ${JSON.stringify(confirmation.value.err)}`);
        failed++;
      } else {
        console.log(`   ✅ Confirmed`);
        sold++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${(error as Error).message}`);
      failed++;
    }

    // Small delay to avoid rate limits
    if (i < positions.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n📊 Results: ${sold}/${positions.length} sold, ${failed} failed`);
}

main().catch(console.error);

