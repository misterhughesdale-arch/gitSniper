#!/usr/bin/env tsx
/**
 * MVP SNIPER - REAL Geyser Stream with Simulation
 * 
 * 1. Connect to REAL Geyser stream
 * 2. Detect REAL new Pump.fun token creations
 * 3. Build REAL buy transaction
 * 4. Simulate with preflight: true
 * 5. STOP (no actual sending)
 * 6. Track latency & success metrics
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import YellowstoneClient, {
  CommitmentLevel,
  type SubscribeRequest,
  type SubscribeUpdate,
} from "@triton-one/yellowstone-grpc";
import { loadConfig } from "../packages/config/src/index";
import { createRootLogger } from "../packages/logging/src/index";
import { createMetrics } from "../packages/metrics/src/index";
import { buildBuyTransaction } from "../packages/transactions/src/index";

// Load config
const config = loadConfig();
const logger = createRootLogger({ level: config.logging.level });
const metrics = createMetrics({
  enabled: config.metrics.enabled,
  samplingRatio: 1.0,
  reportFilePath: "logs/mvp-metrics.log",
});

// Load trader keypair
const keypairData = JSON.parse(readFileSync(config.wallets.trader_keypair_path, "utf-8"));
const trader = Keypair.fromSecretKey(Uint8Array.from(keypairData));

// Create connection
const connection = new Connection(config.rpc.primary_url, {
  commitment: config.rpc.commitment as any,
});

logger.info({ 
  trader: trader.publicKey.toBase58(),
  geyserEndpoint: config.geyser.endpoint,
}, "MVP Sniper initialized - REAL STREAM MODE");

/**
 * Extract minted tokens from Geyser transaction update
 * Returns REAL data - full addresses, no truncation
 */
function extractMintedTokens(meta: any): Array<{ 
  mint: string; 
  owner: string;
  programId: string;
  amountRaw: string;
  decimals: number;
}> {
  const preMints = new Set<string>();
  for (const entry of meta.preTokenBalances ?? []) {
    const mint = typeof entry?.mint === "string" ? entry.mint : undefined;
    if (mint) preMints.add(mint);
  }

  const minted: Array<{ mint: string; owner: string; programId: string; amountRaw: string; decimals: number }> = [];
  for (const entry of meta.postTokenBalances ?? []) {
    const mint = typeof entry?.mint === "string" ? entry.mint : undefined;
    if (!mint || preMints.has(mint)) continue;

    minted.push({
      mint,
      owner: typeof entry?.owner === "string" ? entry.owner : "",
      programId: typeof entry?.programId === "string" ? entry.programId : "",
      amountRaw: entry?.uiTokenAmount?.amount ?? "0",
      decimals: entry?.uiTokenAmount?.decimals ?? 0,
    });
  }

  return minted;
}

/**
 * Decode signature bytes to base58 string
 */
function decodeSignature(signature: unknown): string | null {
  if (!signature) return null;
  
  if (typeof signature === "string") {
    return signature;
  }
  
  if (signature instanceof Uint8Array || Array.isArray(signature)) {
    const bytes = signature instanceof Uint8Array ? signature : Uint8Array.from(signature as number[]);
    // Simple base58 encoding
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const digits = [0];
    
    for (const byte of bytes) {
      let carry = byte;
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] << 8;
        digits[j] = carry % 58;
        carry = Math.floor(carry / 58);
      }
      while (carry > 0) {
        digits.push(carry % 58);
        carry = Math.floor(carry / 58);
      }
    }
    
    let result = "";
    for (let i = digits.length - 1; i >= 0; i--) {
      result += alphabet[digits[i]];
    }
    return result;
  }
  
  return null;
}

/**
 * Handle new token creation - BUILD AND SIMULATE
 * REAL DATA ONLY - full addresses, no truncation
 */
