import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthUser, setAuthUser, clearAuthUser } from '../src/storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('Auth user storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null by default', async () => {
    expect(await getAuthUser()).toBeNull();
  });

  it('stores and retrieves a minimal user', async () => {
    await setAuthUser({ id: 'u1', email: 'a@b.com' });
    const u = await getAuthUser();
    expect(u).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('clears user data', async () => {
    await setAuthUser({ id: 'u1', email: 'a@b.com' });
    await clearAuthUser();
    expect(await getAuthUser()).toBeNull();
  });
});
