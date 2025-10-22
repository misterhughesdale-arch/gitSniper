# Development Guide

A comprehensive guide for engineers contributing to Fresh Sniper.  
**Sections:**  
- [Architecture Overview](#architecture-overview)  
- [Development Standards](#development-standards)  
- [How to Add a New Package](#how-to-add-a-new-package)  
- [Key Code Locations](#key-code-locations)  
- [Testing & Validation](#testing--validation)  
- [Feature Addition Guide](#feature-addition-guide)  
- [Build & Clean System](#build--clean-system)  
- [Debugging Checklist](#debugging-checklist)  
- [Common Coding Patterns](#common-coding-patterns)  
- [Next Steps](#next-steps)  

---

## Architecture Overview

Fresh Sniper uses a modular TypeScript monorepo.  
Understand where to place your work and its dependencies:

### 1. Core Packages

- **config:**  
  - Load TOML configs  
  - Validate with Zod  
- **logging:**  
  - Pino-style structured JSON logging  
- **metrics:**  
  - Histograms, counters, and operational timings  
- **events:**  
  - Type-safe domain event bus for loosely-coupled modules  
- **store:**  
  - Trade position state & history  
- **solana-client:**  
  - Connection abstractions: RPC, WebSocket, Jito  
- **transactions:**  
  - Handles Pump.Fun transaction construction (buy, sell, PDA tools)

### 2. Services

- **geyser-stream:**  
  - Listens to Yellowstone gRPC for token events

### 3. Applications

- **hot-route:**  
  - Express API exposing manual endpoints for buy/sell

---

## Development Standards

**Coding Style:**  
- TypeScript strict mode  
- _No hardcoded values_ (always use config)
- Wrap critical ops in try/catch, propagate errors upward
- All logs must use structured loggers (no `console.log` except in scripts)
- Explicit typing everywhere (annotate all function signatures)
- Consistent naming and file structure (see existing packages)

---

## How to Add a New Package

Follow these steps to add and integrate a package:

#### 1. Create New Package Structure

```bash
mkdir -p packages/my-package/src
cd packages/my-package
```

#### 2. Add `package.json`

```bash
cat > package.json << 'EOF'
{
  "name": "@fresh-sniper/my-package",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "private": false
}
EOF
```

#### 3. Add `tsconfig.json`

```bash
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
```

#### 4. Link to Monorepo

- Update `tsconfig.base.json` with new path alias if applicable
- Add new package to root `tsconfig.json` references array

#### 5. Implement Package Code

- Place core logic in `src/`
- Add type definitions
- Export your API

#### 6. Add README and Tests

- Describe package use in its `README.md`
- Place unit tests in `src/` alongside code

---

## Key Code Locations

| Feature              | File Path                                               | Main Usage                          |
|----------------------|--------------------------------------------------------|-------------------------------------|
| Transaction Builders | `packages/transactions/src/pumpfun/builders.ts`        | `buildBuyTransaction`, `buildSellTransaction` |
| PDA Helpers          | `packages/transactions/src/pumpfun/pdas.ts`            | PDA derivations                     |
| Geyser Subscriptions | `services/geyser-stream/src/subscriptions/pumpfunCreations.ts` | Token creation detection            |

---

## Testing & Validation

Break larger validation tasks into subtasks before merging:

### 1. Test an Individual Package

```bash
cd packages/config
npx tsx src/index.ts   # Run entry file or test scripts here
```

### 2. Test Stream Detection

**Subtasks:**  
- Start stream in detection mode  
- Confirm real-time token detection without sending transactions

```bash
pnpm dev:working
```

### 3. Test Full Trading Pipeline

**Subtasks:**  
- Set buy amount low  
- Validate token detection, simulated or real trade  
- Review logs for error or unexpected behaviour

```bash
# Use SMALL amounts!
pnpm dev:full
```

---

## Feature Addition Guide

Add new features methodically using incremental subtasks.

### A. Adding a Metric

1. **Declare and Increment:**  
   ```typescript
   metrics.incrementCounter("my_new_metric");
   ```

2. **Add Latency Tracking:**  
   ```typescript
   const start = Date.now();
   // ... op
   metrics.observeLatency("my_operation_ms", Date.now() - start);
   ```

3. **Summary Reporting:**  
   ```typescript
   metrics.reportLoopSummary({
     loop: "my_operation",
     success: true,
     customField: value,
   });
   ```

### B. Adding an Event

1. **Define Event Type:**  
   In `packages/events/src/index.ts`  
   ```typescript
   export interface MyNewEvent {
     type: "MyNew";
     data: string;
     timestamp: number;
   }
   ```

2. **Emitter Method:**  
   ```typescript
   emitMyNew(event: Omit<MyNewEvent, "type">): void {
     this.emit("my:new", { ...event, type: "MyNew" });
   }
   ```

3. **Listener Method:**  
   ```typescript
   onMyNew(handler: (event: MyNewEvent) => void): void {
     this.on("my:new", handler);
   }
   ```

---

## Build & Clean System

**Build all packages:**  
```bash
pnpm build
```
**Clean build artifacts:**  
```bash
pnpm clean
```

### Build Order

| Step | Packages                       | Description/Dependencies                          |
|------|------------------------------- |---------------------------------------------------|
| 1    | config, logging, metrics, events, store | Foundation (no deps)                    |
| 2    | solana-client                  | Depends on config                                 |
| 3    | transactions                   | Depends on config, logging, metrics, solana-client |
| 4    | services, apps                 | Top-level, depends on everything                  |

---

## Debugging Checklist

### Enable Debug Logging

1. **Edit configuration:**  
   ```toml
   [logging]
   level = "debug"
   ```

2. **Validate log output:**  
   - Use `logs/mvp-metrics.log` for metric insight

### Check Metrics

```bash
tail -f logs/mvp-metrics.log | jq
```

### Verbose Geyser Event Inspection

- In script (`examples/working-mvp.ts`):  
   ```typescript
   console.log(JSON.stringify(data, null, 2));
   ```

---

## Common Coding Patterns

### 1. Load Configuration

```typescript
import { loadConfig } from "@fresh-sniper/config";
const config = loadConfig();
```

### 2. Logging

```typescript
import { createRootLogger } from "@fresh-sniper/logging";
const logger = createRootLogger({ level: "info" });
logger.info({ context: "value" }, "message");
```

### 3. Metrics

```typescript
import { createMetrics } from "@fresh-sniper/metrics";
const metrics = createMetrics({ enabled: true, samplingRatio: 1.0 });
metrics.incrementCounter("counter_name");
metrics.observeLatency("operation_ms", timeMs);
```

---

## Next Steps

- Review and contribute to the [project roadmap](./todo.md).
- Check remaining tasks and open issues in `docs/todo.md`.
- Discuss questions or proposals in the team chat or by opening issues.

---

