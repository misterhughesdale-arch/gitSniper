import type { FreshSniperConfig } from "@fresh-sniper/config";

export interface PumpfunStrategyConfig {
  // Placeholder for additional strategy-specific options.
}

export interface TokenCreationEvent {
  mint: string;
  creator: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export function createPumpfunStrategy(_config: FreshSniperConfig) {
  // TODO: implement decision logic using thresholds from config.
  return {
    shouldBuy(_event: TokenCreationEvent) {
      return true;
    },
  };
}
