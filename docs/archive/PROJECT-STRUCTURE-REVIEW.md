# 📁 Project Structure Review & Best Practices

**Date**: 2025-10-22  
**Status**: Recommendations for reorganization

---

## 🔍 Current Structure Analysis

### ✅ Good Practices Found

1. **Monorepo with workspaces** - Using pnpm workspaces ✅
2. **TypeScript throughout** - Consistent language ✅
3. **Separate packages** - Modular architecture ✅
4. **Configuration separated** - `config/` and `strategies/` directories ✅
5. **Documentation present** - Multiple MD files ✅

### ⚠️ Issues Identified

#### 1. **Scripts Directory Chaos**

scripts/
├── calculate-pnl.ts          # Utility
├── debug-jito.sh             # Debug tool
├── emergency-sell-all.ts     # Critical utility
├── final.ts                  # ❓ Unclear name
├── list-positions.ts         # Utility
├── momentum-sniper.ts        # 🎯 Main bot
├── monitor-jito-tips.sh      # Monitoring
├── monitor-jito-tips.ts      # Monitoring (duplicate?)
├── quick-pnl.ts              # Utility
├── reclaim-ata-rent.ts       # Utility
├── sell-via-rpc.ts           # Critical utility
├── simple-test.ts            # Test/prototype
├── test-jito-api.sh          # Test
└── test-runner.ts            # Test

**Problems**:

- Mixed purposes (bots, utilities, tests, monitoring)
- Shell scripts mixed with TypeScript
- Inconsistent naming (kebab-case vs camelCase)
- No clear entry points
- Production vs development scripts not separated

#### 2. **Root Directory Clutter**

Root/
├── CODEBASE-REVIEW.md        # Dev doc
├── GIT-SETUP.md              # Dev doc
├── IMPLEMENTATION-STATUS.md  # Dev doc
├── MOMENTUM-STRATEGY.md      # User doc
├── PUSH-INSTRUCTIONS.md      # Dev doc
├── QUICK-START.md            # User doc
├── SAFETY-CONFIG.md          # User doc
├── SESSION-SUMMARY.md        # Dev doc

**Problems**:

- Too many MD files at root (8 files!)
- Development docs mixed with user docs
- No clear entry point (README.md)

#### 3. **Naming Inconsistencies**

| Current Name | Issue |
|--------------|-------|
| `simple-test.ts` | Not descriptive |
| `final.ts` | ❓ What is this? |
| `quick-pnl.ts` vs `calculate-pnl.ts` | Unclear difference |
| `monitor-jito-tips.ts` + `.sh` | Duplicate functionality? |

#### 4. **Missing Standard Files**

- ❌ No root `package.json` (monorepo should have one)
- ❌ No `README.md` at root
- ❌ No `CHANGELOG.md`
- ❌ No `LICENSE`
- ❌ No `.nvmrc` or `.node-version`
- ❌ No `CONTRIBUTING.md`

---

## 🎯 Recommended Structure

### Ideal Organization

gitSniper/
├── README.md                    # ⭐ Main entry point
├── package.json                 # Root package (scripts, devDeps)
├── pnpm-workspace.yaml          # ✅ Already exists
├── tsconfig.json                # ✅ Already exists
├── tsconfig.base.json           # ✅ Already exists
├── .nvmrc                       # Node version
├── .env.example                 # Environment template
├── LICENSE                      # License file
├── CHANGELOG.md                 # Version history
│
├── apps/                        # 🎯 Production applications
│   ├── momentum-sniper/         # Main trading bot
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── position-monitor/        # Future: monitoring app
│       └── ...
│
├── packages/                    # ✅ Already well-organized
│   ├── auto-sell/
│   ├── config/
│   ├── transactions/
│   └── ...
│
├── scripts/                     # 🔧 Operational scripts
│   ├── utils/                   # General utilities
│   │   ├── calculate-pnl.ts
│   │   ├── list-positions.ts
│   │   ├── reclaim-rent.ts     # Renamed
│   │   └── emergency-sell.ts   # Renamed
│   │
│   ├── monitoring/              # Monitoring & debugging
│   │   ├── monitor-jito-tips.ts
│   │   └── debug-jito.sh
│   │
│   └── dev/                     # Development/testing
│       ├── test-basic-buy.ts   # Renamed from simple-test
│       ├── test-strategy.ts    # Renamed from test-runner
│       └── test-jito-api.sh
│
├── strategies/                  # ✅ Strategy configs
│   ├── README.md
│   └── momentum-breakeven.toml
│
├── config/                      # ✅ System configs
│   ├── default.toml
│   └── development.toml
│
├── docs/                        # 📚 All documentation
│   ├── user/                    # User-facing docs
│   │   ├── README.md            # Moved from root
│   │   ├── QUICK-START.md
│   │   ├── SAFETY-CONFIG.md
│   │   └── MOMENTUM-STRATEGY.md
│   │
│   ├── dev/                     # Developer docs
│   │   ├── CODEBASE-REVIEW.md
│   │   ├── IMPLEMENTATION-STATUS.md
│   │   ├── SESSION-SUMMARY.md
│   │   ├── ARCHITECTURE.md      # Moved from docs/architecture.md
│   │   ├── DEVELOPMENT.md
│   │   └── CONTRIBUTING.md      # New
│   │
│   └── deployment/              # Deployment docs
│       ├── DEPLOYMENT.md
│       ├── PUSH-INSTRUCTIONS.md
│       └── GIT-SETUP.md
│
└── test/                        # 🧪 Test files (future)
    └── integration/