async function handleTokenCreation(
  mint: string, 
  creator: string,
  slot: number, 
  signature: string | null,
  tokenInfo: { owner: string; programId: string; amountRaw: string; decimals: number },
  detectedAt: number
) {
  const pipelineStart = Date.now();
  
  // Log FULL addresses - NO TRUNCATION
  logger.info({ 
    mint,                    // FULL 44-char address
    creator,                 // FULL creator address
    owner: tokenInfo.owner,  // FULL owner address
    programId: tokenInfo.programId,
    slot,
    signature,               // FULL signature
    amountRaw: tokenInfo.amountRaw,
    decimals: tokenInfo.decimals,
  }, "🎯 REAL TOKEN DETECTED");
  
  try {
    // Build REAL transaction
    const buildStart = Date.now();
    const { transaction, metadata } = await buildBuyTransaction({
      connection,
      buyer: trader.publicKey,
      mint: new PublicKey(mint),
      amountSol: config.strategy.buy_amount_sol,
      slippageBps: config.strategy.max_slippage_bps,
      priorityFeeLamports: config.jito.priority_fee_lamports,
    });
    const buildTimeMs = Date.now() - buildStart;
    metrics.observeLatency("transaction_build_ms", buildTimeMs);
    
    logger.info({ 
      mint,
      buildTimeMs,
      feePayer: trader.publicKey.toBase58(),  // FULL address
    }, "✅ Transaction built with REAL data");
    
    // SIMULATE (preflight: true)
    const simStart = Date.now();
    const simulation = await connection.simulateTransaction(transaction, undefined, "confirmed");
    const simTimeMs = Date.now() - simStart;
    metrics.observeLatency("transaction_simulate_ms", simTimeMs);
    
    if (simulation.value.err) {
      logger.error({ 
        mint,
        creator,
        slot,
        signature,
        error: simulation.value.err,
        logs: simulation.value.logs,  // FULL logs
      }, "❌ Simulation failed");
      
      metrics.incrementCounter("simulation_failures");
      metrics.reportLoopSummary({
        loop: "token_snipe_simulation",
        mint,
        creator,
        slot,
        signature,
        success: false,
        simulationError: JSON.stringify(simulation.value.err),
        buildTimeMs,
        simTimeMs,
      });
      
      return;
    }
    
    // Simulation succeeded!
    const totalLatencyMs = Date.now() - pipelineStart;
    const detectionLatencyMs = pipelineStart - detectedAt;
    
    metrics.observeLatency("end_to_end_latency_ms", totalLatencyMs);
    metrics.observeLatency("detection_latency_ms", detectionLatencyMs);
    metrics.incrementCounter("simulation_successes");
    
    // Report success with FULL data
    metrics.reportLoopSummary({
      loop: "token_snipe_simulation",
      mint,              // FULL address
      creator,           // FULL address
      slot,
      signature,         // FULL signature
      owner: tokenInfo.owner,
      programId: tokenInfo.programId,
      success: true,
      detectionLatencyMs,
      buildTimeMs,
      simTimeMs,
      totalLatencyMs,
      unitsConsumed: simulation.value.unitsConsumed,
      ...metadata,
    });
    
    logger.info({
      mint,              // FULL ADDRESS
      creator,           // FULL ADDRESS
      slot,
      signature,         // FULL SIGNATURE
      owner: tokenInfo.owner,
      detectionLatencyMs,
      buildTimeMs,
      simTimeMs,
      totalLatencyMs,
      unitsConsumed: simulation.value.unitsConsumed,
      logs: simulation.value.logs,  // ALL logs, not truncated
    }, "✅ SIMULATION SUCCESS - REAL DATA VERIFIED");
    
  } catch (error) {
    metrics.incrementCounter("pipeline_failures");
    metrics.reportLoopSummary({
      loop: "token_snipe_simulation",
      mint,
      creator,
      slot,
      signature,
      success: false,
      error: (error as Error).message,
      errorStack: (error as Error).stack,
      totalLatencyMs: Date.now() - pipelineStart,
    });
    
    logger.error({ 
      mint,
      creator,
      error: (error as Error).message,
      stack: (error as Error).stack,
    }, "💥 Pipeline failed");
  }
}

/**
 * Start REAL Geyser stream
 */
