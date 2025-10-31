// JS interface for the native AppBlocker module with a safe fallback.
import { NativeModules, Platform } from 'react-native';

const Native = NativeModules.AppBlocker;
console.log('[AppBlocker] Checking for native module... Found:', Native ? 'Yes' : 'No');

// Try optional import of react-native-device-activity for iOS builds
let DeviceActivity = null;
try {
  // eslint-disable-next-line no-eval
  const optRequire = eval('require');
  DeviceActivity = optRequire && optRequire('react-native-device-activity');
} catch (e) {
  DeviceActivity = null;
}

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
  async startBlocking(appBundleIds, _durationSeconds = 1800) {
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

// If DeviceActivity is present on iOS, use it for real blocking
let AppBlocker = null;
if (Platform.OS === 'ios' && DeviceActivity) {
  const {
    requestAuthorization,
    AuthorizationStatus,
    startMonitoring,
    stopMonitoring,
    getAuthorizationStatus,
  } = DeviceActivity;

  AppBlocker = {
    isAvailable: true,
    async requestAuthorization() {
      try {
        const status = await requestAuthorization();
        console.log('[AppBlocker DeviceActivity] requestAuthorization:', status);
        return status === AuthorizationStatus.approved;
      } catch (e) {
        console.error('[AppBlocker DeviceActivity] requestAuthorization error:', e);
        return false;
      }
    },
    async selectApps() {
      console.log('[AppBlocker DeviceActivity] selectApps not implemented in JS shim');
      return [];
    },
    async startBlocking(appBundleIds, durationSeconds = 1800) {
      try {
        const now = new Date();
        const end = new Date(now.getTime() + Math.max(60, durationSeconds) * 1000);
        const schedule = {
          intervalStart: { hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds() },
          intervalEnd: { hour: end.getHours(), minute: end.getMinutes(), second: end.getSeconds() },
          repeats: false,
          warningTime: null,
        };
        const applications = (appBundleIds || []).map((bundleId) => ({
          bundleIdentifier: bundleId,
          token: bundleId,
        }));
        await startMonitoring({
          schedule,
          deviceActivityName: 'focusSession',
          includesPastActivity: false,
          applications,
        });
        console.log('[AppBlocker DeviceActivity] startMonitoring scheduled for', applications.length, 'apps');
        return true;
      } catch (e) {
        console.error('[AppBlocker DeviceActivity] startBlocking error:', e);
        return false;
      }
    },
    async stopBlocking() {
      try {
        await stopMonitoring('focusSession');
        console.log('[AppBlocker DeviceActivity] stopMonitoring focusSession');
        return true;
      } catch (e) {
        console.error('[AppBlocker DeviceActivity] stopBlocking error:', e);
        return false;
      }
    },
    async isBlocking() {
      try {
        const status = await getAuthorizationStatus();
        return status === AuthorizationStatus.approved; // capability check (not active state)
      } catch {
        return false;
      }
    },
  };
} else if (Native) {
  // Fall back to our lightweight native bridge if present
  AppBlocker = {
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
    async startBlocking(appBundleIds, _durationSeconds) {
      console.log('[AppBlocker Native] Calling startBlocking with:', appBundleIds);
      try {
        const result = await Native.startBlocking?.(appBundleIds);
        console.log('[AppBlocker Native] startBlocking result:', result);
        return result;
      } catch (e) {
        console.error('[AppBlocker Native] startBlocking error:', e);
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
  };
} else {
  AppBlocker = Fallback;
}

export default {
  isAvailable: AppBlocker.isAvailable,
  requestAuthorization: AppBlocker.requestAuthorization,
  selectApps: AppBlocker.selectApps,
  startBlocking: AppBlocker.startBlocking,
  stopBlocking: AppBlocker.stopBlocking,
  isBlocking: AppBlocker.isBlocking,
};
