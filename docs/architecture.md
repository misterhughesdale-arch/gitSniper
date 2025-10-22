# System Architecture

**Last Updated**: 2025-10-22  
**Status**: Production Ready (Core Components)

## 1. Overview

GitSniper is a high-performance Solana token sniper with momentum-based trading strategies for PumpFun tokens.

### 1.1. Primary Objectives

- **Low-Latency Execution**: <50ms from token detection to transaction sent (target)
- **Momentum-Based Strategy**: Hold positions while buy pressure continues, exit on lull
- **Modular Architecture**: Reusable packages for transactions, strategies, and config
- **Comprehensive Tracking**: CSV export with individual trade and session performance
- **Safety First**: Balance checks, position limits, emergency exits

---

## 2. Current Architecture

### 2.1. Implemented Packages

#### 2.1.1. Transactions (`packages/transactions`) ✅
**Status**: Implemented & Compiled

**Components**:
- `pumpfun/constants.ts` - Program IDs, discriminators, seeds
- `pumpfun/accounts.ts` - PDA derivations (bonding curve, creator vault, etc.)
- `pumpfun/pdas.ts` - PDA helper functions
- `pumpfun/instructions.ts` - Buy/sell instruction encoding
- `pumpfun/builders.ts` - High-level transaction builders
- `pumpfun/curve-parser.ts` - Bonding curve state parsing
- `workflows.ts` - Complete buy/sell workflows

**Key Features**:
- Buy transactions (16 accounts)
- Sell transactions (14 accounts)
- Compute budget management
- Priority fee handling
- Slippage protection
- ATA creation (idempotent)
- Account caching for performance

#### 2.1.2. Auto-Sell (`packages/auto-sell`) ✅
**Status**: Implemented

**Components**:
- `momentum-tracker.ts` - Tracks buy/sell events in rolling window
- `position-manager.ts` - Manages position lifecycle and exit logic
- `strategy-config.ts` - Loads TOML strategy configurations

**Key Features**:
- Rolling window momentum analysis
- Buy/sell ratio calculation
- Lull detection (time since last buy)
- Breakeven sell logic (50% at target MC)
- Time-based exit enforcement
- Configurable via TOML

#### 2.1.3. Config (`packages/config`) ✅
**Status**: Implemented

**Features**:
- TOML parsing with environment variable substitution
- Zod schema validation
- Deep merge of environment-specific configs
- Type-safe configuration access

#### 2.1.4. Supporting Packages ✅
- `packages/logging` - Structured logging
- `packages/metrics` - Performance tracking
- `packages/events` - Event bus
- `packages/store` - Trade state management
- `packages/solana-client` - RPC/WebSocket wrappers
- `packages/strategies/pumpfun` - PumpFun-specific logic

### 2.2. Applications

#### 2.2.1. Momentum Sniper (`apps/momentum-sniper`) ✅
**Status**: Implemented

**Main Application**: Integrated trading bot with:
- Geyser stream connection (Yellowstone gRPC)
- Token detection and filtering
- Automated buy execution
- Momentum-based position management
- Automated sell execution based on strategy
- Real-time performance logging

**Entry Point**: `apps/momentum-sniper/src/index.ts`

### 2.3. Utilities & Scripts

#### 2.3.1. Utils (`scripts/utils/`)
- `calculate-pnl.ts` - Historical P&L analysis
- `list-positions.ts` - Current positions
- `emergency-sell-all.ts` - Emergency exit all positions
- `reclaim-ata-rent.ts` - Reclaim rent from closed ATAs
- `sell-via-rpc.ts` - Manual sell via RPC
- `quick-pnl.ts` - Quick P&L summary

#### 2.3.2. Monitoring (`scripts/monitoring/`)
- `monitor-jito-tips.ts` - Real-time Jito tip percentiles
- `debug-jito.sh` - Jito API debugging

#### 2.3.3. Development (`scripts/dev/`)
- `test-basic-buy.ts` - Enhanced profitability testing with CSV export
- `test-runner.ts` - Multi-strategy testing
- `test-jito-api.sh` - Jito API testing

---

## 3. Data Flow (Current Implementation)

### 3.1. Trading Flow

```
Yellowstone gRPC Stream
        ↓
[Filter: PumpFun transactions]
        ↓
[Extract new token mints]
        ↓
[Dedup check + fast validation]
        ↓
[Build buy transaction] ← packages/transactions
        ↓
[Sign & send to Solana]
        ↓
[Confirm transaction]
        ↓
[Start PositionManager] ← packages/auto-sell
        ↓
[Monitor mint-specific stream]
        ↓
[Track buy/sell momentum]
        ↓
[Breakeven sell at 9000 SOL MC]
        ↓
[Exit on lull/sell pressure]
        ↓
[Dump remainder]
        ↓
[Track performance to CSV]
```

