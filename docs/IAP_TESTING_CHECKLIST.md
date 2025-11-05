# IAP Testing Checklist - FocusFlow RevenueCat Integration

## Pre-Testing Setup ✅

### Environment Configuration
- [ ] `.env` file has `EXPO_PUBLIC_ENABLE_IAP=true`
- [ ] `.env` file has valid `REVENUECAT_IOS_API_KEY=appl_xxxxx`
- [ ] `.env` file has `EXPO_PUBLIC_RC_ENTITLEMENT=premium`
- [ ] Restart Expo dev server after `.env` changes

### RevenueCat Dashboard
- [ ] Products created: `com.giress.focusflow_app.Monthly` and `Annual`
- [ ] Entitlement `premium` exists and is attached to both products
- [ ] Offering `default` exists with monthly and annual packages
- [ ] App Store Shared Secret configured in RevenueCat

### App Store Connect
- [ ] Products created with exact IDs matching RevenueCat
- [ ] Products status: "Ready to Submit"
- [ ] Sandbox tester account created
- [ ] Device signed into Sandbox account (Settings → App Store → Sandbox)

### Build Configuration
- [ ] Development client built with `npx expo run:ios --device`
- [ ] App running on **physical device** (Sandbox doesn't work on Simulator)
- [ ] No metro/build errors related to IAP

---

## Test Scenarios

### 1. Initial Load & Configuration ✅
**Goal**: Verify IAP module loads correctly

- [ ] App launches without crashes
- [ ] Check console for: `[IAP] Configured for user: <user_id>`
- [ ] Navigate to Settings → Premium section visible
- [ ] "Upgrade" button shows in Settings

**Expected Logs**:
```
[IAP] Configured for user: null  // or user ID if signed in
[IAP] isReady: true
```

**If Failed**: 
- Check `EXPO_PUBLIC_ENABLE_IAP` is `true`
- Verify dev client was rebuilt after adding dependency
- Check for errors in Metro bundler

---

### 2. Fetch Offerings ✅
**Goal**: Verify app can load subscription products from RevenueCat

**Steps**:
1. Open Premium modal from Settings
2. Wait for products to load (should show prices)

**Expected Results**:
- Monthly plan shows correct price ($5.99/month)
- Annual plan shows correct price ($49.99/year)
- Plans display "Subscribe" or "Choose" buttons
- No loading spinner stuck forever

**Expected Logs**:
```
[PremiumModal] Offerings loaded: { current: { ... } }
[PremiumModal] Monthly package: $5.99
[PremiumModal] Annual package: $49.99
```

**If Failed**:
- Wait 2-3 hours after creating products (Apple propagation)
- Check product IDs match exactly in App Store Connect and RevenueCat
- Verify offering is set as "Current" in RevenueCat dashboard
- Check internet connection

---

### 3. Purchase Monthly Plan (Sandbox) ✅
**Goal**: Complete a successful Sandbox purchase

**Steps**:
1. Ensure Sandbox account signed in (Settings → App Store)
2. Open Premium modal → Tap Monthly plan
3. iOS prompts: "Confirm your In-App Purchase"
4. **Verify prompt shows "[Sandbox]" or "[Environment: Sandbox]"**
5. Authenticate with Face ID/Touch ID
6. Wait for confirmation

**Expected Results**:
- Purchase sheet appears with product details
- Sandbox environment clearly indicated
- Purchase completes successfully
- Premium unlocks immediately (no app restart needed)
- Premium badge appears in Settings
- App limits removed (can select >5 apps, >5 reminders)

**Expected Logs**:
```
[IAP] Purchase initiated: monthly
[IAP] Purchase successful
[IAP] Customer info updated
[IAP] Has premium entitlement: true
[Settings] Premium status updated: true
```

**If Failed**:
- Check Sandbox account is signed in
- Verify product status is "Ready to Submit"
- Try different Sandbox account (each can only buy once)
- Delete app → reinstall → try again
- Check RevenueCat dashboard for error details

---

### 4. Verify Premium Features Unlocked ✅
**Goal**: Confirm entitlement grants access

**Steps**:
1. After purchase, navigate to App Selection
2. Try to select more than 5 apps
3. Navigate to Reminders
4. Try to create more than 5 reminders
5. Check Analytics export feature

**Expected Results**:
- No "Upgrade to Premium" prompts appear
- Can select unlimited apps (>5)
- Can create unlimited reminders (>5)
- Export button works in Analytics
- Premium badge visible in Settings

**If Failed**:
- Check `hasPremiumEntitlement()` logic in code
- Verify entitlement ID matches `.env` value (`premium`)
- Check RevenueCat dashboard shows entitlement as "Active"
- Try force-closing app and reopening

---

### 5. App Restart (Premium Persistence) ✅
**Goal**: Verify premium status persists across app launches

**Steps**:
1. With active subscription, force-close app
2. Reopen app
3. Check Settings for premium badge
4. Try premium features (unlimited apps/reminders)

**Expected Results**:
- Premium status loads automatically on launch
- No need to "restore purchases"
- Premium features accessible immediately

**Expected Logs**:
```
[IAP] Configured for user: <user_id>
[IAP] Customer info loaded
[IAP] Has premium entitlement: true
```

**If Failed**:
- Check `configure()` is called in App.js on mount
- Verify `getCustomerInfo()` is called on app start
- Check AsyncStorage has premium flag saved

---

### 6. Delete & Reinstall (Restore Purchases) ✅
**Goal**: Verify subscription can be restored after reinstall

**Steps**:
1. Delete FocusFlow from device
2. Reinstall from Xcode (`npx expo run:ios --device`)
3. Open app → Navigate to Settings
4. Tap "Restore Purchases"
5. Wait for restoration

**Expected Results**:
- "Restore Purchases" button exists in Settings
- After tapping, shows loading indicator
- Shows success message: "Purchases restored" or "Premium activated"
- Premium badge appears in Settings
- Premium features unlocked

**Expected Logs**:
```
[IAP] Restore purchases initiated
[IAP] Restore successful
[IAP] Has premium entitlement: true
[Settings] Premium status: true
```

**If Failed**:
- Ensure Sandbox account still signed in
- Check RevenueCat dashboard shows active subscription
- Try signing out and back into Sandbox account
- Verify `restorePurchases()` function implemented correctly

---

### 7. Purchase Annual Plan ✅
**Goal**: Verify annual subscription works

**Steps**:
1. Use a **different Sandbox account** (previous account already purchased monthly)
2. Open Premium modal
3. Tap Annual plan
4. Complete purchase

**Expected Results**:
- Annual purchase completes successfully
- Premium unlocks immediately
- RevenueCat dashboard shows annual subscription

**Note**: Sandbox accounts can only purchase each product once. Create multiple test accounts for repeated testing.

---

### 8. Customer Info Listener ✅
**Goal**: Verify entitlement changes propagate in real-time

**Steps**:
1. While app is open, go to RevenueCat dashboard
2. **Manually revoke** the entitlement for the test customer
3. Wait 5-10 seconds
4. Check app for premium status update

**Expected Results**:
- App detects revocation automatically
- Premium badge disappears from Settings
- Premium features lock again
- No app restart needed

**Expected Logs**:
```
[IAP] Customer info updated
[IAP] Has premium entitlement: false
[Settings] Premium status: false
```

**If Failed**:
- Check `onCustomerInfoUpdate()` listener is registered
- Verify listener callback updates premium state
- Check listener is removed on unmount

---

### 9. Error Handling ✅
**Goal**: Verify app handles purchase failures gracefully

**Steps**:
1. Open Premium modal
2. Start purchase
3. Cancel the purchase sheet (tap "Cancel" or swipe down)

**Expected Results**:
- No crash
- Shows error message or returns to modal
- Can retry purchase
- Premium status unchanged

**Alternative Test**: Turn on Airplane Mode → try to purchase

**Expected Results**:
- Shows "Network error" or similar message
- Doesn't crash
- Can retry when online

---

### 10. Subscription Management Link ✅
**Goal**: Verify user can manage their subscription

**Steps**:
1. After purchase, find "Manage Subscription" link in Settings
2. Tap link
3. Should open iOS Settings → Subscriptions page

**Expected Results**:
- Link exists and is accessible
- Opens to correct subscription management page
- User can see subscription details, renewal date, cancel option

**If Failed**:
- Check `Linking.openURL` to App Store subscription URL
- Verify URL format is correct for iOS 15+

---

## RevenueCat Dashboard Verification

After each successful purchase, check RevenueCat dashboard:

- [ ] Transaction appears in **Customers** tab
- [ ] Customer ID matches app user ID (or is auto-generated)
- [ ] Entitlement shows as "Active"
- [ ] Subscription shows correct:
  - Product ID
  - Price
  - Purchase date
  - Expiration date (for sandbox: usually 5 minutes)
  - Store: "App Store Sandbox"

---

## Sandbox Subscription Behaviors

**Important Sandbox Quirks**:
- Subscriptions auto-renew **5 times** then expire (tests full lifecycle quickly)
- 1 month subscription = **5 minutes** in Sandbox
- 1 year subscription = **1 hour** in Sandbox
- Renewals happen rapidly (every 5 min for monthly)
- Can't purchase same product twice with same Sandbox account
- Billing retry simulation available in Sandbox settings

---

## Production Readiness Checklist

Before submitting to App Store:

### Code Quality
- [ ] Remove all test/debug logs related to IAP
- [ ] Error handling for all purchase scenarios
- [ ] Loading states for async operations
- [ ] Proper cleanup in useEffect hooks

### User Experience
- [ ] Clear subscription terms shown before purchase
- [ ] Pricing displayed correctly (no hardcoded prices)
- [ ] "Restore Purchases" easily accessible
- [ ] "Manage Subscription" link works
- [ ] Premium features clearly explained

### Legal & Compliance
- [ ] Privacy policy mentions "Purchase History" data collection
- [ ] Terms of Service includes subscription terms
- [ ] Refund policy clearly stated
- [ ] Auto-renewal clearly disclosed

### App Store Submission
- [ ] All subscriptions "Ready to Submit" in App Store Connect
- [ ] App privacy nutrition label updated
- [ ] In-app purchase screenshots prepared
- [ ] Subscription description/benefits listed in App Store metadata

---

## Common Issues & Solutions

### "Unable to connect to iTunes Store"
- **Cause**: Not signed into Sandbox account
- **Fix**: Settings → App Store → Sandbox → Sign in with test account

### "This In-App Purchase has already been bought"
- **Cause**: Sandbox account already purchased this product
- **Fix**: Use a different Sandbox account or delete/recreate product

### Products not loading
- **Cause**: Product IDs mismatch or not synced yet
- **Fix**: Wait 2-3 hours, verify exact ID match, check offering is "Current"

### Purchase succeeds but premium doesn't unlock
- **Cause**: Entitlement not attached or wrong entitlement ID
- **Fix**: Check RevenueCat entitlement configuration, verify `.env` value

### "Cannot connect to RevenueCat"
- **Cause**: API key invalid or network issue
- **Fix**: Regenerate API key, check internet connection

---

## Success Criteria

✅ **MVP IAP is complete when**:
- [ ] Can purchase both monthly and annual plans in Sandbox
- [ ] Premium unlocks immediately after purchase
- [ ] Restore purchases works after reinstall
- [ ] Entitlement changes propagate automatically
- [ ] Error cases handled gracefully
- [ ] RevenueCat dashboard shows accurate data
- [ ] All premium features unlock correctly
- [ ] Subscription management link works

---

## Next Steps After Testing

1. ✅ Complete all checklist items
2. Document any issues found and resolutions
3. Test with multiple Sandbox accounts (edge cases)
4. Prepare for TestFlight beta (if ready)
5. Submit app for App Store review

**Parallel Work**: While waiting for app blocking entitlement approval, IAP can be fully tested and shipped independently.

---

**Last Updated**: November 1, 2025  
**Tested By**: _[Your Name]_  
**Device**: _[iPhone model, iOS version]_  
**Build**: _[Dev/TestFlight/Production]_
