# Production Sanitization Scripts

This directory contains scripts to help prepare the FocusFlow app for production deployment by identifying and removing debug artifacts.

## 🎯 Overview

Before deploying to production, the app needs to be sanitized to:
- Remove verbose debug logging
- Gate development-only code with `__DEV__` checks
- Verify environment variables are set correctly
- Fix debug flags (e.g., `DEBUG = true` → `DEBUG = false`)

## 📋 Available Scripts

### 1. Audit Production Readiness

**Purpose:** Scans the codebase and generates a report of issues to fix.

```bash
# Standard report
npm run audit:production

# JSON output (for CI/CD)
npm run audit:production:json
```

**What it checks:**
- ✅ Critical issues (DEBUG flags set to true)
- ✅ Ungated console.log statements
- ✅ Dev-only code not properly gated
- ✅ Environment variable usage

**Output:** Detailed report with file paths and line numbers

---

### 2. Sanitize for Production

**Purpose:** Automatically removes or gates debug artifacts.

```bash
# Dry run (preview changes without modifying files)
npm run sanitize:dry-run

# Apply changes
npm run sanitize:production

# Verbose mode (see detailed logs)
npm run sanitize:verbose
```

**What it does:**
- ❌ Removes verbose debug logs (module loaded checks, layout debug, etc.)
- 🔒 Gates useful logs with `if (__DEV__) { ... }`
- ✅ Keeps error/warn logs (for production monitoring)
- 🔧 Fixes DEBUG flags (changes `true` to `false`)

**Safety features:**
- Never modifies production logic
- Only touches console statements and debug flags
- Respects existing `__DEV__` gates
- Provides detailed before/after summary

---

## 🚀 Recommended Workflow

### Step 1: Initial Audit
```bash
npm run audit:production
```

Review the report and understand what needs fixing.

### Step 2: Preview Changes
```bash
npm run sanitize:dry-run
```

See what the script would change without actually modifying files.

### Step 3: Apply Sanitization
```bash
npm run sanitize:production
```

Apply the changes to your codebase.

### Step 4: Review Changes
```bash
git diff
```

Manually review all changes before committing.

### Step 5: Test Thoroughly
- Run the app and verify functionality
- Test on device
- Run test suite: `npm test`

### Step 6: Commit
```bash
git add -A
git commit -m "chore: sanitize codebase for production"
```

---

## 📝 Checklist

See [PRODUCTION_SANITIZATION_CHECKLIST.md](../PRODUCTION_SANITIZATION_CHECKLIST.md) for a complete checklist of items to verify before production deployment.

---

## ⚠️ Important Notes

### What's Safe to Keep

The scripts are smart enough to preserve:
- `console.error()` and `console.warn()` (production monitoring)
- Code already gated with `__DEV__`
- Production logic and functionality
- Mock data used as fallbacks

### What Gets Modified

- **Removed:** Verbose debug logs (module loaded, layout debug, etc.)
- **Gated:** Useful debugging logs wrapped in `if (__DEV__) { ... }`
- **Fixed:** `DEBUG = true` changed to `DEBUG = false`

### Manual Review Required

After running the scripts, you should manually:
1. Review all changes with `git diff`
2. Test app functionality thoroughly
3. Verify no production features broke
4. Check Settings screen dev sections are hidden
5. Confirm environment variables are correct

---

## 🔧 Customization

### Adding Patterns to Remove

Edit `scripts/sanitize-for-production.js`:

```javascript
const REMOVE_PATTERNS = [
  /your-pattern-here/,
  // ... existing patterns
];
```

### Adding Patterns to Gate

Edit `scripts/sanitize-for-production.js`:

```javascript
const GATE_PATTERNS = [
  /your-pattern-here/,
  // ... existing patterns
];
```

### Skipping Files

Edit both scripts:

```javascript
const SKIP_PATTERNS = [
  /your-pattern-here/,
  // ... existing patterns
];
```

---

## 🐛 Troubleshooting

### Script Errors

If you encounter errors:
1. Check Node.js version (requires Node 14+)
2. Verify file paths are correct
3. Check for syntax errors in patterns (regex)
4. Run with `--verbose` flag for detailed logs

### Changes Not Applied

If changes aren't being applied:
1. Verify you're not in dry-run mode
2. Check file permissions (scripts need write access)
3. Look for error messages in output

### App Broke After Sanitization

If the app stops working:
1. Revert changes: `git checkout .`
2. Review what was changed: `git diff HEAD~1`
3. Manually gate problematic logs instead of removing
4. File an issue with details

---

## 📊 Statistics

Running the sanitization on the current codebase:
- **Files scanned:** ~100 JavaScript files
- **Console logs found:** ~246 statements
- **Critical issues:** 1 (DEBUG flag)
- **Dev-only code blocks:** 17 instances

---

## 🤝 Contributing

If you find issues or want to improve the scripts:
1. Create a new branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

**Last Updated:** November 9, 2025  
**Maintainer:** FocusFlow Team
