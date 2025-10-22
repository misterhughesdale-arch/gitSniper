# 🎯 Momentum-Based Auto-Sell Strategy

**Status**: ✅ Implemented  
**Date**: 2025-10-22

---

## 📋 Overview

A sophisticated auto-sell strategy that monitors buy/sell pressure via Geyser stream and exits positions based on momentum signals.

### Core Logic

1. **Buy** → Token detected via stream
2. **Monitor** → Track all buys/sells for that specific mint
3. **Breakeven** → Sell 50% when market cap reaches 9000 SOL
4. **Hold** → Continue holding while buys maintain momentum
5. **Exit** → Dump remainder if:
   - 2+ second lull (no buys)
   - Sells > buys
   - Max hold time reached

---

## 📦 Implementation

### Package: `@fresh-sniper/auto-sell`

**Files Created**:

packages/auto-sell/
├── src/
│   ├── momentum-tracker.ts      ✅ Tracks buy/sell events & ratios
│   ├── position-manager.ts      ✅ Manages position lifecycle
│   ├── strategy-config.ts       ✅ Loads TOML configs
│   └── index.ts                 ✅ Exports
├── package.json
└── tsconfig.json

### Configuration: `strategies/momentum-breakeven.toml`

```toml
[strategy.targets]
breakeven_market_cap = 9000  # Sell 50% at this market cap

[strategy.momentum]
lull_threshold_seconds = 2.0          # Exit if no buys
monitor_window_seconds = 10           # Rolling window
buy_sell_ratio_threshold = 0.5        # Exit if ratio < 0.5

[strategy.exit]
time_based_exit_seconds = 300         # Max 5 min hold
dump_slippage_bps = 3000              # 30% for emergency
```

### Script: `scripts/momentum-sniper.ts`

New script that integrates the strategy:

```bash
tsx scripts/momentum-sniper.ts
```

---

## 🔧 Key Features

### 1. Momentum Tracker

**Tracks**:

- Buy events (amount + signature)
- Sell events (amount + signature)
- Time since last buy
- Buy/sell ratio in rolling window

**Example**:

```typescript
const tracker = new MomentumTracker(mint, {
  lullThresholdMs: 2000,      // 2 seconds
  windowMs: 10000,            // 10 second window
  buySellRatioThreshold: 0.5, // Exit if < 50%
});

tracker.recordBuy(0.1, "sig123...");
tracker.recordSell(0.05, "sig456...");

const state = tracker.getState();
// {
//   recentBuys: 12,
//   recentSells: 3,
//   buySellRatio: 0.8,  // 80% buys
//   hasLull: false,
//   shouldExit: false
// }
```

### 2. Position Manager

**Manages**:

- Position lifecycle (active → partial_exit → exited)
- Breakeven sell execution
- Momentum-based exit logic
- Time-based exit enforcement

**Example**:

```typescript
const manager = new PositionManager(
  connection,
  trader,
  strategy,
  async (mint, percentage, reason) => {
    await executeSell(mint, percentage, reason);
  }
);

manager.startPosition(mint, buyTx, 0.01, 100000000);

// Manager automatically:
// - Monitors momentum every 100ms
// - Sells 50% at breakeven MC
// - Dumps remainder on lull/sell pressure
```

### 3. Stream Integration

**Monitors**:

- All PumpFun transactions
- Filters for specific mint once position is open
- Parses buy/sell events from transaction metadata
- Updates momentum tracker in real-time

**Flow**:

Geyser Stream → Parse Transaction →
  If involves our mint → Extract buy/sell →
      Update momentum tracker →
      Check exit conditions

---

## 🎮 Usage

### Quick Start

```bash
# Run with default strategy
tsx scripts/momentum-sniper.ts

# Run with custom strategy
STRATEGY_FILE=my-strategy.toml tsx scripts/momentum-sniper.ts
```

### Example Output

```text
🎯 MOMENTUM-BASED SNIPER
========================

Strategy: momentum_breakeven
Wallet: EuZhGRPZ...
Buy: 0.01 SOL
Breakeven: 9000 SOL MC
Lull threshold: 2s
Buy/Sell ratio: 0.5

✅ Stream connected

🪙 Token #1: EFPijYKn... (age: 5ms, balance: 0.0879 SOL)
   📤 Buy TX: 3BxUfJbx...
   🔗 <https://solscan.io/tx/3BxUfJbx>...
   ✅ Buy CONFIRMED - starting momentum tracking

📊 Position started: EFPijYKn...
   Buy: 0.01 SOL, Balance: 100,000,000 tokens

   [5s] Buys: 12, Sells: 3, Ratio: 80%, Last buy: 0s ago, Lull: NO
   [10s] Buys: 18, Sells: 5, Ratio: 78%, Last buy: 1s ago, Lull: NO

💰 Breakeven target reached! MC: 9,234 SOL
   Selling 50% to recover initial investment
   📤 Sell TX: 2AvFkPqL...
   ✅ Sell CONFIRMED

   [15s] Buys: 25, Sells: 8, Ratio: 76%, Last buy: 0s ago, Lull: NO
   [20s] Buys: 26, Sells: 12, Ratio: 68%, Last buy: 2s ago, Lull: NO

🚨 Momentum lost: lull detected
   Buys: 26, Sells: 14, Ratio: 65%, Last buy: 3s ago, Lull: YES
   Dumping remainder...
   📤 Sell TX: 5CpMnJzW...
   ✅ Sell CONFIRMED
   ✅ Position closed: EFPijYKn..
```

