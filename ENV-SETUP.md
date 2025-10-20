# Environment Setup

Add these to your `.env` file:

```bash
# Geyser Stream (REQUIRED)
GRPC_URL=grpc.ny.shyft.to:443
X_TOKEN=390d8dba-2096-4e6b-85ae-f68b002efa3c

# Solana RPC (REQUIRED)
SOLANA_RPC_PRIMARY=https://rpc.shyft.to?api_key=Rn_TYzGG7lvEq0kF

# Jito Block Engine (REQUIRED)
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf/api/v1/transactions
JITO_TIP_ACCOUNT=96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5

# Trader Wallet (REQUIRED)
TRADER_KEYPAIR_PATH=./keypairs/trader.json

# Strategy (Optional - has defaults)
BUY_AMOUNT_SOL=0.001
SLIPPAGE_BPS=500
PRIORITY_FEE=100000
JITO_TIP=10000
```

## Jito Tip Account Rotation

Use different tip accounts to avoid congestion:

```bash
# Pick one randomly:
JITO_TIP_ACCOUNT=96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5
JITO_TIP_ACCOUNT=HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe
JITO_TIP_ACCOUNT=Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY
JITO_TIP_ACCOUNT=ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49
JITO_TIP_ACCOUNT=DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh
JITO_TIP_ACCOUNT=ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt
JITO_TIP_ACCOUNT=DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL
JITO_TIP_ACCOUNT=3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT
```

## NO HARDCODED VALUES

All URLs and addresses MUST come from environment variables.
Script will fail with clear error if any required variable is missing.

