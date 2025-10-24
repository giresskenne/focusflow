import { getSupabase } from './supabase';
import {
  getReminders,
  getSelectedApps,
  getAnalyticsHistory,
  getSettings,
  setReminders,
  setSelectedApps,
  setAnalyticsHistory,
  updateSettings,
} from '../storage';
import { setLastSyncAt } from '../storage';

// Upload local guest data to Supabase for the authenticated user.
// Contract:
// - input: userId (string)
// - behavior: replaces existing cloud data for this user with local copies
// - error modes: throws on network/config/table errors; caller should handle and surface
export async function performMigrationUpload(userId) {
  if (!userId) throw new Error('Missing userId');

  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  // Load local data in parallel
  const [reminders, apps, analytics, settings] = await Promise.all([
    getReminders(),
    getSelectedApps(),
    getAnalyticsHistory(),
    getSettings(),
  ]);

  // Start uploads. We use a simple replace strategy for v1:
  // - delete existing per-user rows in list tables, then insert local data
  // - upsert single-row tables by user_id (settings)
  // This keeps logic simple and deterministic for first migration.
  // If tables are missing, Supabase will return an error which we surface.

  // Settings: upsert by user_id primary key
  if (settings) {
    const { error: settingsErr } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, settings_data: settings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (settingsErr) throw new Error(`Settings upload failed: ${settingsErr.message}`);
  }

  // App selections: store a single row per user
  {
    const { error: delAppsErr } = await supabase.from('user_apps').delete().eq('user_id', userId);
    if (delAppsErr && delAppsErr.code !== 'PGRST116') { // ignore no rows deleted
      throw new Error(`Apps cleanup failed: ${delAppsErr.message}`);
    }
    const { error: insAppsErr } = await supabase.from('user_apps').insert({ user_id: userId, app_data: apps, updated_at: new Date().toISOString() });
    if (insAppsErr) throw new Error(`Apps upload failed: ${insAppsErr.message}`);
  }

  // Reminders: delete then bulk insert
  {
    const { error: delRemErr } = await supabase.from('user_reminders').delete().eq('user_id', userId);
    if (delRemErr && delRemErr.code !== 'PGRST116') {
      throw new Error(`Reminders cleanup failed: ${delRemErr.message}`);
    }
    const reminderRows = (reminders || []).map((r) => ({ user_id: userId, reminder_data: r }));
    if (reminderRows.length > 0) {
      const { error: insRemErr } = await supabase.from('user_reminders').insert(reminderRows);
      if (insRemErr) throw new Error(`Reminders upload failed: ${insRemErr.message}`);
    }
  }

  // Analytics: delete then bulk insert (cap to recent 200 to keep payload small)
  {
    const { error: delAnErr } = await supabase.from('user_analytics').delete().eq('user_id', userId);
    if (delAnErr && delAnErr.code !== 'PGRST116') {
      throw new Error(`Analytics cleanup failed: ${delAnErr.message}`);
    }
    const slice = (analytics || []).slice(0, 200);
    const analyticsRows = slice.map((a) => ({ user_id: userId, session_data: a }));
    if (analyticsRows.length > 0) {
      const { error: insAnErr } = await supabase.from('user_analytics').insert(analyticsRows);
      if (insAnErr) throw new Error(`Analytics upload failed: ${insAnErr.message}`);
    }
  }

  return true;
}

