import AppBlocker from '../components/AppBlocker';

// Mock the native module
jest.mock('react-native', () => ({
  NativeModules: {
    AppBlocker: {
      requestAuthorization: jest.fn(),
      selectApps: jest.fn(),
      startBlocking: jest.fn(),
      stopBlocking: jest.fn(),
      isBlocking: jest.fn(),
    },
  },
}));

describe('App Blocking Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should check if blocking is available', () => {
    expect(AppBlocker.isAvailable).toBeDefined();
    expect(typeof AppBlocker.isAvailable).toBe('boolean');
  });

  test('should request authorization when available', async () => {
    if (AppBlocker.isAvailable) {
      const mockAuth = require('react-native').NativeModules.AppBlocker.requestAuthorization;
      mockAuth.mockResolvedValue(true);

      const result = await AppBlocker.requestAuthorization();
      expect(result).toBe(true);
      expect(mockAuth).toHaveBeenCalled();
    } else {
      // When not available, should not throw
      const result = await AppBlocker.requestAuthorization();
      expect(result).toBeUndefined();
    }
  });

  test('should start blocking when provided with app bundle IDs', async () => {
    const appBundleIds = ['com.facebook.Facebook', 'com.twitter.twitter'];
    
    if (AppBlocker.isAvailable) {
      const mockStart = require('react-native').NativeModules.AppBlocker.startBlocking;
      mockStart.mockResolvedValue(true);

      const result = await AppBlocker.startBlocking(appBundleIds);
      expect(result).toBe(true);
      expect(mockStart).toHaveBeenCalledWith(appBundleIds);
    } else {
      // When not available, should not throw
      const result = await AppBlocker.startBlocking(appBundleIds);
      expect(result).toBeUndefined();
    }
  });

  test('should stop blocking when called', async () => {
    if (AppBlocker.isAvailable) {
      const mockStop = require('react-native').NativeModules.AppBlocker.stopBlocking;
      mockStop.mockResolvedValue(true);

      const result = await AppBlocker.stopBlocking();
      expect(result).toBe(true);
      expect(mockStop).toHaveBeenCalled();
    } else {
      // When not available, should not throw
      const result = await AppBlocker.stopBlocking();
      expect(result).toBeUndefined();
    }
  });

  test('should check blocking status', async () => {
    if (AppBlocker.isAvailable) {
      const mockIsBlocking = require('react-native').NativeModules.AppBlocker.isBlocking;
      mockIsBlocking.mockResolvedValue(false);

      const result = await AppBlocker.isBlocking();
      expect(result).toBe(false);
      expect(mockIsBlocking).toHaveBeenCalled();
    } else {
      // When not available, should return false
      const result = await AppBlocker.isBlocking();
      expect(result).toBe(false);
    }
  });
});