import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
  type Commitment,
  type SendOptions,
  type SimulatedTransactionResponse,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FreshSniperConfig } from "@fresh-sniper/config";

export interface SolanaClients {
  rpcConnection: Connection;
  wsConnection: Connection;
  jitoClient: JitoClient | null;
  traderKeypair: Keypair;
  traderPublicKey: PublicKey;
}

export interface JitoClient {
  sendBundle: (transactions: (Transaction | VersionedTransaction)[]) => Promise<string>;
  sendTransaction: (transaction: Transaction | VersionedTransaction, opts?: JitoSendOptions) => Promise<string>;
}

export interface JitoSendOptions {
  tipLamports?: number;
  skipPreflight?: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Creates Solana RPC, WebSocket, and Jito clients based on configuration.
 * Handles keypair loading, connection pooling, and retry policies.
 */
export async function createSolanaClients(config: FreshSniperConfig): Promise<SolanaClients> {
  const commitment: Commitment = config.rpc.commitment as Commitment;

  // Primary RPC connection
  const rpcConnection = new Connection(config.rpc.primary_url, {
    commitment,
    confirmTransactionInitialTimeout: 60000,
  });

  // WebSocket connection (typically same endpoint or dedicated WS endpoint)
  const wsConnection = new Connection(config.rpc.primary_url, {
    commitment,
    wsEndpoint: config.rpc.primary_url.replace("https://", "wss://").replace("http://", "ws://"),
  });

  // Load trader keypair
  const traderKeypair = loadKeypairFromFile(config.wallets.trader_keypair_path);
  const traderPublicKey = traderKeypair.publicKey;

  // Initialize Jito client if enabled
  const jitoClient = config.jito.bundle_enabled
    ? createJitoClient({
        blockEngineUrl: config.jito.block_engine_url,
        tipAccountPubkey: config.jito.tip_account_pubkey,
        priorityFeeLamports: config.jito.priority_fee_lamports,
        rpcConnection,
      })
    : null;

  return {
    rpcConnection,
    wsConnection,
    jitoClient,
    traderKeypair,
    traderPublicKey,
  };
}

/**
 * Loads a Solana keypair from a JSON file.
 */
function loadKeypairFromFile(keypairPath: string): Keypair {
  try {
    const resolvedPath = resolve(process.cwd(), keypairPath);
    const rawData = readFileSync(resolvedPath, "utf-8");
    const secretKey = JSON.parse(rawData) as number[];

    if (!Array.isArray(secretKey) || secretKey.length !== 64) {
      throw new Error(`Invalid keypair format in ${keypairPath}. Expected array of 64 numbers.`);
    }

    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } catch (error) {
    throw new Error(`Failed to load keypair from ${keypairPath}: ${(error as Error).message}`);
  }
}

interface JitoClientConfig {
  blockEngineUrl: string;
  tipAccountPubkey: string;
  priorityFeeLamports: number;
  rpcConnection: Connection;
}

/**
 * Creates a Jito Block Engine client wrapper.
 * Handles transaction submission with tips and bundle support.
 */
function createJitoClient(config: JitoClientConfig): JitoClient {
  // Note: Full Jito SDK integration requires importing jito-js-rpc
  // For now, we provide a stub that can be implemented with actual Jito SDK calls

  const tipAccount = new PublicKey(config.tipAccountPubkey);

  return {
    async sendBundle(transactions: (Transaction | VersionedTransaction)[]): Promise<string> {
      // TODO: Implement actual Jito bundle submission
      // This would use jito-js-rpc's sendBundle method
      throw new Error("Jito bundle submission not yet implemented. Use sendTransaction instead.");
    },

    async sendTransaction(
      transaction: Transaction | VersionedTransaction,
      opts?: JitoSendOptions,
    ): Promise<string> {
      // For now, fall back to standard RPC with priority fee
      // In production, this would route through Jito Block Engine
      const tipLamports = opts?.tipLamports ?? config.priorityFeeLamports;
      const skipPreflight = opts?.skipPreflight ?? false;

      // Add compute budget and priority fee instructions
      // (This is a simplified version; full implementation needs compute budget program)

      if (transaction instanceof Transaction) {
        const sendOptions: SendOptions = {
          skipPreflight,
          preflightCommitment: config.rpcConnection.commitment,
        };

        // Send via standard RPC for now
        // TODO: Route through Jito Block Engine endpoint
        const signature = await config.rpcConnection.sendRawTransaction(transaction.serialize(), sendOptions);
        return signature;
      }

      // For versioned transactions
      const signature = await config.rpcConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight,
        preflightCommitment: config.rpcConnection.commitment,
      });
      return signature;
    },
  };
}

