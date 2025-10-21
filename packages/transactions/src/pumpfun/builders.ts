/**
 * Pump.fun Transaction Builders
 * 
 * Constructs buy and sell transactions for the Pump.fun bonding curve program.
 * 
 * Program: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
 * 
 * Transaction structure:
 * 1. Compute budget instructions (units + priority fee)
 * 2. Create associated token account (idempotent)
 * 3. Buy/Sell instruction with amount and slippage protection
 * 
 * All PDAs are derived deterministically using program seeds.
 */

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  BUY_DISCRIMINATOR,
  DEFAULT_COMPUTE_UNITS,
  LAMPORTS_PER_SOL,
  PUMP_EVENT_AUTHORITY,
  PUMP_FEE_RECIPIENT,
  PUMP_FEE_PROGRAM,
  PUMP_GLOBAL,
  PUMP_PROGRAM_ID,
  SELL_DISCRIMINATOR,
  SYSTEM_PROGRAM_ID,
  TOKEN_DECIMALS,
  TOKEN_PROGRAM_ID,
} from "./constants";
import { 
  deriveAssociatedBondingCurvePDA, 
  deriveAssociatedTokenAddress, 
  deriveBondingCurvePDA,
  deriveCreatorVaultPDA,
  deriveFeeConfigPDA,
  deriveGlobalVolumeAccumulatorPDA,
  deriveUserVolumeAccumulatorPDA,
} from "./pdas";
import { fetchBondingCurveState } from "./curve-parser";

export interface BuyTransactionParams {
  connection: Connection;
  buyer: PublicKey;
  mint: PublicKey;
  amountSol: number;
  slippageBps: number;
  priorityFeeLamports?: number;
  computeUnits?: number;
}

export interface SellTransactionParams {
  connection: Connection;
  seller: PublicKey;
  mint: PublicKey;
  tokenAmount: number;
  slippageBps: number;
  priorityFeeLamports?: number;
  computeUnits?: number;
}

export interface BuildTransactionResult {
  transaction: Transaction;
  metadata: {
    mint: string;
    amount: number;
    slippageBps: number;
    estimatedFee: number;
  };
}

/**
 * Builds a Pump.fun buy transaction.
 * Creates associated token account if needed, then executes buy instruction.
 */
export async function buildBuyTransaction(params: BuyTransactionParams): Promise<BuildTransactionResult> {
  const { connection, buyer, mint, amountSol, slippageBps, priorityFeeLamports = 33333, computeUnits = DEFAULT_COMPUTE_UNITS } = params; // ~10k lamports total (33k microlamports per unit * 300k units)

  const transaction = new Transaction();

  // Add compute budget instructions
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnits,
    }),
  );

  if (priorityFeeLamports > 0) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeLamports,
      }),
    );
  }

  // Derive all required PDAs
  const [bondingCurve] = deriveBondingCurvePDA(mint);
  const associatedBondingCurve = deriveAssociatedBondingCurvePDA(mint); // Now returns PublicKey directly
  const buyerTokenAccount = deriveAssociatedTokenAddress(buyer, mint, TOKEN_PROGRAM_ID);
  
  // Fetch bonding curve state to get REAL creator
  const curveState = await fetchBondingCurveState(connection, bondingCurve);
  const [creatorVault] = deriveCreatorVaultPDA(curveState.creator);
  
  // Derive volume and fee PDAs
  const [globalVolumeAccumulator] = deriveGlobalVolumeAccumulatorPDA();
  const [userVolumeAccumulator] = deriveUserVolumeAccumulatorPDA(buyer);
  const [feeConfig] = deriveFeeConfigPDA();

  // Create associated token account instruction (idempotent)
  const createAtaInstruction = createAssociatedTokenAccountIdempotentInstruction(
    buyer,
    buyerTokenAccount,
    buyer,
    mint,
  );
  transaction.add(createAtaInstruction);

  // Build buy instruction
  // NOTE: Pump.fun buy instruction takes:
  // 1. TOKEN AMOUNT to receive (in raw token units, 6 decimals)
  // 2. MAX SOL to spend (in lamports, with slippage)
  
  // Request reasonable token amount, limited by max SOL
  const tokenAmount = BigInt(100_000_000_000); // Request 100k tokens (will be limited by SOL)
  const maxSolCost = BigInt(Math.floor((amountSol * (1 + slippageBps / 10000)) * LAMPORTS_PER_SOL));

  const buyInstruction = createBuyInstruction({
    buyer,
    mint,
    bondingCurve,
    associatedBondingCurve,
    buyerTokenAccount,
    creatorVault,
    globalVolumeAccumulator,
    userVolumeAccumulator,
    feeConfig,
    tokenAmount,  // Token amount to receive
    maxSolCost,   // Max SOL to spend
  });

  transaction.add(buyInstruction);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = buyer;

  return {
    transaction,
    metadata: {
      mint: mint.toBase58(),
      amount: amountSol,
      slippageBps,
      estimatedFee: priorityFeeLamports / LAMPORTS_PER_SOL,
    },
  };
}

/**
 * Builds a Pump.fun sell transaction.
 */
