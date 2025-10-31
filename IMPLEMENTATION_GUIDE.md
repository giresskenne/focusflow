# Implementation Guide: iOS App Blocking for FocusFlow
## Using react-native-device-activity Library

**Date:** October 29, 2025  
**For:** Senior Developer  
**Status:** ACTION REQUIRED

---

## Executive Summary

**Problem:** Our current app blocking implementation doesn't enforce blocking at the OS level. Blocks only work while the app is in memory and disappear when the app is killed.

**Root Cause:** iOS Family Controls API requires a complex architecture with 4 separate targets (main app + 3 extensions) working together via DeviceActivity framework. Our current implementation only has the main app target.

**Solution:** Integrate the `react-native-device-activity` library which provides a battle-tested implementation of all required extensions and handles the DeviceActivity scheduling complexity.

**Timeline:** 
- Development: 1-2 weeks
- Entitlement Approvals: 6-12 weeks (Apple's process for 3 additional bundle IDs)
- Total: ~2-3 months until production-ready

---

## Why We Must Use react-native-device-activity

### Technical Requirements We Cannot Avoid

iOS requires **4 separate app targets** for persistent app blocking:

1. **Main App** - User interface and session management
2. **ShieldConfiguration Extension** - Defines blocking screen appearance
3. **ShieldAction Extension** - Handles emergency override button
4. **DeviceActivity Monitor Extension** - Applies/removes blocks in background

**We've been struggling because building these extensions manually is extremely complex:**
- Requires deep Xcode project configuration knowledge
- Extensions must communicate via App Groups
- DeviceActivity scheduling uses non-intuitive 24-hour DateComponents
- Many undocumented edge cases and Apple bugs
- Each extension needs separate entitlement approval

### Why the Library is the Right Choice

`react-native-device-activity` is a production-tested library that:
- ✅ Already implements all 4 targets correctly
- ✅ Handles App Groups, entitlements, and build configuration automatically
- ✅ Used by real apps in production (battle-tested)
- ✅ Actively maintained with good documentation
- ✅ Saves 2-3 weeks of development time debugging Xcode issues
- ✅ Provides TypeScript definitions and clean API
- ✅ Handles known Apple bugs and workarounds

**Building this manually would take 3-4 weeks and we'd likely encounter the same issues the library authors already solved.**

---

## Current State Analysis

### What We Have ✅
- Expo managed workflow with prebuild capability
- Native module scaffold at `ios/` from prebuild
- Family Controls **Development** entitlement (approved for main app)
- RevenueCat integration for premium features
- Supabase sync for user data
- UI for selecting apps and starting sessions

### What's Missing ❌
- ❌ DeviceActivity scheduling (blocks don't persist)
- ❌ Shield Configuration Extension (can't customize blocking screen)
- ❌ Shield Action Extension (can't handle emergency override)
- ❌ Device Activity Monitor Extension (can't run in background)
- ❌ App Groups for inter-process communication
- ❌ Family Controls entitlements for 3 additional bundle IDs

---

## Implementation Plan

### Phase 1: Library Integration (Week 1)

#### Step 1: Install Dependencies

```bash
cd focusflow-app
pnpm add react-native-device-activity
```

#### Step 2: Update app.json Configuration

```json
{
  "expo": {
    "name": "FocusFlow",
    "slug": "focusflow",
    "ios": {
      "bundleIdentifier": "com.giress.focusflow-app",
      "deploymentTarget": "16.0",
      "supportsTablet": true
    },
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "16.0"
          }
        }
      ],
      [
        "react-native-device-activity",
        {
          "appleTeamId": "ZTB4YDKG8V",
          "appGroup": "group.com.giress.focusflow",
          "modes": ["suppressShield"]
        }
      ]
    ]
  }
}
```

**Configuration Notes:**
- `appleTeamId`: Your Apple Developer Team ID (already in your account)
- `appGroup`: Must match across all 4 targets (we'll register this in Apple Developer portal)
- `suppressShield`: Allows us to customize the blocking screen UI

#### Step 3: Register App Group in Apple Developer Portal

1. Go to https://developer.apple.com/account/resources/identifiers
2. Click **+** to create new identifier
3. Select **App Groups** → Continue
4. Description: `FocusFlow App Group`
5. Identifier: `group.com.giress.focusflow`
6. Register

Then add this App Group to your main App ID:
1. Find `com.giress.focusflow-app` in Identifiers
2. Edit → App Groups → Enable → Select `group.com.giress.focusflow`
3. Save

#### Step 4: Clean Prebuild and Reinstall

```bash
# Remove existing iOS folder
rm -rf ios/

# Clean prebuild with new configuration
npx expo prebuild --clean

# Install pods
cd ios && pod install && cd ..
```

This will generate 4 Xcode targets:
- `focusflowapp` (main app)
- `focusflowappShieldConfiguration`
- `focusflowappShieldAction`
- `focusflowappActivityMonitor`

#### Step 5: Verify Xcode Project

```bash
open ios/focusflowapp.xcworkspace
```

In Xcode, verify all 4 targets exist:
1. Click on project root in navigator
2. Under "TARGETS" you should see all 4 targets
3. For each extension target, verify:
   - Deployment Target: 16.0
   - App Groups enabled with `group.com.giress.focusflow`
   - Signing configured with your team

---

### Phase 2: Code Implementation (Week 1)

#### Step 1: Create App Blocking Service

Create `focusflow-app/services/AppBlockingService.ts`:

```typescript
import {
  startMonitoring,
  stopMonitoring,
  requestAuthorization,
  AuthorizationStatus,
  getAuthorizationStatus,
} from 'react-native-device-activity';
import { Platform } from 'react-native';

export interface BlockingSession {
  id: string;
  apps: string[]; // bundle identifiers
  durationMinutes: number;
  startTime: Date;
  endTime: Date;
}

class AppBlockingService {
  private currentSession: BlockingSession | null = null;

  /**
   * Request Family Controls authorization from user
   */
  async requestAuthorization(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.warn('App blocking only available on iOS');
      return false;
    }

    try {
      const status = await requestAuthorization();
      return status === AuthorizationStatus.approved;
    } catch (error) {
      console.error('Authorization failed:', error);
      return false;
    }
  }

  /**
   * Check current authorization status
   */
  async checkAuthorizationStatus(): Promise<AuthorizationStatus> {
    if (Platform.OS !== 'ios') {
      return AuthorizationStatus.notDetermined;
    }

    try {
      return await getAuthorizationStatus();
    } catch (error) {
      console.error('Failed to get auth status:', error);
      return AuthorizationStatus.notDetermined;
    }
  }

  /**
   * Start blocking session with selected apps
   */
  async startSession(
    apps: string[],
    durationMinutes: number
  ): Promise<{ success: boolean; error?: string }> {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'iOS only feature' };
    }

    // Verify authorization
    const status = await this.checkAuthorizationStatus();
    if (status !== AuthorizationStatus.approved) {
      return { success: false, error: 'Not authorized' };
    }

    try {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      // Create DeviceActivity schedule
      // Note: DeviceActivity uses 24-hour DateComponents, not absolute dates
      const now = startTime;
      const end = endTime;

      const schedule = {
        intervalStart: {
          hour: now.getHours(),
          minute: now.getMinutes(),
          second: now.getSeconds(),
        },
        intervalEnd: {
          hour: end.getHours(),
          minute: end.getMinutes(),
          second: end.getSeconds(),
        },
        repeats: false,
        warningTime: null,
      };

      // Start monitoring with device activity
      await startMonitoring({
        schedule,
        deviceActivityName: 'focusSession',
        includesPastActivity: false,
        // Convert bundle IDs to application tokens
        applications: apps.map(bundleId => ({
          bundleIdentifier: bundleId,
          token: bundleId, // Library handles token generation internally
        })),
      });

      // Store session info
      this.currentSession = {
        id: `session_${Date.now()}`,
        apps,
        durationMinutes,
        startTime,
        endTime,
      };

      console.log('✅ Blocking session started:', this.currentSession);
      return { success: true };
    } catch (error) {
      console.error('Failed to start blocking session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * End current blocking session early (Emergency Override)
   */
  async endSession(): Promise<{ success: boolean; error?: string }> {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'iOS only feature' };
    }

    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      await stopMonitoring('focusSession');
      
      console.log('✅ Blocking session ended');
      this.currentSession = null;
      
      return { success: true };
    } catch (error) {
      console.error('Failed to end session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current active session
   */
  getCurrentSession(): BlockingSession | null {
    return this.currentSession;
  }

  /**
   * Check if there's an active session
   */
  hasActiveSession(): boolean {
    if (!this.currentSession) return false;
    
    // Check if session has expired
    const now = new Date();
    if (now >= this.currentSession.endTime) {
      this.currentSession = null;
      return false;
    }
    
    return true;
  }
}

// Export singleton instance
export const appBlockingService = new AppBlockingService();
```

#### Step 2: Update FocusSession Screen

Update `focusflow-app/screens/FocusSession.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { appBlockingService } from '../services/AppBlockingService';
import { AuthorizationStatus } from 'react-native-device-activity';

export default function FocusSessionScreen() {
  const [authStatus, setAuthStatus] = useState<AuthorizationStatus>(
    AuthorizationStatus.notDetermined
  );
  const [isBlocking, setIsBlocking] = useState(false);

  useEffect(() => {
    checkAuthorization();
  }, []);

  const checkAuthorization = async () => {
    const status = await appBlockingService.checkAuthorizationStatus();
    setAuthStatus(status);
  };

  const handleRequestAuthorization = async () => {
    const granted = await appBlockingService.requestAuthorization();
    if (granted) {
      Alert.alert('Success', 'Family Controls authorized!');
      await checkAuthorization();
    } else {
      Alert.alert('Error', 'Authorization denied or failed');
    }
  };

  const handleStartSession = async () => {
    // Example: Block Instagram, Facebook, TikTok for 30 minutes
    const apps = [
      'com.burbn.instagram',
      'com.facebook.Facebook',
      'com.zhiliaoapp.musically', // TikTok
    ];

    const result = await appBlockingService.startSession(apps, 30);

    if (result.success) {
      setIsBlocking(true);
      Alert.alert('Session Started', 'Selected apps are now blocked!');
    } else {
      Alert.alert('Error', result.error || 'Failed to start session');
    }
  };

  const handleEndSession = async () => {
    Alert.alert(
      'Emergency Override',
      'Are you sure? This will break your streak!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            const result = await appBlockingService.endSession();
            if (result.success) {
              setIsBlocking(false);
              // TODO: Log emergency override event to analytics
              // TODO: Break streak in user's profile
            }
          },
        },
      ]
    );
  };

  if (authStatus !== AuthorizationStatus.approved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, marginBottom: 20, textAlign: 'center' }}>
          FocusFlow needs permission to block apps on your device.
        </Text>
        <Button
          title="Grant Permission"
          onPress={handleRequestAuthorization}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20, textAlign: 'center' }}>
        Focus Session
      </Text>

      {!isBlocking ? (
        <Button title="Start 30-Min Session" onPress={handleStartSession} />
      ) : (
        <>
          <Text style={{ textAlign: 'center', marginBottom: 20 }}>
            ✅ Session Active - Apps are blocked
          </Text>
          <Button
            title="Emergency Override"
            onPress={handleEndSession}
            color="red"
          />
        </>
      )}
    </View>
  );
}
```

#### Step 3: Test on Physical Device

**CRITICAL: Family Controls ONLY works on physical devices, not simulator**

```bash
# Build and run on connected iPhone
npx expo run:ios --device
```

**Test Flow:**
1. Open app → Grant Family Controls permission
2. Tap "Start 30-Min Session"
3. Background/kill the FocusFlow app
4. Try to open Instagram → Should see blocking shield
5. Tap shield buttons to test emergency override

---

### Phase 3: Request Additional Entitlements (Week 1-2)

You need to request Family Controls entitlement for **3 additional bundle IDs** that the library creates:

#### Bundle IDs to Request:

1. `com.giress.focusflow-app.ShieldConfiguration`
2. `com.giress.focusflow-app.ShieldAction`
3. `com.giress.focusflow-app.ActivityMonitor`

#### How to Request:

Go to https://developer.apple.com/contact/request/family-controls-distribution

**For EACH bundle ID, fill out the form:**

**App Information:**
- App Name: `FocusFlow Shield Configuration` (or ShieldAction, or ActivityMonitor)
- App Store URL: (leave blank - same app, different target)
- App Apple ID: (same as main app)
- Bundle ID: `com.giress.focusflow-app.ShieldConfiguration` (update for each)

**Which best describes your app's users?**
```
Individuals using the app on their own
```

**Select the category that best describes your app:**
```
Focus-type controls
```

**Detailed Explanation:**
```
This is an App Extension target that is part of the FocusFlow app 
(com.giress.focusflow-app), which was already approved for Family Controls.

FocusFlow is a focus and productivity app that helps individuals overcome 
smartphone addiction through technically unbreakable app blocking.

Apple's DeviceActivity framework architecturally requires 4 separate targets:
1. Main app (already approved)
2. ShieldConfiguration Extension (this request)
3. ShieldAction Extension (separate request)
4. ActivityMonitor Extension (separate request)

THIS EXTENSION'S SPECIFIC ROLE:
[ShieldConfiguration]: Displays the custom blocking screen when users attempt 
to open blocked apps during their focus sessions. Shows FocusFlow branding 
and motivational messaging.

[ShieldAction]: Handles the "Emergency Override" button that allows users to 
end sessions early with accountability (breaks streak, logs event).

[ActivityMonitor]: Runs in background to apply/remove blocks based on user's 
scheduled focus sessions. Ensures blocks persist even if main app is terminated.

All 4 targets work together via App Groups (group.com.giress.focusflow) to 
provide the persistent blocking functionality our users explicitly requested.

DATA PRIVACY:
- No data sharing beyond the user's device
- All blocking decisions made by the user
- Extensions only communicate via local App Groups (no server/cloud)
- No screenshots, recordings, or invasive monitoring
```

**My app will use this entitlement only for the purposes I've described above:**
```
☑ Yes
```

**Will your app share device or usage data...**
```
○ No
```

#### Expected Timeline:
- Each entitlement: 2-4 weeks (sometimes up to 6-8 weeks)
- Total: 6-12 weeks for all 3 extensions
- **Start this process immediately** - it's the bottleneck

---

### Phase 4: Production Configuration (Week 2-3)

Once all entitlements are approved:

#### Step 1: Enable Distribution Entitlements in Xcode

For each of the 4 targets:
1. Open `ios/focusflowapp.xcworkspace` in Xcode
2. Select target → Signing & Capabilities
3. Click **+ Capability** → Family Controls
4. Select **Distribution** (not Development)
5. Repeat for all 4 targets

#### Step 2: Update Provisioning Profiles

1. Go to https://developer.apple.com/account/resources/profiles
2. Edit/regenerate provisioning profiles for all 4 bundle IDs
3. Ensure Family Controls (Distribution) is included
4. Download and install new profiles

#### Step 3: Build for TestFlight

```bash
# Create production build
eas build --platform ios --profile production

# Or if using manual builds:
npx expo prebuild
cd ios
# Archive in Xcode → Distribute to TestFlight
```

#### Step 4: TestFlight Testing

Recruit beta testers to verify:
- [ ] Blocking works when app is backgrounded
- [ ] Blocking persists after force-quitting app
- [ ] Blocking persists after device restart
- [ ] Emergency override works correctly
- [ ] Shield UI shows correct branding
- [ ] No crashes or performance issues

---

## Common Issues & Solutions

### Issue 1: "FamilyControls module not found"
**Cause:** Pods not installed or wrong iOS version
**Solution:**
```bash
cd ios && pod install && cd ..
# Verify deployment target is 16.0+ in Xcode
```

### Issue 2: Blocks don't persist after killing app
**Cause:** DeviceActivity schedule not configured correctly
**Solution:** Verify the `startMonitoring` call uses correct DateComponents format. The library handles this, but ensure you're passing valid start/end times.

### Issue 3: Shield doesn't appear
**Cause:** Shield extensions not running or App Group misconfigured
**Solution:**
1. Check all 4 targets have same App Group: `group.com.giress.focusflow`
2. Verify App Group is registered in Apple Developer portal
3. Clean build folder: Xcode → Product → Clean Build Folder

### Issue 4: "Not authorized" error
**Cause:** User hasn't granted permission or entitlement not enabled
**Solution:**
- Check Settings → Screen Time → FocusFlow has permission
- Verify Family Controls entitlement is in `.entitlements` file
- Check provisioning profile includes Family Controls

### Issue 5: Xcode build fails after prebuild
**Cause:** Plugin configuration issue or missing pods
**Solution:**
```bash
# Nuclear option - rebuild everything
rm -rf ios/ node_modules/
pnpm install
npx expo prebuild --clean
cd ios && pod install && cd ..
npx expo run:ios --device
```

---

## Testing Checklist

### Development Testing (Physical Device Required)
- [ ] App builds successfully with all 4 targets
- [ ] Authorization flow works (system prompt appears)
- [ ] Can select apps to block
- [ ] Can start focus session
- [ ] Blocked apps show shield immediately
- [ ] Background app → shield still works
- [ ] Force-quit app → shield still works
- [ ] Emergency override button works
- [ ] Session ends automatically after duration
- [ ] Can start multiple sessions (new blocks old)

### Production Testing (TestFlight)
- [ ] All development tests pass
- [ ] Blocking persists after device restart
- [ ] Multiple users can use app simultaneously
- [ ] No crashes over 24-hour period
- [ ] Shield UI looks correct on all screen sizes
- [ ] Works on iOS 16, 17, and 18
- [ ] Performance is acceptable (no lag)

---

## Success Criteria

Implementation is complete when:
- ✅ All 4 targets build without errors
- ✅ User can authorize Family Controls
- ✅ User can start focus session
- ✅ Selected apps show blocking shield
- ✅ Blocking persists after app is killed
- ✅ Emergency override works and logs event
- ✅ Session ends automatically after duration
- ✅ No crashes or ANR issues
- ✅ Works on iOS 16, 17, 18
- ✅ TestFlight beta approved by 10+ users

---

## Next Steps (Start Immediately)

---

## Key Resources

**Library Documentation:**
- [react-native-device-activity GitHub](https://github.com/kingstinct/react-native-device-activity)
- [Installation Guide](https://github.com/kingstinct/react-native-device-activity#installation)
- [API Reference](https://github.com/kingstinct/react-native-device-activity#api)

**Apple Documentation:**
- [FamilyControls Framework](https://developer.apple.com/documentation/familycontrols)
- [DeviceActivity Framework](https://developer.apple.com/documentation/deviceactivity)
- [Screen Time API Overview](https://developer.apple.com/documentation/screentime)

**Video Tutorials:**
- [WWDC 2021: Meet Screen Time API](https://developer.apple.com/videos/play/wwdc2021/10123/)
- [WWDC 2022: What's new in Screen Time API](https://developer.apple.com/videos/play/wwdc2022/10151/)

**Entitlement Request:**
- [Family Controls Distribution Request Form](https://developer.apple.com/contact/request/family-controls-distribution)

---

## Contact & Support

**For Implementation Questions:**
- Check library issues: https://github.com/kingstinct/react-native-device-activity/issues
- Expo forums: https://forums.expo.dev
- React Native Discord

**For Entitlement Questions:**
- Apple Developer Support: https://developer.apple.com/contact/



