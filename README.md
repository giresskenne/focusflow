# FocusFlow App

Minimalist focus sessions and smart reminders built with Expo + React Native.

## Features

- Unbreakable Focus Sessions: countdown timer with an “Active Session” screen.
- Smart Reminders: local notifications with repeating intervals.
- Persistence: AsyncStorage stores selected apps, reminders, premium status, and session state.
- Navigation: React Navigation native-stack.

## Scripts

- `pnpm start` – start the Expo dev server (managed workflow).
- `pnpm run ios:expo` – open in iOS Simulator via Expo Go.
- `pnpm run android:expo` – open in Android Emulator via Expo Go.
- `pnpm run web` – run in the browser.
- `pnpm test` – run unit tests.
	- Optional integration tests can be enabled with environment variables (see below).

## Getting Started

```bash
cd focusflow-app
pnpm install
pnpm start
```

Then open the project in Expo Go (device) or press `i` for iOS Simulator / `a` for Android Emulator.

## Smart Reminders

Implemented using `expo-notifications`.

1. Open Smart Reminders from Home.
2. Grant notification permissions when prompted.
3. Add a title and interval (minutes) and press Add.
4. Use Pause/Resume/Delete to manage reminders.

Note: On web, notification support depends on the browser; on iOS/Android, the Expo Notifications plugin configures required permissions.

## Cloud Sync & Migration (Dev)

FocusFlow supports an optional cloud backup/sync for signed-in users (Supabase). The app stays local‑first with a light UX:

- Signed‑in: silent auto‑upload on foreground if local data changed; periodic cloud→local merge.
- Signed‑out: weekly “Sign in” nudge (only if notification permission already granted).
- First sign‑in: app‑level prompt to save local data to your account or replace local with cloud.

### Configure environment variables

1) Copy `.env.example` to `.env` and set your Supabase project credentials:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY

# Optional: enable dev uploads for the first-time migration prompt
EXPO_PUBLIC_ENABLE_MIGRATION_UPLOAD=true
```

2) Restart the Expo server after changing `.env`.

### Optional: run sync integration tests

Provide a test user to exercise upload/download/merge using your Supabase project:

```bash
export EXPO_PUBLIC_SUPABASE_URL=... 
export EXPO_PUBLIC_SUPABASE_ANON_KEY=...
export TEST_USER_EMAIL=...
export TEST_USER_PASSWORD=...
pnpm test
```

The suite will automatically skip if these variables are not set.

## Monetization (RevenueCat)

FocusFlow uses RevenueCat for in‑app subscriptions on iOS. This keeps the app compliant with App Store policies and offloads receipt validation and renewals.

Quick setup:

1) Configure products in App Store Connect (Monthly/Annual) and add them to a RevenueCat Offering (e.g., "default").
2) Add keys to `.env` and enable IAP:

```bash
EXPO_PUBLIC_ENABLE_IAP=true
REVENUECAT_IOS_API_KEY=rc_ios_...
EXPO_PUBLIC_RC_ENTITLEMENT=premium
```

3) Restart the dev server. In Settings → Upgrade to Premium, the modal uses RevenueCat offerings/prices when available. A "Restore Purchases" action appears in Settings when IAP is enabled.

Notes:
- Code paths are guarded. If the native module isn’t present, the app falls back to a simulated upgrade for dev.
- For production, install pods and run a dev client/TestFlight build.
- Entitlement revocations (refund/expiration) are reflected automatically via the customer info listener.

## App Blocking (Placeholder)

- JS interface in `components/AppBlocker/index.js` calls a native module if available; otherwise it’s a safe no‑op in Expo Go.
- Real OS-level app blocking requires native capabilities that are not available in Expo Go.

### When implementing real blocking later

If you decide to ship true Screen Time/App Blocking:

1. Run prebuild to generate native projects: `npx expo prebuild`.
2. iOS: Implement Screen Time/DeviceActivity APIs with proper entitlements and background modes.
3. Android: Use UsageStatsManager/Accessibility Service with the required permissions.
4. Keep the JS API the same so screens remain unchanged.

Note: The native scaffolding is present under `ios/` for development builds. Real enforcement requires platform entitlements and will be shipped separately.

## Tests

Jest via `jest-expo`. Example unit test in `__tests__/time.test.js`.


## app navigation
Stack Navigator (main app navigation)
├── Tab Navigator (bottom tabs for main app)
│   ├── HomeScreen (Home tab)
│   ├── AnalyticsScreen (Analytics tab)
│   ├── RemindersScreen (Reminders tab)
│   └── SettingsScreen (Settings tab)
├── AppSelectionScreen (modal/stack screen)
├── FocusSessionScreen (modal/stack screen)
├── ActiveSessionScreen (modal/stack screen)
├── SignInScreen (modal/stack screen)
├── SignUpScreen (modal/stack screen)
├── TermsScreen (modal/stack screen)
├── PrivacyPolicyScreen (modal/stack screen)
├── AccountScreen (modal/stack screen)
├── PolicyScreen (modal/stack screen)
├── EventModalScreen (modal/stack screen)
└── EventEditModalScreen (modal/stack screen)
