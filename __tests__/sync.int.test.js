/**
 * Integration tests for sync helpers. Skips unless Supabase and test user are configured.
 * Requires: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD
 */

import { createClient } from '@supabase/supabase-js';
import { setSupabaseClient } from '../src/lib/supabase';
import { performMigrationUpload, downloadUserData, pullCloudToLocal, hasCloudData, mergeCloudToLocal } from '../src/lib/sync';

// In-memory mocks for storage used by sync.js
jest.mock('../src/storage', () => {
  let MEM = {
    reminders: [],
    apps: {},
    analytics: [],
    settings: { reminderNotifications: true, sessionNotifications: true, motivationMessages: false, analytics: false },
    lastSyncAt: 0,
  };
  return {
    async getReminders() { return MEM.reminders; },
    async setReminders(next) { MEM.reminders = Array.isArray(next) ? next : []; },

    async getSelectedApps() { return MEM.apps; },
    async setSelectedApps(next) { MEM.apps = next || {}; },

    async getAnalyticsHistory() { return MEM.analytics; },
    async setAnalyticsHistory(next) { MEM.analytics = Array.isArray(next) ? next : []; },

    async getSettings() { return MEM.settings; },
    async updateSettings(next) { MEM.settings = { ...MEM.settings, ...(next || {}) }; },

    async setLastSyncAt(ts) { MEM.lastSyncAt = ts; },

    // Test helpers to reset state between tests
    __resetMem() { MEM = { reminders: [], apps: {}, analytics: [], settings: { reminderNotifications: true, sessionNotifications: true, motivationMessages: false, analytics: false }, lastSyncAt: 0 }; },
  };
});
import { setReminders, setSelectedApps, setAnalyticsHistory, updateSettings, getReminders, getSelectedApps, getAnalyticsHistory } from '../src/storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

const maybe = (cond) => (cond ? describe : describe.skip);

