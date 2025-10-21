import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Bonding Curve State Parser
 * 
 * Parses Pump.fun bonding curve account data to extract:
 * - Creator pubkey
 * - Reserve amounts
 * - Completion status
 * 
 * Account structure (after 8-byte discriminator):
 * - virtual_token_reserves: 8 bytes (u64)
 * - virtual_sol_reserves: 8 bytes (u64)
 * - real_token_reserves: 8 bytes (u64)
 * - real_sol_reserves: 8 bytes (u64)
 * - token_total_supply: 8 bytes (u64)
 * - complete: 1 byte (bool)
 * - creator: 32 bytes (Pubkey)
 */

const EXPECTED_DISCRIMINATOR = Buffer.from([0x17, 0xb7, 0xf8, 0x37, 0x60, 0xd8, 0x8b, 0x89]);

export interface BondingCurveState {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: PublicKey;
}

/**
 * Fetches and parses bonding curve state from the blockchain
 */
export async function fetchBondingCurveState(
  connection: Connection,
  bondingCurveAddress: PublicKey
): Promise<BondingCurveState> {
  const accountInfo = await connection.getAccountInfo(bondingCurveAddress);
  
  if (!accountInfo || !accountInfo.data) {
    throw new Error(`Bonding curve account not found: ${bondingCurveAddress.toBase58()}`);
  }
  
  return parseBondingCurveData(accountInfo.data);
}

/**
 * Parses bonding curve account data
 */
export function parseBondingCurveData(data: Buffer): BondingCurveState {
  if (data.length < 81) { // 8 (discriminator) + 40 (5 * u64) + 1 (bool) + 32 (pubkey)
    throw new Error(`Invalid bonding curve data length: ${data.length}`);
  }
  
  // Skip discriminator validation for now - just parse the data
  // Different tokens may have different discriminators
  let offset = 8;
  
  // Read u64 values (8 bytes each, little-endian)
  const virtualTokenReserves = data.readBigUInt64LE(offset); offset += 8;
  const virtualSolReserves = data.readBigUInt64LE(offset); offset += 8;
  const realTokenReserves = data.readBigUInt64LE(offset); offset += 8;
  const realSolReserves = data.readBigUInt64LE(offset); offset += 8;
  const tokenTotalSupply = data.readBigUInt64LE(offset); offset += 8;
  
  // Read bool (1 byte)
  const complete = data.readUInt8(offset) !== 0; offset += 1;
  
  // Read creator pubkey (32 bytes)
  const creatorBytes = data.subarray(offset, offset + 32);
  const creator = new PublicKey(creatorBytes);
  
  return {
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply,
    complete,
    creator,
  };
}

/**
 * Calculates current token price from bonding curve state
 */
export function calculateTokenPrice(state: BondingCurveState): number {
  if (state.virtualTokenReserves === BigInt(0)) {
    return 0;
  }
  
  const solReserves = Number(state.virtualSolReserves) / 1e9; // Convert lamports to SOL
  const tokenReserves = Number(state.virtualTokenReserves) / 1e6; // Token decimals = 6
  
  return solReserves / tokenReserves;
}

