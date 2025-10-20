import { PublicKey } from "@solana/web3.js";

/**
 * Pump.fun program constants and addresses.
 * These are mainnet addresses; adjust for devnet if needed.
 */

export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const PUMP_GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
export const PUMP_EVENT_AUTHORITY = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
export const PUMP_FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");

export const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const RENT_PROGRAM_ID = new PublicKey("SysvarRent111111111111111111111111111111111");

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const TOKEN_DECIMALS = 6;

/**
 * Buy instruction discriminator (first 8 bytes of sha256("global:buy"))
 */
export const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

/**
 * Sell instruction discriminator (first 8 bytes of sha256("global:sell"))
 */
export const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);

/**
 * Expected bonding curve state discriminator for validation
 */
export const BONDING_CURVE_DISCRIMINATOR = Buffer.from([0x17, 0xb7, 0xf8, 0x37, 0x60, 0xd8, 0x8b, 0x89]);

/**
 * Compute budget program for setting compute units and priority fees
 */
export const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey("ComputeBudget111111111111111111111111111111");

/**
 * Default compute unit limits for Pump.fun transactions
 */
export const DEFAULT_COMPUTE_UNITS = 300_000;
export const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 50_000; // 0.00005 SOL per compute unit

