# Production Sanitization Checklist

This checklist ensures the app is ready for production deployment without debug artifacts.

## Status: 🚧 In Progress

---

## 🚨 Critical (Must Complete Before Production)

### iPad Support Decision
- [x] **URGENT: Fix Apple rejection** - Choose one:
  - [x] Option A (Recommended): Set `"supportsTablet": false` in `app.json` → iPhone-only app
  - [ ] Option B: Fix iPad crash (requires crash log analysis + iPad testing)
- [x] Rebuild and resubmit to App Store

### Environment Variables & Secrets
- [x] Set `EXPO_PUBLIC_ENV=production` in production `.env` (handled by eas.json)
- [x] Verify `EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV=false`
- [x] Verify `EXPO_PUBLIC_ENABLE_STOREKIT_TEST=false`
- [x] Verify `EXPO_PUBLIC_ENABLE_MIGRATION_UPLOAD=false`
- [x] Set `EXPO_PUBLIC_ENABLE_IAP=true` with real RevenueCat key
- [x] Confirm `.env` is in `.gitignore` (don't commit keys)
- [x] Store secrets in EAS Secrets (EXPO_PUBLIC_OPENAI_API_KEY, EXPO_PUBLIC_REVENUECAT_IOS_API_KEY)

### Code Fixes
- [ ] Change `DEBUG = true` to `DEBUG = false` in `src/lib/storekeittest.js`
- [ ] Review and gate/remove verbose console.logs
- [ ] Test that dev-only Settings buttons don't appear (IS_DEV gate)

### Build Configuration
- [ ] Update `app.json` version number
- [ ] Verify `eas.json` production profile settings
- [ ] Confirm RevenueCat configuration

---

## ⚠️ High Priority (Recommended)

### Console Logs Cleanup
- [ ] Run audit script: `npm run audit:production`
- [ ] Review audit report findings
- [ ] Run sanitization: `npm run sanitize:dry-run` to preview changes
- [ ] Apply sanitization: `npm run sanitize:production`
- [ ] Review changes: `git diff`
- [ ] Test app functionality after changes

### Analytics Integration
- [ ] Replace console.error with Sentry/Bugsnag (optional)
- [ ] Set up production error monitoring
- [ ] Configure crash reporting

### File Cleanup
- [ ] Delete `xcode-build-*.log` files from root
- [ ] Move `.md` docs to separate `docs/` folder (optional)

---

## ℹ️ Low Priority (Nice to Have)

### Documentation
- [ ] Update README with production deployment steps
- [ ] Document environment variables
- [ ] Create production troubleshooting guide

### Code Organization
- [ ] Remove unused debug style definitions
- [ ] Clean up debug comments
- [ ] Archive old documentation files

---

## ✅ Already Safe (No Action Needed)

These items are already properly gated and won't appear in production:

- ✅ Dev Settings buttons (gated by `IS_DEV` check)
- ✅ `__DEV__` gated telemetry logs
- ✅ Mock data fallbacks (only used when native unavailable)
- ✅ Dev utility files (only imported in dev mode)
- ✅ Notification debug timestamps (gated by `__DEV__`)
- ✅ Test directories (`__tests__/`, not bundled)

---

## 📝 Testing After Sanitization

### Manual Testing Checklist
- [ ] App launches successfully
- [ ] Voice commands work
- [ ] Focus sessions start/end correctly
- [ ] Notifications deliver properly
- [ ] Reminders create/delete correctly
- [ ] Premium upgrade flow works
- [ ] IAP restore works
- [ ] Settings persist correctly

### Automated Testing
- [ ] Run test suite: `npm test`
- [ ] Verify no new errors in console
- [ ] Check app doesn't crash on startup

---

## 🔄 Scripts Available

```bash
# 1. Audit current state (safe, read-only)
npm run audit:production

# 2. Preview changes (dry-run, no modifications)
npm run sanitize:dry-run

# 3. Apply sanitization (modifies files)
npm run sanitize:production

# 4. Verbose mode (see detailed logs)
npm run sanitize:production -- --verbose
```

---

## 📤 Before Merging to Main

- [ ] Run full audit and fix all critical issues
- [ ] Review all changes with `git diff`
- [ ] Test app thoroughly on device
- [ ] Get code review approval
- [ ] Merge branch: `git checkout main && git merge feature/production-sanitization`
- [ ] Tag release: `git tag v1.0.0-production && git push --tags`

---

## 🚀 Production Deployment Steps

1. ✅ Complete all critical checklist items above
2. ✅ Build production release: `eas build --platform ios --profile production`
3. ✅ Test build on TestFlight
4. ✅ Submit to App Store Review
5. ✅ Monitor error logs after launch

---

**Last Updated:** November 9, 2025  
**Branch:** feature/production-sanitization
