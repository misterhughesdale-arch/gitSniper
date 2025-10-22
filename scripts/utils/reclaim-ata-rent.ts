#!/usr/bin/env node
/**
 * RECLAIM ATA RENT
 * 
 * Closes empty ATAs to reclaim rent (~0.00203 SOL per ATA)
 * Waits until there are at least 3 empty ATAs before running
 */

import "dotenv/config";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createCloseAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync } from "fs";

const HELIUS_RPC = process.env.SOLANA_RPC_PRIMARY!;
const TRADER_KEYPAIR_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";
const MIN_ATAS = 3; // Minimum empty ATAs before reclaiming

const keypairData = JSON.parse(readFileSync(TRADER_KEYPAIR_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));

console.log("💰 RECLAIM ATA RENT");
console.log("===================\n");
console.log(`Wallet: ${trader.publicKey.toBase58()}\n`);

async function main() {
  const connection = new Connection(HELIUS_RPC, "confirmed");

  // Get all token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });

  // Find empty ATAs
  const emptyATAs = tokenAccounts.value
    .filter((accountInfo) => {
      const balance = parseFloat(accountInfo.account.data.parsed.info.tokenAmount.uiAmount);
      return balance === 0;
    })
    .map((accountInfo) => ({
      address: accountInfo.pubkey,
      mint: accountInfo.account.data.parsed.info.mint,
    }));

  console.log(`Total ATAs: ${tokenAccounts.value.length}`);
  console.log(`Empty ATAs: ${emptyATAs.length}\n`);

  if (emptyATAs.length < MIN_ATAS) {
    console.log(`⏸️  Waiting for at least ${MIN_ATAS} empty ATAs`);
    console.log(`   Current: ${emptyATAs.length}`);
    console.log(`   Needed: ${MIN_ATAS - emptyATAs.length} more`);
    return;
  }

  const estimatedRent = emptyATAs.length * 0.00203;
  console.log(`💸 Estimated rent to reclaim: ~${estimatedRent.toFixed(4)} SOL\n`);

  // Create transaction to close all empty ATAs
  const transaction = new Transaction();

  for (const ata of emptyATAs) {
    transaction.add(
      createCloseAccountInstruction(
        ata.address, // account to close
        trader.publicKey, // destination (rent recipient)
        trader.publicKey, // authority
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    console.log(`📌 Closing: ${ata.mint.slice(0, 8)}... (${ata.address.toBase58().slice(0, 8)}...)`);
  }

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = trader.publicKey;

  // Sign and send
  transaction.sign(trader);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
  });

  console.log(`\n📤 Sent: ${signature}`);
  console.log("⏳ Waiting for confirmation...");

  const confirmation = await connection.confirmTransaction(signature, "confirmed");

  if (confirmation.value.err) {
    console.log(`❌ Failed: ${JSON.stringify(confirmation.value.err)}`);
  } else {
    console.log(`✅ Confirmed!`);
    console.log(`💰 Reclaimed: ~${estimatedRent.toFixed(4)} SOL`);
  }
}

main().catch(console.error);

