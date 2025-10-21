import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, type Commitment, type SendOptions, type SimulatedTransactionResponse } from "@solana/web3.js";
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
/**
 * Creates Solana RPC, WebSocket, and Jito clients based on configuration.
 * Handles keypair loading, connection pooling, and retry policies.
 */
export declare function createSolanaClients(config: FreshSniperConfig): Promise<SolanaClients>;
/**
 * Simulates a transaction and returns the result.
 */
export declare function simulateTransaction(connection: Connection, transaction: Transaction | VersionedTransaction, commitment?: Commitment): Promise<SimulatedTransactionResponse>;
/**
 * Sends a transaction with retry logic and exponential backoff.
 */
export declare function sendTransactionWithRetry(connection: Connection, transaction: Transaction, signers: Keypair[], options?: SendOptions, retryPolicy?: RetryPolicy): Promise<string>;
/**
 * Waits for a transaction to be confirmed with timeout.
 */
export declare function waitForConfirmation(connection: Connection, signature: string, commitment?: Commitment, timeoutMs?: number): Promise<boolean>;
/**
 * Creates a connection with fallback RPC endpoints.
 * Automatically switches to fallback on connection failures.
 */
export declare class ConnectionPool {
    private connections;
    private currentIndex;
    private readonly commitment;
    constructor(rpcUrls: string[], commitment?: Commitment);
    /**
     * Gets the current active connection.
     */
    getConnection(): Connection;
    /**
     * Switches to the next available RPC endpoint.
     */
    switchToNextEndpoint(): Connection;
    /**
     * Executes an RPC call with automatic fallback on failure.
     */
    executeWithFallback<T>(operation: (connection: Connection) => Promise<T>, maxRetries?: number): Promise<T>;
}
/**
 * Creates a connection pool with primary and fallback RPCs from config.
 */
export declare function createConnectionPool(config: FreshSniperConfig): ConnectionPool;