/**
 * Simulates a transaction and returns the result.
 */
export async function simulateTransaction(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
  commitment?: Commitment,
): Promise<SimulatedTransactionResponse> {
  if (transaction instanceof Transaction) {
    const simulation = await connection.simulateTransaction(transaction);
    return simulation.value;
  }

  // For versioned transactions  
  const simulation = await connection.simulateTransaction(transaction);
  return simulation.value;
}

/**
 * Sends a transaction with retry logic and exponential backoff.
 */
export async function sendTransactionWithRetry(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  options?: SendOptions,
  retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<string> {
  let lastError: Error | null = null;
  let delayMs = retryPolicy.initialDelayMs;

  for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
    try {
      const signature = await sendAndConfirmTransaction(connection, transaction, signers, options);
      return signature;
    } catch (error) {
      lastError = error as Error;

      if (attempt < retryPolicy.maxAttempts) {
        await sleep(delayMs);
        delayMs = Math.min(delayMs * retryPolicy.backoffMultiplier, retryPolicy.maxDelayMs);
      }
    }
  }

  throw new Error(
    `Transaction failed after ${retryPolicy.maxAttempts} attempts: ${lastError?.message ?? "unknown error"}`,
  );
}

/**
 * Waits for a transaction to be confirmed with timeout.
 */
export async function waitForConfirmation(
  connection: Connection,
  signature: string,
  commitment: Commitment = "confirmed",
  timeoutMs: number = 60000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await connection.getSignatureStatus(signature);

      if (status.value?.confirmationStatus === commitment || status.value?.confirmationStatus === "finalized") {
        return true;
      }

      if (status.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }
    } catch (error) {
      // Continue polling on transient errors
    }

    await sleep(1000);
  }

  return false;
}

/**
 * Creates a connection with fallback RPC endpoints.
 * Automatically switches to fallback on connection failures.
 */
export class ConnectionPool {
  private connections: Connection[];
  private currentIndex: number = 0;
  private readonly commitment: Commitment;

  constructor(rpcUrls: string[], commitment: Commitment = "confirmed") {
    if (rpcUrls.length === 0) {
      throw new Error("At least one RPC URL is required");
    }

    this.commitment = commitment;
    this.connections = rpcUrls.map(
      (url) =>
        new Connection(url, {
          commitment,
          confirmTransactionInitialTimeout: 60000,
        }),
    );
  }

  /**
   * Gets the current active connection.
   */
  getConnection(): Connection {
    return this.connections[this.currentIndex];
  }

  /**
   * Switches to the next available RPC endpoint.
   */
  switchToNextEndpoint(): Connection {
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return this.getConnection();
  }

  /**
   * Executes an RPC call with automatic fallback on failure.
   */
  async executeWithFallback<T>(operation: (connection: Connection) => Promise<T>, maxRetries?: number): Promise<T> {
    const attempts = maxRetries ?? this.connections.length;
    let lastError: Error | null = null;

    for (let i = 0; i < attempts; i++) {
      try {
        const connection = this.getConnection();
        return await operation(connection);
      } catch (error) {
        lastError = error as Error;
        this.switchToNextEndpoint();
      }
    }

    throw new Error(`All RPC endpoints failed: ${lastError?.message ?? "unknown error"}`);
  }
}

export type { Commitment };

/**
 * Creates a connection pool with primary and fallback RPCs from config.
 */
export function createConnectionPool(config: FreshSniperConfig): ConnectionPool {
  const rpcUrls = [config.rpc.primary_url, ...config.rpc.fallback_urls];
  return new ConnectionPool(rpcUrls, config.rpc.commitment as Commitment);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
