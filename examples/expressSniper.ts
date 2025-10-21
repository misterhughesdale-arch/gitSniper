import "dotenv/config";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import Client, {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import BN from "bn.js";

const CONFIG = {
  PUMP_PROGRAM: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
  PUMP_TOKEN_PROGRAM: "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",
  PUMP_GLOBAL: new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"),
  PUMP_FEE_RECIPIENT: new PublicKey(
    "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM",
  ),
  PUMP_EVENT_AUTHORITY: new PublicKey(
    "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1",
  ),
  PUMP_FEE_PROGRAM: new PublicKey(
    "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
  ),
  BUY_AMOUNT_SOL: 0.01, // .01 SOL MAX BUY
  SELL_TIMEOUT_MS: 10000, // 10 seconds - sell if no other buys
  SLIPPAGE_BPS: 500,
  COMPUTE_UNITS: 250000, // Match successful competitor
};

const DISCRIMINATORS = {
  BUY: Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]),
  SELL: Buffer.from([0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]),
};

let latestBlockhash: string | null = null;
const processedTokens = new Set<string>();
const activePositions = new Map<
  string,
  {
    mint: PublicKey;
    creator: PublicKey;
    buyTimestamp: number;
    otherBuysDetected: boolean;
    sellTimeout: NodeJS.Timeout;
  }
>();

function log(_level: string, msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

type DetectionSnapshot = {
  shouldBuy: boolean;
  reason: string;
};

function evaluateBuyReadinessForTest(
  mint: string,
  persist: boolean = false,
): DetectionSnapshot {
  const hasBlockhash = latestBlockhash !== null;
  const alreadyProcessed = processedTokens.has(mint);

  let shouldBuy = true;
  let reason = "ok";

  if (!hasBlockhash) {
    shouldBuy = false;
    reason = "blockhash";
  } else if (alreadyProcessed) {
    shouldBuy = false;
    reason = "processed";
  }

  if (shouldBuy && persist) {
    processedTokens.add(mint);
  }

  return { shouldBuy, reason };
}

function resetStateForTests() {
  latestBlockhash = null;
  processedTokens.clear();
  activePositions.clear();
}

function setLatestBlockhashForTest(hash: string | null) {
  latestBlockhash = hash;
}

// PDA derivation helpers
function findCreatorVault(creator: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    CONFIG.PUMP_PROGRAM,
  );
  return pda;
}

function findGlobalVolumeAccumulator(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    CONFIG.PUMP_PROGRAM,
  );
  return pda;
}

function findUserVolumeAccumulator(user: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    CONFIG.PUMP_PROGRAM,
  );
  return pda;
}

function findFeeConfig(): PublicKey {
  // fee_config seed: [b"fee_config", <32-byte constant from IDL>]
  const constant = Buffer.from([
    1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81,
    137, 203, 151, 245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
  ]);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), constant],
    CONFIG.PUMP_FEE_PROGRAM,
  );
  return pda;
}

function buildBuyTx(
  wallet: Keypair,
  mint: PublicKey,
  creator: PublicKey,
  priorityFee: number,
  blockhash: string,
): Transaction {
  const tx = new Transaction();

  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: CONFIG.COMPUTE_UNITS }),
  );
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
  );

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    CONFIG.PUMP_PROGRAM,
  );

  // CORRECT: associatedBondingCurve is the ATA of the bonding curve
  const associatedBondingCurve = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
  );
  const buyerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);

  // Derive all the new required PDAs
  const creatorVault = findCreatorVault(creator);
  const globalVolumeAccumulator = findGlobalVolumeAccumulator();
  const userVolumeAccumulator = findUserVolumeAccumulator(wallet.publicKey);
  const feeConfig = findFeeConfig();

  // Pre-create our ATA
  tx.add(
    createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      buyerAta,
      wallet.publicKey,
      mint,
    ),
  );

  // Request reasonable token amount for 0.001 SOL
  // Based on: 893k tokens for 0.02 SOL → ~18k tokens for 0.001 SOL
  // Request slightly more to account for favorable early pricing
  const tokenAmount = BigInt("100000000000"); // 250k tokens with 6 decimals = 25,000,000,000
  const maxSolCost = Math.floor(CONFIG.BUY_AMOUNT_SOL * LAMPORTS_PER_SOL); // Strict limit: 0.001 SOL

  // All 16 accounts as per IDL
  tx.add(
    new TransactionInstruction({
      programId: CONFIG.PUMP_PROGRAM,
      keys: [
        { pubkey: CONFIG.PUMP_GLOBAL, isSigner: false, isWritable: false },
        {
          pubkey: CONFIG.PUMP_FEE_RECIPIENT,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: buyerAta, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: creatorVault, isSigner: false, isWritable: true },
        {
          pubkey: CONFIG.PUMP_EVENT_AUTHORITY,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: CONFIG.PUMP_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: true },
        { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
        { pubkey: feeConfig, isSigner: false, isWritable: false },
        { pubkey: CONFIG.PUMP_FEE_PROGRAM, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        DISCRIMINATORS.BUY,
        Buffer.from(new BN(tokenAmount.toString()).toArray("le", 8)),
        Buffer.from(new BN(maxSolCost).toArray("le", 8)),
        Buffer.from([0]), // track_volume: OptionBool::None
      ]),
    }),
  );

  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  return tx;
}

