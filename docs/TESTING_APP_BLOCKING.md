# Testing App Blocking with Family Controls

## Prerequisites
- ✅ Physical iPhone (iOS 16+)
- ✅ Development build installed via EAS
- ✅ Apple Developer Account with Family Controls capability enabled
- ✅ Bundle ID: `com.giress.focusflow-app`

## Installation Steps

### 1. Download and Install the Build
Once the EAS build completes, you'll get a download link.

**Option A: Direct Install**
- Open the build URL in Safari on your iPhone
- Tap "Install"
- Go to Settings → General → VPN & Device Management
- Trust the developer certificate

**Option B: TestFlight** (if uploaded)
- Install TestFlight from App Store
- Open TestFlight invite link
- Install FocusFlow

### 2. First Launch Setup
1. Open FocusFlow on your iPhone
2. Skip sign-in (use as guest)
3. Grant necessary permissions:
   - Notifications (for reminders)
   - Screen Time (Family Controls)

## Testing Checklist

### Test 1: Family Controls Authorization ✅
**Steps:**
1. Go to Settings in FocusFlow
2. Find "iOS Blocking" section
3. Tap "Request Family Controls Authorization"
4. iOS system prompt should appear asking for Screen Time permission
5. Tap "Allow"

**Expected Result:**
- ✅ System prompt appears
- ✅ Authorization granted
- ✅ No error messages

**What if it fails:**
- Check that Family Controls capability is enabled in Apple Developer Portal
- Verify bundle ID matches: `com.giress.focusflow-app`
- Check entitlements in app.json

---

### Test 2: App Selection (Native Picker) ✅
**Steps:**
1. In Settings, tap "Test App Selection"
2. Native Family Activity Picker should appear
3. Select a few apps (e.g., Instagram, TikTok, Twitter)
4. Tap "Done"

**Expected Result:**
- ✅ Native iOS picker appears
- ✅ Can search and select apps
- ✅ Selection is saved

**Current Limitation:**
- The native picker only returns app tokens, not bundle IDs
- Our current implementation may not persist selections yet

---

### Test 3: Start Focus Session with App Blocking 🎯
**Steps:**
1. Go to Home screen
2. Tap on a preset duration (15 min, 30 min, etc.)
3. Select apps to block OR tap "Block All Apps"
4. Tap "Continue" → "Start"
5. Session should begin

**Expected Result:**
- ✅ Session starts successfully
- ✅ Timer begins counting down
- ✅ Blocked apps list shows selected apps

**What to verify:**
- Does the session start without errors?
- Does the UI show the active session?

---

### Test 4: Verify App Blocking (Shield Display) 🛡️
**Steps:**
1. While session is active, press Home button
2. Try to open a blocked app (e.g., Instagram)
3. You should see a shield screen saying the app is blocked

**Expected Result:**
- ✅ Blocked app shows shield screen
- ✅ Shield message explains app is blocked during focus
- ✅ Cannot bypass the shield

**Current Limitation:**
- Shield behavior depends on `managed-settings` entitlement
- With only `family-controls`, you may see:
  - ✅ Authorization works
  - ⚠️ Shield may not appear (needs full entitlements)
  - ⚠️ Enforcement may be limited in dev builds

**Workaround:**
- Category-based blocking (social media, games) should work
- Individual app blocking may require additional setup

---

### Test 5: End Session & Clear Blocks ✅
**Steps:**
1. While session is active, tap "End Session Early"
2. Confirm you want to end
3. Try opening previously blocked apps

**Expected Result:**
- ✅ Session ends
- ✅ All blocks are cleared
- ✅ Apps are accessible again

---

## Known Limitations in Development Builds

### 1. **Device Activity Monitoring** ⚠️
- `device-activity` entitlement not included
- **Impact:** Cannot detect when user tries to open blocked apps
- **Workaround:** Manual testing only

### 2. **Managed Settings** ⚠️
- `managed-settings` may have limited functionality in dev builds
- **Impact:** Individual app blocks may not work
- **Workaround:** Use category-based blocking (social, games)

### 3. **Shield Configuration Extension** ⚠️
- Extension needs to be added to Xcode project
- **Impact:** Custom shield screens may not appear
- **Workaround:** Use default iOS shields

---

## Troubleshooting

### "Authorization Failed"
**Possible causes:**
- Family Controls capability not enabled in Developer Portal
- Bundle ID mismatch
- Provisioning profile doesn't include entitlement

**Solutions:**
1. Check Apple Developer Portal → Certificates, IDs & Profiles
2. Verify bundle ID: `com.giress.focusflow-app`
3. Regenerate provisioning profile
4. Rebuild app

---

### "App Selection Returns Empty"
**Possible causes:**
- Native picker not properly integrated
- SwiftUI view not presented correctly

**Current Status:**
- `selectApps()` method returns empty array
- TODO: Implement FamilyActivityPicker presentation

---

### "Apps Not Actually Blocked"
**Expected in dev builds:**
- Full enforcement requires production entitlements
- Some blocking features may not work in ad-hoc builds

**What works:**
- ✅ Authorization flow
- ✅ Category-based shields
- ⚠️ Individual app blocking (limited)

**What doesn't work:**
- ❌ Background monitoring
- ❌ Usage statistics
- ❌ Device Activity callbacks

---

## Next Steps After Testing

### If Authorization Works ✅
1. Move to IAP testing
2. Connect premium features to Family Controls
3. Add paywall for app blocking features

### If App Blocking Works ✅
1. Implement FamilyActivityPicker UI
2. Add Shield Configuration Extension
3. Test category vs individual app blocking
4. Add usage analytics

### If Issues Found ⚠️
1. Check Xcode console logs
2. Verify entitlements in provisioning profile
3. Try production build (TestFlight)
4. Contact Apple Developer Support if needed

---

## Production Deployment Checklist

Before submitting to App Store:
- [ ] Add Shield Configuration Extension
- [ ] Implement FamilyActivityPicker
- [ ] Request `managed-settings` entitlement
- [ ] Request `device-activity` entitlement (optional)
- [ ] Set app category to "Families" in App Store Connect
- [ ] Add usage descriptions to Info.plist
- [ ] Test on multiple iOS versions (16, 17, 18)
- [ ] Submit for App Review with explanation of Family Controls usage

---

## Resources

**Apple Documentation:**
- [Family Controls Documentation](https://developer.apple.com/documentation/familycontrols)
- [Screen Time API](https://developer.apple.com/documentation/deviceactivity)
- [Managed Settings](https://developer.apple.com/documentation/managedsettings)

**Expo Documentation:**
- [Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [Custom Native Code](https://docs.expo.dev/workflow/customizing/)

**Support:**
- Apple Developer Forums
- Expo Discord
- Stack Overflow: `[ios] [family-controls]`
