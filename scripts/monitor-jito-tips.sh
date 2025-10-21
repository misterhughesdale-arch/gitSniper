#!/bin/bash

# Monitor Jito tips every 60 seconds with SOL conversion

echo "🔍 Monitoring Jito Tips (updates every 60s)"
echo "==========================================="
echo ""

while true; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Fetch tips
  response=$(curl -s https://bundles.jito.wtf/api/v1/bundles/tip_floor)
  
  if [ -n "$response" ]; then
    # Parse values - API returns values in lamports
    if command -v jq &> /dev/null; then
      # Use jq and ensure we get integer values
      p25=$(echo "$response" | jq -r '.[0].landed_tips_25th_percentile // 0' | awk '{printf "%.0f", $1}')
      p50=$(echo "$response" | jq -r '.[0].landed_tips_50th_percentile // 0' | awk '{printf "%.0f", $1}')
      p75=$(echo "$response" | jq -r '.[0].landed_tips_75th_percentile // 0' | awk '{printf "%.0f", $1}')
      p95=$(echo "$response" | jq -r '.[0].landed_tips_95th_percentile // 0' | awk '{printf "%.0f", $1}')
      p99=$(echo "$response" | jq -r '.[0].landed_tips_99th_percentile // 0' | awk '{printf "%.0f", $1}')
    else
      # Fallback parsing without jq
      p25=$(echo "$response" | grep -o '"landed_tips_25th_percentile":[0-9.e+-]*' | grep -o '[0-9.e+-]*' | awk '{printf "%.0f", $1}')
      p50=$(echo "$response" | grep -o '"landed_tips_50th_percentile":[0-9.e+-]*' | grep -o '[0-9.e+-]*' | head -1 | awk '{printf "%.0f", $1}')
      p75=$(echo "$response" | grep -o '"landed_tips_75th_percentile":[0-9.e+-]*' | grep -o '[0-9.e+-]*' | awk '{printf "%.0f", $1}')
      p95=$(echo "$response" | grep -o '"landed_tips_95th_percentile":[0-9.e+-]*' | grep -o '[0-9.e+-]*' | awk '{printf "%.0f", $1}')
      p99=$(echo "$response" | grep -o '"landed_tips_99th_percentile":[0-9.e+-]*' | grep -o '[0-9.e+-]*' | awk '{printf "%.0f", $1}')
    fi
    
    # Handle case where values might be zero or invalid
    p25=${p25:-1000}
    p50=${p50:-10000}
    p75=${p75:-50000}
    p95=${p95:-100000}
    p99=${p99:-500000}
    
    # Convert to SOL (1 SOL = 1,000,000,000 lamports)
    p25_sol=$(awk "BEGIN {printf \"%.9f\", $p25/1000000000}")
    p50_sol=$(awk "BEGIN {printf \"%.9f\", $p50/1000000000}")
    p75_sol=$(awk "BEGIN {printf \"%.9f\", $p75/1000000000}")
    p95_sol=$(awk "BEGIN {printf \"%.9f\", $p95/1000000000}")
    p99_sol=$(awk "BEGIN {printf \"%.9f\", $p99/1000000000}")
    
    # Also show in USD (assuming $200/SOL)
    p25_usd=$(awk "BEGIN {printf \"%.4f\", $p25/1000000000*200}")
    p50_usd=$(awk "BEGIN {printf \"%.4f\", $p50/1000000000*200}")
    p75_usd=$(awk "BEGIN {printf \"%.4f\", $p75/1000000000*200}")
    p95_usd=$(awk "BEGIN {printf \"%.4f\", $p95/1000000000*200}")
    p99_usd=$(awk "BEGIN {printf \"%.4f\", $p99/1000000000*200}")
    
    echo "[$timestamp]"
    echo "  p25: $(printf '%10s' $p25) lamports = $p25_sol SOL (~\$$p25_usd)"
    echo "  p50: $(printf '%10s' $p50) lamports = $p50_sol SOL (~\$$p50_usd)"
    echo "  p75: $(printf '%10s' $p75) lamports = $p75_sol SOL (~\$$p75_usd) ⭐"
    echo "  p95: $(printf '%10s' $p95) lamports = $p95_sol SOL (~\$$p95_usd)"
    echo "  p99: $(printf '%10s' $p99) lamports = $p99_sol SOL (~\$$p99_usd)"
    echo ""
  else
    echo "[$timestamp] ❌ Failed to fetch Jito tips"
    echo ""
  fi
  
  sleep 60
done

