/**
 * Position Manager
 * 
 * Manages a single token position with momentum-based selling
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { MomentumTracker } from "./momentum-tracker";
import { StrategyConfig, getMomentumConfig } from "./strategy-config";

export interface Position {
  mint: PublicKey;
  buyTx: string;
  buyTime: number;
  buyAmountSol: number;
  tokenBalance: number;
  breakevenSold: boolean;
  status: "active" | "partial_exit" | "exited";
}

export class PositionManager {
  private position: Position | null = null;
  private momentumTracker: MomentumTracker | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private connection: Connection,
    private trader: Keypair,
    private config: StrategyConfig,
    private onSell: (mint: PublicKey, percentage: number, reason: string) => Promise<void>
  ) {}

  /**
   * Start managing a new position
   */
  startPosition(
    mint: PublicKey,
    buyTx: string,
    buyAmountSol: number,
    tokenBalance: number
  ): void {
    this.position = {
      mint,
      buyTx,
      buyTime: Date.now(),
      buyAmountSol,
      tokenBalance,
      breakevenSold: false,
      status: "active",
    };

    // Create momentum tracker
    const momentumConfig = getMomentumConfig(this.config);
    this.momentumTracker = new MomentumTracker(mint, momentumConfig);

    console.log(`\n📊 Position started: ${mint.toBase58().slice(0, 8)}...`);
    console.log(`   Buy: ${buyAmountSol} SOL, Balance: ${tokenBalance.toLocaleString()} tokens`);

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Record a buy event from stream
   */
  recordBuy(amountSol: number, signature: string): void {
    if (this.momentumTracker) {
      this.momentumTracker.recordBuy(amountSol, signature);
    }
  }

  /**
   * Record a sell event from stream
   */
  recordSell(amountSol: number, signature: string): void {
    if (this.momentumTracker) {
      this.momentumTracker.recordSell(amountSol, signature);
    }
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    const intervalMs = this.config.strategy.monitoring.check_interval_ms;

    this.checkInterval = setInterval(async () => {
      await this.checkPosition();
    }, intervalMs);
  }

  /**
   * Check position and execute strategy
   */
  private async checkPosition(): Promise<void> {
    if (!this.position || !this.momentumTracker) return;

    const now = Date.now();
    const holdTime = Math.floor((now - this.position.buyTime) / 1000);
    const state = this.momentumTracker.getState();

    // Get current market cap (simplified - would need actual calculation)
    // For now, use placeholder logic
    const currentMarketCap = await this.estimateMarketCap();

    // Check breakeven sell
    if (
      !this.position.breakevenSold &&
      this.config.strategy.breakeven_sell.enabled &&
      currentMarketCap >= this.config.strategy.targets.breakeven_market_cap
    ) {
      console.log(`\n💰 Breakeven target reached! MC: ${currentMarketCap.toLocaleString()} SOL`);
      console.log(`   Selling ${this.config.strategy.breakeven_sell.sell_percentage}% to recover initial investment`);

      await this.onSell(
        this.position.mint,
        this.config.strategy.breakeven_sell.sell_percentage,
        "breakeven"
      );

      this.position.breakevenSold = true;
      this.position.status = "partial_exit";
      return;
    }

    // Check momentum exit conditions
    if (state.shouldExit) {
      const reason = state.hasLull ? "lull detected" : "sell pressure";
      console.log(`\n🚨 Momentum lost: ${reason}`);
      console.log(`   ${this.momentumTracker.getStatus()}`);
      console.log(`   Dumping remainder...`);

      await this.onSell(this.position.mint, 100, reason);
      this.stopPosition();
      return;
    }

    // Check time-based exit
    if (holdTime >= this.config.strategy.exit.time_based_exit_seconds) {
      console.log(`\n⏰ Max hold time reached (${holdTime}s)`);
      console.log(`   Exiting position...`);

      await this.onSell(this.position.mint, 100, "timeout");
      this.stopPosition();
      return;
    }

    // Periodic status update (every 5 seconds)
    if (holdTime % 5 === 0) {
      console.log(`   [${holdTime}s] ${this.momentumTracker.getStatus()}, MC: ~${currentMarketCap.toFixed(0)} SOL`);
    }
  }

  /**
   * Estimate current market cap (simplified)
   * In production, this would query bonding curve state
   */
  private async estimateMarketCap(): Promise<number> {
    // Placeholder - would calculate from bonding curve reserves
    // For now, return random value for testing
    return Math.random() * 15000;
  }

  /**
   * Stop managing position
   */
  stopPosition(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.position) {
      this.position.status = "exited";
      console.log(`   ✅ Position closed: ${this.position.mint.toBase58().slice(0, 8)}...`);
    }

    this.position = null;
    this.momentumTracker = null;
  }

  /**
   * Get current position
   */
  getPosition(): Position | null {
    return this.position;
  }

  /**
   * Check if managing a position
   */
  hasPosition(): boolean {
    return this.position !== null;
  }
}