### 3.2. Momentum Tracking Flow

Once position is opened:

```
Stream monitors ALL PumpFun transactions
        ↓
[Filter: Does tx involve our mint?]
        ↓
[Parse: Is it a buy or sell?]
        ↓
[Update MomentumTracker]
        ↓
[Calculate buy/sell ratio]
        ↓
[Check lull (time since last buy)]
        ↓
[Determine if should exit]
        ↓
[Trigger sell via callback if needed]
```

### 3.3. Rent Reclaim Flow

```
Every 4 completed buys:
        ↓
[Query token accounts]
        ↓
[Filter: balance = 0]
        ↓
[Build close account instructions]
        ↓
[Send single transaction (batch)]
        ↓
[Reclaim ~0.00204 SOL per ATA]
        ↓
[Add to total rent reclaimed]
        ↓
[Calculate recent P&L checkpoint]
```

---

## 4. Configuration Management

### 4.1. System Configuration (`config/`)

**Files**:
- `config/default.toml` - Base configuration
- `config/development.toml` - Development overrides

**Sections**:
- `[rpc]` - RPC endpoints and settings
- `[jito]` - Jito block engine, tips, bundles
- `[geyser]` - Yellowstone gRPC endpoint and auth
- `[strategy]` - Trading parameters (buy amount, slippage, etc.)
- `[wallets]` - Keypair paths
- `[pumpfun_filters]` - Token filtering criteria

**Features**:
- Environment variable substitution (`${VAR_NAME}`)
- Zod validation at runtime
- Deep merge of environment configs
- Type-safe access via `loadConfig()`

### 4.2. Strategy Configuration (`strategies/`)

**Format**: TOML files with strategy-specific parameters

**Example**: `strategies/momentum-breakeven.toml`

**Sections**:
- `[strategy.entry]` - Buy parameters (amount, slippage, priority fee)
- `[strategy.targets]` - Market cap targets (breakeven, full exit)
- `[strategy.momentum]` - Momentum tracking (lull threshold, ratio threshold)
- `[strategy.exit]` - Exit conditions (stop loss, time limit, dump settings)
- `[strategy.risk]` - Risk management (max position, liquidity requirements)

**Loading**: `loadStrategyConfig(filename)` from `@fresh-sniper/auto-sell`

---

## 5. State Management

### 5.1. Position Tracking

**In-Memory State** (PositionManager):
- Stores current active position
- Tracks buy time, amount, token balance
- Maintains momentum tracker instance
- Manages sell execution via callback

**Trade Records** (test-basic-buy.ts):
```typescript
interface TradeRecord {
  mint: string;
  buyTx: string;
  buyTime: number;
  buyAmountSOL: number;
  buyFeeLamports: number;
  tokensBought: number;
  sellTx?: string;
  sellAmountSOL?: number;
  pnlSOL?: number;
  pnlPercent?: number;
  status: "pending" | "sold" | "failed";
}
```

**Persistence**: CSV export to `results/` directory

### 5.2. Deduplication

- `Set<string>` of processed mints prevents duplicate buys
- Position manager ensures max 1 concurrent position
- Cooldown timer (20s) between buys

---

## 6. Implementation Status

### 6.1. Completed ✅

- [x] Geyser stream connection (Yellowstone gRPC)
- [x] PumpFun transaction filtering
- [x] Buy transaction builder (16 accounts)
- [x] Sell transaction builder (14 accounts)
- [x] PDA derivations and caching
- [x] Bonding curve state parsing
- [x] Momentum-based strategy
- [x] Position management
- [x] Automated sell execution
- [x] Rent reclaim (every 4 buys)
- [x] CSV export (trades + session aggregates)
- [x] Configuration system (TOML + Zod)
- [x] Strategy configuration system

### 6.2. In Progress 🚧

- [ ] Fire-and-forget transaction pattern (background confirmation)
- [ ] Balance caching (remove RPC call from hot path)
- [ ] Hot-path optimization (<50ms target)
- [ ] Live testing with real trades

### 6.3. Planned 📋

- [ ] Multiple concurrent positions
- [ ] Advanced filters (liquidity, creator whitelist)
- [ ] Circuit breakers for error recovery
- [ ] Dedicated hot-route service (separate from main app)
- [ ] Real-time market cap calculation
- [ ] Web dashboard for monitoring

---

## 7. Performance Characteristics

