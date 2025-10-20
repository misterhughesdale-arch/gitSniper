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
  PUMP_GLOBAL,
  PUMP_PROGRAM_ID,
  SELL_DISCRIMINATOR,
  SYSTEM_PROGRAM_ID,
  TOKEN_DECIMALS,
  TOKEN_PROGRAM_ID,
} from "./constants";
import { deriveAssociatedBondingCurvePDA, deriveAssociatedTokenAddress, deriveBondingCurvePDA } from "./pdas";

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
  const { connection, buyer, mint, amountSol, slippageBps, priorityFeeLamports = 10000, computeUnits = DEFAULT_COMPUTE_UNITS } = params;

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
  const [associatedBondingCurve] = deriveAssociatedBondingCurvePDA(mint);
  const buyerTokenAccount = deriveAssociatedTokenAddress(buyer, mint, TOKEN_PROGRAM_ID);

  // Create associated token account instruction (idempotent)
  const createAtaInstruction = createAssociatedTokenAccountIdempotentInstruction(
    buyer,
    buyerTokenAccount,
    buyer,
    mint,
  );
  transaction.add(createAtaInstruction);

  // Build buy instruction
  const amountLamports = BigInt(Math.floor(amountSol * LAMPORTS_PER_SOL));
  const maxSolCost = BigInt(Math.floor((amountSol * (1 + slippageBps / 10000)) * LAMPORTS_PER_SOL));

  const buyInstruction = createBuyInstruction({
    buyer,
    mint,
    bondingCurve,
    associatedBondingCurve,
    buyerTokenAccount,
    amountLamports,
    maxSolCost,
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
  const [associatedBondingCurve] = deriveAssociatedBondingCurvePDA(mint);
  const sellerTokenAccount = deriveAssociatedTokenAddress(seller, mint, TOKEN_PROGRAM_ID);

  // Build sell instruction
  const tokenAmountRaw = BigInt(Math.floor(tokenAmount * 10 ** TOKEN_DECIMALS));
  const minSolOutput = BigInt(0); // Calculate based on slippage and current price

  const sellInstruction = createSellInstruction({
    seller,
    mint,
    bondingCurve,
    associatedBondingCurve,
    sellerTokenAccount,
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
 */
function createBuyInstruction(params: {
  buyer: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  associatedBondingCurve: PublicKey;
  buyerTokenAccount: PublicKey;
  amountLamports: bigint;
  maxSolCost: bigint;
}): TransactionInstruction {
  const { buyer, mint, bondingCurve, associatedBondingCurve, buyerTokenAccount, amountLamports, maxSolCost } = params;

  // Instruction data: discriminator + amount + max_sol_cost
  const data = Buffer.alloc(24);
  BUY_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amountLamports, 8);
  data.writeBigUInt64LE(maxSolCost, 16);

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
      { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PUMP_PROGRAM_ID,
    data,
  });
}

/**
 * Creates a sell instruction for Pump.fun
 */
function createSellInstruction(params: {
  seller: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  associatedBondingCurve: PublicKey;
  sellerTokenAccount: PublicKey;
  tokenAmountRaw: bigint;
  minSolOutput: bigint;
}): TransactionInstruction {
  const { seller, mint, bondingCurve, associatedBondingCurve, sellerTokenAccount, tokenAmountRaw, minSolOutput } = params;

  // Instruction data: discriminator + amount + min_sol_output
  const data = Buffer.alloc(24);
  SELL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(tokenAmountRaw, 8);
  data.writeBigUInt64LE(minSolOutput, 16);

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
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
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

