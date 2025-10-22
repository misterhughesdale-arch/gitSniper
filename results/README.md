# Test Results

This directory contains CSV exports from test runs.

## Files

### trades-{timestamp}.csv
Individual trade performance with columns:
- `timestamp` - When the buy was executed
- `mint` - Token mint address
- `buy_tx` - Buy transaction signature
- `buy_amount_sol` - SOL spent on buy
- `buy_fee_lamports` - Priority fee paid
- `tokens_bought` - Number of tokens received
- `sell_tx` - Sell transaction signature
- `sell_amount_sol` - Actual SOL received from sell
- `sell_fee_lamports` - Sell priority fee
- `hold_time_sec` - How long the position was held
- `pnl_sol` - Profit/loss in SOL
- `pnl_percent` - Profit/loss percentage
- `status` - pending | sold | failed

### session-{timestamp}.csv
Hourly aggregated performance with columns:
- `hour` - Hour number (0, 1, 2, etc.)
- `trades` - Number of trades in this hour
- `buys` - Successful buys
- `sells` - Successful sells
- `total_spent_sol` - Total SOL spent buying
- `total_received_sol` - Total SOL received from sells
- `total_fees_sol` - Total fees paid
- `net_pnl_sol` - Net profit/loss
- `rent_reclaimed_sol` - Rent reclaimed (distributed)
- `success_rate` - % of profitable trades

## Usage

Run test script:
```bash
tsx scripts/dev/test-basic-buy.ts
```

Analyze results:
```bash
# View latest trades
cat results/trades-*.csv | tail -20

# View session summary
cat results/session-*.csv

# Import to Excel/Google Sheets for analysis
```

## Analysis

Open CSV files in Excel/Google Sheets to:
- Sort by profitability
- Calculate averages and medians
- Create charts and graphs
- Identify patterns

## Cleanup

Old result files can be safely deleted:
```bash
rm results/trades-2025-*.csv
rm results/session-2025-*.csv
```
