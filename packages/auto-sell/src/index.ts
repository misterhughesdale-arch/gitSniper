/**
 * Auto-Sell Manager
 * 
 * Manages automatic selling of positions based on configurable strategies:
 * - Time-based: Sell after X seconds
 * - Price-based: Take profit / stop loss
 * - Manual: Keep position open
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { buildSellTransaction } from "@fresh-sniper/transactions";

export interface Position {
  mint: PublicKey;
  mintStr: string;
  buySignature: string;
  buyTimestamp: number;
  buyAmount: number; // SOL spent
  buyPrice: number; // SOL per token (if calculable)
  tokenBalance: number; // Tokens received
  creator: PublicKey;
}

export interface SellResult {
  success: boolean;
  signature?: string;
  sellTimestamp: number;
  sellAmount?: number; // SOL received
  pnl?: number; // Profit/loss in SOL
  pnlPercent?: number; // Profit/loss percentage
  holdTime?: number; // Seconds held
  error?: string;
}

export type SellStrategy = "time_based" | "tp_sl" | "manual";

export interface AutoSellConfig {
  strategy: SellStrategy;
  holdTimeSeconds?: number; // For time_based
  takeProfitPercent?: number; // For tp_sl (e.g., 50 = 50% profit)
  stopLossPercent?: number; // For tp_sl (e.g., 20 = 20% loss)
  priorityFeeLamports: number;
  slippageBps: number;
}

export class AutoSellManager {
  private positions: Map<string, Position> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private connection: Connection,
    private trader: Keypair,
    private config: AutoSellConfig,
    private onSell?: (mintStr: string, result: SellResult) => void,
  ) {}

  /**
   * Add a position to track
   */
  async addPosition(position: Position): Promise<void> {
    this.positions.set(position.mintStr, position);

    if (this.config.strategy === "time_based" && this.config.holdTimeSeconds) {
      // Schedule automatic sell
      const timer = setTimeout(() => {
        this.executeSell(position.mintStr, "time_based").catch((error) => {
          console.error(`Auto-sell failed for ${position.mintStr}:`, error);
        });
      }, this.config.holdTimeSeconds * 1000);

      this.timers.set(position.mintStr, timer);
    }
  }

  /**
   * Execute sell for a position
   */
  async executeSell(mintStr: string, reason: string): Promise<SellResult> {
    const position = this.positions.get(mintStr);
    if (!position) {
      return {
        success: false,
        sellTimestamp: Date.now(),
        error: "Position not found",
      };
    }

    const startTime = Date.now();

    try {
      // Get current token balance
      const balance = await this.getTokenBalance(position.mint);
      if (balance === 0) {
        return {
          success: false,
          sellTimestamp: Date.now(),
          error: "No tokens to sell",
        };
      }

      // Build sell transaction
      const { transaction } = await buildSellTransaction({
        connection: this.connection,
        seller: this.trader.publicKey,
        mint: position.mint,
        tokenAmount: balance,
        slippageBps: this.config.slippageBps,
        priorityFeeLamports: this.config.priorityFeeLamports,
      });

      // Sign and send
      transaction.sign(this.trader);
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, "confirmed");

      if (confirmation.value.err) {
        return {
          success: false,
          sellTimestamp: Date.now(),
          error: JSON.stringify(confirmation.value.err),
        };
      }

      // Calculate PnL
      const sellTimestamp = Date.now();
      const holdTime = Math.floor((sellTimestamp - position.buyTimestamp) / 1000);

      // Get SOL received (from transaction logs if possible)
      // For now, estimate based on initial buy
      const estimatedSellAmount = position.buyAmount * 0.9; // Rough estimate
      const pnl = estimatedSellAmount - position.buyAmount;
      const pnlPercent = (pnl / position.buyAmount) * 100;

      const result: SellResult = {
        success: true,
        signature,
        sellTimestamp,
        sellAmount: estimatedSellAmount,
        pnl,
        pnlPercent,
        holdTime,
      };

      // Cleanup
      this.positions.delete(mintStr);
      const timer = this.timers.get(mintStr);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(mintStr);
      }

      // Callback
      if (this.onSell) {
        this.onSell(mintStr, result);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        sellTimestamp: Date.now(),
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get token balance for position
   */
  private async getTokenBalance(mint: PublicKey): Promise<number> {
    try {
      const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

      const [ata] = PublicKey.findProgramAddressSync(
        [this.trader.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const account = await getAccount(this.connection, ata);
      return Number(account.amount) / 1e6; // 6 decimals
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get all active positions
   */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Cancel sell timer for a position
   */
  cancelSell(mintStr: string): boolean {
    const timer = this.timers.get(mintStr);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(mintStr);
      return true;
    }
    return false;
  }

  /**
   * Cleanup all timers
   */
  shutdown(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.positions.clear();
  }
}