function buildSellTx(
  wallet: Keypair,
  mint: PublicKey,
  creator: PublicKey,
  tokenAmount: bigint,
  priorityFee: number,
  blockhash: string,
): Transaction {
  const tx = new Transaction();

  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: CONFIG.COMPUTE_UNITS }),
  );
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
  );

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    CONFIG.PUMP_PROGRAM,
  );

  const associatedBondingCurve = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
  );
  const sellerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);

  // Derive all the new required PDAs
  const creatorVault = findCreatorVault(creator);
  const globalVolumeAccumulator = findGlobalVolumeAccumulator();
  const userVolumeAccumulator = findUserVolumeAccumulator(wallet.publicKey);
  const feeConfig = findFeeConfig();

  const minSolOutput = 1; // Minimum SOL to receive

  // All 16 accounts as per IDL
  tx.add(
    new TransactionInstruction({
      programId: CONFIG.PUMP_PROGRAM,
      keys: [
        { pubkey: CONFIG.PUMP_GLOBAL, isSigner: false, isWritable: false },
        {
          pubkey: CONFIG.PUMP_FEE_RECIPIENT,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: sellerAta, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: creatorVault, isSigner: false, isWritable: true },
        {
          pubkey: CONFIG.PUMP_EVENT_AUTHORITY,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: CONFIG.PUMP_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: true },
        { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
        { pubkey: feeConfig, isSigner: false, isWritable: false },
        { pubkey: CONFIG.PUMP_FEE_PROGRAM, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        DISCRIMINATORS.SELL,
        Buffer.from(new BN(tokenAmount.toString()).toArray("le", 8)),
        Buffer.from(new BN(minSolOutput).toArray("le", 8)),
        Buffer.from([0]), // track_volume: OptionBool::None
      ]),
    }),
  );

  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  return tx;
}

async function executeSell(
  connection: Connection,
  wallet: Keypair,
  mint: PublicKey,
  creator: PublicKey,
  mintStr: string,
  reason: string,
) {
  try {
    log("INFO", `⏰ Attempting sell for ${mintStr} (${reason})`);
    const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey);

    // Retry fetching account up to 3 times
    let acc = null;
    for (let i = 0; i < 3; i++) {
      acc = await connection.getAccountInfo(ata);
      if (acc) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!acc) {
      log("ERROR", `❌ No ATA account for ${mintStr} at ${ata.toBase58()}`);
      return;
    }
    if (acc.data.length < 72) {
      log("ERROR", `❌ ATA data too short: ${acc.data.length}`);
      return;
    }
    const amt = acc.data.readBigUInt64LE(64);
    log("INFO", `📊 Token balance: ${amt.toString()}`);
    if (amt === BigInt(0)) {
      log("ERROR", `❌ Zero balance for ${mintStr}`);
      return;
    }
    if (!latestBlockhash) {
      log("ERROR", `❌ No blockhash for sell`);
      return;
    }
    const sellTx = buildSellTx(
      wallet,
      mint,
      creator,
      amt,
      5000000, // 5M microlamports priority fee for better landing rate
      latestBlockhash,
    );
    sellTx.sign(wallet);
    const sellSig = await connection.sendRawTransaction(sellTx.serialize(), {
      skipPreflight: true,
      maxRetries: 0,
    });
    log("SUCCESS", `💰 SELL: ${sellSig}`);
  } catch (e) {
    log("ERROR", `❌ Sell error: ${e}`);
  } finally {
    activePositions.delete(mintStr);
  }
}

