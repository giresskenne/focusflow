Running FocusFlow on Simulator and Device

This app is configured to run in both iOS Simulator and on a physical iPhone using Expo. It mirrors the working setup from travelly-app.

Quick scripts
- `npm run start` — start Metro bundler
- `npm run start:clean` — clear cache and start
- `npm run start:tunnel` — start with Tunnel for easy device connection
- `npm run ios:expo` — open in iOS Simulator (Expo)
- `npm run android:expo` — open in Android emulator (Expo)
- `npm run ios` — build and run a local iOS dev build (native)

Device builds (Expo Dev Client)
- Install a Dev Client on your device for native modules:
  - iOS internal dev build: `eas build -p ios --profile development`
  - Install via EAS after the build completes (QR code or link)
  - Then run `npm run start:tunnel` and open the project in the Dev Client

Connection mode
- Simulator generally works with `LAN`.
- Physical device: prefer `Tunnel` unless your phone and computer are on the same LAN and firewalls allow access.
- Use `npm run start:tunnel` to avoid network issues on device.

Environment variables
- Uses `EXPO_PUBLIC_` variables (Expo loads `.env` automatically):
  - Example in `.env.example` already provided (Supabase, IAP, AI flags)
- For local services accessed from a physical device, use your computer’s LAN IP (e.g., `http://10.0.0.82:8080`) instead of `localhost`.

Deep linking / scheme
- Configured in `app.json` under `expo.scheme`: `com.giress.focusflow-app`
- React Navigation is used; no expo-router required.

Notes
- Because this app uses native modules (IAP, Device Activity, Voice), Expo Go is not sufficient. Use the Dev Client (development profile) for device testing.