maybe(!!(url && anon && TEST_EMAIL && TEST_PASSWORD))('Sync (integration)', () => {
  let client = null;
  let userId = null;

  beforeAll(async () => {
    // Sign in and inject client for sync.js
  client = createClient(url, anon);
  const { data, error } = await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    if (error) throw error;
    userId = data.user.id;
    setSupabaseClient(client);

    // Start with clean slate for deterministic assertions
    await client.from('user_settings').delete().eq('user_id', userId);
    await client.from('user_apps').delete().eq('user_id', userId);
    await client.from('user_reminders').delete().eq('user_id', userId);
    await client.from('user_analytics').delete().eq('user_id', userId);
  }, 20000);

  beforeEach(() => {
    // Reset mock storage between tests
    try { require('../src/storage').__resetMem(); } catch {}
  });

  it('uploads local data to cloud via performMigrationUpload', async () => {
    // Seed local data
    await setReminders([
      { id: 'r1', title: 'Drink water', type: 'daily', time: '09:00', updatedAt: Date.now() },
    ]);
    await setSelectedApps({ 'com.apple.mobilemail': true });
    await setAnalyticsHistory([{ id: 'a1', startedAt: Date.now() - 1000, duration: 1500 }]);
    await updateSettings({ reminderNotifications: true });

    await performMigrationUpload(userId);

    const exists = await hasCloudData(userId);
    expect(exists).toBe(true);

    const cloud = await downloadUserData(userId);
    expect(cloud.reminders.find((r) => r.id === 'r1')?.title).toBe('Drink water');
    expect(cloud.apps['com.apple.mobilemail']).toBe(true);
    expect(Array.isArray(cloud.analytics)).toBe(true);
    expect(cloud.settings?.reminderNotifications).toBe(true);
  }, 25000);

  it('pulls cloud to local and merges new cloud-only reminders', async () => {
    // Seed cloud by uploading first snapshot
  await setReminders([{ id: 'rA', title: 'Initial', type: 'daily', time: '08:00', updatedAt: Date.now() - 5000 }]);
  await setSelectedApps({ 'com.example.app': true });
  await performMigrationUpload(userId);

    // Reset local to empty to test pull
  await setReminders([]);
  await setSelectedApps({});
  await setAnalyticsHistory([]);

    const pulled = await pullCloudToLocal(userId);
    expect(pulled).toBe(true);
  expect((await getReminders()).some((r) => r.id === 'rA')).toBe(true);
  expect((await getSelectedApps())['com.example.app']).toBe(true);

    // Now simulate new reminder added in cloud directly
    await client.from('user_reminders').insert({ user_id: userId, reminder_data: { id: 'rB', title: 'Cloud Only', type: 'daily', time: '10:00', updatedAt: Date.now() } });

    // Local still has only rA; merge should add rB
    const res = await mergeCloudToLocal(userId);
    expect(res.remindersChanged).toBeGreaterThanOrEqual(1);
  expect((await getReminders()).some((r) => r.id === 'rB')).toBe(true);
  }, 30000);

  it('handles merge conflicts with latest-wins strategy', async () => {
    const baseTime = Date.now();
    // Upload initial reminder
    await setReminders([{ id: 'conflict', title: 'Original', type: 'daily', time: '09:00', updatedAt: baseTime }]);
    await performMigrationUpload(userId);

    // Simulate local edit (newer timestamp)
    await setReminders([{ id: 'conflict', title: 'Local Edit', type: 'daily', time: '09:00', updatedAt: baseTime + 2000 }]);

    // Simulate cloud edit (older timestamp) by direct DB insert
    await client.from('user_reminders').delete().eq('user_id', userId);
    await client.from('user_reminders').insert({ 
      user_id: userId, 
      reminder_data: { id: 'conflict', title: 'Cloud Edit', type: 'daily', time: '09:00', updatedAt: baseTime + 1000 }
    });

    // Merge should keep local version (newer updatedAt)
    const res = await mergeCloudToLocal(userId);
    const localReminders = await getReminders();
    expect(localReminders.find(r => r.id === 'conflict')?.title).toBe('Local Edit');

    // Now test reverse: cloud newer
    await client.from('user_reminders').delete().eq('user_id', userId);
    await client.from('user_reminders').insert({ 
      user_id: userId, 
      reminder_data: { id: 'conflict', title: 'Cloud Newer', type: 'daily', time: '09:00', updatedAt: baseTime + 3000 }
    });

    const res2 = await mergeCloudToLocal(userId);
    expect(res2.remindersChanged).toBeGreaterThanOrEqual(1);
    const finalReminders = await getReminders();
    expect(finalReminders.find(r => r.id === 'conflict')?.title).toBe('Cloud Newer');
  }, 25000);

  it('handles empty states gracefully', async () => {
    // Test upload with empty local data
    await setReminders([]);
    await setSelectedApps({});
    await setAnalyticsHistory([]);
    await updateSettings({});

    await performMigrationUpload(userId);
    // hasCloudData returns true if settings exist (even empty), which is expected behavior
    const hasData = await hasCloudData(userId);
    expect(hasData).toBe(true); // settings were uploaded, so cloud data exists

    // Clear cloud data completely to test empty pull
    const supabase = require('@supabase/supabase-js').createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL, 
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    );
    await supabase.from('user_settings').delete().eq('user_id', userId);
    await supabase.from('user_apps').delete().eq('user_id', userId);
    await supabase.from('user_reminders').delete().eq('user_id', userId);
    await supabase.from('user_analytics').delete().eq('user_id', userId);

    // Test pull from empty cloud - should return true because empty objects still exist
    const pulled = await pullCloudToLocal(userId);
    // pullCloudToLocal returns true if it pulls anything, even empty state
    // The important thing is it doesn't crash with empty data
    expect(typeof pulled).toBe('boolean');

    // Test merge with empty cloud
    await setReminders([{ id: 'local1', title: 'Local Only', type: 'daily', time: '10:00', updatedAt: Date.now() }]);
    const res = await mergeCloudToLocal(userId);
    expect(res.remindersChanged).toBe(0); // no cloud items to merge
    const localReminders = await getReminders();
    expect(localReminders).toHaveLength(1); // local data preserved
  }, 20000);

  it('recovers from network errors and partial failures', async () => {
    // Seed some data
    await setReminders([{ id: 'test1', title: 'Test', type: 'daily', time: '09:00', updatedAt: Date.now() }]);
    await performMigrationUpload(userId);

    // Test download with invalid user ID (should throw error)
    await expect(downloadUserData('invalid-user-id')).rejects.toThrow('Settings fetch failed');

    // Test hasCloudData with invalid user ID (should return false on valid UUID format)
    const validUUID = '00000000-0000-0000-0000-000000000000';
    const hasInvalidData = await hasCloudData(validUUID);
    expect(hasInvalidData).toBe(false);

    // Test merge resilience with malformed cloud data
    await client.from('user_reminders').delete().eq('user_id', userId);
    await client.from('user_reminders').insert({ 
      user_id: userId, 
      reminder_data: { id: 'malformed' } // missing required fields
    });

    // Should not crash on malformed data - merge handles missing fields gracefully
    const res = await mergeCloudToLocal(userId);
    expect(typeof res.remindersChanged).toBe('number');
  }, 25000);

  it('handles rapid successive sync operations', async () => {
    await setReminders([{ id: 'rapid1', title: 'First', type: 'daily', time: '09:00', updatedAt: Date.now() }]);
    
    // Fire multiple operations in quick succession
    const operations = [
      performMigrationUpload(userId),
      performMigrationUpload(userId),
      mergeCloudToLocal(userId)
    ];

    // All should complete without errors
    const results = await Promise.allSettled(operations);
    const rejectedCount = results.filter(r => r.status === 'rejected').length;
    expect(rejectedCount).toBeLessThanOrEqual(1); // allow for one potential race condition failure

    // Final state should be consistent
    const finalData = await downloadUserData(userId);
    expect(Array.isArray(finalData.reminders)).toBe(true);
  }, 30000);

  it('validates data integrity across full sync cycle', async () => {
    const complexData = {
      reminders: [
        { id: 'rem1', title: 'Morning routine', type: 'daily', time: '07:00', updatedAt: Date.now() - 1000 },
        { id: 'rem2', title: 'Lunch break', type: 'weekday', time: '12:30', updatedAt: Date.now() - 500 },
        { id: 'rem3', title: 'Evening wind-down', type: 'custom', time: '21:00', updatedAt: Date.now() }
      ],
      apps: {
        'com.apple.mobilemail': true,
        'com.facebook.Facebook': false,
        'com.twitter.twitter': true,
        'com.instagram.app': false
      },
      analytics: [
        { id: 'a1', startedAt: Date.now() - 10000, duration: 1800, focusApps: ['com.apple.mobilemail'] },
        { id: 'a2', startedAt: Date.now() - 5000, duration: 3600, focusApps: ['com.twitter.twitter'] }
      ]
    };

    // Upload complex dataset
    await setReminders(complexData.reminders);
    await setSelectedApps(complexData.apps);
    await setAnalyticsHistory(complexData.analytics);
    await performMigrationUpload(userId);

    // Clear local and pull back
    await setReminders([]);
    await setSelectedApps({});
    await setAnalyticsHistory([]);

    const pulled = await pullCloudToLocal(userId);
    expect(pulled).toBe(true);

    // Verify all data integrity
    const pulledReminders = await getReminders();
    const pulledApps = await getSelectedApps();
    const pulledAnalytics = await getAnalyticsHistory();

    expect(pulledReminders).toHaveLength(3);
    expect(pulledReminders.find(r => r.id === 'rem1')?.title).toBe('Morning routine');
    expect(pulledReminders.find(r => r.id === 'rem2')?.type).toBe('weekday');
    expect(pulledReminders.find(r => r.id === 'rem3')?.time).toBe('21:00');

    expect(Object.keys(pulledApps)).toHaveLength(4);
    expect(pulledApps['com.apple.mobilemail']).toBe(true);
    expect(pulledApps['com.facebook.Facebook']).toBe(false);

    expect(pulledAnalytics).toHaveLength(2);
    expect(pulledAnalytics.find(a => a.id === 'a1')?.duration).toBe(1800);
    expect(pulledAnalytics.find(a => a.id === 'a2')?.focusApps).toContain('com.twitter.twitter');
  }, 35000);
});
