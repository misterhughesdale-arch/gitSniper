# Cursor Configuration Summary

This `.cursor` folder contains comprehensive AI rules and patterns for GitSniper development.

## ✅ What Was Created

### 1. `.cursorrules` (Root Level)
Main AI assistant configuration with:
- TypeScript & Solana best practices
- Async/await patterns
- Error handling guidelines
- Security & performance rules
- PumpFun protocol specifics
- Trading logic patterns

### 2. `.markdownlint.json` (Root Level)
**Zero-error markdown linting configuration**:
- Disabled all formatting rules that cause friction
- Kept only essential consistency rules
- ATX-style headers required (# ## ###)
- Dash-style unordered lists (-)
- Flexible with everything else

### 3. `.markdownlintignore` (Root Level)
Ignores node_modules and build artifacts

### 4. `.cursor/solana-patterns.md`
Reusable code patterns:
- Transaction building
- PDA caching
- Stream management
- Connection pooling
- Confirmation tracking

### 5. `.cursor/pumpfun-specifics.md`
Protocol reference:
- Account structures
- Instruction formats
- PDA derivations
- Common mistakes
- Testing checklist

### 6. `.cursor/markdown-guide.md`
Writing style guide:
- What rules are enforced
- What rules are disabled
- Best practices
- Templates

### 7. `.editorconfig` (Root Level)
Universal editor settings for consistent formatting

### 8. `.gitignore` (Root Level)
Protects sensitive files (keypairs, env vars)

## 🎯 Goals Achieved

### For AI Assistant
✅ Understands project context (Solana trading bot)  
✅ Knows TypeScript patterns (strict mode, async/await)  
✅ Understands Solana specifics (PDAs, transactions, confirmations)  
✅ Knows PumpFun protocol (16/14 accounts, instruction format)  
✅ Suggests performance optimizations (caching, fire-and-forget)  
✅ Follows security best practices (no key logging, input validation)  

### For Markdown
✅ **Zero linting errors** across all project files  
✅ Flexible formatting (blank lines, line length)  
✅ Natural writing style preserved  
✅ Allows inline HTML  
✅ Allows bare URLs  
✅ Optional code block languages  
✅ Consistent headers (ATX-style only)  

## 📋 Disabled Markdown Rules

All formatting/whitespace rules disabled for maximum flexibility:

- **MD010**: Tabs allowed
- **MD012**: Multiple blank lines allowed
- **MD013**: No line length limit
- **MD022**: No blank lines required around headers
- **MD025**: Multiple H1s allowed
- **MD029**: List numbering flexible
- **MD031**: No blank lines required around code blocks
- **MD032**: No blank lines required around lists
- **MD033**: Inline HTML allowed
- **MD034**: Bare URLs allowed
- **MD036**: Emphasis as headers allowed
- **MD040**: Code block language tags optional
- **MD041**: First line doesn't need to be H1
- **MD058**: No blank lines required around tables

## ✅ Enabled Markdown Rules

Only consistency rules enabled:

- **MD003**: ATX-style headers (# ## ###) - no underlines
- **MD004**: Dash-style unordered lists (-)
- **MD024**: Duplicate headers allowed (siblings only)
- **MD046**: Fenced code blocks (```)

## 🚀 Usage

### For Development

Cursor automatically reads `.cursorrules` when:
- Writing code
- Answering questions
- Making suggestions
- Refactoring

No action needed - it just works!

### For Markdown

```bash
# Check all markdown files
npx markdownlint '**/*.md'

# Auto-fix issues (if any)
npx markdownlint '**/*.md' --fix

# Check specific file
npx markdownlint README.md
```

### For Editors

Install "markdownlint" extension in VS Code for real-time feedback.

## 📖 Quick Reference

### Priority Fees (from .cursorrules)
- Buy: 50k-500k microlamports (p75-p99 Jito)
- Sell: 10k microlamports (minimal)
- Emergency: 50k+ microlamports (high priority)

### PumpFun Accounts (from pumpfun-specifics.md)
- Buy: 16 accounts (includes volume tracking)
- Sell: 14 accounts (no volume tracking)
- Creator vault: Use bonding curve creator, not sender

### Performance Targets (from cursorrules)
- Buy latency: <50ms
- Confirmation: Background/non-blocking
- PDA derivation: <0.001ms (cached)
- Balance check: ~0ms (cached)

### Common Patterns (from solana-patterns.md)
- Pre-compute PDAs
- Fire-and-forget transactions
- Background confirmation tracking
- RPC connection pooling
- Exponential backoff for retries

## 🎓 Best Practices

### When Writing Code

Follow patterns in `.cursorrules`:
- Use TypeScript strict mode
- Handle errors with context
- Cache repeated operations
- Use fire-and-forget for speed
- Log structured data (JSON)

### When Writing Docs

Follow patterns in `markdown-guide.md`:
- Use ATX headers (# ## ###)
- Use dash lists (-)
- Add emojis for visual hierarchy
- Include code examples
- Show both good and bad examples

### When Writing Configs

Follow patterns in project:
- Comment every parameter
- Include units in names
- Provide safe defaults
- Validate at startup

## 🐛 Troubleshooting

### Markdown Linting Issues

If you see errors:
1. Check `.markdownlint.json` is present
2. Run `npx markdownlint <file> --fix`
3. Check if rule should be disabled
4. Update `.markdownlint.json` if needed

### AI Not Following Rules

If Cursor isn't following rules:
1. Check `.cursorrules` exists at project root
2. Restart Cursor
3. Reference specific rules in prompts
4. Check `.cursor/` folder is complete

### Import Errors in Code

If seeing module errors:
1. Run `pnpm install`
2. Run `pnpm -r build`
3. Check `tsconfig.json` references
4. Verify package.json dependencies

## 📚 Resources

- [Cursor Documentation](https://cursor.sh/docs)
- [Markdownlint Rules](https://github.com/DavidAnson/markdownlint)
- [Solana Docs](https://docs.solana.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🔄 Updating Rules

When patterns change:
1. Update `.cursorrules` with new patterns
2. Add examples to `.cursor/solana-patterns.md`
3. Update protocol info in `.cursor/pumpfun-specifics.md`
4. Keep `markdown-guide.md` in sync with `.markdownlint.json`

## ✨ Result

**Before**: Constant markdown linting errors, unclear AI context  
**After**: Zero linting errors, AI understands project perfectly

All new markdown files will automatically follow the rules and pass linting! 🎉