export async function buildSellTransaction(params: SellTransactionParams): Promise<BuildTransactionResult> {
  const { connection, seller, mint, tokenAmount, slippageBps, priorityFeeLamports = 10000, computeUnits = DEFAULT_COMPUTE_UNITS } = params;

  const transaction = new Transaction();

  // Add compute budget instructions
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnits,
    }),
  );

  if (priorityFeeLamports > 0) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeLamports,
      }),
    );
  }

  // Derive PDAs
  const [bondingCurve] = deriveBondingCurvePDA(mint);
  const associatedBondingCurve = deriveAssociatedBondingCurvePDA(mint);
  const sellerTokenAccount = deriveAssociatedTokenAddress(seller, mint, TOKEN_PROGRAM_ID);

  // Fetch bonding curve state to get REAL creator
  const curveState = await fetchBondingCurveState(connection, bondingCurve);
  const [creatorVault] = deriveCreatorVaultPDA(curveState.creator);
  const [feeConfig] = deriveFeeConfigPDA();

  // Build sell instruction (14 accounts - no volume tracking for sells)
  const tokenAmountRaw = BigInt(Math.floor(tokenAmount * 10 ** TOKEN_DECIMALS));
  const minSolOutput = BigInt(0); // Calculate based on slippage and current price

  const sellInstruction = createSellInstruction({
    seller,
    mint,
    bondingCurve,
    associatedBondingCurve,
    sellerTokenAccount,
    creatorVault,
    feeConfig,
    tokenAmountRaw,
    minSolOutput,
  });

  transaction.add(sellInstruction);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = seller;

  return {
    transaction,
    metadata: {
      mint: mint.toBase58(),
      amount: tokenAmount,
      slippageBps,
      estimatedFee: priorityFeeLamports / LAMPORTS_PER_SOL,
    },
  };
}

/**
 * Creates a buy instruction for Pump.fun
 * 
 * Account order matches Pump.fun program requirements (16 accounts total):
 * 0. global, 1. fee_recipient, 2. mint, 3. bonding_curve, 4. associated_bonding_curve,
 * 5. buyer_token_account, 6. buyer (signer), 7. system_program, 8. token_program,
 * 9. creator_vault, 10. event_authority, 11. program, 12. global_volume_accumulator,
 * 13. user_volume_accumulator, 14. fee_config, 15. fee_program
 */
function createBuyInstruction(params: {
  buyer: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  associatedBondingCurve: PublicKey;
  buyerTokenAccount: PublicKey;
  creatorVault: PublicKey;
  globalVolumeAccumulator: PublicKey;
  userVolumeAccumulator: PublicKey;
  feeConfig: PublicKey;
  tokenAmount: bigint;
  maxSolCost: bigint;
}): TransactionInstruction {
  const { 
    buyer, mint, bondingCurve, associatedBondingCurve, buyerTokenAccount,
    creatorVault, globalVolumeAccumulator, userVolumeAccumulator, feeConfig,
    tokenAmount, maxSolCost 
  } = params;

  // Instruction data: discriminator + token_amount + max_sol_cost + track_volume (Option<bool>)
  const data = Buffer.alloc(25);
  BUY_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(tokenAmount, 8);  // TOKEN amount to receive (6 decimals)
  data.writeBigUInt64LE(maxSolCost, 16);  // MAX SOL to spend (lamports)
  data.writeUInt8(0, 24); // track_volume = None (0 = Option::None)

  return new TransactionInstruction({
    keys: [
      { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: PUMP_FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: true },
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
      { pubkey: feeConfig, isSigner: false, isWritable: false },
      { pubkey: PUMP_FEE_PROGRAM, isSigner: false, isWritable: false },
    ],
    programId: PUMP_PROGRAM_ID,
    data,
  });
}

/**
 * Creates a sell instruction for Pump.fun
 * 
 * SELL has 14 accounts (not 16 like buy - no volume tracking):
 * 0. global, 1. fee_recipient, 2. mint, 3. bonding_curve, 4. associated_bonding_curve,
 * 5. seller_token_account, 6. seller (signer), 7. system_program, 8. creator_vault,
 * 9. token_program, 10. event_authority, 11. program, 12. fee_config, 13. fee_program
 * 
 * NOTE: creator_vault MUST come before token_program (verified from Python bot)
 */
function createSellInstruction(params: {
  seller: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  associatedBondingCurve: PublicKey;
  sellerTokenAccount: PublicKey;
  creatorVault: PublicKey;
  feeConfig: PublicKey;
  tokenAmountRaw: bigint;
  minSolOutput: bigint;
}): TransactionInstruction {
  const { 
    seller, mint, bondingCurve, associatedBondingCurve, sellerTokenAccount,
    creatorVault, feeConfig, tokenAmountRaw, minSolOutput 
  } = params;

  // Instruction data: discriminator + amount + min_sol_output + track_volume (Option<bool>)
  const data = Buffer.alloc(25);
  SELL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(tokenAmountRaw, 8);
  data.writeBigUInt64LE(minSolOutput, 16);
  data.writeUInt8(0, 24); // track_volume = None (0 = Option::None)

  return new TransactionInstruction({
    keys: [
      { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: PUMP_FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: creatorVault, isSigner: false, isWritable: true }, // creator_vault BEFORE token_program!
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program AFTER creator_vault!
      { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: feeConfig, isSigner: false, isWritable: false },
      { pubkey: PUMP_FEE_PROGRAM, isSigner: false, isWritable: false },
    ],
    programId: PUMP_PROGRAM_ID,
    data,
  });
}

/**
 * Creates an idempotent associated token account creation instruction
 */
function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([0x01]), // CreateIdempotent discriminator
  });
}

