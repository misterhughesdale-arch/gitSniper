# Fresh Sniper – Modular Solana Token Sniping Service

A high-performance, low-latency Solana sniping bot that listens for Pump.fun token creations via Yellowstone Geyser streams, executes configurable buy/sell strategies, and tracks comprehensive performance metrics.

## Architecture Overview

Fresh Sniper provides a modular architecture with clear separation of concerns:

- **Config Service**: TOML/YAML configuration with environment variable interpolation and Zod validation
- **Logging & Metrics**: Structured logging (pino-style) with configurable histograms and counters
- **Solana Client**: Unified wrapper for RPC, WebSocket, and Jito Block Engine interactions
- **Geyser Stream**: Real-time event streaming from Shyft Yellowstone gRPC for token creation detection
- **Transaction Pipeline**: Builders, simulators, and senders for buy/sell operations
- **Strategy Layer**: Pump.fun-specific logic with liquidity checks, slippage protection, and timing controls
- **Hot Route Express API**: Low-latency `/v1/snipe` endpoint for buy/sell execution

## Toolchain Requirements

- **Node.js**: >= 20.0.0 (LTS recommended)
- **pnpm**: >= 9.0.0 (package manager)
- **TypeScript**: >= 5.0 (configured in workspace)

## Project Structure

```
freshSniper/
├── apps/
│   └── hot-route/              # Express API for snipe endpoints
├── packages/
│   ├── config/                 # Configuration loader with Zod validation
│   ├── logging/                # Structured logging utilities
│   ├── metrics/                # Performance metrics and reporters
│   ├── solana-client/          # Solana RPC/WebSocket/Jito client wrapper
│   ├── transactions/           # Transaction builders and simulators
│   └── strategies/
│       └── pumpfun/            # Pump.fun-specific strategy logic
├── services/
│   └── geyser-stream/          # Yellowstone gRPC listener for token events
├── config/
│   ├── default.toml            # Base configuration
│   └── development.toml        # Environment-specific overrides
├── logs/                       # Application and metrics logs
└── examples/                   # Reference implementations and testing utilities
```

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy the environment template and configure your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `SOLANA_RPC_PRIMARY`: Primary Solana RPC endpoint
- `GEYSER_ENDPOINT`: Shyft Yellowstone gRPC endpoint (e.g., `grpc.shyft.to:443`)
- `GEYSER_AUTH_TOKEN`: Your Shyft API token
- `JITO_BLOCK_ENGINE_URL`: Jito Block Engine endpoint
- `JITO_TIP_ACCOUNT`: Jito tip receiver account
- `TRADER_KEYPAIR_PATH`: Path to trader wallet keypair JSON
- `TRADER_WALLET_ADDRESS`: Trader wallet public key

### 3. Build Workspace

```bash
pnpm build
```

### 4. Start Services

Start the Geyser stream listener:

```bash
pnpm dev:geyser
```

In a separate terminal, start the hot-route API:

```bash
pnpm start:hot-route
```

## Configuration

Configuration is layered using TOML files in the `config/` directory:

1. **Base configuration**: `config/default.toml` (shared defaults)
2. **Environment overrides**: `config/{environment}.toml` (per-environment settings)
3. **Environment variables**: `${VAR_NAME}` syntax for sensitive data

### Key Configuration Sections

```toml
[rpc]
primary_url = "${SOLANA_RPC_PRIMARY}"
fallback_urls = []
commitment = "processed"

[jito]
block_engine_url = "${JITO_BLOCK_ENGINE_URL}"
tip_account_pubkey = "${JITO_TIP_ACCOUNT}"
priority_fee_lamports = 10000
bundle_enabled = true

[geyser]
endpoint = "${GEYSER_ENDPOINT}"
auth_token = "${GEYSER_AUTH_TOKEN}"

[strategy]
buy_amount_sol = 0.1
max_slippage_bps = 300  # 3%
sell_wait_seconds = 120
max_open_positions = 3

[simulation]
enabled = true
skip_preflight = false
```

## API Endpoints

### POST /v1/snipe/buy

Execute a buy transaction for a Pump.fun token.

