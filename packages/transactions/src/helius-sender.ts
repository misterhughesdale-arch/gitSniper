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
} from "@solana/web3.js";

export interface HeliusSenderConfig {
  apiKey: string;
  rpcEndpoint?: string; // Standard RPC for reads
  commitment?: Commitment;
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

  constructor(config: HeliusSenderConfig) {
    // Standard RPC endpoint for reads (account info, etc)
    const rpcUrl = config.rpcEndpoint || `https://mainnet.helius-rpc.com/?api-key=${config.apiKey}`;
    super(rpcUrl, config.commitment || "confirmed");

    this.heliusApiKey = config.apiKey;
    this.heliusSenderUrl = "https://sender.helius-rpc.com/fast";
  }

  /**
   * Override sendRawTransaction to route through Helius Sender
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
          Authorization: `Bearer ${this.heliusApiKey}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendTransaction",
          params: [
            serializedTx,
            {
              encoding: "base64",
              skipPreflight: true, // Helius Sender requirement
              maxRetries: 0, // Helius Sender requirement
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
   * Override sendTransaction to serialize and route through Helius Sender
   */
  override async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    signers?: any,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    let serialized: Buffer;

    if (transaction instanceof VersionedTransaction) {
      serialized = Buffer.from(transaction.serialize());
    } else {
      // Legacy transaction - sign if signers provided
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
  }
): HeliusSenderConnection {
  return new HeliusSenderConnection({
    apiKey,
    rpcEndpoint: options?.rpcEndpoint,
    commitment: options?.commitment || "confirmed",
  });
}

/**
 * Helper: Send pre-signed transaction through Helius Sender (fire-and-forget)
 */
export async function sendViaHeliusSender(
  serializedTx: Buffer | Uint8Array,
  apiKey: string
): Promise<TransactionSignature> {
  const heliusSenderUrl = "https://sender.helius-rpc.com/fast";
  const serializedB64 = Buffer.from(serializedTx).toString("base64");

  const response = await fetch(heliusSenderUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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

