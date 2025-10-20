# MVP Sniper - REAL Geyser Stream with Simulation

## What It Does RIGHT NOW

1. ✅ **REAL Geyser Stream**: Connects to Shyft Yellowstone gRPC
2. ✅ **REAL Events**: Listens for actual Pump.fun token creations on mainnet
3. ✅ **REAL Transaction Building**: Constructs actual buy transactions
4. ✅ **REAL Simulation**: Runs preflight simulation (preflight: true)
5. ⏸️ **STOPS**: Does NOT send transactions on-chain
6. ✅ **Metrics**: Tracks all latencies and success rates

## Quick Start

```bash
# 1. Set up environment
cp .env.template .env
# Edit .env with:
# - SOLANA_RPC_PRIMARY (your RPC endpoint)
# - GEYSER_ENDPOINT (grpc.shyft.to:443)
# - GEYSER_AUTH_TOKEN (your Shyft API key)
# - TRADER_KEYPAIR_PATH (./keypairs/trader.json)

# 2. Create wallet
mkdir -p keypairs
# Place your keypair JSON at keypairs/trader.json

# 3. Install
pnpm install

# 4. Run MVP
pnpm dev:mvp
```

## What You'll See

```
🎯 MVP Sniper starting
✅ Geyser stream connected - waiting for Pump.fun events...
📡 Geyser event received { mint: 'ABC...', slot: 12345678 }
🎯 New token detected - building & simulating
✅ Transaction built { buildTimeMs: 45 }
✅ Simulation SUCCESS - would send if enabled {
  detectionLatencyMs: 23,
  buildTimeMs: 45,
  simTimeMs: 67,
  totalLatencyMs: 135,
  unitsConsumed: 145623
}
```

## Metrics Tracked

Real-time performance metrics:

- `detection_latency_ms` - Geyser event → handler start
- `transaction_build_ms` - Time to construct transaction
- `transaction_simulate_ms` - Preflight simulation time
- `end_to_end_latency_ms` - Total pipeline latency
- `pumpfun_creation_events` - Count of detected tokens
- `simulation_successes` - Count of successful simulations
- `simulation_failures` - Count of failed simulations
- `pipeline_failures` - Complete failures

## Output

### Console Logs
Structured JSON logs with context:
```json
{
  "level": "info",
  "time": "2025-10-20T...",
  "msg": "Simulation SUCCESS",
  "mint": "...",
  "detectionLatencyMs": 23,
  "buildTimeMs": 45,
  "simTimeMs": 67,
  "totalLatencyMs": 135
}
```

### Metrics File
`logs/mvp-metrics.log` contains periodic summaries:
```json
{
  "timestamp": "2025-10-20T...",
  "summary": {
    "loop": "token_snipe_simulation",
    "mint": "...",
    "success": true,
    "detectionLatencyMs": 23,
    "buildTimeMs": 45,
    "simTimeMs": 67
  },
  "counters": {
    "pumpfun_creation_events": 5,
    "simulation_successes": 3,
    "simulation_failures": 2
  },
  "latencies": {
    "end_to_end_latency_ms": { "count": 5, "avg_ms": 142.5, "max_ms": 235 }
  }
}
```

## Configuration

Edit `config/default.toml`:

```toml
[geyser.subscriptions]
pumpfun_program_ids = ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]

[strategy]
buy_amount_sol = 0.01      # SOL amount per buy
max_slippage_bps = 300     # 3% slippage

[jito]
priority_fee_lamports = 10000  # Priority fee
```

## Why Simulation Only?

This lets you:
1. ✅ Verify Geyser stream works
2. ✅ Confirm token detection logic
3. ✅ Test transaction building
4. ✅ Check simulation success rates
5. ✅ Measure latencies
6. ⚠️ **WITHOUT SPENDING SOL**

## Next Steps

Once you've verified simulation works:

1. **Enable Sending**: Change simulation flag in config
2. **Add Jito Integration**: Route through Jito Block Engine
3. **Add Filters**: Liquidity checks, creator whitelist
4. **Add Sell Logic**: Automated sells after hold period

## Safety Notes

⚠️ **Current Mode**: SIMULATION ONLY - No transactions sent
⚠️ **Real Events**: You'll see REAL mainnet tokens being created
⚠️ **Real Building**: Transactions are built with REAL parameters
⚠️ **Real Simulation**: Uses your RPC quota for preflights

When ready to send real transactions:
- Start with SMALL amounts (0.001 SOL)
- Use a TEST wallet first
- Monitor success rates carefully
- Watch for RPC rate limits
