#!/usr/bin/env node
/**
 * LIST POSITIONS
 * 
 * Shows all current token positions with balances
 */

import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync } from "fs";

const HELIUS_RPC = process.env.SOLANA_RPC_PRIMARY!;
const TRADER_KEYPAIR_PATH = process.env.TRADER_KEYPAIR_PATH || "./keypairs/trader.json";

const keypairData = JSON.parse(readFileSync(TRADER_KEYPAIR_PATH, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));

console.log("📊 CURRENT POSITIONS");
console.log("===================\n");
console.log(`Wallet: ${trader.publicKey.toBase58()}\n`);

async function main() {
  const connection = new Connection(HELIUS_RPC, "confirmed");

  // Get all token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(trader.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });

  const positions = tokenAccounts.value
    .map((accountInfo) => {
      const account = accountInfo.account.data.parsed.info;
      return {
        mint: account.mint,
        balance: parseFloat(account.tokenAmount.uiAmount),
        decimals: account.tokenAmount.decimals,
        ata: accountInfo.pubkey.toBase58(),
      };
    })
    .filter((p) => p.balance > 0);

  console.log(`Total Positions: ${positions.length}\n`);

  positions.forEach((pos, index) => {
    console.log(`${index + 1}. ${pos.mint}`);
    console.log(`   Balance: ${pos.balance.toLocaleString()} tokens`);
    console.log(`   ATA: ${pos.ata.slice(0, 16)}...`);
    console.log();
  });

  // Show empty ATAs
  const emptyATAs = tokenAccounts.value.filter((accountInfo) => {
    const balance = parseFloat(accountInfo.account.data.parsed.info.tokenAmount.uiAmount);
    return balance === 0;
  });

  console.log(`Empty ATAs: ${emptyATAs.length} (can reclaim ~${(emptyATAs.length * 0.00203).toFixed(4)} SOL)`);
}

main().catch(console.error);

