/**
 * PumpFun SDK Wrapper
 * 
 * Wraps the pumpdotfun-repumped-sdk for easier integration with our trading logic.
 * Provides simplified buy/sell methods while maintaining access to advanced features.
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PumpFunSDK } from "pumpdotfun-repumped-sdk";

export interface SDKBuyParams {
  connection: Connection;
  buyer: Keypair;
  mint: PublicKey;
  amountSol: number;
  slippageBps: number;
  priorityFeeMicroLamports?: number;
  computeUnits?: number;
  useJito?: boolean;
  jitoTipLamports?: number;
}

export interface SDKSellParams {
  connection: Connection;
  seller: Keypair;
  mint: PublicKey;
  tokenAmount: number;
  slippageBps: number;
  priorityFeeMicroLamports?: number;
  computeUnits?: number;
  useJito?: boolean;
  jitoTipLamports?: number;
}

export interface SDKTransactionResult {
  signature: string;
  success: boolean;
}

/**
 * Initialize PumpFun SDK
 */
export function initPumpFunSDK(
  connection: Connection,
  wallet: Keypair,
  options?: {
    jitoUrl?: string;
    useJito?: boolean;
  }
): PumpFunSDK {
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: "confirmed" }
  );

  const sdkOptions: any = {};
  
  if (options?.useJito && options?.jitoUrl) {
    sdkOptions.jitoUrl = options.jitoUrl;
    sdkOptions.authKeypair = wallet;
  }

  return new PumpFunSDK(provider, sdkOptions);
}

/**
 * Buy tokens using SDK
 */
export async function buyWithSDK(params: SDKBuyParams): Promise<SDKTransactionResult> {
  const {
    connection,
    buyer,
    mint,
    amountSol,
    slippageBps,
    priorityFeeMicroLamports = 50000,
    computeUnits = 300000,
    useJito = false,
    jitoTipLamports = 500000,
  } = params;

  const sdk = initPumpFunSDK(connection, buyer, {
    useJito,
    jitoUrl: useJito ? "ny.mainnet.block-engine.jito.wtf" : undefined,
  });

  const priorityFee = {
    unitLimit: computeUnits,
    unitPrice: priorityFeeMicroLamports,
  };

  const amountLamports = BigInt(Math.floor(amountSol * 1e9));
  const slippage = BigInt(slippageBps);

  try {
    let txResult: any;

    if (useJito && sdk.jito) {
      // Use Jito for MEV protection
      txResult = await sdk.jito.buyJito(
        buyer,
        mint,
        amountLamports,
        slippage,
        jitoTipLamports,
        priorityFee,
        "confirmed"
      );
    } else {
      // Standard buy
      txResult = await sdk.trade.buy(
        buyer,
        mint,
        amountLamports,
        slippage,
        priorityFee
      );
    }

    const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult);

    return {
      signature,
      success: true,
    };
  } catch (error) {
    throw new Error(`SDK buy failed: ${(error as Error).message}`);
  }
}

/**
 * Sell tokens using SDK
 */
export async function sellWithSDK(params: SDKSellParams): Promise<SDKTransactionResult> {
  const {
    connection,
    seller,
    mint,
    tokenAmount,
    slippageBps,
    priorityFeeMicroLamports = 10000,
    computeUnits = 80000,
    useJito = false,
    jitoTipLamports = 100000,
  } = params;

  const sdk = initPumpFunSDK(connection, seller, {
    useJito,
    jitoUrl: useJito ? "ny.mainnet.block-engine.jito.wtf" : undefined,
  });

  const priorityFee = {
    unitLimit: computeUnits,
    unitPrice: priorityFeeMicroLamports,
  };

  // Convert to raw token amount (6 decimals)
  const tokenAmountRaw = BigInt(Math.floor(tokenAmount * 1e6));
  const slippage = BigInt(slippageBps);

  try {
    let txResult: any;

    if (useJito && sdk.jito) {
      // Use Jito for sell
      txResult = await sdk.jito.sellJito(
        seller,
        mint,
        tokenAmountRaw,
        slippage,
        jitoTipLamports,
        priorityFee,
        "confirmed"
      );
    } else {
      // Standard sell
      txResult = await sdk.trade.sell(
        seller,
        mint,
        tokenAmountRaw,
        slippage,
        priorityFee
      );
    }

    const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult);

    return {
      signature,
      success: true,
    };
  } catch (error) {
    throw new Error(`SDK sell failed: ${(error as Error).message}`);
  }
}

/**
 * Get SDK instance (for advanced usage)
 */
export function getSDKInstance(
  connection: Connection,
  wallet: Keypair,
  options?: {
    jitoUrl?: string;
    useJito?: boolean;
    slotKey?: string;
    astraKey?: string;
  }
): PumpFunSDK {
  return initPumpFunSDK(connection, wallet, options);
}

