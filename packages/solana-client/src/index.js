"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionPool = void 0;
exports.createSolanaClients = createSolanaClients;
exports.simulateTransaction = simulateTransaction;
exports.sendTransactionWithRetry = sendTransactionWithRetry;
exports.waitForConfirmation = waitForConfirmation;
exports.createConnectionPool = createConnectionPool;
const web3_js_1 = require("@solana/web3.js");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const DEFAULT_RETRY_POLICY = {
    maxAttempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
};
/**
 * Creates Solana RPC, WebSocket, and Jito clients based on configuration.
 * Handles keypair loading, connection pooling, and retry policies.
 */
async function createSolanaClients(config) {
    const commitment = config.rpc.commitment;
    // Primary RPC connection
    const rpcConnection = new web3_js_1.Connection(config.rpc.primary_url, {
        commitment,
        confirmTransactionInitialTimeout: 60000,
    });
    // WebSocket connection (typically same endpoint or dedicated WS endpoint)
    const wsConnection = new web3_js_1.Connection(config.rpc.primary_url, {
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
function loadKeypairFromFile(keypairPath) {
    try {
        const resolvedPath = (0, node_path_1.resolve)(process.cwd(), keypairPath);
        const rawData = (0, node_fs_1.readFileSync)(resolvedPath, "utf-8");
        const secretKey = JSON.parse(rawData);
        if (!Array.isArray(secretKey) || secretKey.length !== 64) {
            throw new Error(`Invalid keypair format in ${keypairPath}. Expected array of 64 numbers.`);
        }
        return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(secretKey));
    }
    catch (error) {
        throw new Error(`Failed to load keypair from ${keypairPath}: ${error.message}`);
    }
}
/**
 * Creates a Jito Block Engine client wrapper.
 * Handles transaction submission with tips and bundle support.
 */
function createJitoClient(config) {
    // Note: Full Jito SDK integration requires importing jito-js-rpc
    // For now, we provide a stub that can be implemented with actual Jito SDK calls
    const tipAccount = new web3_js_1.PublicKey(config.tipAccountPubkey);
    return {
        async sendBundle(transactions) {
            // TODO: Implement actual Jito bundle submission
            // This would use jito-js-rpc's sendBundle method
            throw new Error("Jito bundle submission not yet implemented. Use sendTransaction instead.");
        },
        async sendTransaction(transaction, opts) {
            // For now, fall back to standard RPC with priority fee
            // In production, this would route through Jito Block Engine
            const tipLamports = opts?.tipLamports ?? config.priorityFeeLamports;
            const skipPreflight = opts?.skipPreflight ?? false;
            // Add compute budget and priority fee instructions
            // (This is a simplified version; full implementation needs compute budget program)
            if (transaction instanceof web3_js_1.Transaction) {
                const sendOptions = {
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
async function simulateTransaction(connection, transaction, commitment) {
    if (transaction instanceof web3_js_1.Transaction) {
        const simulation = await connection.simulateTransaction(transaction, undefined, commitment);
        return simulation.value;
    }
    // For versioned transactions
    const simulation = await connection.simulateTransaction(transaction, { commitment });
    return simulation.value;
}
/**
 * Sends a transaction with retry logic and exponential backoff.
 */
async function sendTransactionWithRetry(connection, transaction, signers, options, retryPolicy = DEFAULT_RETRY_POLICY) {
    let lastError = null;
    let delayMs = retryPolicy.initialDelayMs;
    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
        try {
            const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, signers, options);
            return signature;
        }
        catch (error) {
            lastError = error;
            if (attempt < retryPolicy.maxAttempts) {
                await sleep(delayMs);
                delayMs = Math.min(delayMs * retryPolicy.backoffMultiplier, retryPolicy.maxDelayMs);
            }
        }
    }
    throw new Error(`Transaction failed after ${retryPolicy.maxAttempts} attempts: ${lastError?.message ?? "unknown error"}`);
}
/**
 * Waits for a transaction to be confirmed with timeout.
 */
async function waitForConfirmation(connection, signature, commitment = "confirmed", timeoutMs = 60000) {
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
        }
        catch (error) {
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
class ConnectionPool {
    constructor(rpcUrls, commitment = "confirmed") {
        this.currentIndex = 0;
        if (rpcUrls.length === 0) {
            throw new Error("At least one RPC URL is required");
        }
        this.commitment = commitment;
        this.connections = rpcUrls.map((url) => new web3_js_1.Connection(url, {
            commitment,
            confirmTransactionInitialTimeout: 60000,
        }));
    }
    /**
     * Gets the current active connection.
     */
    getConnection() {
        return this.connections[this.currentIndex];
    }
    /**
     * Switches to the next available RPC endpoint.
     */
    switchToNextEndpoint() {
        this.currentIndex = (this.currentIndex + 1) % this.connections.length;
        return this.getConnection();
    }
    /**
     * Executes an RPC call with automatic fallback on failure.
     */
    async executeWithFallback(operation, maxRetries) {
        const attempts = maxRetries ?? this.connections.length;
        let lastError = null;
        for (let i = 0; i < attempts; i++) {
            try {
                const connection = this.getConnection();
                return await operation(connection);
            }
            catch (error) {
                lastError = error;
                this.switchToNextEndpoint();
            }
        }
        throw new Error(`All RPC endpoints failed: ${lastError?.message ?? "unknown error"}`);
    }
}
exports.ConnectionPool = ConnectionPool;
/**
 * Creates a connection pool with primary and fallback RPCs from config.
 */
function createConnectionPool(config) {
    const rpcUrls = [config.rpc.primary_url, ...config.rpc.fallback_urls];
    return new ConnectionPool(rpcUrls, config.rpc.commitment);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