### 7.1. Current Latency

**Buy Path**:
- Token detection: 0-1ms (stream latency)
- Balance check: 50-100ms (RPC call) ⚠️
- Transaction build: 50-100ms
- Transaction send: 20-50ms
- Confirmation wait: 400-1000ms ⚠️
- **Total**: ~600-1550ms

**Optimization Targets**:
- Balance check: 0ms (cache)
- Confirmation: 0ms (background tracking)
- **Target Total**: <50ms

### 7.2. Throughput

- Stream processing: ~17 events/second
- Token detection: ~1.2 tokens/second
- Buy cooldown: 20s between buys (configurable)
- Sell execution: Parallel with buy logic

### 7.3. Resource Management

**Rent Reclaim**:
- Every 4 completed buys
- ~0.00204 SOL per empty ATA
- Batched into single transaction

**Position Limits**:
- Max 1 concurrent position (current)
- Min 0.01 SOL balance required
- 20s cooldown between buys

### 7.4. Observability

**Live Monitoring**:
- Real-time console output with trade details
- Momentum status every 5s
- Checkpoint reports every 4 buys

**CSV Export**:
- Individual trade performance (`results/trades-{timestamp}.csv`)
- Hourly session aggregates (`results/session-{timestamp}.csv`)
- Win rate, P&L, hold times tracked

### 7.5. Provider Strategy

**Current Setup**:
- **Stream**: Shyft Yellowstone gRPC
- **RPC**: Helius/Shyft (configurable)
- **Commitment**: "confirmed" for trading
- **Priority Fees**: 50k microlamports for buys, 1k-10k for sells

## 8. PumpFun Protocol Integration

### 8.1. Account Structure

**Buy Transaction** (16 accounts):
0-2: global, fee_recipient, mint  
3-5: bonding_curve, associated_bonding_curve, buyer_token_account  
6-9: buyer (signer), system_program, token_program, creator_vault  
10-15: event_authority, program, global_volume, user_volume, fee_config, fee_program

**Sell Transaction** (14 accounts):
Same as buy but WITHOUT volume accumulators (indices 12-13)

**Critical**: creator_vault must be derived from bonding curve creator, not transaction sender

### 8.2. Instruction Format

**Buy**: `[discriminator(8)][token_amount(8)][max_sol_cost(8)][track_volume(1)]`  
**Sell**: `[discriminator(8)][token_amount(8)][min_sol_output(8)][track_volume(1)]`

### 8.3. PDA Derivations

All PDAs cached for performance:
- Bonding curve: `["bonding-curve", mint]`
- Creator vault: `["creator-vault", creator_pubkey]`
- Global volume: `["global-volume-accumulator"]`
- User volume: `["user-volume-accumulator", user_pubkey]`
- Fee config: `["fee-config"]`

## 9. Security & Risk Management

### 9.1. Safety Guards

- Min balance check before every buy
- Max position size limit (0.02 SOL)
- Cooldown between buys (20s)
- Time-based exit (5 min max hold)
- Stop loss at -30% from peak

### 9.2. Emergency Procedures

**Emergency Exit**:
```bash
tsx scripts/utils/emergency-sell-all.ts
```

**Manual Sell**:
```bash
tsx scripts/utils/sell-via-rpc.ts
```

**Reclaim Rent**:
```bash
tsx scripts/utils/reclaim-ata-rent.ts
```

### 9.3. Key Protection

- Private keys loaded from file (never logged)
- Keypair paths in environment variables
- `.gitignore` protects keypair files
- No hardcoded secrets in code

## 10. Future Enhancements

### 10.1. Performance Optimizations

- [ ] Balance caching (remove 50-100ms RPC call)
- [ ] Fire-and-forget transactions (remove 400-1000ms wait)
- [ ] Account pre-computation (0.001ms vs 50ms)
- [ ] Dedicated hot-route service (<50ms target)
- [ ] Rust hot-path implementation (optional)

### 10.2. Strategy Enhancements

- [ ] Multiple concurrent positions (3-5 max)
- [ ] Volume-weighted momentum (weight by trade size)
- [ ] Multi-stage exits (25% at MC1, 50% at MC2, etc.)
- [ ] Social signal integration (Twitter, Telegram)
- [ ] ML-based exit prediction

### 10.3. Monitoring & Analytics

- [ ] Real-time web dashboard
- [ ] Prometheus metrics export
- [ ] Alert system (Telegram/Discord)
- [ ] Historical performance analysis
- [ ] Backtesting framework

---

**Document Version**: 2.0  
**Last Major Update**: 2025-10-22  
**Next Review**: After live testing phase
