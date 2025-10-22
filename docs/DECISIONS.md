# Architecture Decision Log

This document tracks major architectural and technical decisions made during development.
It follows the [ADR (Architecture Decision Record)](https://adr.github.io/) format.

---

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Decision Record Format](#2-decision-record-format)
- [3. Past Decisions](#3-past-decisions)
  - [ADR-001: Monorepo with pnpm Workspaces](#adr-001-monorepo-with-pnpm-workspaces)
  - [ADR-002: Momentum-Based Auto-Sell Strategy](#adr-002-momentum-based-auto-sell-strategy)
  - [ADR-003: Fire-and-Forget Transaction Pattern](#adr-003-fire-and-forget-transaction-pattern)
  - [ADR-004: TOML for Strategy Configuration](#adr-004-toml-for-strategy-configuration)
  - [ADR-005: Organized Script Structure](#adr-005-organized-script-structure)
  - [ADR-006: CSV Export for Trade Performance](#adr-006-csv-export-for-trade-performance)
  - [ADR-007: Rent Reclaim Every 4 Buys](#adr-007-rent-reclaim-every-4-buys)
  - [ADR-008: Documentation Organization](#adr-008-documentation-organization)
- [4. Template for Future Decisions](#4-template-for-future-decisions)
- [5. Next Decision Number](#5-next-decision-number)

---

## 1. Introduction

This decision log serves as a centralized record of key architectural and technical choices, including context and consequences, to ensure alignment and transparency as the project evolves.

---

## 2. Decision Record Format

Each ADR must include:

- **Date**: When the decision was made
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: Why was this decision necessary?
- **Decision**: What was decided?
- **Consequences**: What follows from this decision?

---

## 3. Past Decisions

### ADR-001: Monorepo with pnpm Workspaces

- **Date**: 2025-10-22  
- **Status**: Accepted

**Context**  
- Need to share code between packages (config, transactions, auto-sell)
- Want consistent dependency versions
- TypeScript project references for fast builds

**Decision**  
Use pnpm workspaces with TypeScript project references.

**Consequences**  
- ✅ Easy code sharing between packages
- ✅ Fast incremental builds
- ✅ Single pnpm-lock.yaml
- ⚠️ Requires building packages before using

---

### ADR-002: Momentum-Based Auto-Sell Strategy

- **Date**: 2025-10-22  
- **Status**: Accepted

**Context**  
- Need automated exit strategy
- Want to ride momentum while it lasts
- Need to protect capital with breakeven exits

**Decision**  
Implement momentum tracker that monitors buy/sell ratio and exits on:
1. 2+ second lull (no buys)
2. Sell pressure (ratio < 0.5)
3. Breakeven at target market cap (9000 SOL)

**Consequences**  
- ✅ Automated risk management
- ✅ Recovers initial investment at breakeven
- ✅ Rides momentum for potential profits
- ⚠️ May exit on temporary lulls (false signals)

---

### ADR-003: Fire-and-Forget Transaction Pattern

- **Date**: 2025-10-22  
- **Status**: Proposed

**Context**  
- Buy transactions currently wait for confirmation (400-1000ms)
- This delays processing of next token
- Speed is critical for competitive edge

**Decision**  
Send transaction and track confirmation in background.

**Consequences**  
- ✅ Reduces buy latency from 600ms to <50ms
- ✅ Can process multiple tokens faster
- ⚠️ Need separate confirmation tracker service
- ⚠️ More complex error handling

---

### ADR-004: TOML for Strategy Configuration

- **Date**: 2025-10-22  
- **Status**: Accepted

**Context**  
- Need human-readable configuration
- Want comments in config files
- Need type validation at runtime

**Decision**  
Use TOML for strategy configs with Zod validation.

**Consequences**  
- ✅ Easy to read and edit
- ✅ Supports comments
- ✅ Type-safe with Zod
- ⚠️ Need custom TOML parser (simple one implemented)

---

### ADR-005: Organized Script Structure

- **Date**: 2025-10-22  
- **Status**: Accepted

**Context**  
- Scripts were scattered in flat directory (14+ files)
- Mixed purposes: bots, utilities, tests, monitoring
- Hard to find and maintain scripts

**Decision**  
Organize scripts into subdirectories:
- `scripts/utils/` - Operational utilities (pnl, positions, emergency-sell)
- `scripts/monitoring/` - Monitoring tools (jito tips, debugging)
- `scripts/dev/` - Development and testing scripts
- Main bot moved to `apps/momentum-sniper/`

**Consequences**  
- ✅ Easy to find scripts by purpose
- ✅ Clear separation of concerns
- ✅ Scalable structure for adding more scripts
- ⚠️ Need to update all documentation with new paths

---

### ADR-006: CSV Export for Trade Performance

- **Date**: 2025-10-22  
- **Status**: Accepted

**Context**  
- Need to track individual trade profitability
- Want historical analysis capabilities
- Need to measure strategy effectiveness

**Decision**  
Export trade data to CSV files:
- `results/trades-{timestamp}.csv` - Individual trades
- `results/session-{timestamp}.csv` - Hourly aggregates
- Track actual SOL received (not estimates)

**Consequences**  
- ✅ Complete trade history for analysis
- ✅ Import to Excel/Sheets for charts
- ✅ Calculate win rate, P&L, hold times
- ✅ Identify profitable patterns
- ⚠️ CSV files grow over time (need cleanup strategy)

---

### ADR-007: Rent Reclaim Every 4 Buys

- **Date**: 2025-10-22  
- **Status**: Accepted

**Context**  
- Each buy creates ATA (~0.00204 SOL rent)
- After sell, ATA is empty but not closed
- Rent adds up quickly (20 trades = ~0.04 SOL locked)

**Decision**  
Automatically reclaim rent every 4 completed buys:
- Query all token accounts
- Filter for zero balance
- Batch close instructions into single transaction
- Show profitability checkpoint

**Consequences**  
- ✅ Recovers ~0.008 SOL every 4 buys
- ✅ Reduces capital lockup
- ✅ Checkpoint provides performance feedback
- ⚠️ Adds ~1-2s to buy flow (runs in background)

---

### ADR-008: Documentation Organization

- **Date**: 2025-10-22  
- **Status**: Accepted

**Context**  
- Too many random .md files at project root
- Documentation scattered and hard to navigate
- User explicitly requested better organization

**Decision**  
Use structured documentation approach:
- Root: Only README.md, CHANGELOG.md, LICENSE
- `docs/ACTIVITY.md` - Ongoing work log
- `docs/DECISIONS.md` - This file (ADRs)
- `docs/architecture.md` - System architecture
- `docs/archive/` - Temporary review documents
- Never create ad-hoc .md files

**Consequences**  
- ✅ Clean root directory
- ✅ Easy to find documentation
- ✅ Clear purpose for each doc file
- ✅ Prevents documentation clutter
- ⚠️ Must update existing files instead of creating new ones

---

## 4. Template for Future Decisions

> Copy this template for new ADRs.

```markdown
## ADR-XXX: [Title]

**Date**: YYYY-MM-DD  
**Status**: Proposed | Accepted | Deprecated | Superseded

**Context**:
[Why do we need to make this decision? What is the situation?]

**Decision**:
[What are we going to do?]

**Consequences**:
- ✅ Positive outcomes
- ⚠️ Trade-offs
- ❌ Negative outcomes
```

---

---

### ADR-009: Integrate Official PumpFun SDK

- **Date**: 2025-10-22  
- **Status**: Accepted

**Context**  
- Manual transaction building is complex (16/14 accounts)
- Account derivation errors are hard to debug
- SDK provides tested buy/sell implementation
- SDK includes Jito bundle support and relay integrations

**Decision**  
Integrate [pumpdotfun-repumped-sdk](https://github.com/D3AD-E/pumpdotfun-sdk-repumped):
- Created `sdk-wrapper.ts` for easier integration
- Updated momentum-sniper to use SDK methods
- Kept original builders for reference/fallback
- SDK handles all PDA derivations automatically

**Consequences**  
- ✅ Tested buy/sell logic (fewer bugs)
- ✅ Jito bundle support ready (set `useJito: true`)
- ✅ 4 relay options (Astra, 0Slot, NodeOne, NextBlock)
- ✅ Anchor-based with full IDL
- ⚠️ Additional dependency (but worth it)
- ⚠️ SDK uses Anchor (adds weight but provides safety)

---

## 5. Next Decision Number

> **Next Decision Number**: ADR-010

