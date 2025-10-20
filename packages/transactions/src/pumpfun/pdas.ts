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
 * Derives the associated token account address for a wallet and mint
 */
export function deriveAssociatedTokenAddress(wallet: PublicKey, mint: PublicKey, tokenProgramId: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [wallet.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  );
  return address;
}

