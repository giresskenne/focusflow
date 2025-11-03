# IAP Issue Resolution

## Problems Identified

### 1. **Dev Fallback Granting Free Premium** ❌
**Location**: `SettingsScreen.js` lines 717-721

**Issue**: When neither RevenueCat (`IAP.isReady()`) nor StoreKitTest was available, the code had a fallback that just set `isPremium = true` **without any actual purchase or payment**.

```javascript
// Old code (BAD):
} else {
  // Dev fallback
  await setPremiumStatus(true);
  setIsPremium(true);
}
```

This is why clicking "Upgrade" immediately granted premium without asking for payment or sign-in.

**Fix**: Removed the dev fallback and replaced it with a proper error message telling users to rebuild the app with IAP enabled.

---

### 2. **No Authentication Required** ❌
**Issue**: Users could "purchase" premium (via the dev fallback) without being signed in, meaning:
- No account linked to the purchase
- No way to restore purchases on other devices
- No RevenueCat customer tracking

**Fix**: Added authentication check before allowing purchases:
```javascript
if (!authUser) {
  Alert.alert('Sign In Required', 'Please sign in to purchase Premium...');
  return;
}
```

---

### 3. **Native IAP Module Not Loaded** ❌
**Root Cause**: Your `.env` has `EXPO_PUBLIC_ENABLE_IAP=true` and your RevenueCat API key is set, BUT the native module (`react-native-purchases`) is not included in your development build.

**Evidence**: 
- Alert shows "In-app purchases are not enabled in this build"
- `IAP.isReady()` returns `false`
- The native module requires a rebuild to include

**Why**: In Expo, adding a native dependency (like `react-native-purchases`) requires rebuilding the development client with `expo prebuild` and `expo run:ios`.

---

## Changes Made

### ✅ SettingsScreen.js
**Before**:
- Dev fallback granted premium for free
- No authentication check
- Silent failure

**After**:
- Removed dev fallback
- Requires sign-in before purchase
- Shows proper error with rebuild instructions
- Success alert on successful purchase

### ✅ SignInScreen.js
- Added `IAP.configure(user.id)` after successful sign-in
- Links RevenueCat purchases to user account

### ✅ SignUpScreen.js
- Added `IAP.configure(user.id)` after successful sign-up
- Links RevenueCat purchases to user account

---

## How to Fix & Test

### Step 1: Rebuild Development Client
The native IAP module needs to be included in your build:

```bash
# Clean prebuild
npx expo prebuild --clean

# Rebuild and run on physical device (Sandbox IAP doesn't work in Simulator)
npx expo run:ios --device
```

⚠️ **Important**: You MUST use a physical device. IAP (including Sandbox) does not work in iOS Simulator.

---

### Step 2: Create Apple Sandbox Tester
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access** → **Sandbox Testers**
3. Click **+** to add a new tester
4. Create a test account (use a valid email format, doesn't need to be real)
5. On your physical device:
   - Go to **Settings** → **App Store** → **Sandbox Account**
   - Sign in with your Sandbox tester credentials

---

### Step 3: Test Purchase Flow
1. **Sign In** to the app (REQUIRED now)
2. Go to **Settings** → tap **Upgrade**
3. Select a plan (Annual or Monthly)
4. Tap **Start Annual** or **Start Monthly**
5. iOS will show the Sandbox purchase dialog
6. Complete the purchase with your Sandbox account
7. Verify premium status activates

**Expected Result**: 
- Purchase dialog shows with test pricing
- After confirmation, premium activates
- "Success!" alert appears
- You can access unlimited apps/reminders

---

### Step 4: Test Restore Purchases
1. Delete the app from your device
2. Reinstall and sign in with the same account
3. Go to **Settings** → **Restore Purchases**
4. Verify premium status is restored

**Expected Result**:
- "Purchases restored" alert
- Premium status reactivates

---

## What Was Wrong

| Issue | Why It Happened | Fix |
|-------|----------------|-----|
| **Free premium** | Dev fallback code always granted premium | Removed fallback, show error instead |
| **No sign-in required** | Purchase logic didn't check `authUser` | Added auth check before purchase |
| **"Not available" error** | Native IAP module not in dev client | Rebuild with `expo prebuild` + `expo run:ios` |
| **No account linking** | RevenueCat not configured on sign-in | Added `IAP.configure(userID)` in auth flows |

---

## Verification Checklist

After rebuilding:

- [ ] `IAP.isReady()` returns `true` (check console logs)
- [ ] "Upgrade" button requires sign-in (shows alert if not signed in)
- [ ] Tapping plan shows iOS Sandbox purchase dialog (not instant premium)
- [ ] Completing purchase activates premium (check unlimited apps)
- [ ] "Restore Purchases" works after reinstall
- [ ] RevenueCat dashboard shows the test transaction

---

## Console Logs to Look For

**Success indicators**:
```
[SignIn] RevenueCat configured with user ID: abc123...
[IAP] isReady: true
[IAP] Offerings loaded: { current: ... }
[IAP] Purchase initiated for package: monthly
[IAP] Purchase successful, entitlement active: true
```

**Failure indicators**:
```
[IAP] isReady: false
[IAP] react-native-purchases not loaded
```

---

## RevenueCat Dashboard Verification

After a test purchase:
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Click **Customers** → search for your test user ID
3. Verify:
   - Customer exists with correct app user ID
   - Active subscription shows
   - Entitlement "premium" is active
   - Transaction details match your test purchase

---

## Production Checklist

Before shipping to TestFlight/App Store:

- [ ] Remove or disable any dev testing flags
- [ ] Verify `.env` has correct production RevenueCat keys
- [ ] Test full purchase flow with Sandbox account
- [ ] Test restore purchases flow
- [ ] Verify entitlement gates work (unlimited apps, reminders, analytics)
- [ ] Test cancellation flow (cancel subscription, verify premium expires)
- [ ] Configure App Store pricing to match RevenueCat products
- [ ] Test with multiple users to verify account isolation

---

## Key Takeaways

1. **Never grant premium for free in production code** - even as a "dev fallback"
2. **Always require authentication for purchases** - to link to user account
3. **Native modules need rebuilds** - adding `react-native-purchases` requires `expo prebuild`
4. **Configure RevenueCat with user ID** - ensures purchases are tied to accounts, not just devices
5. **Test on physical devices** - IAP doesn't work in Simulator

---

## Next Steps

1. Run the rebuild command: `npx expo prebuild --clean && npx expo run:ios --device`
2. Create a Sandbox tester in App Store Connect
3. Sign in to the app with a test account
4. Test purchasing monthly/annual plans
5. Verify premium features unlock
6. Test restore purchases after reinstall
7. Check RevenueCat dashboard for transactions

If you see "Not available - In-app purchases are not enabled in this build" after rebuilding, ensure:
- `package.json` has `react-native-purchases: ^9.6.1`
- `.env` has `EXPO_PUBLIC_ENABLE_IAP=true`
- You're testing on a **physical device** (not Simulator)
- You ran `npx expo prebuild --clean` before `npx expo run:ios`
