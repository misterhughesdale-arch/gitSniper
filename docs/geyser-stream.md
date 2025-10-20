# Geyser Stream Service

This service connects to Shyft's Yellowstone gRPC endpoint and emits `pumpfun:tokenCreated` events whenever a newly minted Pump.fun token is detected. Metrics and structured logs are emitted for every stream loop to keep hot-route latency transparent.

## Prerequisites
- Obtain a Shyft Yellowstone gRPC endpoint URL and access token (`X-Token`).
- Set the following environment variables before launching:
  - `GEYSER_ENDPOINT` – gRPC host with port (e.g. `grpc.shyft.to:10000`).
  - `GEYSER_AUTH_TOKEN` – Shyft X-Token value.
  - `SOLANA_RPC_PRIMARY` – primary RPC used elsewhere in the stack.
  - `TRADER_WALLET_ADDRESS` – wallet to monitor for landed buys.
  - `TRADER_KEYPAIR_PATH` – filesystem path to the signing keypair.
  - `JITO_BLOCK_ENGINE_URL` / `JITO_TIP_ACCOUNT` when integrating the Jito sender.

Override the defaults in `config/default.toml` or create environment-specific overrides in `config/{env}.toml`.

## Running the Stream Locally
```bash
pnpm --filter geyser-stream-service build
pnpm --filter geyser-stream-service start
```

The CLI loads configuration via `@fresh-sniper/config`, instantiates the file-backed logger + metrics reporter, and starts the reconnection-aware Yellowstone subscription loop.

On shutdown (`SIGINT`/`SIGTERM`) the service drains the stream, removes listeners, and exits cleanly.

## Observability
- **Logs**: `config.logging.file` (JSON lines including slot, signature, and minted tokens).
- **Metrics**: `config.metrics.report_file` (per-loop counters + latency histograms).
- **Counters**: `geyser_stream_reconnect_attempts`, `geyser_stream_errors`, `pumpfun_new_creation_events`.
- **Latency**: `pumpfun_geyser_process_ms` histogram per update.

## Reconnection Strategy
- Exponential backoff starting at `geyser.reconnect.initial_backoff_ms` up to `max_backoff_ms`.
- Backoff resets immediately after a successful subscribe.
- Metrics track connect/reconnect attempts so you can spot upstream issues.

## Event Payload
Each `pumpfun:tokenCreated` event published to the shared `EventEmitter` contains:

```ts
{
  type: "TokenCreated",
  signature: string | null,
  slot: number | null,
  filters: string[],
  mintedTokens: Array<{
    mint: string;
    owner: string;
    programId: string;
    amountRaw: string;
    amountUi?: number;
    amountUiString?: string;
  }>,
  receivedAt: number,
  logMessages: string[]
}
```

Downstream consumers (Express hot-route, strategy workers) can extend this payload for buy decisions, latency tracking, and immediate sell scheduling.
