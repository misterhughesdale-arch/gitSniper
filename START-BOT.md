# 🚀 START THE MOMENTUM SNIPER

## Quick Start (AWS)

```bash
cd ~/gitSniper/gitSniper
git pull origin main
pnpm build
npx tsx apps/momentum-sniper/src/index.ts
```

## Safety First! ⚠️

**BEFORE running with real money:**

1. **Edit strategy config** for test amounts:
```bash
nano strategies/momentum-breakeven.toml
```

Change this line:
```toml
buy_amount_sol = 0.001  # Start with 0.001 SOL ($0.20)
```

2. **Check your balance**:
```bash
# Your wallet: 42h7HqyNr9jbNwZWNPtqwnrGpNBaV5dFoiLAHK6zBriw
# Current balance: ~0.02 SOL
# With 0.001 SOL buys: ~20 attempts
```

3. **Verify .env settings**:
```bash
cat .env | grep -E "(GRPC_URL|X_TOKEN|HELIUS_API_KEY|TRADER_KEYPAIR_PATH)"
```

## What the Bot Does

1. **Detects** new PumpFun tokens via Yellowstone gRPC
2. **Buys** 0.001 SOL worth using Helius Sender (with 0.001 SOL tip)
3. **Tracks momentum** (buy/sell activity)
4. **Sells 50%** at breakeven market cap
5. **Holds rest** while momentum continues
6. **Exits** on 2s lull OR sell pressure

## Current Configuration

✅ **Helius Sender**: Enabled for buys (0.001 SOL tip, SLC region)
✅ **Standard RPC**: Used for sells (saves 0.001 SOL tip)
✅ **PumpFun SDK**: Integrated for reliable transactions
✅ **Yellowstone gRPC**: Real-time token detection

## Monitor the Bot

```bash
# If running in foreground: Press Ctrl+C to stop
# Bot will print session stats on exit

# If running in background:
tail -f sniper.log

# Stop background process:
pkill -f "momentum-sniper"
```

## Expected Output

```
🎯 MOMENTUM-BASED SNIPER
========================

Strategy: Momentum Breakeven
Wallet: 42h7HqyNr9jbNwZWNPtqwnrGpNBaV5dFoiLAHK6zBriw
Buy: 0.001 SOL
Breakeven: 9000 SOL MC
Lull threshold: 2s
Buy/Sell ratio: 1.5

✅ Stream connected
🎯 Monitoring for tokens...

🪙 Token #1: EFPijYKn... (age: 0ms, balance: 0.02 SOL)
   📤 Buy TX: 3BxUfJbxzToJw...
   🔗 https://solscan.io/tx/3BxUfJbxzToJw...
   ✅ Buy CONFIRMED - starting momentum tracking
```

## Performance Expectations

**Detection to Buy**:
- Yellowstone gRPC: ~10-50ms to see new token
- Transaction send: ~30-50ms (Helius Sender)
- Total: **~40-100ms** from token creation to buy TX sent

**Confirmation**:
- ~400-600ms for on-chain confirmation
- Start momentum tracking immediately after

## Troubleshooting

**No detections?**
```bash
# Test gRPC connection
npx tsx apps/momentum-sniper/src/debug.ts
```

**Low balance?**
```bash
# Check balance
npx tsx -e "import {Connection,PublicKey} from '@solana/web3.js'; const c=new Connection('https://api.mainnet-beta.solana.com'); c.getBalance(new PublicKey('42h7HqyNr9jbNwZWNPtqwnrGpNBaV5dFoiLAHK6zBriw')).then(b=>console.log((b/1e9).toFixed(4)+' SOL'))"
```

**TX failures?**
- Check Helius Sender is working: Look for "Helius Sender" in error messages
- Verify tip is being paid: Each buy costs 0.001 SOL buy + 0.001 SOL tip = 0.002 SOL total

## Scaling Up

Once comfortable with 0.001 SOL buys:

1. Edit `strategies/momentum-breakeven.toml`:
```toml
buy_amount_sol = 0.01  # Increase to 0.01 SOL
```

2. Increase balance:
```bash
# Send more SOL to: 42h7HqyNr9jbNwZWNPtqwnrGpNBaV5dFoiLAHK6zBriw
```

3. Monitor performance and adjust strategy parameters

## Stop the Bot

```bash
# Ctrl+C (if running in foreground)

# Or kill background process:
pkill -f "momentum-sniper"
```

Bot will print session stats:
```
🛑 Shutting down gracefully...

📊 Session Stats:
   Tokens detected: 50
   Buy attempts: 20
   Buy success: 18 (90.0%)
   Sell attempts: 15
   Sell success: 14 (93.3%)
```

## Ready to Start?

```bash
npx tsx apps/momentum-sniper/src/index.ts
```

🚀 **Good luck!**

