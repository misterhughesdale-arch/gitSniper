#!/usr/bin/env node
/**
 * Monitor Jito Tips - Updates every 60 seconds
 */

async function fetchJitoTips() {
  try {
    const response = await fetch("https://bundles.jito.wtf/api/v1/bundles/tip_floor");
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log("❌ No data returned from Jito API");
      return null;
    }
    
    const latest = data[0];
    return {
      p25: latest.landed_tips_25th_percentile || 1000,
      p50: latest.landed_tips_50th_percentile || 10000,
      p75: latest.landed_tips_75th_percentile || 50000,
      p95: latest.landed_tips_95th_percentile || 100000,
      p99: latest.landed_tips_99th_percentile || 500000,
      ema_p50: latest.ema_landed_tips_50th_percentile || 25000,
    };
  } catch (error) {
    console.log(`❌ Error fetching Jito tips: ${(error as Error).message}`);
    return null;
  }
}

function formatTip(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  const usd = sol * 200; // Assuming $200/SOL
  return `${lamports.toLocaleString().padStart(10)} lamports = ${sol.toFixed(9)} SOL (~$${usd.toFixed(4)})`;
}

async function monitor() {
  console.log("🔍 Monitoring Jito Tips (updates every 60s)");
  console.log("=".repeat(70));
  console.log();
  
  while (true) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const tips = await fetchJitoTips();
    
    if (tips) {
      console.log(`[${timestamp}]`);
      console.log(`  p25: ${formatTip(tips.p25)}`);
      console.log(`  p50: ${formatTip(tips.p50)}`);
      console.log(`  p75: ${formatTip(tips.p75)} ⭐ (recommended)`);
      console.log(`  p95: ${formatTip(tips.p95)}`);
      console.log(`  p99: ${formatTip(tips.p99)}`);
      console.log(`  EMA: ${formatTip(tips.ema_p50)} (p50 moving average)`);
      console.log();
      
      // Compare to current setting
      const currentFee = 10000; // Your current setting
      console.log(`  Your setting: ${formatTip(currentFee)}`);
      if (currentFee < tips.p25) {
        console.log(`  ⚠️  Your fee is BELOW p25 - may be too slow`);
      } else if (currentFee < tips.p50) {
        console.log(`  ✅ Your fee is between p25-p50 (conservative)`);
      } else if (currentFee < tips.p75) {
        console.log(`  ✅ Your fee is between p50-p75 (balanced)`);
      } else if (currentFee < tips.p95) {
        console.log(`  💪 Your fee is between p75-p95 (aggressive)`);
      } else {
        console.log(`  🚀 Your fee is p95+ (very aggressive)`);
      }
      console.log();
    }
    
    // Wait 60 seconds
    await new Promise(r => setTimeout(r, 60000));
  }
}

monitor().catch(console.error);

