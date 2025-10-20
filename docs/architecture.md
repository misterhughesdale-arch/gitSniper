# Architecture Plan

## Objectives
- Provide a modular Solana sniping service that listens for Pump.fun token creations, executes configurable buy/sell strategies, and records performance metrics.
- Deliver a low-latency "hot-route" for detection and buy execution via Express while isolating long-running telemetry logic in dedicated services.
- Maintain full configurability through layered config files and environment overrides; no runtime constants should be hard-coded inside application logic.

## High-Level Components
1. **Config Service (`packages/config`)**
   - Loads TOML/YAML configuration profiles from `config/` directory (per-environment + secrets overrides).
   - Validates shape with Zod schema and exposes typed accessors for all components.
   - Supports hot-reload hooks for dynamic strategy updates (future enhancement).

2. **Logging & Monitoring (`packages/logging`, `packages/metrics`)**
   - Structured logs using pino-style logger with log level from config.
   - Metrics abstraction toggled via config (`metrics.enabled`), supporting histograms for latency and counters for success/failure.
   - Provides `performanceReporter` helper invoked at the end of each processing loop to dump stats to rotating log files.

3. **Solana Connectivity (`packages/solana-client`)**
   - Wraps `@solana/web3.js` and `jito-js-rpc` clients to manage RPC/WebSocket endpoints, priority fees, bundle submissions, and retry policies.
   - Exposes connection factories for standard RPC, Jito Block Engine, and gRPC subscriptions.

4. **Transaction Pipeline (`packages/transactions`)**
   - Builders: create buy/sell instructions based on Pump.fun program layouts.
   - Simulators: run `simulateTransaction` with configurable `skipPreflight`.
   - Sender: submits via Jito bundle or standard RPC, records signature, and emits events for monitoring service.

5. **Strategy Layer (`packages/strategies/pumpfun`)**
   - Implements Pump.fun-specific parsing, liquidity criteria, slippage checks, and wait-period logic for sells.
   - Maintains per-token state (entry price, quantity, timers) using in-memory and persistent stores (pluggable).

6. **Express Hot-Route (`apps/hot-route`)**
   - Minimal Express server exposing `/v1/snipe` endpoint that orchestrates detection → buy pipeline with minimal middleware to avoid latency.
   - Consumes events from Geyser stream or manual triggers; responds with order status and metrics snapshot.

7. **Geyser Stream Service (`services/geyser-stream`)**
- Runs gRPC client subscribing to Pump.fun program logs and specific wallet signatures.
- Emits domain events (`TokenCreated`, `OurBuyLanded`, etc.) through an internal message bus (e.g., Node `EventEmitter` initially) consumed by the Express app and strategy state machines.
- Uses the official Yellowstone SDK to stream from Shyft, with exponential backoff reconnects and metrics (`geyser_stream_*`) for operational visibility.

8. **Shared Utilities (`packages/utils`, future)**
   - Timeouts, retries, exponential back-off, Prometheus formatters, file rotation utilities.

## Data Flow Overview
1. **Discovery**: Geyser service subscribes to Pump.fun program updates (filter `program_id == pump_fun`) and pushes normalized events onto the in-memory event bus.
2. **Decision**: Strategy layer evaluates event + config thresholds; if criteria met, it generates buy request payload.
3. **Execution (Hot Route)**: Express `/v1/snipe` endpoint receives buy request (either from strategy trigger or manual HTTP call), fetches config, constructs transaction via `transactions` package, optionally simulates, and submits using Solana client.
4. **Settlement Monitoring**: Geyser also watches our wallet address for confirmation of submitted signatures. Upon detection, it starts the configured wait timer and triggers sell pipeline when elapsed.
5. **Sell Execution**: Strategy constructs sell transaction analogously, simulates (if enabled), submits, and tracks final confirmation.
6. **Reporting**: At the end of each route loop (buy or sell cycle), metrics helpers compute latency, success ratio, PnL, and write structured summary to log file plus optional stdout for debugging.

## Configuration Model
- Base config file (`config/default.toml`) holds shared defaults; environment-specific overrides in `config/{environment}.toml`.
- Secrets (RPC keys, private keys) injected via environment variables resolved inside config schema to avoid storing sensitive data.
- Key sections: `rpc`, `jito`, `geyser`, `strategy`, `express`, `metrics`, `logging`, `wallets`, `pumpfunFilters`.
- All modules receive configuration through dependency injection at initialization, preventing hidden constants.

## Eventing & State Management
- Internal `EventEmitter` (Phase 1) for simplicity; plan to swap for Redis/NATS when horizontality is needed.
- Strategy state stored in lightweight repository interface (`ITradeStore`) with initial memory implementation and TODO for persistent KV.
- Debounce/duplicate detection ensures single buy per token even with repeated events.

## Sequence Roadmap
1. **Milestone 1**: Geyser stream connecting, filtering Pump.fun `TokenCreated` events, logging structured output.
2. **Milestone 2**: Buy transaction builder + simulator accessible via Express endpoint; config toggles for `simulate.enabled` and `skipPreflight`.
3. **Milestone 3**: Jito-backed submission and confirmation tracking.
4. **Milestone 4**: Wallet monitoring for landed buys, automated sell builder/simulator.
5. **Milestone 5**: Automated sell submission with confirmation and PnL/metrics reporting.

## Non-Functional Considerations
- **Latency**: Minimal middleware, pre-initialized Solana/Jito clients, parallel signature confirmation watchers.
- **Reliability**: Retry policies and fallback RPC nodes defined in config; persistent queue optional future.
- **Observability**: Structured logs, per-loop metrics dump, optional Prometheus endpoint.
- **Provider Integration**: Shyft Yellowstone gRPC is the primary stream source; Shyft RPC and Helius serve as buy/sell fallbacks; Jito transaction sends default to a `0.00001` SOL tip and can be toggled via config.
- **Testing Strategy**: Unit tests for builders/simulators using fixture accounts; integration tests with Solana devnet via config profile.

## Provider Strategy Notes
- Prefer **Shyft Yellowstone gRPC** for the Pump.fun stream service to benefit from managed Yellowstone infrastructure and simplified auth.
- Configure **Shyft RPC** as the first fallback for buy/sell submissions when standard Solana RPCs degrade.
- Layer **Helius RPC** as an additional fallback for buy/sell flows to diversify providers.
- Prioritize the **Jito transaction send path** (no bundles initially) with a starting tip of `0.00001` SOL to improve landing probability without overcommitting fees.

## Open Questions / Follow-Ups
- Decide on persistent store for trade history (SQLite vs Dynamo-like). Placeholder interfaces provided.
- Evaluate need for rate-limiting or request authentication on Express hot-route.
- Plan for secure secret storage (env var + Vault integration) before production usage.
