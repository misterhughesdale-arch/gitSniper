/**
 * Strategy Configuration Loader
 * 
 * Loads and validates strategy configurations from TOML files
 */

import { readFileSync } from "fs";
import { resolve } from "path";

export interface StrategyConfig {
  strategy: {
    name: string;
    enabled: boolean;
    entry: {
      buy_amount_sol: number;
      max_slippage_bps: number;
      priority_fee_lamports: number;
    };
    targets: {
      breakeven_market_cap: number;
      full_exit_market_cap: number;
    };
    breakeven_sell: {
      enabled: boolean;
      sell_percentage: number;
    };
    momentum: {
      lull_threshold_seconds: number;
      monitor_window_seconds: number;
      buy_sell_ratio_threshold: number;
    };
    monitoring: {
      check_interval_ms: number;
      stream_commitment: string;
    };
    exit: {
      stop_loss_percent: number;
      time_based_exit_seconds: number;
      dump_slippage_bps: number;
      dump_priority_fee: number;
    };
    risk: {
      max_position_size_sol: number;
      min_liquidity_sol: number;
      max_concurrent_positions: number;
    };
  };
}

/**
 * Simple TOML parser (handles basic key=value syntax)
 */
function parseSimpleToml(content: string): any {
  const result: any = {};
  let currentSection: any = result;
  let currentPath: string[] = [];

  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    // Section header
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const section = trimmed.slice(1, -1);
      const parts = section.split(".");
      
      // Navigate/create nested structure
      currentSection = result;
      currentPath = parts;
      
      for (const part of parts) {
        if (!currentSection[part]) {
          currentSection[part] = {};
        }
        currentSection = currentSection[part];
      }
      continue;
    }
    
    // Key = value
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex !== -1) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value: any = trimmed.slice(eqIndex + 1).trim();
      
      // Remove inline comments
      const commentIndex = value.indexOf("#");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
      
      // Parse value type
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (!isNaN(Number(value))) {
        value = Number(value);
      }
      
      currentSection[key] = value;
    }
  }
  
  return result;
}

/**
 * Load strategy configuration from TOML file
 */
export function loadStrategyConfig(filename: string): StrategyConfig {
  const filepath = resolve(process.cwd(), "strategies", filename);
  const content = readFileSync(filepath, "utf-8");
  const parsed = parseSimpleToml(content);
  
  // Validate required fields
  if (!parsed.strategy) {
    throw new Error("Missing [strategy] section in config");
  }
  
  return parsed as StrategyConfig;
}

/**
 * Get momentum configuration from strategy
 */
export function getMomentumConfig(config: StrategyConfig) {
  return {
    lullThresholdMs: config.strategy.momentum.lull_threshold_seconds * 1000,
    windowMs: config.strategy.momentum.monitor_window_seconds * 1000,
    buySellRatioThreshold: config.strategy.momentum.buy_sell_ratio_threshold,
  };
}

