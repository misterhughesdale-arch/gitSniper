# Pull config
OHLCV_CHAIN=solana
OHLCV_INTERVAL=5m
OHLCV_DAYS=14           # 14 days of 5m = ~4032 candles
WINDOW_DAYS=14          # only fetch tokens called within this many days from now

HELIUS_API_KEY=b09e2845-90c6-4218-b86f-2dc37d6cc444
# Control spend & parallelism
CU_BUDGET=50000         # hard cap for this run (tune!)
MAX_CONCURRENCY=3       # be polite to the API
DRY_RUN=0               # set to 1 to simulate without calling

# Solana Configuration
RPC_ENDPOINT=https://rpc.shyft.to?api_key=Rn_TYzGG7lvEq0kF
BACKUP_RPC_ENDPOINT=https://rpc.shyft.to?api_key=Rn_TYzGG7lvEq0kF

# Shyft Configuration (Yellowstone gRPC)
SHYFT_API_KEY=390d8dba-2096-4e6b-85ae-f68b002efa3c
SHYFT_RPC_API_KEY=Rn_TYzGG7lvEq0kF
SHYFT_RPC_URL=https://rpc.shyft.to?api_key=Rn_TYzGG7lvEq0kF
SHYFT_GRPC_URL=https://grpc.ny.shyft.to:443
SHYFT_GRAPHQL_URL=https://programs.shyft.to/v0/graphql/?api_key=Rn_TYzGG7lvEq0kF&network=mainnet-beta
FALLBACK_RPC_URL=https://rpc.shyft.to?api_key=Rn_TYzGG7lvEq0kF
# gRPC Configuration (Shyft Yellowstone)
GRPC_URL=https://grpc.ny.shyft.to:443
X_TOKEN=390d8dba-2096-4e6b-85ae-f68b002efa3c
GRPC_TOKEN=390d8dba-2096-4e6b-85ae-f68b002efa3c
RPC_API_KEY=Rn_TYzGG7lvEq0kF

# Wallet Configuration (REPLACE WITH YOUR WALLET)
WALLET_PRIVATE_KEY=4DEG1gyActkp52gLbVwVt3Q7RjHVjGfjJqzkLxEhd4GzEUJF3d1x5FsW2xppf1a3fRxJBawtWJ1RMjkmCVoVswpf

# Trading Configuration
EXECUTE=true
BUY_AMOUNT_SOL=0.035
MAX_SOL_PER_TRADE=0.07
DEFAULT_SLIPPAGE=0.1
PRIORITY_FEE=0.001
USE_DUST_SELL=false
MAX_FEE_PERCENT=5
HELIUS_SENDER_ENDPOINTS=https://ny-sender.helius-rpc.com/fast,https://ewr-sender.helius-rpc.com/fast
HELIUS_SEND_URL=https://ny-sender.helius-rpc.com/fast
HELIUS_TIP_SOL=0.00002
COMPUTE_UNITS=80000
COMPUTE_UNITS_SELL=80000
DUST_SELL_COMPUTE_UNITS=80000
BUY_PRIORITY_FEE_SOL=0.00002
SELL_PRIORITY_FEE_SOL=0.00002
SELL_DUST_PRIORITY_FEE_SOL=0.00002

# Position Management
TAKE_PROFIT=1.5
STOP_LOSS=0.7
DYNAMIC_SLIPPAGE=true
TRAILING_STOP_PERCENT=30
MAX_POSITION_TIME=1800

# Optional Services
USE_JITO=false
JITO_TIP_STREAM=false
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=token_sniper
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
