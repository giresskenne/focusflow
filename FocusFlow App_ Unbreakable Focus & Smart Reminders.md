# FocusFlow App: Unbreakable Focus & Smart Reminders

## Overview

FocusFlow is a minimalist, intuitive mobile application designed to help users achieve uninterrupted focus by temporarily locking down distracting applications and providing gentle, non-intrusive reminders for important daily routines. It addresses the pervasive problem of digital distraction, offering a robust solution for enhanced productivity and digital well-being.

## Features

*   **Unbreakable Focus Sessions:** Set a timer to temporarily lock down distracting apps. Once a session begins, bypassing it requires a conscious effort, promoting genuine commitment to focus.
*   **Smart Reminders for Daily Habits:** Configure simple, recurring reminders for non-digital tasks or habits (e.g., "Drink water," "Take a break," "Check on coffee"). These are designed to be subtle and actionable.
*   **Minimalist Interface:** A clean, uncluttered design ensures ease of use and eliminates onboarding friction. Core functionalities are accessible with minimal taps.
*   **Cross-Platform Compatibility:** Built with React Native and Expo, enabling deployment to both iOS and Android from a single codebase.

## Technical Stack

*   **Framework:** React Native
*   **Development Environment:** Expo
*   **Navigation:** React Navigation
*   **Native Module Integration:** (Planned) Custom native modules for iOS (Screen Time API) and Android (UsageStatsManager/Accessibility Services) for robust app blocking.
*   **Local Storage:** (Planned) AsyncStorage for user preferences and reminder schedules.

## Development Roadmap (Completed & Planned)

### Phase 1: Project Setup and Environment Configuration (Completed)

*   Project directory initialized with Git.
*   Expo CLI installed globally.
*   React Native project scaffolded using `create-expo-app`.

### Phase 2: Core Feature - Native App Blocking Module (In Progress / Placeholder)

*   Research on iOS Screen Time API (`DeviceActivity` framework) and Android `UsageStatsManager` completed.
*   Placeholder files for native module bridge created for both iOS and Android.
*   JavaScript interface (`components/AppBlocker/index.js`) created to expose native methods.
    *   **Note:** Direct integration of these native modules into a *managed* Expo project requires either ejecting the project to a bare workflow or utilizing `expo-modules` for a more integrated approach. This step will be part of the final build process outside of this environment.

### Phase 3: UI/UX Development (Completed - Basic Structure)

*   `App.js` configured to integrate React Navigation.
*   Basic screen components created:
    *   `HomeScreen.js`: Entry point.
    *   `AppSelectionScreen.js`: For selecting apps to block.
    *   `FocusSessionScreen.js`: Displays active focus session timer.
*   React Navigation libraries installed.

### Phase 4: Smart Reminder Implementation (Planned)

*   Install `expo-notifications` library.
*   Implement logic for setting, scheduling, and receiving local notifications for custom reminders.

### Phase 5: Data Persistence (Planned)

*   Implement `AsyncStorage` for local storage of user preferences, app blocking lists, and reminder schedules.

### Phase 6: Testing and Deployment Preparation (Planned)

*   Write unit tests using Jest.
*   Create comprehensive documentation (this README).
*   Package the project for handover, including instructions for native compilation and app store submission.

## Getting Started (for Replit or Local Development)

### Prerequisites

*   Node.js (LTS version recommended)
*   pnpm (or npm/yarn)
*   Expo CLI (`pnpm install -g expo-cli`)
*   For iOS development: Xcode (macOS only)
*   For Android development: Android Studio

### Installation

1.  **Clone the repository or download the project files:**
    ```bash
    git clone <repository-url>
    cd focusflow-app
    ```
    *If you downloaded a zip file, extract it and navigate into the `focusflow-app` directory.*

2.  **Install dependencies:**
    ```bash
    pnpm install
    # or npm install
    # or yarn install
    ```

3.  **Install web-specific dependencies (if building for web):**
    ```bash
    npx expo install react-dom react-native-web
    ```

### Running the App

#### On Web (for quick preview)

```bash
npm start --web
# or expo start --web
```

This will open the app in your browser. Note that native app blocking functionality will not work in the web version.

#### On iOS/Android Simulator/Device (requires Expo Go app)

```bash
npm start
# or expo start
```

This will start the Expo development server. You can then:
*   Scan the QR code with the Expo Go app on your physical device.
*   Press `a` to open on an Android emulator.
*   Press `i` to open on an iOS simulator (macOS only).

#### Building for iOS (requires macOS and Xcode)

To build a standalone iOS app, you will likely need to eject your Expo project to a bare workflow or use `expo-modules` for native code integration. After that, you can build with Xcode.

1.  **If ejecting:**
    ```bash
    npx expo prebuild --platform ios
    cd ios
    pod install
    open FocusFlow.xcworkspace
    ```
2.  **Integrate Native App Blocker Module:**
    *   Manually link `ios/FocusFlow/AppBlocker/AppBlocker.h` and `ios/FocusFlow/AppBlocker/AppBlocker.m` into your Xcode project.
    *   Implement the actual app blocking logic using Apple's Screen Time API within these native files.
    *   Ensure all necessary entitlements and permissions for Screen Time are configured in Xcode.

#### Building for Android (requires Android Studio)

To build a standalone Android app, similar steps apply for native code integration.

1.  **If ejecting:**
    ```bash
    npx expo prebuild --platform android
    # Open the android project in Android Studio
    ```
2.  **Integrate Native App Blocker Module:**
    *   Ensure `android/app/src/main/java/com/focusflow/appblocker/AppBlockerModule.java` and `AppBlockerPackage.java` are correctly linked and registered in your `MainApplication.java` (or equivalent for Expo prebuild).
    *   Implement the actual app blocking logic using Android's `UsageStatsManager` and potentially Accessibility Services within `AppBlockerModule.java`.
    *   Configure necessary permissions (`PACKAGE_USAGE_STATS`) in `AndroidManifest.xml` and handle runtime permission requests.

## Contributing

Feel free to fork this repository and submit pull requests. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT License](LICENSE)

