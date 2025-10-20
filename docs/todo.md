# Project TODO Roadmap

## Phase 0 – Project Bootstrap
- [ ] Define toolchain (Node.js >= 20, TypeScript, pnpm) and record in `README`.
- [ ] Create root `package.json`, workspace layout, base TS config, lint/prettier configs.
- [ ] Implement config loader skeleton with schema validation and environment resolution.
- [ ] Wire shared logger and metrics stubs with config-driven enable/disable toggles.

## Phase 1 – Geyser Listener MVP
- [ ] Implement gRPC client wrapper using Solana Geyser proto definitions.
  - [ ] Import/compile proto files into TS (ts-proto or buf).
  - [ ] Parameterize endpoint, auth token, reconnect backoff via config.
- [ ] Subscribe to Pump.fun program `TokenCreated` events.
  - [ ] Define filter builder using config-specified program IDs and account filters.
  - [ ] Normalize incoming messages into domain event objects.
- [ ] Publish events onto internal event bus with latency timestamps.
- [ ] Add latency metrics + structured logging for each received event.
- [ ] Dump per-loop performance report (events processed, avg latency, errors) to log file.

## Phase 2 – Buy Pipeline (Simulation)
- [ ] Implement Pump.fun strategy evaluator.
  - [ ] Read thresholds from config (market cap, liquidity, owner checks, etc.).
  - [ ] Determine trade quantity and slippage parameters.
- [ ] Build transaction construction utilities.
  - [ ] Write PDA + instruction helpers for Pump.fun buy flow.
  - [ ] Encapsulate token account creation + SOL wrapping logic.
- [ ] Integrate simulation path.
  - [ ] Respect `simulate.enabled` and `simulate.skipPreflight` flags.
  - [ ] Capture simulation latency + result metrics.
- [ ] Expose `/v1/snipe/buy` Express route that triggers build + simulate without send.
  - [ ] Validate payloads using zod and config-based defaults.
  - [ ] Ensure route-level latency metrics and final loop performance dump.

## Phase 3 – Buy Submission & Confirmation
- [ ] Integrate Jito SDK client with prioritized fee config.
  - [ ] Load tip accounts + bundle options from config.
  - [ ] Implement fallback to direct RPC submit.
- [ ] Implement send pipeline with retries and signature tracking.
  - [ ] Emit `BuySubmitted` events containing signature and metadata.
- [ ] Extend Geyser listener to monitor our wallet/signature list for confirmation.
  - [ ] Maintain pending signature map with timestamps for latency calculation.
  - [ ] On confirmation, emit `BuyLanded` event and append to trade store.
- [ ] Expand performance reports to include success rate, failures, and fee data.

## Phase 4 – Sell Automation (Simulation + Send)
- [ ] Configure wait-period scheduler (per token or global) using async timers.
- [ ] Build sell transaction constructors and simulation logic mirroring buy flow.
- [ ] Add `/v1/snipe/sell` Express route for manual overrides/testing.
- [ ] Implement automatic sell trigger in strategy once wait period elapses.
- [ ] Submit sell transactions via Jito client, track confirmation, update trade store.
- [ ] Include buy/sell PnL computation and cumulative metrics in loop dumps.

## Phase 5 – Observability & Operational Hardening
- [ ] Add persistent log storage/rotation and metrics exporting (Prometheus/OTLP).
- [ ] Implement health checks and readiness probes for Express hot-route and Geyser service.
- [ ] Add feature flags for latency profiling and debug traces.
- [ ] Document runbooks: config examples, troubleshooting, deployment steps.

## Phase 6 – Testing & QA
- [ ] Unit tests for config loader, transaction builders, metrics reporter.
- [ ] Integration tests with local validator (solana-test-validator) using mock Pump.fun program IDs.
- [ ] Smoke tests for Express endpoint and Geyser stream connectivity (devnet profile).
- [ ] Load tests for hot-route to validate throughput and latency targets.
- [ ] QA checklist before production: secret rotation, fallback RPCs, monitoring dashboards.

## Continuous Improvements / Backlog
- [ ] Swap EventEmitter for pluggable message bus (Redis Streams or NATS).
- [ ] Persist trade history into SQLite/Postgres for post-trade analytics.
- [ ] Add strategy experimentation interface (e.g., config-driven multi-strategy support).
- [ ] Build UI dashboard for live metrics and performance logs visualization.
- [ ] Implement bundle submissions with multiple buys per slot (advanced feature).
