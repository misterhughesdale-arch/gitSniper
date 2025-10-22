# Solana Development Patterns for GitSniper

## Transaction Building

### Standard Pattern

```typescript
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  ComputeBudgetProgram 
} from "@solana/web3.js";

async function buildOptimizedTransaction(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[],
  priorityFeeMicroLamports: number = 50000,
  computeUnits: number = 300000
): Promise<Transaction> {
  const transaction = new Transaction();
  
  // 1. Add compute budget instructions FIRST
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeMicroLamports })
  );
  
  // 2. Add your instructions
  transaction.add(...instructions);
  
  // 3. Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payer;
  
  return transaction;
}
```

## PDA Derivation with Caching

```typescript
class PDACache {
  private cache = new Map<string, [PublicKey, number]>();
  
  getBondingCurve(mint: PublicKey, programId: PublicKey): [PublicKey, number] {
    const key = `bonding-curve-${mint.toBase58()}`;
    
    if (!this.cache.has(key)) {
      const pda = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), mint.toBuffer()],
        programId
      );
      this.cache.set(key, pda);
    }
    
    return this.cache.get(key)!;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Use singleton
export const pdaCache = new PDACache();
```

## Yellowstone gRPC Stream Management

```typescript
import Client, { CommitmentLevel } from "@triton-one/yellowstone-grpc";

class GeyserStreamManager {
  private client: Client;
  private stream: any;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  constructor(endpoint: string, token: string) {
    this.client = new Client(endpoint, token, undefined);
  }
  
  async connect(onData: (data: any) => void): Promise<void> {
    try {
      this.stream = await this.client.subscribe();
      
      this.stream.on("data", onData);
      
      this.stream.on("error", (error: Error) => {
        console.error("Stream error:", error);
        this.handleDisconnect();
      });
      
      this.stream.on("end", () => {
        console.warn("Stream ended");
        this.handleDisconnect();
      });
      
      // Subscribe to PumpFun transactions
      const request = {
        accounts: {},
        slots: {},
        transactions: {
          pumpfun: {
            vote: false,
            failed: false,
            accountInclude: ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"],
            accountExclude: [],
            accountRequired: [],
          },
        },
        transactionsStatus: {},
        entry: {},
        blocks: {},
        blocksMeta: {},
        accountsDataSlice: [],
        commitment: CommitmentLevel.CONFIRMED,
      };
      
      await new Promise<void>((resolve, reject) => {
        this.stream.write(request, (err: any) => err ? reject(err) : resolve());
      });
      
      this.reconnectAttempts = 0;
      console.log("✅ Stream connected");
      
    } catch (error) {
      console.error("Failed to connect stream:", error);
      this.handleDisconnect();
    }
  }
  
  private async handleDisconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      process.exit(1);
    }
    
    this.reconnectAttempts++;
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts})`);
    
    await new Promise(resolve => setTimeout(resolve, backoffMs));
    
    // Reconnect with same handlers
    // Implementation depends on your specific needs
  }
  
  disconnect(): void {
    if (this.stream) {
      this.stream.end();
    }
  }
}
```

## RPC Connection with Fallback

```typescript
class SolanaConnectionManager {
  private primary: Connection;
  private fallbacks: Connection[];
  private currentIndex = 0;
  
  constructor(primaryUrl: string, fallbackUrls: string[]) {
    this.primary = new Connection(primaryUrl, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });
    
