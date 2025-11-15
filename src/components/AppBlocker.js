// JS wrapper for the native AppBlocker bridge with a simulator-friendly dev stub.
// - Uses NativeModules.AppBlocker when available (iOS device / built with plugin)
// - Falls back to a simple in-memory stub when EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV=true

import { NativeModules, Platform } from 'react-native';
import { safeTurboModuleCall, isIPad } from '../utils/deviceCompat';

const ENABLE_IOS_BLOCKING_DEV = process.env.EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV === 'true';
const Native = NativeModules?.AppBlocker;

const nativeAvailable = Platform.OS === 'ios' && !!Native;

// Dev stub for simulator/testing — mimics the API shape
let devActive = false;
const DevStub = {
  isAvailable: ENABLE_IOS_BLOCKING_DEV, // true when dev flag is on
  async requestAuthorization() {
    console.log('[AppBlocker DevStub] requestAuthorization (simulated)');
    return true; // Simulate approval
  },
  async selectApps() {
    console.log('[AppBlocker DevStub] selectApps (simulated)');
    return [];
  },
  async startBlocking(bundleIds = [], durationSeconds = 1800) {
    console.log('[AppBlocker DevStub] startBlocking (simulated):', bundleIds, `for ${durationSeconds}s`);
    devActive = true;
    return true; // Simulate success
  },
  async stopBlocking() {
    console.log('[AppBlocker DevStub] stopBlocking (simulated)');
    devActive = false;
    return true; // Simulate success
  },
  async isBlocking() {
    return devActive;
  },
  // Android helper used conditionally elsewhere
  async hasUsageAccess() {
    return false;
  },
};

const NativeWrapper = {
  isAvailable: true,
  async requestAuthorization() {
    return safeTurboModuleCall(() => Native.requestAuthorization?.(), false);
  },
  async selectApps() {
    return safeTurboModuleCall(() => Native.selectApps?.(), []);
  },
  async startBlocking(bundleIds = []) {
    if (isIPad()) {
      console.warn('[AppBlocker] Skipping startBlocking on iPad');
      return { success: false, reason: 'iPad not supported' };
    }
    return safeTurboModuleCall(() => Native.startBlocking?.(bundleIds), { success: false });
  },
  async stopBlocking() {
    return safeTurboModuleCall(() => Native.stopBlocking?.(), { success: true });
  },
  async isBlocking() {
    return safeTurboModuleCall(() => Native.isBlocking?.(), false);
  },
  async hasUsageAccess() {
    // iOS path doesn't use this; Android screens guard on Platform
    return false;
  },
};

const AppBlocker = nativeAvailable ? NativeWrapper : (ENABLE_IOS_BLOCKING_DEV ? DevStub : { ...DevStub, isAvailable: false });

export default AppBlocker;

