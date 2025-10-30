# RevenueCat Setup Guide

## Overview
RevenueCat handles in-app purchase subscriptions for FocusFlow. This guide covers configuration and testing.

## Products Configuration

### Products Created in RevenueCat:
- **Monthly:** `com.giress.focusflow_app.Monthly` - $5.99/month
- **Annual:** `com.giress.focusflow_app.Annual` - $49.99/year

### Entitlement:
- **Name:** `premium`
- **Unlocks:** Unlimited focus sessions, advanced analytics, custom app blocking

---

## Step 1: Configure Products in RevenueCat Dashboard

### 1.1 Access RevenueCat Dashboard
1. Go to [app.revenuecat.com](https://app.revenuecat.com)
2. Log in with your account
3. Select your project: **smart Focus flow**

### 1.2 Link App Store Connect Products
1. Go to **Products** tab
2. You should see:
   - ✅ Monthly (`com.giress.focusflow_app.Monthly`)
   - ✅ Annual (`com.giress.focusflow_app.Annual`)

3. For each product, verify:
   - **App Store Product ID** matches
   - **Duration** is set (1 month / 1 year)
   - **Price** is configured ($5.99 / $49.99)

### 1.3 Create Offering
1. Go to **Offerings** tab
2. Click **New Offering**
3. Name: `default`
4. Description: "Standard FocusFlow Premium"
5. Add packages:
   - **Monthly Package**
     - Product: `com.giress.focusflow_app.Monthly`
     - Package ID: `monthly`
   - **Annual Package**
     - Product: `com.giress.focusflow_app.Annual`
     - Package ID: `annual`
     - Mark as **default** or **recommended**
6. Save offering

---

## Step 2: App Store Connect Configuration

### 2.1 Create In-App Purchase Products
Since you already created products in RevenueCat, you need to mirror them in App Store Connect:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app (or create new app)
3. Go to **Features** → **In-App Purchases**
4. Click **+** to create new subscription group

#### Create Subscription Group
- **Name:** FocusFlow Premium
- **Reference Name:** premium_subscriptions

#### Create Monthly Subscription
1. Click **+** in subscription group
2. **Product ID:** `com.giress.focusflow_app.Monthly`
3. **Reference Name:** Monthly Subscription
4. **Duration:** 1 Month (Auto-renewable)
5. **Pricing:**
   - Select **Manual Pricing**
   - USD: $5.99
   - (Auto-fills other currencies)
6. **Localization:**
   - **Display Name:** FocusFlow Premium Monthly
   - **Description:** Unlock unlimited focus sessions and premium features
7. **Review Information:**
   - Screenshot of premium features
8. Save

#### Create Annual Subscription
1. Click **+** in subscription group
2. **Product ID:** `com.giress.focusflow_app.Annual`
3. **Reference Name:** Annual Subscription
4. **Duration:** 1 Year (Auto-renewable)
5. **Pricing:**
   - Select **Manual Pricing**
   - USD: $49.99
   - (Auto-fills other currencies)
6. **Localization:**
   - **Display Name:** FocusFlow Premium Annual
   - **Description:** Get 2 months free with annual subscription
7. **Review Information:**
   - Screenshot of premium features
8. Save

### 2.2 Submit for Review
- After creating products, they need App Review approval
- Status will be "Waiting for Review" until approved
- **Note:** You can test in sandbox mode before approval

---

## Step 3: RevenueCat API Key Configuration

### 3.1 Verify API Key in .env
Your `.env` file should already have:
```bash
REVENUECAT_IOS_API_KEY=appl_XmIgKuJfHfXYxUzrmpMLcBOBjrq
EXPO_PUBLIC_RC_ENTITLEMENT=premium
EXPO_PUBLIC_ENABLE_IAP=true
```

✅ This is already configured!

### 3.2 API Key Permissions
In RevenueCat dashboard:
1. Go to **Settings** → **API Keys**
2. Verify `appl_XmIgKuJfHfXYxUzrmpMLcBOBjrq` has:
   - ✅ Read access
   - ✅ Write access (for testing)

---

## Step 4: Testing In-App Purchases (Sandbox)

### 4.1 Create Sandbox Test Account
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access** → **Sandbox Testers**
3. Click **+** to add tester
4. Fill in:
   - **Email:** Use a unique email (not your main Apple ID)
   - **Password:** Create strong password
   - **First Name / Last Name**
   - **Country:** United States (or your region)
5. Save

### 4.2 Configure iPhone for Sandbox Testing
1. Open **Settings** on your iPhone
2. Go to **App Store**
3. Scroll down to **Sandbox Account**
4. Sign in with your sandbox test account email

**Important:**
- Use sandbox account ONLY for testing
- Don't use your real Apple ID
- Purchases won't be charged

### 4.3 Test Purchase Flow
1. Open FocusFlow dev build
2. Navigate to Premium screen (or trigger paywall)
3. Tap on Monthly or Annual subscription
4. iOS purchase dialog appears
5. Authenticate with Face ID / Touch ID
6. Confirm purchase

**Expected Result:**
- ✅ Purchase succeeds
- ✅ RevenueCat confirms subscription
- ✅ Premium features unlock
- ✅ No actual charge (sandbox mode)

### 4.4 Verify in RevenueCat Dashboard
1. Go to RevenueCat Dashboard
2. Navigate to **Customers**
3. Search for your test user (by App User ID)
4. Verify:
   - ✅ Active subscription shown
   - ✅ Entitlement: `premium`
   - ✅ Product ID matches
   - ✅ Expiration date set

---

## Step 5: Integration Implementation

### 5.1 Install Dependencies
```bash
pnpm add react-native-purchases
```

✅ Already installed in your `package.json`!

### 5.2 Initialize RevenueCat
Update `App.js` to initialize RevenueCat on app start:

```javascript
import Purchases from 'react-native-purchases';

useEffect(() => {
  const initializeRevenueCat = async () => {
    if (Platform.OS === 'ios') {
      const apiKey = process.env.REVENUECAT_IOS_API_KEY;
      if (apiKey) {
        Purchases.configure({ apiKey });
      }
    }
  };
  initializeRevenueCat();
}, []);
```

### 5.3 Create Premium Context
Create `src/context/PremiumContext.js` to manage premium state globally.

### 5.4 Implement Paywall Screen
Create `src/screens/PremiumScreen.js` with:
- Product offerings display
- Purchase buttons
- Restore purchases
- Loading states

---

## Step 6: Premium Features Gating

### Current Free Limits:
- 3 apps per session
- 5 sessions per day
- 5 reminders total

### Premium Unlocks:
- ✅ Unlimited apps per session
- ✅ Unlimited sessions per day
- ✅ Unlimited reminders
- ✅ Advanced analytics
- ✅ Custom blocking schedules

### Implementation:
Check premium status before allowing actions:
```javascript
const { isPremium } = usePremium();

if (selectedApps.length > 3 && !isPremium) {
  showPremiumUpgradePrompt();
  return;
}
```

---

## Troubleshooting

### Issue: "No products available"
**Causes:**
- Products not created in App Store Connect
- Products not approved yet
- Bundle ID mismatch

**Solutions:**
1. Check App Store Connect → In-App Purchases
2. Verify product IDs match exactly
3. Wait for product approval (can take 24-48 hours)
4. Verify bundle ID: `com.giress.focusflow-app`

---

### Issue: "Purchase fails with unknown error"
**Causes:**
- Not logged into sandbox account
- Invalid product configuration
- StoreKit issues

**Solutions:**
1. Sign out of regular App Store account
2. Sign in with sandbox test account
3. Delete and reinstall app
4. Check RevenueCat logs in dashboard

---

### Issue: "Entitlement not unlocking"
**Causes:**
- Entitlement ID mismatch
- RevenueCat not properly initialized
- User ID not set

**Solutions:**
1. Verify entitlement ID: `premium`
2. Check RevenueCat initialization in App.js
3. Set user ID with `Purchases.setAppUserID(userId)`
4. Check customer info in RevenueCat dashboard

---

## Production Checklist

Before launching:
- [ ] Products approved in App Store Connect
- [ ] Subscription pricing finalized
- [ ] Localization for all markets
- [ ] Privacy policy updated (mentions subscriptions)
- [ ] Terms of service includes subscription terms
- [ ] Restore purchases button functional
- [ ] Subscription management link added
- [ ] Tested in multiple currencies
- [ ] Tested renewal flow
- [ ] Tested cancellation flow
- [ ] Analytics tracking purchases
- [ ] App Review screenshots show IAP

---

## Resources

- [RevenueCat Documentation](https://www.revenuecat.com/docs/)
- [iOS Subscription Best Practices](https://developer.apple.com/app-store/subscriptions/)
- [StoreKit 2 Guide](https://developer.apple.com/storekit/)
- [RevenueCat SDK Reference](https://sdk.revenuecat.com/ios/index.html)

---

## Support

**RevenueCat Support:**
- Dashboard: Live chat support
- Email: support@revenuecat.com
- Slack: RevenueCat Community

**Apple Support:**
- App Store Connect Help
- Developer Forums
- Technical Support Incidents (2 per year free)
