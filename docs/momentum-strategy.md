# 🎯 Momentum-Based Auto-Sell Strategy

**Status:** ✅ Implemented  
**Date:** 2025-10-22

---

## Table of Contents

1. [Strategy Overview](#strategy-overview)
2. [Detailed Task Breakdown](#detailed-task-breakdown)
3. [Implementation Structure](#implementation-structure)
4. [Key Components](#key-components)
5. [Usage Guide](#usage-guide)
6. [Configuration Reference](#configuration-reference)
7. [Performance and Use Cases](#performance-and-use-cases)
8. [Testing Roadmap](#testing-roadmap)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Planned Enhancements](#planned-enhancements)
11. [Key Metrics](#key-metrics)
12. [Risk Caveats](#risk-caveats)

---

## Strategy Overview

A momentum-based auto-sell algorithm for Solana PumpFun tokens:  
- **Buy** tokens at launch.  
- **Monitor** real-time buy/sell pressure.
- **Sell** 50% at a breakeven target.  
- **Hold** remainder while momentum is positive.
- **Exit** all if momentum drops or risk triggers.

### Decision Logic Flow

1. **Token Detection (Buy Entry)**
    - Monitor stream for new eligible tokens.
    - Place buy order with config params.

2. **Real-Time Tracking**
    - Parse all buys and sells for the new token.
    - Track rolling buy/sell ratio and buy frequency.

3. **Breakeven Partial Exit**
    - Once MC threshold hit, sell half position.
    - Continue tracking remainder.

4. **Momentum Assessment (Hold/Early Exit)**
    - Continuously check:
        - Has there been a lull (no buys) over X seconds?
        - Are sells outpacing buys?
        - Has max configured hold time elapsed?

5. **Full Position Exit**
    - If momentum lost or condition met:
        - Execute sell of remaining tokens.
        - Use "dump" slippage/fees for fast exit.

---

## Detailed Task Breakdown

### 1. Token Detection & Stream Setup
- [ ] Establish connection to Geyser stream.
- [ ] Filter for newly-created PumpFun tokens.
- [ ] For each detected token, start monitoring.

### 2. Position Lifecycle Management
- [ ] Place initial buy.
- [ ] Initialize tracker for that mint.
- [ ] Maintain active position state.

#### Subtasks
- [ ] Store buy transaction details.
- [ ] Track entry price, market cap, timestamps.

### 3. Momentum Tracking
- [ ] Parse buy and sell transactions for the active mint.
- [ ] Update rolling window with each event.

#### Subtasks
- [ ] Compute buy frequency (buys/sec) in window.
- [ ] Calculate buy/sell ratio.
- [ ] Record time since last buy.
- [ ] Mark if lull or unfavorable ratio occurs.

### 4. Breakeven and Exit Decision Engine
- [ ] Check market cap after each buy event.
  - [ ] If above breakeven target, trigger partial sell (50%).
  - [ ] Mark partial exit state.
- [ ] Evaluate on each tracker update:
  - [ ] Has a lull exceeded the threshold?
  - [ ] Has buy/sell ratio dropped below minimum?
  - [ ] Has maximum hold time expired?
- [ ] If any trigger active, issue full exit for remaining tokens.

### 5. Transaction Execution
- [ ] Submit sell transactions per current trigger (breakeven/dump).
- [ ] Handle slippage and fee parameters.
- [ ] Confirm transaction results.
- [ ] Update position state.

### 6. Logging & Metrics
- [ ] Log every buy/sell with timestamp, price, reason.
- [ ] Snapshot momentum state on entry, partial exit, exit.
- [ ] Store PnL, hold times, reason for exit.

---

## Implementation Structure

### Project Layout

```
packages/auto-sell/
├── src/
│   ├── momentum-tracker.ts      # Core: tracks buy/sell events & ratios
│   ├── position-manager.ts      # Manages all position states
│   ├── strategy-config.ts       # Loads params from TOML
│   └── index.ts                 # Entry point exports
├── package.json
└── tsconfig.json
```

### Key Configuration File

**strategies/momentum-breakeven.toml:**
```toml
[strategy.targets]
breakeven_market_cap = 9000

[strategy.momentum]
lull_threshold_seconds = 2.0
monitor_window_seconds = 10
buy_sell_ratio_threshold = 0.5

[strategy.exit]
time_based_exit_seconds = 300
dump_slippage_bps = 3000
```

### Main Integration Script

- `scripts/momentum-sniper.ts`

**Basic Usage:**
```bash
tsx scripts/momentum-sniper.ts
```

---

## Key Components

### 1. Momentum Tracker

**Task Decomposition:**
- [ ] Expose interface for `recordBuy` and `recordSell`.
  - [ ] Accepts amount, signature, timestamp.
- [ ] Maintains windowed event lists.
- [ ] Expose `.getState()` giving:
  - - Recent buy/sell counts & amounts.
  - - Buy/sell ratio.
  - - Last buy timestamp.
  - - Flags: hasLull, shouldExit.

**Example:**
```typescript
const tracker = new MomentumTracker(mint, {
  lullThresholdMs: 2000,
  windowMs: 10000,
  buySellRatioThreshold: 0.5,
});

tracker.recordBuy(0.1, "sig123...");
tracker.recordSell(0.05, "sig456...");
const state = tracker.getState();
```

### 2. Position Manager

**Responsibilities:**
- [ ] Manage entire position lifecycle:
  - [ ] Open position
  - [ ] Trigger partial exit
  - [ ] Monitor for exit conditions
  - [ ] Execute full exit and close position

**Integration Point:**
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
```

### 3. Stream Integration

**Tasks:**
- [ ] Subscribe to all PumpFun transactions.
- [ ] For each, check if relevant to active position.
- [ ] Parse and push events to Momentum Tracker.
- [ ] On each tracker update, evaluate all exit triggers.

---

## Usage Guide

### Quick Start

```bash
# Default config
tsx scripts/momentum-sniper.ts

# Custom config
STRATEGY_FILE=my-strategy.toml tsx scripts/momentum-sniper.ts
```

### Example Output

See full trade progress (auto-summarized):

```text
🎯 MOMENTUM-BASED SNIPER
========================

Strategy: momentum_breakeven
Wallet: EuZhGRPZ...
Buy: 0.01 SOL
Breakeven: 9000 SOL MC
Lull threshold: 2s
Buy/Sell ratio: 0.5
...
✅ Stream connected
🪙 Token: EFPijYKn... Buy TX: 3BxUfJbx...
✅ Buy confirmed
[5s] Buys: 12, Sells: 3, Ratio: 80%, Lull: NO
💰 Breakeven reached (9,234 SOL): Selling 50%
...
🚨 Lull detected: Dumping remainder
✅ Position closed: EFPijYKn...
```

---

## Configuration Reference

### Entry Setup

```toml
[strategy.entry]
buy_amount_sol = 0.01
max_slippage_bps = 500
priority_fee_lamports = 50000
```

### Momentum Tuning

```toml
[strategy.momentum]
lull_threshold_seconds = 2.0
monitor_window_seconds = 10
buy_sell_ratio_threshold = 0.5
```
> - **Aggressive:** `lull_threshold_seconds = 5.0`, `buy_sell_ratio_threshold = 0.3`
> - **Conservative:** `lull_threshold_seconds = 1.0`, `buy_sell_ratio_threshold = 0.6`

### Targets

```toml
[strategy.targets]
breakeven_market_cap = 9000
full_exit_market_cap = 50000

[strategy.breakeven_sell]
enabled = true
sell_percentage = 50
```
> - To disable breakeven: set `[strategy.breakeven_sell] enabled = false`

### Exit Logic

```toml
[strategy.exit]
stop_loss_percent = -30
time_based_exit_seconds = 300
dump_slippage_bps = 3000
dump_priority_fee = 50000
```

---

## Performance and Use Cases

### Strengths
- ✅ Momentum-sensitive: holds only with buy pressure
- ✅ Risk-managed: early recovery of capital
- ✅ Adaptive: real-time reactivity
- ✅ Rapid exits on momentum loss

### Weaknesses
- ⚠️ Can exit on short/fake lulls
- ⚠️ Requires liquid, busy tokens
- ⚠️ High slippage on emergency exits
- ⚠️ May miss top during monitoring window

### Optimal Scenarios
- High-volume, freshly-launched tokens
- Market with positive trend
- Small, diversified position sizing

---

## Testing Roadmap

**Testing Phases and Subtasks:**

### Phase 1: Dry Run (No Buys)
- [ ] Comment out all buy/sell executions.
- [ ] Run to observe live trade flows.
- [ ] Check event parsing and momentum calculations.
- [ ] Adjust config for desired exit behavior.

### Phase 2: Small-Scale Testing
- [ ] Set `buy_amount_sol` to 0.001.
- [ ] Perform multiple live trades.
- [ ] Validate breakeven, early/lull, and time-based exits.
- [ ] Tune momentum and target triggers.

### Phase 3: Production Testing
- [ ] Raise size to intended value (e.g. 0.01 SOL).
- [ ] Monitor auto-exits and hold length.
- [ ] Track PnL, losses on dumps, timing of entries/exits.

---

## Troubleshooting Guide

### Issue: Position doesn't exit on lull
- [ ] Lower `lull_threshold_seconds`
- [ ] Check Geyser stream and TX parsing
- [ ] Ensure buy/sell events are registered by tracker

### Issue: Exits happen too early
- [ ] Raise `lull_threshold_seconds`
- [ ] Lower `buy_sell_ratio_threshold`
- [ ] Expand `monitor_window_seconds`

### Issue: No breakeven exit
- [ ] Lower `breakeven_market_cap`
- [ ] Verify MC calculation and stream data quality
- [ ] Confirm token activity/liquidity

---

## Planned Enhancements

### Roadmap Items

#### Near-Term
- [ ] Real-time market cap from bonding curve
- [ ] Volume-weighted momentum triggers

#### Mid/Long-Term
- [ ] Multi-stage exits (portion sells at multiple MCs)
- [ ] Social signal integration (Twitter, Telegram)
- [ ] ML-driven exit strategy

#### Advanced
- [ ] Trailing stop
- [ ] Volatility/reactive exit logic
- [ ] Portfolio/multi-position management

---

## Key Metrics

### Per Trade
- Entry & exit times/prices
- Breakeven times/prices
- Total hold time
- Momentum state at entry/exit
- Full PnL (gross, net)

### Cumulative
- Win rate (%)
- Avg. hold time
- Avg. PnL per trade
- Max drawdown
- Sharpe ratio / risk-reward

---

## Risk Caveats

**BEWARE:**  
- High volatility (PumpFun tokens)  
- Real risk of rug-pulls (can go to zero)  
- 30%+ slippage on emergency exits  
- False momentum signals possible  
- Technical/infra errors (stream, RPC)  

> **Never risk more than you are fully willing to lose.**

---

**Status:** ✅ Ready for Testing  
**Next:** Begin small position tests, monitor, and tune params