---

## ⚙️ Configuration Guide

### Entry Parameters

```toml
[strategy.entry]
buy_amount_sol = 0.01          # Position size
max_slippage_bps = 500         # 5% slippage
priority_fee_lamports = 50000  # ~10k lamports total
```

### Momentum Tuning

```toml
[strategy.momentum]
lull_threshold_seconds = 2.0         # How long to wait for buys
monitor_window_seconds = 10          # Rolling window size
buy_sell_ratio_threshold = 0.5       # Exit if buys/(buys+sells) < 0.5
```

**Aggressive** (hold longer):

- `lull_threshold_seconds = 5.0`
- `buy_sell_ratio_threshold = 0.3`

**Conservative** (exit faster):

- `lull_threshold_seconds = 1.0`
- `buy_sell_ratio_threshold = 0.6`

### Target Settings

```toml
[strategy.targets]
breakeven_market_cap = 9000      # Sell 50% here
full_exit_market_cap = 50000     # Complete exit target

[strategy.breakeven_sell]
enabled = true                    # Enable breakeven logic
sell_percentage = 50              # Sell this % at breakeven
```

**Disable breakeven** (diamond hands):

```toml
[strategy.breakeven_sell]
enabled = false
```

### Exit Conditions

```toml
[strategy.exit]
stop_loss_percent = -30            # Exit if -30% from peak
time_based_exit_seconds = 300      # Max 5 min hold
dump_slippage_bps = 3000           # 30% slippage for dumps
dump_priority_fee = 50000          # Higher fee for exits
```

---

## 📊 Performance Characteristics

### Strengths

✅ **Momentum-aware** - Only holds while buy pressure continues  
✅ **Risk-managed** - Breaks even early, risks only "house money"  
✅ **Adaptive** - Responds to real-time market activity  
✅ **Fast exits** - Dumps quickly when momentum lost  

### Weaknesses

⚠️ **False signals** - May exit on temporary lulls  
⚠️ **Requires liquidity** - Needs active trading to work  
⚠️ **Slippage risk** - Emergency dumps at 30% slippage  
⚠️ **Timing risk** - May miss peaks during monitoring window  

### Best Use Cases

1. **High-volume tokens** - Active trading for accurate signals
2. **Early entry** - Buy within first few seconds
3. **Trending markets** - Bull market with sustained interest
4. **Small positions** - Risk only what you can afford to lose

---

## 🔬 Testing Recommendations

### Phase 1: Observation (No Real Buys)

1. Comment out actual buy/sell execution
2. Run script to observe momentum patterns
3. Tune parameters based on observations
4. Duration: 1-2 hours

### Phase 2: Small Position Testing

1. Start with 0.001 SOL positions
2. Test breakeven logic
3. Test momentum exit logic
4. Duration: 24 hours, 10-20 trades

### Phase 3: Full Strategy

1. Increase to target position size (0.01 SOL)
2. Run for extended period
3. Track win rate, average hold time, PnL
4. Duration: 1 week

---

## 🐛 Troubleshooting

### Position not exiting on lull

**Issue**: Holds too long despite no buys

**Solutions**:

- Decrease `lull_threshold_seconds`
- Check stream is receiving transactions
- Verify momentum tracker is recording events

### Exits too early

**Issue**: Sells before momentum truly lost

**Solutions**:

- Increase `lull_threshold_seconds`
- Decrease `buy_sell_ratio_threshold`
- Increase `monitor_window_seconds`

### Breakeven never triggers

**Issue**: Position never reaches target MC

**Solutions**:

- Lower `breakeven_market_cap` target
- Verify MC calculation is correct
- Check if token has enough liquidity

---

## 🚀 Future Enhancements

### Potential Improvements

1. **Real market cap calculation** - Query bonding curve state
2. **Volume-weighted momentum** - Weight by trade size
3. **Multi-stage exits** - 25% at MC1, 50% at MC2, etc.
4. **Social signals** - Integrate Twitter/Telegram sentiment
5. **ML-based exit** - Train model on historical exits

### Advanced Features

- **Trailing stop** - Exit if price drops X% from peak
- **Volatility-based exits** - Adjust based on price volatility
- **Correlation trading** - Monitor related tokens
- **Portfolio mode** - Manage multiple positions

---

## 📈 Metrics to Track

### Per Trade

- Entry time & price
- Breakeven time & price
- Exit time & price
- Hold duration
- Momentum at entry/exit
- PnL (gross & net)

### Overall

- Win rate (% profitable)
- Average hold time
- Average PnL per trade
- Max drawdown
- Sharpe ratio

---

## ⚠️ Risk Warnings

1. **High volatility** - PumpFun tokens are extremely volatile
2. **Rug pulls** - Tokens can drop to zero instantly
3. **Slippage** - Emergency exits at 30% slippage = significant loss
4. **False signals** - Momentum can reverse suddenly
5. **Technical risk** - Bugs, stream issues, RPC failures

**Only risk what you can afford to lose completely.**

---

**Status**: ✅ Ready for Testing  
**Next**: Test with small positions, tune parameters, track results
