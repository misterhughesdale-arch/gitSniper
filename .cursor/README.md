# Cursor Rules for GitSniper

This directory contains project-specific rules and patterns for AI-assisted development.

## Files

### `.cursorrules`

Main Cursor AI rules file containing:

- Project context and tech stack
- Code style and naming conventions
- Async/await best practices
- Solana-specific patterns
- PumpFun protocol specifics
- Testing and security guidelines
- Common pitfalls to avoid

### `solana-patterns.md`

Reusable Solana development patterns:

- Transaction building
- PDA caching strategies
- Yellowstone gRPC stream management
- RPC connection with fallback
- Token account management
- Non-blocking confirmation tracking

### `pumpfun-specifics.md`

PumpFun protocol details:

- Program IDs and constants
- Account structures (buy: 16, sell: 14)
- Instruction formats and discriminators
- PDA derivation methods
- Bonding curve state parsing
- Common mistakes and how to avoid them

## Markdown Linting

### `.markdownlint.json`

Configures markdown linting rules to prevent common errors:

**Key Settings**:

- `MD003`: ATX-style headers only (# ## ###)
- `MD013`: Line length 120 chars (disabled for code/tables)
- `MD029`: Ordered lists restart at 1 after headings
- `MD033`: Allow inline HTML (for special formatting)
- `MD034`: Allow bare URLs (for convenience)
- `MD040`: Don't require language in code blocks

## Using These Rules

### Cursor IDE

Cursor automatically reads `.cursorrules` and applies the guidelines when:

- Writing new code
- Refactoring existing code
- Answering questions about the project
- Suggesting improvements

### Markdown Linting

Install markdownlint extension in your editor, or run:

```bash
# Install globally
npm install -g markdownlint-cli

# Lint all markdown files
markdownlint '**/*.md' --ignore node_modules

# Auto-fix issues
markdownlint '**/*.md' --ignore node_modules --fix
```

## Quick Reference

### Priority Fees

- Buy: p75-p99 Jito tips (50k-500k microlamports)
- Sell: Minimal (10k microlamports)
- Emergency: High priority (50k+ microlamports)

### PumpFun Accounts

- Buy: 16 accounts (includes volume tracking)
- Sell: 14 accounts (no volume tracking)
- Creator vault: MUST use bonding curve creator

### Performance Targets

- Buy latency: <50ms (detection to send)
- Confirmation: Non-blocking (background)
- PDA derivation: Cached (<0.001ms)
- Balance check: Cached (~0ms)

### Common Issues

1. Import errors → Run `pnpm install && pnpm -r build`
2. Transaction fails → Check priority fee and RPC health
3. Stream disconnects → Implement exponential backoff
4. Wrong accounts → Double-check order and count

## Contributing

When adding new patterns or rules:

1. Document with clear examples
2. Explain WHY, not just WHAT
3. Include both good and bad examples
4. Add to relevant file (.cursorrules, solana-patterns, or pumpfun-specifics)
5. Keep rules up to date with code changes

## Resources

- [Solana Docs](https://docs.solana.com)
- [Cursor Documentation](https://cursor.sh/docs)
- [Markdownlint Rules](https://github.com/DavidAnson/markdownlint)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
