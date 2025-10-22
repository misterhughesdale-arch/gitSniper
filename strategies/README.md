# Trading Strategies

This directory contains configurable trading strategies in TOML format.

## Available Strategies

### momentum-breakeven.toml

**Momentum-based breakeven strategy** - Holds position as long as buy pressure continues.

**Logic**:
1. Buy token on detection
2. Monitor buy/sell activity via Geyser stream
3. At 9000 SOL market cap → sell 50% to break even
4. Continue holding remaining 50% while momentum continues
5. Exit conditions:
   - 2+ second lull (no buys)
   - Sells > buys (ratio < 0.5)
   - Max hold time reached (5 minutes)

**Configuration**:
```toml
[strategy.targets]
breakeven_market_cap = 9000   # Sell 50% at this MC
full_exit_market_cap = 50000  # Target for complete exit

[strategy.momentum]
lull_threshold_seconds = 2.0           # Exit if no buys
monitor_window_seconds = 10            # Rolling window
buy_sell_ratio_threshold = 0.5         # Exit if ratio drops

[strategy.exit]
stop_loss_percent = -30                # Emergency exit
time_based_exit_seconds = 300          # Max 5 min hold
dump_slippage_bps = 3000               # 30% slippage for dumps
```

## Usage

### Run with default strategy
```bash
tsx scripts/momentum-sniper.ts
```

### Run with custom strategy
```bash
STRATEGY_FILE=my-custom-strategy.toml tsx scripts/momentum-sniper.ts
```

## Creating Custom Strategies

1. Copy `momentum-breakeven.toml` to a new file
2. Adjust parameters to your risk tolerance
3. Test with small amounts first

### Key Parameters to Tune

**Entry**:
- `buy_amount_sol` - Position size (default: 0.01 SOL)
- `max_slippage_bps` - Max slippage (default: 500 = 5%)

**Momentum**:
- `lull_threshold_seconds` - How long to wait for next buy (default: 2.0s)
- `buy_sell_ratio_threshold` - Exit if ratio drops below (default: 0.5)
- `monitor_window_seconds` - Rolling window for ratio (default: 10s)

**Targets**:
- `breakeven_market_cap` - MC to trigger partial exit (default: 9000 SOL)
- `full_exit_market_cap` - MC to exit everything (default: 50000 SOL)

**Risk**:
- `stop_loss_percent` - Max loss before exit (default: -30%)
- `time_based_exit_seconds` - Max hold time (default: 300s = 5 min)

## Strategy Templates

### Conservative (Low Risk)
- Small position size (0.005 SOL)
- Quick breakeven (5000 SOL MC)
- Shorter lull threshold (1.5s)
- Tighter stop loss (-20%)

### Aggressive (High Risk)
- Larger position size (0.02 SOL)
- Later breakeven (15000 SOL MC)
- Longer lull threshold (5s)
- Wider stop loss (-50%)

### Diamond Hands (Hold for Moon)
- Disable breakeven sell
- Very long lull threshold (10s)
- No time-based exit
- Wide stop loss (-70%)

## Monitoring

The strategy provides real-time feedback:
```
📊 Position started: EFPijYKn...
   Buy: 0.01 SOL, Balance: 100,000,000 tokens
   
   [5s] Buys: 12, Sells: 3, Ratio: 80%, Last buy: 0s ago, Lull: NO
   [10s] Buys: 18, Sells: 5, Ratio: 78%, Last buy: 1s ago, Lull: NO
   
💰 Breakeven target reached! MC: 9,234 SOL
   Selling 50% to recover initial investment
   ✅ Sell CONFIRMED
   
   [15s] Buys: 25, Sells: 8, Ratio: 76%, Last buy: 0s ago, Lull: NO
   [20s] Buys: 26, Sells: 12, Ratio: 68%, Last buy: 2s ago, Lull: NO
   
🚨 Momentum lost: lull detected
   Buys: 26, Sells: 14, Ratio: 65%, Last buy: 3s ago, Lull: YES
   Dumping remainder...
   ✅ Sell CONFIRMED
   ✅ Position closed
```

## Safety Features

✅ **Balance checks** - Won't buy if insufficient SOL  
✅ **Position limits** - Max 1 concurrent position  
✅ **Stop loss** - Exits at max loss threshold  
✅ **Time limits** - Max hold time enforced  
✅ **Emergency dumps** - High slippage for quick exits  

## Performance Tips

1. **Monitor first** - Run without buying to observe patterns
2. **Start small** - Test with 0.001 SOL positions
3. **Tune gradually** - Adjust one parameter at a time
4. **Track results** - Keep logs of what works
5. **Stay disciplined** - Follow your strategy rules

## Troubleshooting

**Position not selling at breakeven**:
- Check market cap calculation is accurate
- Verify breakeven target is reachable

**Exits too early**:
- Increase `lull_threshold_seconds`
- Decrease `buy_sell_ratio_threshold`

**Holds too long**:
- Decrease `lull_threshold_seconds`
- Increase `buy_sell_ratio_threshold`
- Add shorter `time_based_exit_seconds`

## Advanced: Multiple Strategies

Run multiple instances with different strategies:
```bash
# Terminal 1: Conservative
STRATEGY_FILE=conservative.toml tsx scripts/momentum-sniper.ts

# Terminal 2: Aggressive
STRATEGY_FILE=aggressive.toml tsx scripts/momentum-sniper.ts
```

**Note**: Use different wallets to avoid conflicts!

