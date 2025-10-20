/**
 * Trade Store - manages state for open positions and trade history
 */

export interface TradePosition {
  mint: string;
  entrySignature: string;
  entryPrice: number;
  tokenAmount: number;
  amountSol: number;
  enteredAt: number;
  entrySlot: number;
  status: "pending_buy" | "open" | "pending_sell" | "closed" | "failed";
  exitSignature?: string;
  exitPrice?: number;
  exitedAt?: number;
  exitSlot?: number;
  pnlSol?: number;
  pnlPercent?: number;
}

export interface TradeHistoryEntry {
  mint: string;
  entrySignature: string;
  exitSignature?: string;
  entryPrice: number;
  exitPrice?: number;
  tokenAmount: number;
  amountSol: number;
  enteredAt: number;
  exitedAt?: number;
  pnlSol?: number;
  pnlPercent?: number;
  status: "success" | "failed" | "partial";
  failureReason?: string;
}

export interface ITradeStore {
  /**
   * Creates a new pending buy position.
   */
  createPendingBuy(mint: string, signature: string, amountSol: number, submittedAt: number): Promise<void>;

  /**
   * Updates a position to open status after buy confirmation.
   */
  confirmBuy(
    mint: string,
    tokenAmount: number,
    entryPrice: number,
    slot: number,
    confirmedAt: number,
  ): Promise<void>;

  /**
   * Marks a buy as failed.
   */
  failBuy(mint: string, reason: string): Promise<void>;

  /**
   * Creates a pending sell for an open position.
   */
  createPendingSell(mint: string, signature: string, submittedAt: number): Promise<void>;

  /**
   * Updates a position to closed status after sell confirmation.
   */
  confirmSell(mint: string, exitPrice: number, slot: number, pnlSol: number, confirmedAt: number): Promise<void>;

  /**
   * Marks a sell as failed.
   */
  failSell(mint: string, reason: string): Promise<void>;

  /**
   * Gets an open position by mint address.
   */
  getPosition(mint: string): Promise<TradePosition | null>;

  /**
   * Gets all open positions.
   */
  getOpenPositions(): Promise<TradePosition[]>;

  /**
   * Gets trade history (completed and failed trades).
   */
  getHistory(limit?: number): Promise<TradeHistoryEntry[]>;

  /**
   * Gets the count of open positions.
   */
  getOpenPositionCount(): Promise<number>;

  /**
   * Clears all positions and history (for testing).
   */
  clear(): Promise<void>;
}

/**
 * In-memory implementation of ITradeStore.
 * Suitable for single-process deployments; data is lost on restart.
 */
export class InMemoryTradeStore implements ITradeStore {
  private positions: Map<string, TradePosition>;
  private history: TradeHistoryEntry[];

  constructor() {
    this.positions = new Map();
    this.history = [];
  }

  async createPendingBuy(mint: string, signature: string, amountSol: number, submittedAt: number): Promise<void> {
    const position: TradePosition = {
      mint,
      entrySignature: signature,
      entryPrice: 0,
      tokenAmount: 0,
      amountSol,
      enteredAt: submittedAt,
      entrySlot: 0,
      status: "pending_buy",
    };

    this.positions.set(mint, position);
  }

  async confirmBuy(
    mint: string,
    tokenAmount: number,
    entryPrice: number,
    slot: number,
    confirmedAt: number,
  ): Promise<void> {
    const position = this.positions.get(mint);
    if (!position) {
      throw new Error(`Position not found for mint ${mint}`);
    }

    position.status = "open";
    position.tokenAmount = tokenAmount;
    position.entryPrice = entryPrice;
    position.entrySlot = slot;
    position.enteredAt = confirmedAt;

    this.positions.set(mint, position);
  }

  async failBuy(mint: string, reason: string): Promise<void> {
    const position = this.positions.get(mint);
    if (!position) {
      return;
    }

    position.status = "failed";

    // Move to history
    this.history.push({
      mint: position.mint,
      entrySignature: position.entrySignature,
      entryPrice: 0,
      tokenAmount: 0,
      amountSol: position.amountSol,
      enteredAt: position.enteredAt,
      status: "failed",
      failureReason: reason,
    });

    this.positions.delete(mint);
  }

  async createPendingSell(mint: string, signature: string, submittedAt: number): Promise<void> {
    const position = this.positions.get(mint);
    if (!position) {
      throw new Error(`Position not found for mint ${mint}`);
    }

    position.status = "pending_sell";
    position.exitSignature = signature;
    position.exitedAt = submittedAt;

    this.positions.set(mint, position);
  }

  async confirmSell(mint: string, exitPrice: number, slot: number, pnlSol: number, confirmedAt: number): Promise<void> {
    const position = this.positions.get(mint);
    if (!position) {
      throw new Error(`Position not found for mint ${mint}`);
    }

    position.status = "closed";
    position.exitPrice = exitPrice;
    position.exitSlot = slot;
    position.exitedAt = confirmedAt;
    position.pnlSol = pnlSol;
    position.pnlPercent = position.amountSol > 0 ? (pnlSol / position.amountSol) * 100 : 0;

    // Move to history
    this.history.push({
      mint: position.mint,
      entrySignature: position.entrySignature,
      exitSignature: position.exitSignature,
      entryPrice: position.entryPrice,
      exitPrice: position.exitPrice,
      tokenAmount: position.tokenAmount,
      amountSol: position.amountSol,
      enteredAt: position.enteredAt,
      exitedAt: position.exitedAt,
      pnlSol: position.pnlSol,
      pnlPercent: position.pnlPercent,
      status: "success",
    });

    this.positions.delete(mint);
  }

  async failSell(mint: string, reason: string): Promise<void> {
    const position = this.positions.get(mint);
    if (!position) {
      return;
    }

    // Revert to open status
    position.status = "open";
    position.exitSignature = undefined;
    position.exitedAt = undefined;

    this.positions.set(mint, position);
  }

  async getPosition(mint: string): Promise<TradePosition | null> {
    return this.positions.get(mint) ?? null;
  }

  async getOpenPositions(): Promise<TradePosition[]> {
    return Array.from(this.positions.values()).filter((p) => p.status === "open" || p.status === "pending_buy");
  }

  async getHistory(limit: number = 100): Promise<TradeHistoryEntry[]> {
    return this.history.slice(-limit).reverse();
  }

  async getOpenPositionCount(): Promise<number> {
    return Array.from(this.positions.values()).filter((p) => p.status === "open").length;
  }

  async clear(): Promise<void> {
    this.positions.clear();
    this.history = [];
  }
}

/**
 * Creates a trade store instance.
 * Can be extended to support persistent storage (SQLite, Postgres, etc.)
 */
export function createTradeStore(type: "memory" = "memory"): ITradeStore {
  switch (type) {
    case "memory":
      return new InMemoryTradeStore();
    default:
      throw new Error(`Unknown store type: ${type}`);
  }
}

