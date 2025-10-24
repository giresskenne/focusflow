import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPremiumStatus, setPremiumStatus } from '../src/storage';
import { FREE_REMINDER_LIMIT, canAddReminder } from '../src/utils/premium';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('Premium status storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to free (false) when not set', async () => {
    const premium = await getPremiumStatus();
    expect(premium).toBe(false);
  });

  it('toggles premium true -> false correctly', async () => {
    await setPremiumStatus(true);
    expect(await getPremiumStatus()).toBe(true);

    await setPremiumStatus(false);
    expect(await getPremiumStatus()).toBe(false);
  });

  it('supports legacy object format { isPremium }', async () => {
    await AsyncStorage.setItem('ff:premium', JSON.stringify({ isPremium: true }));
    expect(await getPremiumStatus()).toBe(true);

    // Setting again should overwrite as boolean and be read back
    await setPremiumStatus(false);
    const raw = await AsyncStorage.getItem('ff:premium');
    expect(raw).toBe('false');
    expect(await getPremiumStatus()).toBe(false);
  });
});

describe('Free vs Premium gating', () => {
  it('allows adding reminders under free until limit', () => {
    for (let count = 0; count < FREE_REMINDER_LIMIT; count++) {
      expect(canAddReminder(false, count)).toBe(true);
    }
    expect(canAddReminder(false, FREE_REMINDER_LIMIT)).toBe(false);
  });

  it('always allows adding reminders under premium', () => {
    for (let count = 0; count < FREE_REMINDER_LIMIT + 5; count++) {
      expect(canAddReminder(true, count)).toBe(true);
    }
  });
});
