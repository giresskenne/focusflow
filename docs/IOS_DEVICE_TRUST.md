# Trusting your Personal Team build on iPhone

If Xcode shows “The request to open <bundleId> failed … invalid code signature, inadequate entitlements or its profile has not been explicitly trusted by the user” or you see an “Untrusted Developer” prompt on device, follow these steps:

## 1) Ensure the app is installed
- Build and Run from Xcode to your iPhone once. This installs the app and registers the developer certificate on the device.

## 2) Trust the developer certificate on device
- Open Settings on iPhone
- Go to General → VPN & Device Management (on some iOS versions: General → Device Management or Profiles & Device Management)
- Under “Developer App”, tap your Apple ID (e.g., `Apple Development: you@icloud.com`)
- Tap “Trust” and confirm

Tip: If you don’t see “Developer App”, try launching the app once from the Home Screen to trigger the prompt, or reinstall from Xcode.

## 3) Relaunch from Xcode
- Return to Xcode, select your device, and press Run again
- The app should launch

## Troubleshooting

- Still untrusted
  - Delete the app from your device
  - Product → Clean Build Folder in Xcode
  - Rebuild and repeat Step 2

- Code signature / provisioning complaints
  - In the target → Signing & Capabilities:
    - Team: your Personal Team
    - Bundle Identifier: unique (e.g., `com.<yourname>.focusflow-app`)
    - Automatically manage signing: enabled
    - Capabilities: none added (no Push Notifications, App Groups, Family Controls, or Device Activity)

- Device time/date
  - Ensure the device has correct date/time (Settings → General → Date & Time → Set Automatically)

- Reset certificates (if necessary)
  - Xcode → Settings… → Accounts → your Apple ID → Manage Certificates…
  - If there’s an “Apple Development” certificate error, “+” to create a new one or delete and recreate

- DerivedData reset
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

## Notes
- Local notifications do not require Push Notifications capability; they will work on a Personal Team build
- Real iOS app blocking requires Apple-approved entitlements and is intentionally disabled in this configuration
