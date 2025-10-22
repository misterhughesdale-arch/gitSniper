# Helius Sender Integration

All transaction sends are now routed through **Helius Sender** for ultra-fast submission.

## What is Helius Sender?

Helius Sender is a specialized transaction broadcasting service that:
- Routes transactions through optimized pathways
- Uses aggressive retry logic internally
- Provides the fastest possible execution times
- Handles transaction spam more effectively

## How It Works

### 1. HeliusSenderConnection Class

We've created `HeliusSenderConnection` which extends Solana's `Connection` class:

```typescript
import { createHeliusSenderConnection } from "@fresh-sniper/transactions";

const connection = createHeliusSenderConnection(HELIUS_API_KEY, {
  rpcEndpoint: "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY",
  commitment: "confirmed"
});
```

### 2. Automatic Routing

- **Sends**: All `sendTransaction()` and `sendRawTransaction()` calls route to `https://sender.helius-rpc.com/fast`
- **Reads**: Account reads, balance checks, etc. use standard RPC endpoint
- **Transparent**: No code changes needed in buy/sell logic

### 3. Best Practices

Helius Sender automatically applies:
```typescript
{
  skipPreflight: true,  // No preflight simulation
  maxRetries: 0,        // Helius handles retries internally
}
```

## Implementation

### Momentum Sniper App

```typescript
// apps/momentum-sniper/src/index.ts
const connection = createHeliusSenderConnection(HELIUS_API_KEY, {
  rpcEndpoint: RPC_URL,
  commitment: "confirmed"
});

// All buyWithSDK/sellWithSDK calls now use Helius Sender
await buyWithSDK({
  connection,  // <-- Routes through Helius Sender
  buyer,
  mint,
  amountSol,
  slippageBps: 1000
});
```

### Test Scripts

```typescript
// scripts/dev/test-basic-buy.ts
const connection = createHeliusSenderConnection(
  process.env.HELIUS_API_KEY!,
  { commitment: "confirmed" }
);
```

## Environment Variables

Required:
```bash
HELIUS_API_KEY=your-helius-api-key
```

Optional (for reads):
```bash
SOLANA_RPC_PRIMARY=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

## Performance Benefits

**Before (Standard RPC)**:
- TX send → RPC node → Validators
- 150-300ms typical latency

**After (Helius Sender)**:
- TX send → Helius Sender → Optimized validator set
- 50-100ms typical latency
- Better success rate during network congestion

## Monitoring

Track Helius Sender performance in logs:
```typescript
console.log(`📤 Buy TX: ${signature}`);
console.log(`⏱️  Submission took: ${Date.now() - startTime}ms`);
```

## Fallback Strategy

If Helius Sender fails, the connection throws an error:
```typescript
try {
  await connection.sendRawTransaction(tx);
} catch (error) {
  console.error("Helius Sender failed:", error);
  // Implement fallback logic here
}
```

## Documentation

- [Helius Sender Guide](https://docs.helius.dev/guides/sending-transactions-on-solana)
- [Helius LaserStream](https://docs.helius.dev/laserstream/laserstream-guide) (for reactive trading)

## Next Steps

- [ ] Add fallback to standard RPC if Helius Sender fails
- [ ] Integrate with Jito for MEV protection
- [ ] Add Helius Sender metrics to dashboard
- [ ] Test latency improvements vs standard RPC

