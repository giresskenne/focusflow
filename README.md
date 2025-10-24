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

## App Blocking (Placeholder)

- JS interface in `components/AppBlocker/index.js` calls a native module if available; otherwise it’s a safe no‑op in Expo Go.
- Real OS-level app blocking requires native capabilities that are not available in Expo Go.

### When implementing real blocking later

If you decide to ship true Screen Time/App Blocking:

1. Run prebuild to generate native projects: `npx expo prebuild`.
2. iOS: Implement Screen Time/DeviceActivity APIs with proper entitlements and background modes.
3. Android: Use UsageStatsManager/Accessibility Service with the required permissions.
4. Keep the JS API the same so screens remain unchanged.

Note: The `ios/` and `android/` folders were removed to keep the repo Expo-managed. They’re ignored by `.gitignore` and can be re-generated anytime via prebuild.

## Tests

Jest via `jest-expo`. Example unit test in `__tests__/time.test.js`.
