// JS interface for the native AppBlocker module with a safe fallback.
import { NativeModules } from 'react-native';

const Native = NativeModules.AppBlocker;

// Provide a graceful no-op fallback when the native module isn't available
// (e.g., Expo Go, web, or dev builds without the iOS DeviceActivity bridge).
const Fallback = {
  isAvailable: false,
  async requestAuthorization() {},
  async selectApps() { return []; },
  async startBlocking(/* appBundleIds: string[] */) {
    // no-op in environments without native support
  },
  async stopBlocking() {
    // no-op
  },
  async isBlocking() {
    return false;
  },
};

// Normalize the surface to always expose isAvailable and async methods
const AppBlocker = Native
  ? {
      isAvailable: true,
      async requestAuthorization() {
        try {
          return await Native.requestAuthorization?.();
        } catch (e) {
          return undefined;
        }
      },
      async selectApps() {
        try {
          const res = await Native.selectApps?.();
          return Array.isArray(res) ? res : [];
        } catch (e) {
          return [];
        }
      },
      async startBlocking(appBundleIds) {
        try {
          return await Native.startBlocking?.(appBundleIds);
        } catch (e) {
          // If native throws, don't crash the app
          return undefined;
        }
      },
      async stopBlocking() {
        try {
          return await Native.stopBlocking?.();
        } catch (e) {
          return undefined;
        }
      },
      async isBlocking() {
        try {
          const res = await Native.isBlocking?.();
          return !!res;
        } catch (e) {
          return false;
        }
      },
    }
  : Fallback;

export default AppBlocker;
