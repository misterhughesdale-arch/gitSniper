# 🚀 RUNNING THE SNIPER

## Current Status

✅ **Stream Working** - 26+ tokens detected in seconds  
✅ **Transaction Builder** - Ready  
✅ **Jito Integration** - Ready  
⏳ **Testing** - In progress  

## Quick Commands

```bash
# 1. Stream only (no buying) - WORKING NOW
pnpm dev:working

# 2. Full sniper (build + simulate + send via Jito)
pnpm dev:full
```

## Required Environment Variables

Add to your `.env`:

```bash
# Geyser Stream (WORKING)
GRPC_URL=grpc.ny.shyft.to:443
X_TOKEN=your-shyft-api-key

# RPC
SOLANA_RPC_PRIMARY=https://rpc.shyft.to?api_key=your-key

# Jito (for sending)
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf/api/v1/transactions
JITO_TIP_ACCOUNT=96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5
JITO_TIP=10000

# Trader Wallet
TRADER_KEYPAIR_PATH=./keypairs/trader.json

# Strategy
BUY_AMOUNT_SOL=0.001
SLIPPAGE_BPS=500
PRIORITY_FEE=100000
```

## What Each Script Does

### `pnpm dev:working` (SAFE - Stream Only)

- ✅ Connects to Geyser
- ✅ Detects tokens in real-time
- ✅ Shows full addresses
- ❌ Does NOT build or send transactions

### `pnpm dev:full` (LIVE - Real Sending!)

- ✅ Connects to Geyser
- ✅ Detects tokens
- ✅ Builds buy transactions
- ✅ Simulates transactions
- ✅ Sends via Jito with tip
- ✅ Tracks confirmations
- ⚠️  **SPENDS REAL SOL!**

## Safety Checklist

Before running `dev:full`:

1. ✅ Check `BUY_AMOUNT_SOL` is small (0.001 SOL recommended)
2. ✅ Verify `TRADER_KEYPAIR_PATH` points to correct wallet
3. ✅ Ensure wallet has enough SOL for fees + buys
4. ✅ Test with `dev:working` first
5. ✅ Monitor output carefully

## Sample Output (Full Sniper)

### 🚀 FULL SNIPER - REAL JITO SENDING

💰 Buy Amount: 0.001 SOL
📊 Slippage: 5%
⚡ Priority Fee: 100000 lamports
💎 Jito Tip: 10000 lamports
🎯 Trader: YourWalletAddress...
✅ Stream connected

🪙 TOKEN #1 - DgnFCvkrV8SGDWPKzwTe5znV2vd8FCX9iEaZr5YJpump
   Owner: HrEP1YmhZnQpnT7EbUqDgm9GYTYZjKZdpXMTXDWR1RMu
   ⚙️  Built: 45ms | Tip: 10000 lamports
   ✅ Sim OK: 67ms | Units: 145623
   ✅ Sent via Jito: 5VERv8NMvz... (89ms)
   📊 Total: 201ms | Sig: 5VERv8NMvz...
   🎉 CONFIRMED: DgnFCvkrV... - 5VERv8NMvz...

## Jito Tip Accounts (Rotating)

Use different tip accounts to distribute load:

```

96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5
HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe
Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY
ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49
DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh
ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt
DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL
3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT
```

## Metrics Tracked

- `tokensDetected` - Total tokens seen
- `txBuilt` - Transactions constructed
- `simSuccess/simFailed` - Simulation results
- `txSent` - Sent to Jito
- `txConfirmed` - Landed on-chain
- `txFailed` - Failed transactions

Press Ctrl+C to see final stats!