```

---

## 🔄 Migration Plan

### Phase 1: Reorganize Scripts (High Priority)

```bash
# Create new structure
mkdir -p scripts/{utils,monitoring,dev}

# Move utilities
mv scripts/calculate-pnl.ts scripts/utils/
mv scripts/quick-pnl.ts scripts/utils/
mv scripts/list-positions.ts scripts/utils/
mv scripts/reclaim-ata-rent.ts scripts/utils/reclaim-rent.ts
mv scripts/emergency-sell-all.ts scripts/utils/emergency-sell.ts
mv scripts/sell-via-rpc.ts scripts/utils/sell-via-rpc.ts

# Move monitoring
mv scripts/monitor-jito-tips.ts scripts/monitoring/
mv scripts/monitor-jito-tips.sh scripts/monitoring/
mv scripts/debug-jito.sh scripts/monitoring/

# Move dev/test scripts
mv scripts/simple-test.ts scripts/dev/test-basic-buy.ts
mv scripts/test-runner.ts scripts/dev/test-strategy.ts
mv scripts/test-jito-api.sh scripts/dev/

# Remove unclear script
rm scripts/final.ts  # Or rename if needed
```

### Phase 2: Create Apps Directory

```bash
# Create main bot app
mkdir -p apps/momentum-sniper/src

# Move momentum-sniper.ts to app structure
mv scripts/momentum-sniper.ts apps/momentum-sniper/src/index.ts

# Create app package.json
cat > apps/momentum-sniper/package.json << 'EOF'
{
  "name": "@gitsniper/momentum-sniper",
  "version": "1.0.0",
  "private": true,
  "bin": {
    "momentum-sniper": "./dist/index.js"
  },
  "scripts": {
    "start": "tsx src/index.ts",
    "build": "tsc",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@fresh-sniper/auto-sell": "workspace:*",
    "@fresh-sniper/transactions": "workspace:*",
    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.9",
    "@triton-one/yellowstone-grpc": "^0.4.0",
    "bs58": "^5.0.0",
    "dotenv": "^16.0.0"
  }
}
EOF
```

### Phase 3: Reorganize Documentation

```bash
# Create doc structure
mkdir -p docs/{user,dev,deployment}

# Move user docs
mv QUICK-START.md docs/user/
mv SAFETY-CONFIG.md docs/user/
mv MOMENTUM-STRATEGY.md docs/user/

# Move dev docs
mv CODEBASE-REVIEW.md docs/dev/
mv IMPLEMENTATION-STATUS.md docs/dev/
mv SESSION-SUMMARY.md docs/dev/
mv docs/architecture.md docs/dev/ARCHITECTURE.md
mv docs/DEVELOPMENT.md docs/dev/

# Move deployment docs
mv PUSH-INSTRUCTIONS.md docs/deployment/
mv GIT-SETUP.md docs/deployment/
mv docs/DEPLOYMENT.md docs/deployment/

# Clean up old docs/
rm -rf docs/todo.md docs/SETUP.md  # Merge into other docs
```

### Phase 4: Create Root Files

```bash
# Create main README.md
cat > README.md << 'EOF'
# GitSniper 🎯

A high-performance Solana token sniper with momentum-based trading strategies.

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure
cp .env.example .env
# Edit .env with your settings

# Run momentum sniper
pnpm sniper

# Or run directly
cd apps/momentum-sniper
pnpm start
```

## Documentation

- [Quick Start Guide](docs/user/QUICK-START.md)
- [Safety Configuration](docs/user/SAFETY-CONFIG.md)
- [Momentum Strategy](docs/user/MOMENTUM-STRATEGY.md)
- [Development Guide](docs/dev/DEVELOPMENT.md)
- [Architecture](docs/dev/ARCHITECTURE.md)

## Scripts

```bash
# Utilities
pnpm calc-pnl          # Calculate profit/loss
pnpm list-positions    # List open positions
pnpm emergency-sell    # Sell all positions

# Monitoring
pnpm monitor-jito      # Monitor Jito tips
pnpm monitor-positions # Watch positions

