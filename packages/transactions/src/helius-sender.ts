/**
 * Helius Sender Integration
 * 
 * Routes all transaction sends through Helius Sender for ultra-fast submission.
 * https://docs.helius.dev/guides/sending-transactions-on-solana
 */

import {
  Connection,
  Transaction,
  VersionedTransaction,
  SendOptions,
  TransactionSignature,
  Commitment,
  Finality,
  SendTransactionError,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

// Helius Sender tip addresses (validators)
const HELIUS_TIP_ADDRESSES = [
  "4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE",
  "D2L6yPZ2FmmmTKPgzaMKdhu6EWZcTpLy1Vhx8uvZe7NZ",
  "9bnz4RShgq1hAnLnZbP8kbgBg1kEmcJBYQq3gQbmnSta",
  "5VY91ws6B2hMmBFRsXkoAAdsPHBJwRfBht4DXox3xkwn",
  "2nyhqdwKcJZR2vcqCyrYsaPVdAnFoJjiksCXJ7hfEYgD",
  "2q5pghRs6arqVjRvT5gfgWfWcHWmw1ZuCzphgd5KfWGJ",
  "wyvPkWjVZz1M8fHQnMMCDTQDbkManefNNhweYk5WkcF",
  "3KCKozbAaF75qEU33jtzozcJ29yJuaLJTy2jFdzUY8bT",
  "4vieeGHPYPG2MmyPRcYjdiDmmhN3ww7hsFNap8pVN3Ey",
  "4TQLFNWK8AovT1gFvda5jfw2oJeRMKEmw7aH6MGBJ3or",
];

export interface HeliusSenderConfig {
  apiKey: string;
  rpcEndpoint?: string; // Standard RPC for reads
  commitment?: Commitment;
  tipLamports?: number; // Tip amount (default 0.001 SOL = 1000000 lamports)
}

/**
 * Helius Sender Connection
 * 
 * Extends Connection to route sendTransaction/sendRawTransaction through Helius Sender.
 * All other RPC methods use standard endpoint for reads.
 */
export class HeliusSenderConnection extends Connection {
  private heliusSenderUrl: string;
  private heliusApiKey: string;
  private tipLamports: number;
  private enableTip: boolean = true; // Can be toggled per transaction type

  constructor(config: HeliusSenderConfig) {
    // Standard RPC endpoint for reads (account info, etc)
    const rpcUrl = config.rpcEndpoint || `https://mainnet.helius-rpc.com/?api-key=${config.apiKey}`;
    super(rpcUrl, config.commitment || "confirmed");

    this.heliusApiKey = config.apiKey;
    // Use standard Helius RPC with api-key, not separate sender endpoint
    this.heliusSenderUrl = `https://mainnet.helius-rpc.com/?api-key=${config.apiKey}`;
    this.tipLamports = config.tipLamports || 1000000; // 0.001 SOL default
  }

  /**
   * Enable or disable tip for next transaction
   */
  setTipEnabled(enabled: boolean): void {
    this.enableTip = enabled;
  }

  /**
   * Pick a random tip address
   */
  private getRandomTipAddress(): PublicKey {
    const randomIndex = Math.floor(Math.random() * HELIUS_TIP_ADDRESSES.length);
    return new PublicKey(HELIUS_TIP_ADDRESSES[randomIndex]);
  }

  /**
   * Add tip instruction to transaction
   */
  private addTipToTransaction(transaction: Transaction, payer: PublicKey): Transaction {
    const tipInstruction = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: this.getRandomTipAddress(),
      lamports: this.tipLamports,
    });
    
    // Add tip as last instruction
    transaction.add(tipInstruction);
    return transaction;
  }

  /**
   * Override sendRawTransaction to route through Helius with optimized settings
   */
  override async sendRawTransaction(
    rawTransaction: Buffer | Uint8Array | Array<number>,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    const serializedTx = Buffer.from(rawTransaction).toString("base64");

    try {
      const response = await fetch(this.heliusSenderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendTransaction",
          params: [
            serializedTx,
            {
              encoding: "base64",
              skipPreflight: true,
              maxRetries: 0,
              preflightCommitment: options?.preflightCommitment || "confirmed",
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius Sender HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Helius Sender error: ${data.error.message}`);
      }

      return data.result as TransactionSignature;
    } catch (error) {
      if (error instanceof SendTransactionError) {
        throw error;
      }
      throw new Error(`Helius Sender failed: ${(error as Error).message}`);
    }
  }

  /**
   * Override sendTransaction to optionally add tip and route through Helius Sender
   * 
   * To skip tip, pass { skipHeliusTip: true } in options
   */
  override async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    signers?: any,
    options?: SendOptions & { skipHeliusTip?: boolean }
  ): Promise<TransactionSignature> {
    let serialized: Buffer;

    if (transaction instanceof VersionedTransaction) {
      // VersionedTransaction: can't modify, send as-is
      // (Tip should be added by caller before creating VersionedTransaction)
      serialized = Buffer.from(transaction.serialize());
    } else {
      // Legacy transaction: conditionally add tip instruction
      if (!transaction.feePayer) {
        throw new Error("Transaction must have a feePayer to add tip");
      }
      
      // Add tip to transaction if enabled (can be controlled via setTipEnabled or options)
      const shouldAddTip = options?.skipHeliusTip !== undefined 
        ? !options.skipHeliusTip 
        : this.enableTip;
      
      if (shouldAddTip) {
        this.addTipToTransaction(transaction, transaction.feePayer);
      }
      
      // Sign if signers provided
      if (signers && Array.isArray(signers) && signers.length > 0) {
        transaction.sign(...signers);
      }
      serialized = transaction.serialize();
    }

    return this.sendRawTransaction(serialized, options);
  }
}

/**
 * Create a Helius Sender connection
 */
export function createHeliusSenderConnection(
  apiKey: string,
  options?: {
    rpcEndpoint?: string;
    commitment?: Commitment;
    tipLamports?: number; // Default 0.001 SOL (1000000 lamports)
  }
): HeliusSenderConnection {
  return new HeliusSenderConnection({
    apiKey,
    rpcEndpoint: options?.rpcEndpoint,
    commitment: options?.commitment || "confirmed",
    tipLamports: options?.tipLamports || 1000000,
  });
}

/**
 * Helper: Send pre-signed transaction through Helius Sender (fire-and-forget)
 */
export async function sendViaHeliusSender(
  serializedTx: Buffer | Uint8Array,
  apiKey: string
): Promise<TransactionSignature> {
  const heliusSenderUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const serializedB64 = Buffer.from(serializedTx).toString("base64");

  const response = await fetch(heliusSenderUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [
        serializedB64,
        {
          encoding: "base64",
          skipPreflight: true,
          maxRetries: 0,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Helius Sender HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Helius Sender error: ${data.error.message}`);
  }

  return data.result as TransactionSignature;
}

