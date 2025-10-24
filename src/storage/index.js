import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  selectedApps: 'ff:selectedApps',
  reminders: 'ff:reminders',
  session: 'ff:session',
  premium: 'ff:premium',
  analytics: 'ff:analytics', // array of session records
  settings: 'ff:settings', // user preferences
  authUser: 'ff:authUser', // cached auth user (supabase)
  migrationFlagPrefix: 'ff:migrated:', // ff:migrated:<userId>
  lastSyncAt: 'ff:lastSyncAt',
};

export async function getSelectedApps() {
  const raw = await AsyncStorage.getItem(KEYS.selectedApps);
  return raw ? JSON.parse(raw) : {};
}

export async function setSelectedApps(map) {
  await AsyncStorage.setItem(KEYS.selectedApps, JSON.stringify(map));
}

export async function getReminders() {
  const raw = await AsyncStorage.getItem(KEYS.reminders);
  return raw ? JSON.parse(raw) : [];
}

export async function setReminders(list) {
  await AsyncStorage.setItem(KEYS.reminders, JSON.stringify(list));
}

export async function getSession() {
  const raw = await AsyncStorage.getItem(KEYS.session);
  return raw ? JSON.parse(raw) : { active: false, endAt: null, totalSeconds: null };
}

export async function setSession(session) {
  await AsyncStorage.setItem(KEYS.session, JSON.stringify(session));
}

export async function getPremiumStatus() {
  const raw = await AsyncStorage.getItem(KEYS.premium);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    // Backward compatibility: previously stored as { isPremium: boolean }
    if (typeof parsed === 'boolean') return parsed;
    if (parsed && typeof parsed.isPremium === 'boolean') return parsed.isPremium;
    return false;
  } catch {
    return false;
  }
}

export async function setPremiumStatus(isPremium) {
  // Store as a simple boolean going forward
  await AsyncStorage.setItem(KEYS.premium, JSON.stringify(!!isPremium));
}

// ---- Analytics History ----
// Shape: {
//   id: string,
//   startAt: number, // ms
//   endAt: number,   // ms
//   durationSeconds: number,
//   endedEarly: boolean,
//   apps: string[],  // selected app ids for this session
// }
export async function getAnalyticsHistory() {
  const raw = await AsyncStorage.getItem(KEYS.analytics);
  return raw ? JSON.parse(raw) : [];
}

export async function appendSessionRecord(record) {
  const list = await getAnalyticsHistory();
  const next = [record, ...list].slice(0, 500); // cap to 500 recent sessions
  await AsyncStorage.setItem(KEYS.analytics, JSON.stringify(next));
}

export async function setAnalyticsHistory(list) {
  await AsyncStorage.setItem(KEYS.analytics, JSON.stringify(Array.isArray(list) ? list : []));
}

// ---- Settings ----
export async function getSettings() {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  return raw ? JSON.parse(raw) : {
    reminderNotifications: true,
    sessionNotifications: true,
    motivationMessages: false,
    analytics: false,
  };
}

export async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(updated));
  return updated;
}

// ---- Auth (cached user info for UI) ----
export async function getAuthUser() {
  const raw = await AsyncStorage.getItem(KEYS.authUser);
  return raw ? JSON.parse(raw) : null;
}

export async function setAuthUser(user) {
  if (!user) {
    await AsyncStorage.removeItem(KEYS.authUser);
  } else {
    await AsyncStorage.setItem(KEYS.authUser, JSON.stringify({ id: user.id, email: user.email }));
  }
}

export async function clearAuthUser() {
  await AsyncStorage.removeItem(KEYS.authUser);
}

// ---- Migration helpers (guest -> auth) ----
export async function getMigrationFlag(userId) {
  if (!userId) return false;
  const raw = await AsyncStorage.getItem(KEYS.migrationFlagPrefix + userId);
  return raw === 'true';
}

export async function setMigrationFlag(userId, value) {
  if (!userId) return;
  await AsyncStorage.setItem(KEYS.migrationFlagPrefix + userId, value ? 'true' : 'false');
}

export async function hasLocalData() {
  const [appsRaw, remindersRaw, analyticsRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.selectedApps),
    AsyncStorage.getItem(KEYS.reminders),
    AsyncStorage.getItem(KEYS.analytics),
  ]);
  const apps = appsRaw ? JSON.parse(appsRaw) : {};
  const reminders = remindersRaw ? JSON.parse(remindersRaw) : [];
  const analytics = analyticsRaw ? JSON.parse(analyticsRaw) : [];
  return (Object.keys(apps || {}).length > 0) || (reminders || []).length > 0 || (analytics || []).length > 0;
}

// ---- Data management helpers ----
export async function exportUserData() {
  const [apps, reminders, analytics, settings] = await Promise.all([
    getSelectedApps(),
    getReminders(),
    getAnalyticsHistory(),
    getSettings(),
  ]);
  return { apps, reminders, analytics, settings, exportedAt: Date.now() };
}

export async function clearUserData() {
  // Clear only user content data; leave premium/auth flags intact
  await AsyncStorage.multiRemove([
    KEYS.selectedApps,
    KEYS.reminders,
    KEYS.analytics,
    KEYS.settings,
  ]);
}

// ---- Sync metadata ----
export async function getLastSyncAt() {
  const raw = await AsyncStorage.getItem(KEYS.lastSyncAt);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function setLastSyncAt(ts) {
  const v = typeof ts === 'number' ? String(ts) : String(Date.now());
  await AsyncStorage.setItem(KEYS.lastSyncAt, v);
}