**Request Body:**
```json
{
  "mint": "TokenMintAddress",
  "amountSol": 0.1,
  "slippageBps": 300
}
```

**Response:**
```json
{
  "success": true,
  "signature": "transaction_signature",
  "metrics": {
    "buildTimeMs": 12,
    "simulateTimeMs": 45,
    "sendTimeMs": 78
  }
}
```

### POST /v1/snipe/sell

Execute a sell transaction for a held token position.

**Request Body:**
```json
{
  "mint": "TokenMintAddress",
  "percentage": 100,
  "slippageBps": 300
}
```

## Event Flow

1. **Discovery**: Geyser service subscribes to Pump.fun program updates
2. **Filtering**: Strategy evaluates liquidity, creator checks, and thresholds
3. **Execution**: Hot route constructs and simulates transaction
4. **Submission**: Transaction sent via Jito (with tip) or fallback RPC
5. **Confirmation**: Geyser monitors wallet for confirmation events
6. **Settlement**: Automatic sell triggered after configured wait period

## Provider Strategy

- **Primary Stream**: Shyft Yellowstone gRPC for token creation events
- **Primary RPC**: Configurable via `SOLANA_RPC_PRIMARY`
- **Fallback RPCs**: Shyft RPC → Helius RPC for degraded performance
- **Transaction Submission**: Jito Block Engine (default tip: 0.00001 SOL)

## Performance & Observability

### Metrics

Metrics are automatically collected and reported to `logs/metrics.log`:

- `pumpfun_new_creation_events`: Token creation events detected
- `pumpfun_geyser_process_ms`: Event processing latency
- `geyser_stream_errors`: Connection/stream errors
- `transaction_build_ms`: Transaction construction time
- `transaction_simulate_ms`: Simulation latency
- `transaction_send_ms`: Submission to confirmation time

### Logging

Structured JSON logs written to `logs/app.log`:

```json
{
  "level": "info",
  "time": "2025-10-20T12:34:56.789Z",
  "msg": "pumpfun token creation detected",
  "context": {
    "signature": "...",
    "slot": 12345678,
    "mintedTokens": [...]
  }
}
```

## Development Roadmap

- [x] **Phase 0**: Project bootstrap, config loader, logging/metrics
- [x] **Phase 1**: Geyser listener MVP with event normalization
- [ ] **Phase 2**: Buy pipeline with simulation
- [ ] **Phase 3**: Buy submission & confirmation tracking
- [ ] **Phase 4**: Sell automation
- [ ] **Phase 5**: Observability & operational hardening
- [ ] **Phase 6**: Testing & QA

See `docs/todo.md` for detailed task breakdown.

## Examples & References

The `examples/` directory contains reference implementations:

- `pumpfun-bonkfun-bot/`: Complete Python reference implementation
- `stream_pump_fun_new_minted_tokens/`: Token creation detection example
- `jito-js-rpc/`: Jito Block Engine integration patterns

## Security Considerations

- **Never commit private keys**: Use `.env` for sensitive configuration
- **Validate all inputs**: Zod schemas protect against malformed data
- **Rate limiting**: Configure Express middleware for production
- **Secrets management**: Consider Vault/KMS for production deployments

## Testing

```bash
# Run unit tests
pnpm test

# Run integration tests (requires devnet)
pnpm test:integration

# Run linter
pnpm lint
```

## Troubleshooting

### Geyser Connection Issues

1. Verify `GEYSER_AUTH_TOKEN` is valid
2. Check Shyft API quota/limits
3. Review logs for reconnection attempts

### Transaction Failures

1. Enable simulation: `simulation.enabled = true`
2. Check wallet SOL balance for fees
3. Review slippage settings
4. Verify Jito tip account configuration

### High Latency

1. Use dedicated RPC endpoints (avoid public RPCs)
2. Enable `skip_preflight` for faster submission
3. Tune `priority_fee_lamports` for better landing rates
4. Monitor metrics for bottlenecks

## License

See LICENSE file for details.

## Contributing

Contributions welcome! Please follow:
- TypeScript strict mode
- Structured logging patterns
- Comprehensive error handling
- Unit tests for new features

For questions or support, open an issue on GitHub.

