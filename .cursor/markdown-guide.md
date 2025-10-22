# Markdown Style Guide for GitSniper

This guide ensures all markdown files pass linting and maintain consistency.

## Configuration

Project uses `.markdownlint.json` with rules optimized for technical documentation.

## Disabled Rules (For Flexibility)

These rules are **disabled** to allow natural writing:

- **MD010**: Allows tabs (mixed spaces/tabs OK)
- **MD012**: Allows multiple consecutive blank lines
- **MD013**: No line length limits (120 char guideline, not enforced)
- **MD022**: Headings don't need blank lines around them
- **MD031**: Code blocks don't need blank lines around them
- **MD032**: Lists don't need blank lines around them
- **MD033**: Allows inline HTML (`<br>`, `<details>`, etc.)
- **MD034**: Allows bare URLs (no need to wrap in `<>`)
- **MD036**: Allows emphasis as headers
- **MD040**: Code blocks don't require language tags
- **MD041**: First line doesn't have to be top-level header

## Enforced Rules (For Consistency)

### Headers (MD003)
✅ **Use ATX-style** headers with `#`:

```markdown
# Top Level
## Second Level
### Third Level
```

❌ **Don't use setext-style** with underlines:

```markdown
Top Level
=========

Second Level
------------
```

### Lists (MD004, MD029)

✅ **Use dashes** for unordered lists:

```markdown
- Item 1
- Item 2
  - Nested item
```

✅ **Restart numbering** after headings:

```markdown
### Step 1

1. First action
2. Second action

### Step 2

1. First action  ← Restart at 1
2. Second action
```

❌ **Don't continue numbering** across sections:

```markdown
### Step 1

1. First action
2. Second action

### Step 2

3. First action  ← Wrong! Should be 1
4. Second action
```

### Code Blocks (MD046)

✅ **Use fenced code blocks** with backticks:

````markdown
```typescript
const example = "code here";
```
````

✅ Language tags are **optional** but recommended:

````markdown
```
Generic code block (no language)
```

```typescript
TypeScript code block (with language)
```
````

### Text Formatting

✅ **Use underscores** for emphasis (MD049):

```markdown
_italic text_
__bold text__
```

✅ **Use asterisks** for strong emphasis (MD050):

```markdown
*single asterisk*
**double asterisk**
```

## Best Practices (Not Enforced)

### Structure

```markdown
# Document Title

Brief introduction paragraph.

## Main Section

Content here.

### Subsection

More specific content.

#### Details

Fine-grained details.
```

### Code Examples

Include context and explanations:

````markdown
Build a transaction:

```typescript
const transaction = new Transaction();
transaction.add(instruction);
```

This creates a new transaction and adds an instruction.
````

### Tables

Use consistent spacing:

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |
```

### Links

Both styles are allowed:

```markdown
[Named link](https://example.com)
https://example.com  (bare URL - OK)
<https://example.com>  (angle brackets - also OK)
```

### Inline HTML

Allowed for special formatting:

```markdown
<details>
<summary>Click to expand</summary>

Hidden content here.

</details>

<br>  <!-- Line break -->

<kbd>Ctrl</kbd> + <kbd>C</kbd>  <!-- Keyboard shortcuts -->
```

## Project-Specific Patterns

### Status Badges

```markdown
**Status**: ✅ Complete  
**Priority**: 🔴 High  
**Type**: 🎯 Feature  
```

### Code vs Output

````markdown
### Command

```bash
npm install
```

### Output

```text
> Installing packages...
Done in 5.2s
```
````

### Warnings and Notes

```markdown
⚠️ **Warning**: This is important!

✅ **Note**: This is helpful information.

🔴 **Critical**: This is critical!
```

### File Paths

Use inline code for paths:

```markdown
Edit the `config/default.toml` file.
Check `packages/transactions/src/pumpfun/builders.ts`.
```

### Multiple Related Code Blocks

````markdown
**Before**:

```typescript
// Old code
```

**After**:

```typescript
// New code
```
````

## Quick Reference

### Common Emojis

- ✅ Success / Check / Done
- ❌ Error / Wrong / Bad
- ⚠️ Warning / Caution
- 🔴 Critical / High priority
- 🟡 Medium priority
- 🟢 Low priority
- 🎯 Goal / Target
- 🚀 Launch / Deploy
- 📊 Stats / Metrics
- 💰 Money / Finance
- 🔧 Configuration / Settings
- 📚 Documentation
- 🐛 Bug
- 🎉 Celebration / Complete

### Section Templates

**Feature Documentation**:

```markdown
# Feature Name

**Status**: ✅ Implemented  
**Date**: 2025-10-22

## Overview

Brief description.

## Usage

```bash
command here
```

## Configuration

```toml
[section]
key = value
```

## Examples

See above.
```

**Troubleshooting Section**:

```markdown
## Troubleshooting

### Issue Name

**Problem**: Description of the problem.

**Solution**: How to fix it.

**Prevention**: How to avoid it.
```

**API Reference**:

```markdown
### `functionName(param1, param2)`

Description of function.

**Parameters**:
- `param1` (Type) - Description
- `param2` (Type) - Description

**Returns**: Description of return value

**Example**:

```typescript
const result = functionName(arg1, arg2);
```
```

## Validation

### Check All Files

```bash
# Install markdownlint globally
npm install -g markdownlint-cli

# Lint all markdown files
npx markdownlint '**/*.md' --ignore node_modules --ignore dist

# Auto-fix issues
npx markdownlint '**/*.md' --ignore node_modules --ignore dist --fix
```

### Check Specific File

```bash
npx markdownlint path/to/file.md
```

### VS Code Extension

Install "markdownlint" extension by David Anson for real-time linting.

## Summary

With current configuration:
- ✅ Flexible formatting (blank lines, line length)
- ✅ Allows inline HTML
- ✅ Allows bare URLs
- ✅ Optional language tags
- ✅ Natural writing style
- ⚠️ Enforces ATX headers only
- ⚠️ Enforces list numbering restart

This balances consistency with flexibility for technical documentation.

