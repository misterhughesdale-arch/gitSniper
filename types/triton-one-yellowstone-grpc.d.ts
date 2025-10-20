declare module "@triton-one/yellowstone-grpc" {
  import { EventEmitter } from "events";

  export enum CommitmentLevel {
    PROCESSED = 0,
    CONFIRMED = 1,
    FINALIZED = 2,
  }

  export interface SubscribeRequestFilterTransactions {
    vote?: boolean;
    failed?: boolean;
    signature?: string;
    accountInclude?: string[];
    accountExclude?: string[];
    accountRequired?: string[];
  }

  export interface SubscribeRequest {
    accounts?: Record<string, unknown>;
    slots?: Record<string, unknown>;
    transactions?: Record<string, SubscribeRequestFilterTransactions>;
    transactionsStatus?: Record<string, SubscribeRequestFilterTransactions>;
    blocks?: Record<string, unknown>;
    blocksMeta?: Record<string, unknown>;
    entry?: Record<string, unknown>;
    commitment?: CommitmentLevel;
    accountsDataSlice?: unknown[];
    ping?: unknown;
  }

  export interface UiTokenAmountLike {
    amount?: string;
    uiAmount?: number;
    uiAmountString?: string;
  }

  export interface TokenBalanceLike {
    accountIndex?: number;
    mint?: string;
    owner?: string;
    programId?: string;
    uiTokenAmount?: UiTokenAmountLike;
  }

  export interface TransactionMetaLike {
    preTokenBalances?: TokenBalanceLike[];
    postTokenBalances?: TokenBalanceLike[];
    logMessages?: string[];
  }

  export interface InnerTransactionLike {
    signature?: string | Uint8Array;
    meta?: TransactionMetaLike;
    transaction?: {
      signature?: string | Uint8Array;
      meta?: TransactionMetaLike;
    };
  }

  export interface SubscribeUpdateTransaction {
    slot?: number;
    signature?: string | Uint8Array;
    transaction?: InnerTransactionLike;
    meta?: TransactionMetaLike;
  }

  export interface SubscribeUpdate {
    filters?: string[];
    transaction?: SubscribeUpdateTransaction;
  }

  export interface YellowstoneStream extends EventEmitter {
    write(request: SubscribeRequest, cb?: (err?: Error | null) => void): void;
    end(): void;
    removeAllListeners(): void;
  }

  export default class Client {
    constructor(endpoint: string, xToken?: string, channelOptions?: unknown);
    subscribe(): Promise<YellowstoneStream>;
  }
}
