/**
 * PumpFun SDK Wrapper
 * 
 * Wraps the pumpdotfun-repumped-sdk for easier integration with our trading logic.
 * Provides simplified buy/sell methods while maintaining access to advanced features.
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PumpFunSDK } from "pumpdotfun-repumped-sdk";
import { HeliusSenderConnection } from "../helius-sender";

export interface SDKBuyParams {
  connection: Connection | HeliusSenderConnection;
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
  connection: Connection | HeliusSenderConnection;
  seller: Keypair;
  mint: PublicKey;
  tokenAmount: number;
  slippageBps: number;
  priorityFeeMicroLamports?: number;
  computeUnits?: number;
  useJito?: boolean;
  jitoTipLamports?: number;
  skipHeliusTip?: boolean; // Skip Helius Sender tip (default: true for sells)
}

export interface SDKTransactionResult {
  signature: string;
  success: boolean;
}

/**
 * Initialize PumpFun SDK
 * 
 * Pass HeliusSenderConnection to route all sends through Helius Sender
 */
export function initPumpFunSDK(
  connection: Connection | HeliusSenderConnection,
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
    jitoTipLamports = 1000000, // 0.001 SOL minimum tip
  } = params;

  // Enable Helius tip for buys
  if (connection instanceof HeliusSenderConnection) {
    connection.setTipEnabled(true);
  }

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
    skipHeliusTip = true, // Skip Helius tip for sells by default
  } = params;

  // Disable Helius tip for sells (unless explicitly enabled)
  if (connection instanceof HeliusSenderConnection) {
    connection.setTipEnabled(!skipHeliusTip);
  }

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

    // Extract signature properly
    let signature: string;
    if (typeof txResult === 'string') {
      signature = txResult;
    } else if (txResult && typeof txResult === 'object') {
      signature = txResult.signature || JSON.stringify(txResult);
    } else {
      signature = String(txResult);
    }

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
  connection: Connection | HeliusSenderConnection,
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

