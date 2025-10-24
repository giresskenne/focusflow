# iOS App Blocking (Phase 10)

This app uses a local-first model and can optionally enforce *unbreakable focus* by blocking distracting apps on iOS. Enforcing app blocking requires native iOS capabilities that are not available in Expo Go.

## ⚠️ Current Status: Deferred

**Production app blocking is currently deferred** pending Apple's approval of Screen Time API entitlements (Family Controls + Device Activity). These entitlements require special approval from Apple and are not automatically granted.

- The app ships with a fully functional focus timer and reminder system
- App blocking UI is gated behind a development flag (EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV=false by default)
- When enabled, the blocking interface works but enforcement is not active
- This allows continued development and user testing of the core app functionality

## Why a dev build?

Apple’s DeviceActivity + FamilyControls frameworks require:
- App Groups and entitlements configured in the iOS project
- Native Swift/Obj‑C code to schedule activities and apply Shields
- User authorization prompts for family controls

These are not supported in Expo Go. You’ll need an iOS dev build with the native module.

## Current behavior in Expo Go

- The app simulates a focus session timer.
- Blocking calls no-op with a safe fallback.
- You’ll see an in-app notice: “App blocking isn’t active in this build (Expo Go). Use an iOS dev build …”.

## Current status

- Production-grade iOS app blocking is deferred until Apple approves the Screen Time API entitlements (Family Controls + Device Activity).
- You can keep building and shipping the rest of the app; the UI and sessions work without full enforcement.
- A dev-only section can be toggled for internal testing: set `EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV=true` in `.env` (default is false).

### Building to a personal iPhone (Personal Team)

If you're installing to a device with a Personal Apple Developer account, Xcode cannot create provisioning profiles that include:

- Push Notifications (aps-environment)
- App Groups
- Family Controls
- Device Activity

For a successful build:

1. Remove these keys from `ios/focusflowapp/focusflowapp.entitlements` (already done in this repo).
2. In Xcode > Signing & Capabilities, ensure only basic signing remains (no Push Notifications / App Groups / Family Controls / Device Activity).
3. Enable “Automatically manage signing”, select your Personal Team, and use a unique Bundle ID (e.g., `com.<yourname>.focusflow`).
4. Build and run on your device. Local notifications and the focus timer will work; native app blocking remains disabled pending Apple approval.

## Getting a dev build running

1) Enable the config plugin (already wired)
- `app.json` includes `"./plugins/app-blocker-plugin"` which:
  - Adds an App Group entitlement if you set `appGroup` (placeholder set to `group.com.example.focusflow`)
  - Injects a native Swift module scaffold (`AppBlocker.swift`) and bridge

2) Generate native projects (one-time)
- Run the prebuild to create the `ios/` folder and apply the plugin

```sh
pnpm expo prebuild --platform ios
```

- Then open the workspace in Xcode:

```sh
open ios/*.xcworkspace
```

3) Enable capabilities in Xcode
- Signing & Capabilities:
  - App Groups: match `app.json` → `plugins[./plugins/app-blocker-plugin].appGroup`
  - Family Controls and Device Activity: add both capabilities
- Ensure your bundle ID and team are set

4) Native bridge status (scaffolded)
- The plugin injects `AppBlocker.swift` and a bridge with placeholder methods that:
  - Request authorization hook (to be implemented with FamilyControls)
  - Expose startBlocking/stopBlocking/isBlocking as Promises for RN
- TODO in native code: Apply ManagedSettings shields using FamilyControls tokens (requires FamilyActivityPicker and/or DeviceActivity extension for stronger enforcement)

5) Build & run
- Use: npx expo run:ios (or build/run in Xcode)
- On first run, accept Family Controls permissions on device

## JS contract for the native bridge

- startBlocking(appBundleIds: string[]): Promise<void>
- stopBlocking(): Promise<void>
- isBlocking(): Promise<boolean>
- requestAuthorization(): Promise<void>
- isAvailable: boolean (added by the JS wrapper)

The JS wrapper lives in `components/AppBlocker/index.js` and provides:
- A no-op fallback when the native module is missing (Expo Go)
- A stable surface with `isAvailable` that flips true in dev builds after native is compiled

## Future enhancements

- Enforce a post‑install onboarding step to request FamilyControls authorization
- Persist an allowlist/blocklist per session profile
- Add Shield configuration (title/reason) aligned to Figma
- DeviceActivityMonitor Extension for stronger enforcement during background and across reboots

## Troubleshooting

- “Undefined is not an object (evaluating NativeModules.AppBlocker)”: Ensure the native module is compiled into your dev build (not Expo Go) and the plugin ran during prebuild
- Build errors about entitlements: Double‑check Team, bundle ID, capabilities, and App Group values
- Permissions not shown: Device must be signed into iCloud; FamilyControls requires iOS 16+