async function main() {
  const rpcUrl = process.env.SHYFT_RPC_URL!.startsWith("http")
    ? process.env.SHYFT_RPC_URL!
    : `https://${process.env.SHYFT_RPC_URL!}`;
  const connection = new Connection(rpcUrl);
  const wallet = Keypair.fromSecretKey(
    bs58.decode(process.env.WALLET_PRIVATE_KEY!),
  );

  log("INFO", `🚀 Wallet: ${wallet.publicKey.toBase58()}`);

  const client = new Client(
    process.env.GRPC_URL!,
    process.env.X_TOKEN,
    undefined,
  );
  const stream = await client.subscribe();

  stream.on("data", async (data: any) => {
    try {
      // Capture blockhash
      if (data.blockMeta?.blockhash) {
        latestBlockhash = data.blockMeta.blockhash;
      }

      // Detect new pump tokens and subsequent buys
      const txn = data.transaction;
      if (txn?.transaction?.meta?.postTokenBalances) {
        const meta = txn.transaction.meta;
        const mintStr = meta.postTokenBalances[0]?.mint;

        if (mintStr && mintStr.endsWith("pump")) {
          // Check if this is a buy transaction
          const preBalances = meta.preBalances || [];
          const postBalances = meta.postBalances || [];
          const solSpent =
            (preBalances[0] - postBalances[0]) / LAMPORTS_PER_SOL;

          // Check if we already have a position in this token
          if (activePositions.has(mintStr)) {
            // This is a subsequent buy - trigger sell immediately
            const position = activePositions.get(mintStr)!;
            if (!position.otherBuysDetected) {
              position.otherBuysDetected = true;
              clearTimeout(position.sellTimeout);
              log(
                "INFO",
                `📈 Other buy detected on ${mintStr} (${solSpent.toFixed(3)} SOL) - selling for profit`,
              );
              await executeSell(
                connection,
                wallet,
                position.mint,
                position.creator,
                mintStr,
                "other buys detected",
              );
            }
            return;
          }

          // This is a new token creation - buy immediately
          if (processedTokens.has(mintStr)) {
            // Already attempted to trade this token
            return;
          }

          processedTokens.add(mintStr);
          const mint = new PublicKey(mintStr);
          log("INFO", `🆕 New token detected: ${mintStr} - buying immediately`);

          if (!latestBlockhash) {
            log("ERROR", "❌ No blockhash");
            return;
          }

          // Extract creator from transaction
          const transaction = txn.transaction.transaction;
          const accountKeys = transaction.message?.accountKeys;
          if (!accountKeys || accountKeys.length === 0) {
            log("ERROR", "❌ No account keys");
            return;
          }
          const creator = new PublicKey(accountKeys[0]);

          // BUY IMMEDIATELY ON CREATION
          try {
            const buyTx = buildBuyTx(
              wallet,
              mint,
              creator,
              5000000, // 5M microlamports priority fee = 0.005 SOL for better landing rate
              latestBlockhash,
            );
            buyTx.sign(wallet);
            const sig = await connection.sendRawTransaction(buyTx.serialize(), {
              skipPreflight: true,
              maxRetries: 0,
            });
            log("SUCCESS", `✅ BUY: ${sig}`);

            // Set up timeout to sell after 60s if no other buys
            const sellTimeout = setTimeout(async () => {
              const position = activePositions.get(mintStr);
              if (position && !position.otherBuysDetected) {
                log("INFO", `⏰ 60s timeout - no other buys on ${mintStr}`);
                await executeSell(
                  connection,
                  wallet,
                  mint,
                  creator,
                  mintStr,
                  "60s timeout",
                );
              }
            }, CONFIG.SELL_TIMEOUT_MS);

            // Track this position
            activePositions.set(mintStr, {
              mint,
              creator,
              buyTimestamp: Date.now(),
              otherBuysDetected: false,
              sellTimeout,
            });
          } catch (e) {
            log("ERROR", `❌ Buy: ${e}`);
          }
        }
      }
    } catch {}
  });

  const req: SubscribeRequest = {
    accounts: {},
    slots: {},
    transactions: {
      pumpfun: {
        vote: false,
        failed: false,
        signature: undefined,
        accountInclude: [CONFIG.PUMP_TOKEN_PROGRAM],
        accountExclude: [],
        accountRequired: [],
      },
    },
    blocks: {},
    blocksMeta: {
      blockmeta: {},
    },
    entry: {},
    accountsDataSlice: [],
    commitment: CommitmentLevel.PROCESSED,
  };

  stream.write(req);
  await new Promise(() => {});
}

if (process.env.NODE_ENV !== "test") {
  main().catch(console.error);
}

export const __testHooks = {
  buildBuyTx,
  buildSellTx,
  evaluateBuyReadinessForTest,
  resetStateForTests,
  setLatestBlockhashForTest,
};