# Development
pnpm test-buy         # Test basic buy
pnpm test-strategy    # Test full strategy
```

## Features

✅ Momentum-based auto-sell  
✅ Breakeven protection  
✅ Real-time Geyser stream  
✅ Configurable strategies  
✅ Risk management  

## License

MIT
EOF

# Create package.json

cat > package.json << 'EOF'
{
  "name": "@gitsniper/root",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "sniper": "pnpm --filter @gitsniper/momentum-sniper start",
    "calc-pnl": "tsx scripts/utils/calculate-pnl.ts",
    "list-positions": "tsx scripts/utils/list-positions.ts",
    "emergency-sell": "tsx scripts/utils/emergency-sell.ts",
    "monitor-jito": "tsx scripts/monitoring/monitor-jito-tips.ts",
    "test-buy": "tsx scripts/dev/test-basic-buy.ts",
    "test-strategy": "tsx scripts/dev/test-strategy.ts",
    "build": "pnpm -r build",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.7.2"
  }
}
EOF

# Create .nvmrc

echo "20" > .nvmrc

# Create .env.example

cat > .env.example << 'EOF'

# Solana RPC

SOLANA_RPC_PRIMARY=<https://your-rpc-url>

# Geyser Stream

GRPC_URL=<https://grpc.ny.shyft.to:443>
X_TOKEN=your-auth-token

# Wallet

TRADER_KEYPAIR_PATH=./keypairs/trader.json

# Strategy

STRATEGY_FILE=momentum-breakeven.toml
EOF

```

---

## 📝 Naming Conventions

### Files

**Use kebab-case** for all files:
```

✅ momentum-sniper.ts
✅ calculate-pnl.ts
✅ emergency-sell.ts
❌ finalTest.ts
❌ simple_test.ts

```

### Scripts Categories

1. **Apps** (`apps/*`) - Production applications
   - Format: `{purpose}-{type}/`
   - Examples: `momentum-sniper/`, `position-monitor/`

2. **Utilities** (`scripts/utils/*`) - Operational tools
   - Format: `{action}-{target}.ts`
   - Examples: `calculate-pnl.ts`, `list-positions.ts`, `emergency-sell.ts`

3. **Monitoring** (`scripts/monitoring/*`) - Monitoring & debugging
   - Format: `monitor-{what}.ts`
   - Examples: `monitor-jito-tips.ts`, `monitor-stream.ts`

4. **Dev/Test** (`scripts/dev/*`) - Development & testing
   - Format: `test-{what}.ts`
   - Examples: `test-basic-buy.ts`, `test-strategy.ts`

### Packages

**Use kebab-case** with descriptive names:
```

✅ @fresh-sniper/auto-sell
✅ @fresh-sniper/transactions
✅ @gitsniper/momentum-sniper

```

---

## 🚀 Immediate Actions (Priority Order)

### 1. Create Root README.md ⭐
**Impact**: HIGH  
**Effort**: 30 min  
Provides entry point for users/devs.

### 2. Reorganize Scripts Directory
**Impact**: HIGH  
**Effort**: 1 hour  
Improves navigation and maintenance.

### 3. Move Momentum Sniper to Apps
**Impact**: MEDIUM  
**Effort**: 2 hours  
Establishes proper app structure.

### 4. Reorganize Documentation
**Impact**: MEDIUM  
**Effort**: 1 hour  
Separates user vs dev docs.

### 5. Create Root package.json
**Impact**: MEDIUM  
**Effort**: 30 min  
Provides convenient scripts.

### 6. Remove/Rename Unclear Scripts
**Impact**: LOW  
**Effort**: 15 min  
Clean up confusing files.

---

## 📋 Quick Wins (Do First)

```bash
# 1. Rename unclear scripts
mv scripts/simple-test.ts scripts/test-basic-buy.ts
mv scripts/final.ts scripts/archived-final.ts  # Or delete

# 2. Create README.md (see template above)

# 3. Create root package.json (see template above)

# 4. Add shebang to all scripts
for file in scripts/**/*.ts; do
  if ! grep -q "^#!/usr/bin/env" "$file"; then
    sed -i '1i#!/usr/bin/env tsx' "$file"
  fi
done

# 5. Make scripts executable
chmod +x scripts/**/*.ts
chmod +x apps/*/src/*.ts
```

---

## 🎓 Best Practices Summary

### Directory Structure

1. **`apps/`** - Deployable applications (entry points)
2. **`packages/`** - Reusable libraries
3. **`scripts/`** - Utilities organized by purpose
4. **`docs/`** - All documentation, categorized
5. **`config/`** - System configuration
6. **`strategies/`** - Trading strategies
7. **`test/`** - Test files (future)

### Naming

1. **Files**: kebab-case (e.g., `momentum-sniper.ts`)
2. **Packages**: kebab-case with scope (e.g., `@gitsniper/app`)
3. **Scripts**: Descriptive, action-based (e.g., `emergency-sell.ts`)
4. **Configs**: Descriptive purpose (e.g., `momentum-breakeven.toml`)

### Organization

1. **Separate concerns** - Apps vs libraries vs scripts
2. **Group by purpose** - Not by file type
3. **Clear entry points** - README.md, package.json scripts
4. **Consistent structure** - All apps follow same pattern

### Documentation

1. **README at root** - Project overview
2. **Docs by audience** - user/ vs dev/ vs deployment/
3. **README per app** - App-specific docs
4. **Examples included** - Show, don't just tell

---

## 🔗 References

- [Monorepo Best Practices](https://monorepo.tools/)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [PNPM Workspaces](https://pnpm.io/workspaces)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Status**: ✅ Review Complete  
**Next**: Implement reorganization in phases  
**Priority**: Create README.md and reorganize scripts first
