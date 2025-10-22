# Changelog

All notable changes to GitSniper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2025-10-22

### Added

**Core Features**:
- PumpFun transaction builders (buy: 16 accounts, sell: 14 accounts)
- Momentum-based auto-sell strategy with configurable TOML
- Position manager with lull detection (2s threshold)
- Buy/sell ratio monitoring in rolling 10s window
- Breakeven sell at target market cap (50% exit)
- CSV export for individual trade performance
- Hourly session aggregates for analysis
- Rent reclaim every 4 buys (~0.008 SOL recovered)

**Packages**:
- `@fresh-sniper/transactions` - Transaction builders and PDA derivations
- `@fresh-sniper/auto-sell` - Momentum tracking and position management
- `@fresh-sniper/config` - TOML configuration with Zod validation

**Applications**:
- `apps/momentum-sniper` - Main trading bot with Geyser stream integration

**Scripts**:
- Organized into utils/, monitoring/, dev/ subdirectories
- Enhanced test script with profitability tracking
- Emergency utilities (sell-all, reclaim-rent, etc.)

**Documentation**:
- Comprehensive README.md
- docs/ACTIVITY.md - Development activity log
- docs/DECISIONS.md - Architecture decision records (8 ADRs)
- docs/architecture.md - System architecture
- docs/momentum-strategy.md - Strategy explanation
- .cursorrules - AI development guidelines
- .cursor/ - Solana and PumpFun patterns

**Configuration**:
- .markdownlint.json - Zero-error markdown linting
- .editorconfig - Consistent code formatting
- .env.example - Environment variable template
- .gitignore - Protection for sensitive files

### Changed

- Reorganized scripts from flat structure to organized subdirectories
- Moved momentum-sniper from scripts/ to apps/
- Updated all import paths to use workspace packages
- Cleaned up root directory (only README.md remains)

### Fixed

- TypeScript compilation errors in all packages
- Import path issues between packages
- Markdown linting errors across documentation
- Git remote configuration for new repository

### Security

- Protected keypair files in .gitignore
- Never log private keys or sensitive data
- Environment variable template without actual values
- PAT token authentication for GitHub

---

## [Unreleased]

### Planned

**Performance Optimizations**:
- Balance caching (remove 50-100ms RPC call)
- Fire-and-forget transactions (remove 400-1000ms wait)
- Target: <50ms from detection to transaction sent

**Features**:
- Multiple concurrent positions (3-5 max)
- Real market cap calculation from bonding curve
- Advanced filters (liquidity, creator whitelist)
- Circuit breakers for error recovery

**Monitoring**:
- Web dashboard for real-time monitoring
- Prometheus metrics export
- Alert system (Telegram/Discord)

---

[1.0.0]: https://github.com/misterhughesdale-arch/gitSniper/releases/tag/v1.0.0
