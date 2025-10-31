import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ActiveSessionScreen from '../src/screens/ActiveSessionScreen';

// Mock navigation
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const route = { params: { durationSeconds: 3 } }; // short session

// Mock storage APIs used by the screen
jest.mock('../src/storage', () => ({
  getSelectedApps: jest.fn(async () => ({ familyActivitySelectionId: 'focusflow_selection' })),
  setSession: jest.fn(async () => {}),
  appendSessionRecord: jest.fn(async () => {}),
  getSession: jest.fn(async () => ({ active: true })),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'notif-id'),
}));

// Mock react-native-device-activity module (iOS only)
jest.mock('react-native-device-activity', () => ({
  getAuthorizationStatus: jest.fn(() => 2),
  requestAuthorization: jest.fn(async () => {}),
  updateShield: jest.fn(() => {}),
  configureActions: jest.fn(() => {}),
  blockSelection: jest.fn(() => {}),
  unblockSelection: jest.fn(() => {}),
  stopMonitoring: jest.fn(() => {}),
  startMonitoring: jest.fn(async () => {}),
  activitySelectionMetadata: jest.fn(() => ({ applicationCount: 0, categoryCount: 0 })),
}));

jest.useFakeTimers();

describe('ActiveSessionScreen lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes exactly once and sends a notification', async () => {
    const tree = renderer.create(<ActiveSessionScreen navigation={navigation} route={route} />);

    // Let useEffect async setup run
    await act(async () => {});

    // Advance timers beyond duration to trigger zero countdown and JS timer
    await act(async () => { jest.advanceTimersByTime(4000); });

    const { setSession, appendSessionRecord } = require('../src/storage');
    const Notifications = require('expo-notifications');

    // Expect session cleared and record appended at least once
    expect(setSession).toHaveBeenCalledWith({ active: true, endAt: expect.any(Number), totalSeconds: 3 });
    expect(setSession).toHaveBeenCalledWith({ active: false, endAt: null, totalSeconds: null });
    expect(appendSessionRecord).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    // Navigate back called once
    expect(navigation.goBack).toHaveBeenCalled();

    tree.unmount();
  });
});
