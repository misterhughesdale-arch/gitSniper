# Quick Start - Fresh Sniper

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Set Up Environment

Create a `.env` file in the root:

```env
SOLANA_RPC_PRIMARY=https://api.mainnet-beta.solana.com
GEYSER_ENDPOINT=grpc.shyft.to:443
GEYSER_AUTH_TOKEN=your-token
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
JITO_TIP_ACCOUNT=96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5
TRADER_KEYPAIR_PATH=./keypairs/trader.json
TRADER_WALLET_ADDRESS=YourPubkey
```

## Step 3: Build

```bash
pnpm build
```

## Step 4: Run Sanity Check

```bash
npx tsx scripts/sanity-check.ts
```

## Step 5: Test Hot Route (Optional)

```bash
pnpm start:hot-route
```

Then in another terminal:
```bash
curl http://localhost:8080/health
```

## What Works Now

✅ Config loading with TOML + Zod validation  
✅ Logging and metrics  
✅ Event bus for domain events  
✅ Trade position store  
✅ Transaction builders (build + simulate)  
✅ Express API endpoints  

## What's NOT Implemented Yet

❌ Actual transaction sending  
❌ Geyser live streaming  
❌ Jito bundle submission  
❌ Automated buy/sell triggers  

## Next Steps

1. Test that the code compiles: `pnpm build`
2. Run sanity checks: `npx tsx scripts/sanity-check.ts`
3. Fix any issues found
4. Then proceed with Jito integration and actual transaction sending

