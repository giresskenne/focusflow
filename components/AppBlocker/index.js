// JS interface for the native AppBlocker module with a safe fallback.
import { NativeModules } from 'react-native';

const Native = NativeModules.AppBlocker;
console.log('[AppBlocker] Checking for native module... Found:', Native ? 'Yes' : 'No');

// Provide a graceful no-op fallback when the native module isn't available
// (e.g., Expo Go, web, or dev builds without the iOS DeviceActivity bridge).
const Fallback = {
  isAvailable: false,
  async requestAuthorization() {
    console.log('[AppBlocker Fallback] requestAuthorization called');
  },
  async selectApps() {
    console.log('[AppBlocker Fallback] selectApps called');
    return [];
  },
  async startBlocking(appBundleIds) {
    console.log('[AppBlocker Fallback] startBlocking called with:', appBundleIds);
    // no-op in environments without native support
  },
  async stopBlocking() {
    console.log('[AppBlocker Fallback] stopBlocking called');
    // no-op
  },
  async isBlocking() {
    console.log('[AppBlocker Fallback] isBlocking called');
    return false;
  },
};

// Normalize the surface to always expose isAvailable and async methods
const AppBlocker = Native
  ? {
      isAvailable: true,
      async requestAuthorization() {
        console.log('[AppBlocker Native] Calling requestAuthorization...');
        try {
          const result = await Native.requestAuthorization?.();
          console.log('[AppBlocker Native] requestAuthorization result:', result);
          return result;
        } catch (e) {
          console.error('[AppBlocker Native] requestAuthorization error:', e);
          return undefined;
        }
      },
      async selectApps() {
        console.log('[AppBlocker Native] Calling selectApps...');
        try {
          const res = await Native.selectApps?.();
          console.log('[AppBlocker Native] selectApps result:', res);
          return Array.isArray(res) ? res : [];
        } catch (e) {
          console.error('[AppBlocker Native] selectApps error:', e);
          return [];
        }
      },
      async startBlocking(appBundleIds) {
        console.log('[AppBlocker Native] Calling startBlocking with:', appBundleIds);
        try {
          const result = await Native.startBlocking?.(appBundleIds);
          console.log('[AppBlocker Native] startBlocking result:', result);
          return result;
        } catch (e) {
          console.error('[AppBlocker Native] startBlocking error:', e);
          // If native throws, don't crash the app
          return undefined;
        }
      },
      async stopBlocking() {
        console.log('[AppBlocker Native] Calling stopBlocking...');
        try {
          const result = await Native.stopBlocking?.();
          console.log('[AppBlocker Native] stopBlocking result:', result);
          return result;
        } catch (e) {
          console.error('[AppBlocker Native] stopBlocking error:', e);
          return undefined;
        }
      },
      async isBlocking() {
        console.log('[AppBlocker Native] Calling isBlocking...');
        try {
          const res = await Native.isBlocking?.();
          console.log('[AppBlocker Native] isBlocking result:', res);
          return !!res;
        } catch (e) {
          console.error('[AppBlocker Native] isBlocking error:', e);
          return false;
        }
      },
    }
  : Fallback;

export default AppBlocker;