async function startGeyserStream() {
  logger.info({ endpoint: config.geyser.endpoint }, "🚀 Connecting to REAL Geyser stream...");
  
  const client = new YellowstoneClient(
    config.geyser.endpoint,
    config.geyser.auth_token,
    undefined
  );
  
  // Build subscription request for Pump.fun program
  const request: SubscribeRequest = {
    accounts: {},
    slots: {},
    transactions: {
      "pumpfun-program": {
        vote: false,
        failed: false,
        signature: undefined,
        accountInclude: config.geyser.subscriptions.pumpfun_program_ids,
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    blocks: {},
    blocksMeta: {},
    entry: {},
    accountsDataSlice: [],
    ping: undefined,
    commitment: CommitmentLevel.CONFIRMED,
  };
  
  const stream = await client.subscribe();
  
  logger.info({}, "✅ Geyser stream connected - waiting for Pump.fun events...");
  metrics.incrementCounter("geyser_connections");
  
  // Handle data - EXTRACT REAL DATA ONLY
  stream.on("data", (update: SubscribeUpdate) => {
    const receivedAt = Date.now();
    
    try {
      if (!update.transaction) return;
      
      const txInfo = update.transaction.transaction ?? update.transaction;
      const meta = txInfo.meta ?? update.transaction.meta;
      if (!meta) return;
      
      // Extract REAL signature - FULL, not truncated
      const signature = decodeSignature(txInfo.signature ?? update.transaction.signature);
      
      // Extract REAL slot
      const slot = update.transaction.slot ?? 0;
      
      // Extract REAL accounts (includes creator)
      const accountKeys = txInfo.message?.accountKeys ?? [];
      const creator = accountKeys.length > 0 ? String(accountKeys[0]) : "unknown";
      
      // Extract REAL minted tokens with FULL data
      const mintedTokens = extractMintedTokens(meta);
      if (mintedTokens.length === 0) return;
      
      // Get REAL log messages
      const logMessages = meta.logMessages ?? [];
      
      metrics.incrementCounter("pumpfun_creation_events");
      
      // Log FULL Geyser event - NO TRUNCATION
      logger.info({ 
        signature,           // FULL signature
        slot,
        creator,             // FULL creator address
        mintedTokensCount: mintedTokens.length,
        filters: update.filters,
        logMessagesCount: logMessages.length,
      }, "📡 REAL Geyser event received");
      
      // Handle each minted token with FULL data
      for (const tokenInfo of mintedTokens) {
        logger.info({ 
          mint: tokenInfo.mint,                // FULL 44-char mint address
          owner: tokenInfo.owner,              // FULL owner address
          programId: tokenInfo.programId,      // FULL program ID
          amountRaw: tokenInfo.amountRaw,
          decimals: tokenInfo.decimals,
          creator,                             // FULL creator address
          signature,                           // FULL signature
          slot,
        }, "🪙 REAL token minted");
        
        // Process async (don't block stream)
        handleTokenCreation(
          tokenInfo.mint,
          creator,
          slot,
          signature,
          tokenInfo,
          receivedAt
        ).catch((error) => {
          logger.error({ 
            mint: tokenInfo.mint,
            error: (error as Error).message,
            stack: (error as Error).stack,
          }, "Handler crashed");
        });
      }
      
    } catch (error) {
      logger.error({ 
        error: (error as Error).message,
        stack: (error as Error).stack,
      }, "Failed to process Geyser update");
      metrics.incrementCounter("geyser_processing_errors");
    }
  });
  
  // Handle errors
  stream.on("error", (error: unknown) => {
    logger.error({ error: String(error) }, "❌ Geyser stream error");
    metrics.incrementCounter("geyser_stream_errors");
  });
  
  // Handle end
  stream.on("end", () => {
    logger.info({}, "⚠️ Geyser stream ended");
    metrics.incrementCounter("geyser_stream_ends");
  });
  
  // Send subscription request
  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  logger.info({}, "📡 Subscription request sent - listening for Pump.fun creations");
  
  return stream;
}

/**
 * Main entry point
 */
async function main() {
  logger.info({
    mode: "REAL_STREAM_SIMULATION_ONLY",
    rpcEndpoint: config.rpc.primary_url,
    geyserEndpoint: config.geyser.endpoint,
    traderPubkey: trader.publicKey.toBase58(),
    buyAmountSol: config.strategy.buy_amount_sol,
    priorityFee: config.jito.priority_fee_lamports,
    pumpfunPrograms: config.geyser.subscriptions.pumpfun_program_ids,
  }, "🎯 MVP Sniper starting");
  
  // Start REAL Geyser stream
  const stream = await startGeyserStream();
  
  logger.info({}, "✅ MVP Sniper running - watching for REAL Pump.fun token creations");
  logger.info({}, "⚠️  Transactions will be SIMULATED only (no on-chain sends)");
  
  // Keep alive
  return new Promise(() => {
    // Run forever until killed
  });
}

// Handle shutdown
process.on("SIGINT", () => {
  logger.info({}, "🛑 Shutting down MVP Sniper");
  
  // Dump final metrics
  metrics.reportLoopSummary({
    loop: "shutdown",
    reason: "SIGINT",
  });
  
  process.exit(0);
});

main().catch((error) => {
  logger.error({ error: (error as Error).message, stack: (error as Error).stack }, "💥 MVP Sniper crashed");
  process.exit(1);
});
