# Documentation Policy

## 🚫 STOP Creating Documentation Files!

### The Problem

Too many .md files clutter the project:
- CODEBASE-REVIEW.md
- MOMENTUM-STRATEGY.md
- STRUCTURE-CHANGES.md
- IMPLEMENTATION-STATUS.md
- QUICK-START.md
- PROJECT-STRUCTURE-REVIEW.md
- GIT-SETUP.md
- SAFETY-CONFIG.md
- SESSION-SUMMARY.md

**This is excessive and needs to stop.**

## ✅ New Policy

### NEVER Create Documentation Unless:

1. **User explicitly requests it**: "Create a document about X"
2. **Initial package README**: When creating new package
3. **Updating existing docs**: Editing files that already exist

### Instead of Creating Docs:

1. **Answer in chat** - Just reply with the information
2. **Add code comments** - Document in the code itself
3. **Update README.md** - Add section to existing README
4. **Link to external docs** - Reference official docs

## 📁 Proper Documentation Structure

If docs ARE needed, use this structure:

```
project/
├── README.md              ← Main entry point only
├── CHANGELOG.md           ← Version history only
├── LICENSE                ← License only
│
├── docs/                  ← All other docs here
│   ├── user/
│   │   ├── quick-start.md
│   │   └── configuration.md
│   │
│   ├── dev/
│   │   ├── contributing.md
│   │   └── architecture.md
│   │
│   └── deployment/
│       └── production.md
│
└── packages/
    └── package-name/
        └── README.md      ← Package-specific docs
```

## 🎯 When Documentation IS Justified

### User Documentation
- **Quick start guide** (docs/user/quick-start.md)
- **Configuration reference** (docs/user/configuration.md)
- **Troubleshooting** (docs/user/troubleshooting.md)

### Developer Documentation
- **Architecture overview** (docs/dev/architecture.md)
- **Contributing guide** (docs/dev/contributing.md)
- **API reference** (docs/dev/api.md)

### Deployment Documentation
- **Production setup** (docs/deployment/production.md)
- **Monitoring** (docs/deployment/monitoring.md)

## 🚨 Examples: What NOT To Do

### ❌ Bad: Creating Review Documents
```
User: "Review the codebase"
AI: *Creates CODEBASE-REVIEW.md*
```

**Instead**: Provide review findings in chat response.

### ❌ Bad: Creating Status Documents
```
User: "What have we built?"
AI: *Creates IMPLEMENTATION-STATUS.md*
```

**Instead**: List achievements in chat, update README.md if needed.

### ❌ Bad: Creating Strategy Documents
```
User: "Explain the momentum strategy"
AI: *Creates MOMENTUM-STRATEGY.md*
```

**Instead**: Explain in chat, add to docs/user/ if persistent doc needed.

### ❌ Bad: Creating Change Logs
```
User: "What changed today?"
AI: *Creates STRUCTURE-CHANGES.md*
```

**Instead**: List changes in chat, update CHANGELOG.md if significant.

## ✅ Examples: What TO Do

### ✅ Good: Answer Inline
```
User: "How does the momentum strategy work?"
AI: [Explains in chat response with code examples]
```

### ✅ Good: Update Existing Docs
```
User: "Document the new feature"
AI: *Updates docs/user/quick-start.md with new section*
```

### ✅ Good: Add Code Comments
```
User: "Document this function"
AI: *Adds JSDoc comments to the function*
```

### ✅ Good: Ask First
```
User: "Review the architecture"
AI: "I've reviewed it. Key findings: [list]. Should I update docs/dev/architecture.md or is this chat response sufficient?"
```

## 📊 Cleanup Plan

### Consolidate Existing Docs

Move to proper structure:

```bash
# User docs
mv MOMENTUM-STRATEGY.md docs/user/momentum-strategy.md
mv SAFETY-CONFIG.md docs/user/safety-config.md

# Dev docs
mv CODEBASE-REVIEW.md docs/dev/codebase-review.md
mv SESSION-SUMMARY.md docs/dev/session-summary.md
mv IMPLEMENTATION-STATUS.md docs/dev/implementation-status.md
mv PROJECT-STRUCTURE-REVIEW.md docs/dev/structure-review.md

# Deployment docs
mv PUSH-INSTRUCTIONS.md docs/deployment/push-instructions.md
mv GIT-SETUP.md docs/deployment/git-setup.md

# Delete unnecessary
rm STRUCTURE-CHANGES.md  # Temporary, not needed
rm QUICK-START.md        # Merge into README.md
```

## 🎓 Guidelines Summary

1. **Default**: Answer in chat, don't create files
2. **Code changes**: Add inline comments
3. **Configuration**: Update config comments or README
4. **Persistent info**: Ask user if doc is needed
5. **New docs**: Use docs/ folder structure
6. **Root level**: Only README.md, CHANGELOG.md, LICENSE

## 🔒 Enforcement

Added to `.cursorrules`:
```
⚠️ CRITICAL: DO NOT CREATE DOCUMENTATION FILES
NEVER proactively create new .md files.
Only when explicitly requested by user.
```

## ✨ Benefits

- ✅ Clean root directory
- ✅ Organized documentation
- ✅ Easier to find information
- ✅ Less clutter in git
- ✅ Professional appearance
- ✅ Better maintainability

## 🤝 User Preference

The user has explicitly stated:
> "I am sick of just endless .md files you seem to create"

**Translation**: Stop creating documentation files proactively!

**Action**: Only create when explicitly asked, and ask first if unsure.

