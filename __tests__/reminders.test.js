import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getReminders, setReminders } from '../src/storage';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('Reminder Notifications', () => {
  beforeEach(() => {
    AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('should request notification permissions', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const { status: currentStatus } = await Notifications.getPermissionsAsync();
    expect(currentStatus).toBe('undetermined');

    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    expect(newStatus).toBe('granted');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  test('should schedule daily notification', async () => {
    const mockNotificationId = 'notification-123';
    Notifications.scheduleNotificationAsync.mockResolvedValue(mockNotificationId);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Reminder', body: 'Test reminder' },
      trigger: { hour: 9, minute: 0, repeats: true },
    });

    expect(notificationId).toBe(mockNotificationId);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Reminder', body: 'Test reminder' },
      trigger: { hour: 9, minute: 0, repeats: true },
    });
  });

  test('should save reminder with notification ID', async () => {
    const mockNotificationId = 'notification-456';
    const reminder = {
      id: '1',
      type: 'daily',
      text: 'Take a break',
      notificationId: mockNotificationId,
      enabled: true,
      hour: 14,
      minute: 30,
      updatedAt: Date.now(),
    };

    await setReminders([reminder]);
    const savedReminders = await getReminders();

    expect(savedReminders).toHaveLength(1);
    expect(savedReminders[0].notificationId).toBe(mockNotificationId);
    expect(savedReminders[0].text).toBe('Take a break');
  });

  test('should cancel notification when deleting reminder', async () => {
    const notificationId = 'notification-to-cancel';
    
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(notificationId);
  });

  test('should schedule one-time notification', async () => {
    const mockNotificationId = 'notification-once-123';
    const futureDate = new Date(Date.now() + 300000); // 5 minutes from now
    
    Notifications.scheduleNotificationAsync.mockResolvedValue(mockNotificationId);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Reminder', body: 'One-time reminder test' },
      trigger: { date: futureDate },
    });

    expect(notificationId).toBe(mockNotificationId);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Reminder', body: 'One-time reminder test' },
      trigger: { date: futureDate },
    });
  });

  test('should save one-time reminder with scheduled date', async () => {
    const mockNotificationId = 'notification-once-456';
    const scheduledDate = new Date(Date.now() + 3600000).getTime(); // 1 hour from now
    
    const reminder = {
      id: '1',
      type: 'once',
      text: 'Take a break in 1 hour',
      notificationId: mockNotificationId,
      enabled: true,
      scheduledDate: scheduledDate,
      updatedAt: Date.now(),
    };

    await setReminders([reminder]);
    const savedReminders = await getReminders();

    expect(savedReminders).toHaveLength(1);
    expect(savedReminders[0].type).toBe('once');
    expect(savedReminders[0].scheduledDate).toBe(scheduledDate);
    expect(savedReminders[0].text).toBe('Take a break in 1 hour');
  });
});