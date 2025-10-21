import { PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID } from "./constants";

/**
 * Derives the bonding curve PDA for a given mint
 */
export function deriveBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM_ID);
}

/**
 * Derives the associated bonding curve PDA (the token account owned by the bonding curve)
 */
export function deriveAssociatedBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
  const [bondingCurve] = deriveBondingCurvePDA(mint);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("associated-bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID,
  );
}

/**
 * Derives the creator vault PDA for receiving fees
 */
export function deriveCreatorVaultPDA(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("creator-vault"), creator.toBuffer()], PUMP_PROGRAM_ID);
}

/**
 * Derives the global volume accumulator PDA
 */
export function deriveGlobalVolumeAccumulatorPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("global_volume_accumulator")], PUMP_PROGRAM_ID);
}

/**
 * Derives the user volume accumulator PDA
 */
export function deriveUserVolumeAccumulatorPDA(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("user_volume_accumulator"), user.toBuffer()], PUMP_PROGRAM_ID);
}

/**
 * Derives the fee config PDA
 */
export function deriveFeeConfigPDA(): [PublicKey, number] {
  const PUMP_FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), PUMP_PROGRAM_ID.toBuffer()],
    PUMP_FEE_PROGRAM
  );
}

/**
 * Derives the associated token account address for a wallet and mint
 */
export function deriveAssociatedTokenAddress(wallet: PublicKey, mint: PublicKey, tokenProgramId: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [wallet.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  );
  return address;
}