    this.fallbacks = fallbackUrls.map(url => 
      new Connection(url, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      })
    );
  }
  
  async getBalance(pubkey: PublicKey): Promise<number> {
    try {
      return await this.primary.getBalance(pubkey);
    } catch (error) {
      console.warn("Primary RPC failed, trying fallback");
      return await this.getFallbackConnection().getBalance(pubkey);
    }
  }
  
  async sendTransaction(
    transaction: Transaction,
    signers: Keypair[],
    options?: SendOptions
  ): Promise<string> {
    const connections = [this.primary, ...this.fallbacks];
    
    for (let i = 0; i < connections.length; i++) {
      try {
        transaction.sign(...signers);
        const signature = await connections[i].sendRawTransaction(
          transaction.serialize(),
          options
        );
        return signature;
      } catch (error) {
        if (i === connections.length - 1) throw error;
        console.warn(`RPC ${i} failed, trying next`);
      }
    }
    
    throw new Error("All RPC endpoints failed");
  }
  
  private getFallbackConnection(): Connection {
    const connection = this.fallbacks[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.fallbacks.length;
    return connection;
  }
  
  getPrimaryConnection(): Connection {
    return this.primary;
  }
}
```

## Token Account Management

```typescript
import { 
  getAccount, 
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";

async function getOrCreateTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID
  );
  
  try {
    // Check if exists
    await getAccount(connection, ata);
    return ata;
  } catch (error) {
    // ATA doesn't exist - will be created in transaction
    // Use idempotent instruction so it's safe if it exists
    return ata;
  }
}

async function getTokenBalance(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      owner,
      { mint, programId: TOKEN_PROGRAM_ID }
    );
    
    if (tokenAccounts.value.length === 0) return 0;
    
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return parseFloat(balance);
  } catch (error) {
    console.error("Failed to get token balance:", error);
    return 0;
  }
}
```

## Confirmation Tracking (Non-Blocking)

```typescript
class ConfirmationTracker {
  private pending = new Map<string, {
    mint: string;
    sentAt: number;
    callback: (success: boolean) => void;
  }>();
  
  constructor(private connection: Connection) {
    this.startTracking();
  }
  
  track(
    signature: string, 
    mint: string, 
    callback: (success: boolean) => void
  ): void {
    this.pending.set(signature, {
      mint,
      sentAt: Date.now(),
      callback,
    });
  }
  
  private startTracking(): void {
    setInterval(async () => {
      if (this.pending.size === 0) return;
      
      const signatures = Array.from(this.pending.keys());
      
      try {
        const statuses = await this.connection.getSignatureStatuses(signatures);
        
        for (let i = 0; i < signatures.length; i++) {
          const signature = signatures[i];
          const status = statuses.value[i];
          
          if (status?.confirmationStatus === "confirmed") {
            const info = this.pending.get(signature)!;
            this.pending.delete(signature);
            info.callback(true);
          } else if (status?.err) {
            const info = this.pending.get(signature)!;
            this.pending.delete(signature);
            info.callback(false);
          } else if (Date.now() - this.pending.get(signature)!.sentAt > 60000) {
            // Timeout after 60s
            const info = this.pending.get(signature)!;
            this.pending.delete(signature);
            info.callback(false);
          }
        }
      } catch (error) {
        console.error("Confirmation tracking error:", error);
      }
    }, 1000);
  }
}
```

## Common Pitfalls to Avoid

### ❌ Don't Create Connection Per Request

```typescript
// BAD
async function buyToken() {
  const connection = new Connection(RPC_URL); // ❌ Creates new connection
  // ...
}

// GOOD
const connection = new Connection(RPC_URL); // ✅ Reuse connection

async function buyToken() {
  // Use shared connection
}
```

### ❌ Don't Await in Hot Loops

```typescript
// BAD
for (const mint of mints) {
  await processToken(mint); // ❌ Sequential
}

// GOOD
await Promise.all(
  mints.map(mint => processToken(mint)) // ✅ Parallel
);
```

### ❌ Don't Ignore Blockhash Expiry

```typescript
// BAD
const { blockhash } = await connection.getLatestBlockhash();
// ... long delay ...
transaction.recentBlockhash = blockhash; // ❌ May be expired

// GOOD
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
transaction.recentBlockhash = blockhash;
transaction.lastValidBlockHeight = lastValidBlockHeight; // ✅ Includes validity
```

### ❌ Don't Skip Error Context

```typescript
// BAD
try {
  await sendTransaction();
} catch (error) {
  console.error(error); // ❌ No context
}

// GOOD
try {
  await sendTransaction();
} catch (error) {
  console.error("Transaction failed", { // ✅ With context
    error: error.message,
    mint,
    amount,
    stack: error.stack
  });
}
```
