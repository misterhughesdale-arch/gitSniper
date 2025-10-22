/**
 * Momentum Tracker
 * 
 * Monitors buy/sell activity for a specific token mint via Geyser stream
 * and determines when momentum is lost.
 */

import { PublicKey } from "@solana/web3.js";

export interface MomentumEvent {
  type: "buy" | "sell";
  timestamp: number;
  amountSol: number;
  signature: string;
}

export interface MomentumState {
  lastBuyTime: number;
  lastSellTime: number;
  recentBuys: number;
  recentSells: number;
  buySellRatio: number;
  hasLull: boolean;
  shouldExit: boolean;
}

export interface MomentumConfig {
  lullThresholdMs: number;      // Exit if no buys for this long
  windowMs: number;              // Rolling window for ratio calculation
  buySellRatioThreshold: number; // Exit if ratio falls below this
}

export class MomentumTracker {
  private events: MomentumEvent[] = [];
  private lastBuyTime: number = Date.now();
  private lastCheckTime: number = Date.now();

  constructor(
    public mint: PublicKey,
    private config: MomentumConfig
  ) {}

  /**
   * Record a buy event
   */
  recordBuy(amountSol: number, signature: string): void {
    const now = Date.now();
    this.events.push({
      type: "buy",
      timestamp: now,
      amountSol,
      signature,
    });
    this.lastBuyTime = now;
    this.cleanOldEvents();
  }

  /**
   * Record a sell event
   */
  recordSell(amountSol: number, signature: string): void {
    this.events.push({
      type: "sell",
      timestamp: Date.now(),
      amountSol,
      signature,
    });
    this.cleanOldEvents();
  }

  /**
   * Get current momentum state
   */
  getState(): MomentumState {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Filter events in window
    const recentEvents = this.events.filter(e => e.timestamp >= windowStart);
    
    const recentBuys = recentEvents.filter(e => e.type === "buy").length;
    const recentSells = recentEvents.filter(e => e.type === "sell").length;
    
    // Calculate buy/sell ratio (handle division by zero)
    const buySellRatio = recentSells > 0 
      ? recentBuys / (recentBuys + recentSells)
      : 1.0;
    
    // Check for lull (no buys in threshold period)
    const timeSinceLastBuy = now - this.lastBuyTime;
    const hasLull = timeSinceLastBuy > this.config.lullThresholdMs;
    
    // Determine if should exit
    const shouldExit = 
      hasLull || 
      (buySellRatio < this.config.buySellRatioThreshold && recentEvents.length > 5);

    return {
      lastBuyTime: this.lastBuyTime,
      lastSellTime: Math.max(...this.events.filter(e => e.type === "sell").map(e => e.timestamp), 0),
      recentBuys,
      recentSells,
      buySellRatio,
      hasLull,
      shouldExit,
    };
  }

  /**
   * Check if momentum is lost
   */
  shouldExit(): boolean {
    return this.getState().shouldExit;
  }

  /**
   * Get human-readable status
   */
  getStatus(): string {
    const state = this.getState();
    const timeSinceLastBuy = Math.floor((Date.now() - state.lastBuyTime) / 1000);
    
    return `Buys: ${state.recentBuys}, Sells: ${state.recentSells}, ` +
           `Ratio: ${(state.buySellRatio * 100).toFixed(0)}%, ` +
           `Last buy: ${timeSinceLastBuy}s ago, ` +
           `Lull: ${state.hasLull ? "YES" : "NO"}`;
  }

  /**
   * Remove events outside the window
   */
  private cleanOldEvents(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.events = this.events.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Reset tracker (e.g., after position exit)
   */
  reset(): void {
    this.events = [];
    this.lastBuyTime = Date.now();
  }
}