// Download user data from Supabase (read-only). Returns normalized shape.
export async function downloadUserData(userId) {
  if (!userId) throw new Error('Missing userId');
  const supabase = getSupabase();

  const [settingsRes, appsRes, remRes, anRes] = await Promise.all([
    supabase.from('user_settings').select('settings_data').eq('user_id', userId).maybeSingle(),
    supabase.from('user_apps').select('app_data, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('user_reminders').select('reminder_data, created_at').eq('user_id', userId),
    supabase.from('user_analytics').select('session_data, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
  ]);

  const throwIf = (res, label) => { if (res.error) throw new Error(`${label}: ${res.error.message}`); };
  throwIf(settingsRes, 'Settings fetch failed');
  throwIf(appsRes, 'Apps fetch failed');
  throwIf(remRes, 'Reminders fetch failed');
  throwIf(anRes, 'Analytics fetch failed');

  const settings = settingsRes.data?.settings_data || null;
  const apps = appsRes.data?.app_data || {};
  const reminders = (remRes.data || []).map((r) => r.reminder_data);
  const analytics = (anRes.data || []).map((a) => a.session_data);

  return { settings, apps, reminders, analytics };
}

// Replace local data with cloud data (use when local is empty or user selected Replace).
export async function pullCloudToLocal(userId) {
  const { settings, apps, reminders, analytics } = await downloadUserData(userId);
  const hasAny = (
    (settings && Object.keys(settings).length > 0) ||
    (apps && Object.keys(apps).length > 0) ||
    (reminders && reminders.length > 0) ||
    (analytics && analytics.length > 0)
  );
  if (!hasAny) return false;
  // Write to local
  await Promise.all([
    setSelectedApps(apps || {}),
    setReminders(reminders || []),
    setAnalyticsHistory(analytics || []),
    settings ? updateSettings(settings) : Promise.resolve(),
  ]);
  return true;
}

// Lightweight presence check to see if any cloud data exists for the user
export async function hasCloudData(userId) {
  if (!userId) return false;
  const supabase = getSupabase();

  const [settingsRes, appsCount, remCount, anCount] = await Promise.all([
    supabase.from('user_settings').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('user_apps').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_reminders').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_analytics').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw new Error(settingsRes.error.message);
  if (appsCount.error) throw new Error(appsCount.error.message);
  if (remCount.error) throw new Error(remCount.error.message);
  if (anCount.error) throw new Error(anCount.error.message);

  const hasSettings = !!settingsRes.data;
  const hasApps = (appsCount.count || 0) > 0;
  const hasRem = (remCount.count || 0) > 0;
  const hasAn = (anCount.count || 0) > 0;
  return hasSettings || hasApps || hasRem || hasAn;
}

// Merge cloud data into local (latest-wins for reminders by updatedAt; analytics union).
// Returns an object with counts of merged items.
export async function mergeCloudToLocal(userId) {
  const cloud = await downloadUserData(userId);
  const localReminders = await getReminders();
  const localAnalytics = await getAnalyticsHistory();

  // Merge reminders by id using updatedAt (fallback 0)
  const byId = new Map();
  for (const r of Array.isArray(localReminders) ? localReminders : []) {
    byId.set(r.id, r);
  }
  let mergedReminders = Array.isArray(localReminders) ? [...localReminders] : [];
  let remindersChanged = 0;
  for (const cr of Array.isArray(cloud.reminders) ? cloud.reminders : []) {
    const existing = byId.get(cr.id);
    const a = existing?.updatedAt || 0;
    const b = cr?.updatedAt || 0;
    if (!existing) {
      mergedReminders.push(cr);
      remindersChanged++;
    } else if (b > a) {
      // replace with cloud version
      mergedReminders = mergedReminders.map((it) => (it.id === cr.id ? cr : it));
      remindersChanged++;
    }
  }

  // Analytics: union by id, prefer local order (newest first)
  const localIds = new Set((localAnalytics || []).map((a) => a.id));
  const newAnalytics = (cloud.analytics || []).filter((a) => a && !localIds.has(a.id));
  const mergedAnalytics = [...(localAnalytics || []), ...newAnalytics].slice(0, 500);

  // Apply writes
  await Promise.all([
    setReminders(mergedReminders),
    setAnalyticsHistory(mergedAnalytics),
  ]);
  await setLastSyncAt(Date.now());

  return { remindersChanged, analyticsAdded: newAnalytics.length };
}
