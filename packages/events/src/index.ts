import { EventEmitter } from "node:events";

/**
 * Domain events for Fresh Sniper trading system.
 * All events flow through a central EventEmitter bus for loose coupling.
 */

export interface TokenCreatedEvent {
  type: "TokenCreated";
  signature: string | null;
  slot: number | null;
  mint: string;
  creator: string;
  receivedAt: number;
  metadata?: {
    name?: string;
    symbol?: string;
    uri?: string;
  };
  filters: string[];
  logMessages: string[];
}

export interface BuySubmittedEvent {
  type: "BuySubmitted";
  mint: string;
  signature: string;
  amountSol: number;
  slippageBps: number;
  submittedAt: number;
  via: "jito" | "rpc";
}

export interface BuyLandedEvent {
  type: "BuyLanded";
  mint: string;
  signature: string;
  confirmedAt: number;
  slot: number;
  tokenAmount: number;
  pricePerToken: number;
  totalCostSol: number;
}

export interface BuyFailedEvent {
  type: "BuyFailed";
  mint: string;
  signature: string | null;
  reason: string;
  failedAt: number;
}

export interface SellSubmittedEvent {
  type: "SellSubmitted";
  mint: string;
  signature: string;
  tokenAmount: number;
  slippageBps: number;
  submittedAt: number;
  via: "jito" | "rpc";
}

export interface SellLandedEvent {
  type: "SellLanded";
  mint: string;
  signature: string;
  confirmedAt: number;
  slot: number;
  solReceived: number;
  pricePerToken: number;
  pnlSol: number;
  pnlPercent: number;
}

export interface SellFailedEvent {
  type: "SellFailed";
  mint: string;
  signature: string | null;
  reason: string;
  failedAt: number;
}

export type DomainEvent =
  | TokenCreatedEvent
  | BuySubmittedEvent
  | BuyLandedEvent
  | BuyFailedEvent
  | SellSubmittedEvent
  | SellLandedEvent
  | SellFailedEvent;

/**
 * Typed event emitter for Fresh Sniper domain events.
 * Provides type-safe event subscription and publishing.
 */
export class FreshSniperEventBus extends EventEmitter {
  /**
   * Emits a TokenCreated event when a new Pump.fun token is detected.
   */
  emitTokenCreated(event: Omit<TokenCreatedEvent, "type">): void {
    this.emit("pumpfun:tokenCreated", { ...event, type: "TokenCreated" } as TokenCreatedEvent);
  }

  /**
   * Subscribes to TokenCreated events.
   */
  onTokenCreated(handler: (event: TokenCreatedEvent) => void): void {
    this.on("pumpfun:tokenCreated", handler);
  }

  /**
   * Emits a BuySubmitted event when a buy transaction is submitted.
   */
  emitBuySubmitted(event: Omit<BuySubmittedEvent, "type">): void {
    this.emit("trade:buySubmitted", { ...event, type: "BuySubmitted" } as BuySubmittedEvent);
  }

  /**
   * Subscribes to BuySubmitted events.
   */
  onBuySubmitted(handler: (event: BuySubmittedEvent) => void): void {
    this.on("trade:buySubmitted", handler);
  }

  /**
   * Emits a BuyLanded event when a buy transaction is confirmed.
   */
  emitBuyLanded(event: Omit<BuyLandedEvent, "type">): void {
    this.emit("trade:buyLanded", { ...event, type: "BuyLanded" } as BuyLandedEvent);
  }

  /**
   * Subscribes to BuyLanded events.
   */
  onBuyLanded(handler: (event: BuyLandedEvent) => void): void {
    this.on("trade:buyLanded", handler);
  }

  /**
   * Emits a BuyFailed event when a buy transaction fails.
   */
  emitBuyFailed(event: Omit<BuyFailedEvent, "type">): void {
    this.emit("trade:buyFailed", { ...event, type: "BuyFailed" } as BuyFailedEvent);
  }

  /**
   * Subscribes to BuyFailed events.
   */
  onBuyFailed(handler: (event: BuyFailedEvent) => void): void {
    this.on("trade:buyFailed", handler);
  }

  /**
   * Emits a SellSubmitted event when a sell transaction is submitted.
   */
  emitSellSubmitted(event: Omit<SellSubmittedEvent, "type">): void {
    this.emit("trade:sellSubmitted", { ...event, type: "SellSubmitted" } as SellSubmittedEvent);
  }

  /**
   * Subscribes to SellSubmitted events.
   */
  onSellSubmitted(handler: (event: SellSubmittedEvent) => void): void {
    this.on("trade:sellSubmitted", handler);
  }

  /**
   * Emits a SellLanded event when a sell transaction is confirmed.
   */
  emitSellLanded(event: Omit<SellLandedEvent, "type">): void {
    this.emit("trade:sellLanded", { ...event, type: "SellLanded" } as SellLandedEvent);
  }

  /**
   * Subscribes to SellLanded events.
   */
  onSellLanded(handler: (event: SellLandedEvent) => void): void {
    this.on("trade:sellLanded", handler);
  }

  /**
   * Emits a SellFailed event when a sell transaction fails.
   */
  emitSellFailed(event: Omit<SellFailedEvent, "type">): void {
    this.emit("trade:sellFailed", { ...event, type: "SellFailed" } as SellFailedEvent);
  }

  /**
   * Subscribes to SellFailed events.
   */
  onSellFailed(handler: (event: SellFailedEvent) => void): void {
    this.on("trade:sellFailed", handler);
  }

  /**
   * Removes all listeners and cleans up resources.
   */
  dispose(): void {
    this.removeAllListeners();
  }
}

/**
 * Creates a new event bus instance for the application.
 */
export function createEventBus(): FreshSniperEventBus {
  const bus = new FreshSniperEventBus();
  bus.setMaxListeners(100); // Increase for multiple subscribers
  return bus;
}

