# Development Guide

Guide for developers working on Fresh Sniper.

## Architecture

Fresh Sniper follows a modular monorepo architecture:

### Core Packages

- **config**: TOML configuration loader with Zod validation
- **logging**: Structured JSON logging (pino-style)
- **metrics**: Performance tracking with histograms and counters
- **events**: Type-safe domain event bus
- **store**: Trade position and history management
- **solana-client**: Solana RPC/WebSocket/Jito client wrappers
- **transactions**: Pump.fun transaction builders and PDAs

### Services

- **geyser-stream**: Yellowstone gRPC listener for token events

### Applications

- **hot-route**: Express API for manual buy/sell endpoints

## Code Style

- TypeScript strict mode
- No hardcoded values (use config)
- Comprehensive error handling with try-catch
- Structured logging for all operations
- Type annotations on all functions

## Adding a New Package

```bash
mkdir -p packages/my-package/src
cd packages/my-package

# Create package.json
cat > package.json << 'EOF'
{
  "name": "@fresh-sniper/my-package",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "private": false
}
EOF

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
EOF

# Update tsconfig.base.json paths
# Update root tsconfig.json references
```

## Key Files

### Transaction Builders

File: `packages/transactions/src/pumpfun/builders.ts`

- `buildBuyTransaction()` - Constructs Pump.fun buy transactions
- `buildSellTransaction()` - Constructs sell transactions

### PDAs

File: `packages/transactions/src/pumpfun/pdas.ts`

- `deriveBondingCurvePDA()` - Get bonding curve account
- `deriveAssociatedBondingCurvePDA()` - Get token account
- `deriveAssociatedTokenAddress()` - Get user's token account

### Geyser Stream

File: `services/geyser-stream/src/subscriptions/pumpfunCreations.ts`

- Yellowstone gRPC subscription management
- Token creation event extraction
- Auto-reconnection with exponential backoff

## Testing Changes

### Test Individual Package

```bash
cd packages/config
npx tsx src/index.ts  # Test directly
```

### Test Stream Detection

```bash
pnpm dev:working  # Safe - no transactions
```

### Test Full Pipeline

```bash
# Use SMALL amounts!
pnpm dev:full
```

## Adding Features

### Example: Add New Metric

1. Increment counter in code:

```typescript
metrics.incrementCounter("my_new_metric");
```

2. Observe latency:

```typescript
const start = Date.now();
// ... operation
metrics.observeLatency("my_operation_ms", Date.now() - start);
```

3. Report summary:

```typescript
metrics.reportLoopSummary({
  loop: "my_operation",
  success: true,
  customField: value,
});
```

### Example: Add New Event

1. Define event type in `packages/events/src/index.ts`:

```typescript
export interface MyNewEvent {
  type: "MyNew";
  data: string;
  timestamp: number;
}
```

2. Add emitter method:

```typescript
emitMyNew(event: Omit<MyNewEvent, "type">): void {
  this.emit("my:new", { ...event, type: "MyNew" });
}
```

3. Add listener method:

```typescript
onMyNew(handler: (event: MyNewEvent) => void): void {
  this.on("my:new", handler);
}
```

## Build System

```bash
pnpm build        # Build all packages
pnpm clean        # Remove build artifacts
```

Build order (managed by TypeScript project references):

1. config, logging, metrics, events, store (no dependencies)
2. solana-client (depends on config)
3. transactions (depends on config, logging, metrics, solana-client)
4. services and apps (depend on everything)

## Debugging

### Enable Debug Logging

Edit `config/default.toml`:

```toml
[logging]
level = "debug"
```

### Check Metrics

Metrics are written to `logs/mvp-metrics.log`:

```bash
tail -f logs/mvp-metrics.log | jq
```

### Inspect Geyser Events

Add verbose logging in `examples/working-mvp.ts`:

```typescript
console.log(JSON.stringify(data, null, 2));
```

## Common Patterns

### Configuration Access

```typescript
import { loadConfig } from "@fresh-sniper/config";
const config = loadConfig();
```

### Logging

```typescript
import { createRootLogger } from "@fresh-sniper/logging";
const logger = createRootLogger({ level: "info" });
logger.info({ context: "value" }, "message");
```

### Metrics

```typescript
import { createMetrics } from "@fresh-sniper/metrics";
const metrics = createMetrics({ enabled: true, samplingRatio: 1.0 });
metrics.incrementCounter("counter_name");
metrics.observeLatency("operation_ms", timeMs);
```

## Next Steps

See `docs/todo.md` for development roadmap.
