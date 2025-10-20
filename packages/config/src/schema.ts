import { z } from "zod";

/**
 * Zod schema for Fresh Sniper configuration.
 * Validates structure and types at runtime to catch misconfigurations early.
 */

const EnvironmentSchema = z.object({
  name: z.string().min(1, "Environment name cannot be empty"),
});

const RpcSchema = z.object({
  primary_url: z.string().url("Primary RPC must be a valid URL"),
  fallback_urls: z.array(z.string().url()).default([]),
  commitment: z.enum(["processed", "confirmed", "finalized"]).default("processed"),
});

const JitoSchema = z.object({
  block_engine_url: z.string().url("Jito Block Engine URL must be valid"),
  tip_account_pubkey: z.string().min(32, "Jito tip account must be a valid public key"),
  priority_fee_lamports: z.number().int().nonnegative().default(10000),
  bundle_enabled: z.boolean().default(true),
});

const GeyserReconnectSchema = z.object({
  initial_backoff_ms: z.number().int().positive().default(500),
  max_backoff_ms: z.number().int().positive().default(5000),
});

const GeyserSubscriptionsSchema = z.object({
  pumpfun_program_ids: z.array(z.string().min(32)).min(1, "At least one Pump.fun program ID required"),
  wallet_addresses: z.array(z.string().min(32)).default([]),
});

const GeyserSchema = z.object({
  endpoint: z.string().min(1, "Geyser endpoint cannot be empty"),
  auth_token: z.string().min(1, "Geyser auth token cannot be empty"),
  reconnect: GeyserReconnectSchema,
  subscriptions: GeyserSubscriptionsSchema,
});

const ExpressSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().int().min(1).max(65535).default(8080),
  request_timeout_ms: z.number().int().positive().default(2000),
});

const StrategySchema = z.object({
  buy_amount_sol: z.number().positive("Buy amount must be positive"),
  max_slippage_bps: z.number().int().min(0).max(10000, "Slippage cannot exceed 100%").default(300),
  sell_wait_seconds: z.number().int().nonnegative().default(120),
  max_open_positions: z.number().int().positive().default(3),
});

const SimulationSchema = z.object({
  enabled: z.boolean().default(true),
  skip_preflight: z.boolean().default(false),
});

const MetricsSchema = z.object({
  enabled: z.boolean().default(true),
  sampling_ratio: z.number().min(0).max(1).default(1.0),
  report_file: z.string().default("logs/metrics.log"),
});

const LoggingSchema = z.object({
  level: z.enum(["debug", "info", "error"]).default("info"),
  file: z.string().default("logs/app.log"),
});

const WalletsSchema = z.object({
  trader_keypair_path: z.string().min(1, "Trader keypair path cannot be empty"),
});

const PumpfunFiltersSchema = z.object({
  min_liquidity_sol: z.number().nonnegative().default(1.0),
  whitelist_creator_addresses: z.array(z.string().min(32)).default([]),
  blacklist_creator_addresses: z.array(z.string().min(32)).default([]),
});

export const FreshSniperConfigSchema = z.object({
  environment: EnvironmentSchema,
  rpc: RpcSchema,
  jito: JitoSchema,
  geyser: GeyserSchema,
  express: ExpressSchema,
  strategy: StrategySchema,
  simulation: SimulationSchema,
  metrics: MetricsSchema,
  logging: LoggingSchema,
  wallets: WalletsSchema,
  pumpfun_filters: PumpfunFiltersSchema,
});

export type FreshSniperConfig = z.infer<typeof FreshSniperConfigSchema>;

/**
 * Validates a raw configuration object using Zod schema.
 * Throws a detailed error if validation fails.
 */
export function validateConfigWithZod(raw: unknown): FreshSniperConfig {
  try {
    return FreshSniperConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("; ");
      throw new Error(`Configuration validation failed: ${messages}`);
    }
    throw error;
  }
}

