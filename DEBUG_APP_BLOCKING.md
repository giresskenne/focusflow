# App Blocking Debug Guide

## Step-by-Step Testing for New Dev Client (Build #16)

### 1. Verify Native Module is Available

**What to test:**
- Open Settings → App Blocking (iOS Dev)
- Should show "Request Authorization" and "Select Apps to Block" (NOT "Not available")

**Expected Result:** ✅ Options visible (no "Native module missing" message)
**If still shows "Not available":** You're using the OLD dev client, install the new one

---

### 2. Test Family Controls Authorization

**What to test:**
- Settings → App Blocking (iOS Dev) → "Request Authorization"
- Should show iOS system dialog asking for Screen Time permissions

**Expected Result:** ✅ Native iOS permission dialog appears
**If no dialog:** Family Controls entitlement may not be working
**If error:** Check console logs for authorization failure details

---

### 3. Test App Selection and Session Start

**What to test:**
- Start Focus → Select Apps to Block
- Search for "WhatsApp" or "Zoom" (should find them now)
- Select an app and start a 15-minute session

**Expected Result:** ✅ Apps found in search, session starts normally
**If apps not found:** Enhanced app list not working
**If session fails:** Check console for blocking start errors

---

### 4. Test Actual App Blocking

**What to test:**
- During an active session, try to open a blocked app (WhatsApp, etc.)
- Should see a shield/blocking screen, not the actual app

**Expected Result:** ✅ Shield appears blocking app access
**If app opens normally:** Blocking isn't enforced (most likely issue)
**If different behavior:** Note exactly what happens

---

### 5. Check Console Logs

**What to look for:**
- Open React Native debugger or Metro logs
- Look for AppBlocker-related messages:
  - "AppBlocker authorization requested"
  - "Starting blocking for apps: [...]"
  - Any error messages from native module

---

## Common Issues and Solutions

### Issue: "Not available" still shows
**Solution:** Install new dev client build #16 from: https://expo.dev/accounts/kenn69/projects/focusflow-app/builds/a592086a-0c6e-47de-9175-ceafe8a3db9d

### Issue: Authorization works but no blocking
**Likely cause:** Family Controls shields require additional iOS configuration
**Next step:** May need Device Activity entitlement or production TestFlight build

### Issue: Apps not found in search
**Solution:** Search is working for WhatsApp, Zoom, YouTube, Netflix (added to enhanced list)

### Issue: Native module loads but blocking fails
**Debug:** Check if ManagedSettingsStore.shield calls are working in Swift code

---

## Quick Test Results Template

```
✅/❌ Native module available (not "Not available"): 
✅/❌ Family Controls authorization dialog appears: 
✅/❌ Can find and select apps (WhatsApp, Zoom): 
✅/❌ Session starts without errors: 
✅/❌ Shield blocks access to selected apps: 
✅/❌ Console shows AppBlocker logs: 

Notes: 
```

Fill this out and share the results so I can identify exactly what's not working and fix it.