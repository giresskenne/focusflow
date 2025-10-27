// Utilities to compute analytics metrics from session history

// history item shape:
// { id, startAt, endAt, durationSeconds, endedEarly, apps: string[] }

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeWeekBuckets(history = []) {
  // Returns 7 buckets (Mon..Sun) of total focus minutes for the current week
  const now = new Date();
  const day = now.getDay(); // 0..6 (Sun..Sat)
  // Compute Monday as index 0
  const diffToMonday = (day + 6) % 7; // days since Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const weekStart = monday.getTime();
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  const buckets = Array(7).fill(0);
  history.forEach((r) => {
    if (!r?.endAt || !r?.durationSeconds) return;
    if (r.endAt < weekStart || r.startAt >= weekEnd) return;
    const index = ((new Date(r.endAt).getDay() + 6) % 7); // map Sun->6
    buckets[index] += Math.max(0, r.durationSeconds) / 60; // minutes
  });
  return buckets.map((m) => Math.round(m));
}

export function computePreviousWeekBuckets(history = []) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday - 7);
  monday.setHours(0, 0, 0, 0);
  const weekStart = monday.getTime();
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  const buckets = Array(7).fill(0);
  history.forEach((r) => {
    if (!r?.endAt || !r?.durationSeconds) return;
    if (r.endAt < weekStart || r.startAt >= weekEnd) return;
    const index = ((new Date(r.endAt).getDay() + 6) % 7);
    buckets[index] += Math.max(0, r.durationSeconds) / 60;
  });
  return buckets.map((m) => Math.round(m));
}

export function computeSummary(history = []) {
  const totalSessions = history.length;
  const totalFocusSeconds = history.reduce((acc, r) => acc + Math.max(0, r.durationSeconds || 0), 0);
  const avgSessionSeconds = totalSessions ? Math.round(totalFocusSeconds / totalSessions) : 0;

  // Streak: consecutive days with at least one session ending today-? going back
  const byDay = new Map();
  history.forEach((r) => {
    const d = startOfDay(r.endAt || r.startAt);
    byDay.set(d, (byDay.get(d) || 0) + 1);
  });
  const days = Array.from(byDay.keys()).sort((a, b) => a - b);
  let best = 0, cur = 0, prev = null;
  days.forEach((d) => {
    if (prev === null || d === prev + 24 * 60 * 60 * 1000) cur += 1; else cur = 1;
    if (cur > best) best = cur;
    prev = d;
  });
  const bestStreakDays = best;

  // Weekly change vs last week
  const thisWeek = computeWeekBuckets(history).reduce((a, b) => a + b, 0);
  const prevWeek = computePreviousWeekBuckets(history).reduce((a, b) => a + b, 0);
  const changeVsLastWeekPercent = prevWeek === 0 ? (thisWeek > 0 ? 100 : 0) : Math.round(((thisWeek - prevWeek) / prevWeek) * 100);

  // Most productive day (max bucket)
  const week = computeWeekBuckets(history);
  let productiveDayIndex = 0, max = -1;
  week.forEach((v, i) => { if (v > max) { max = v; productiveDayIndex = i; } });

  return { totalSessions, totalFocusSeconds, avgSessionSeconds, bestStreakDays, changeVsLastWeekPercent, productiveDayIndex, weekBuckets: week };
}

export function computeMostBlockedApps(history = [], top = 3) {
  const counts = new Map();
  history.forEach((r) => {
    (r.apps || []).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  });
  const arr = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, top);
  return arr.map(([id, count]) => ({ id, label: prettifyAppId(id), count }));
}

function prettifyAppId(id) {
  if (!id) return 'Unknown';
  // Heuristic: last segment or known aliases
  const aliases = {
    'com.social.app': 'Instagram',
    'com.video.stream': 'YouTube',
    'com.games.arcade': 'Arcade Games',
    'com.shop.mall': 'Shopping',
  };
  if (aliases[id]) return aliases[id];
  const parts = id.split('.');
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export function formatHrsMins(seconds) {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return { h, m: mm };
}

export const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function computeMonthBuckets(history = []) {
  // Returns 30 days of focus minutes (last 30 days from today)
  const now = new Date();
  const buckets = Array(30).fill(0);
  
  history.forEach((r) => {
    if (!r?.endAt || !r?.durationSeconds) return;
    const daysAgo = Math.floor((now.getTime() - r.endAt) / (24 * 60 * 60 * 1000));
    if (daysAgo >= 0 && daysAgo < 30) {
      const index = 29 - daysAgo; // most recent is at index 29
      buckets[index] += Math.max(0, r.durationSeconds) / 60; // minutes
    }
  });
  
  return buckets.map(m => Math.round(m));
}

export function computeHourlyPatterns(history = []) {
  // Returns 24 buckets (0-23 hours) showing when user is most productive
  const buckets = Array(24).fill(0);
  
  history.forEach((r) => {
    if (!r?.startAt || !r?.durationSeconds) return;
    const hour = new Date(r.startAt).getHours();
    buckets[hour] += Math.max(0, r.durationSeconds) / 60; // minutes
  });
  
  return buckets.map(m => Math.round(m));
}

export function computeTimeSpentOnApps(history = []) {
  // Calculate total time "saved" by blocking each app
  const appTimes = new Map();
  
  history.forEach((r) => {
    if (!r?.apps || !r?.durationSeconds) return;
    const timePerApp = r.durationSeconds / r.apps.length; // distribute time evenly
    r.apps.forEach((appId) => {
      appTimes.set(appId, (appTimes.get(appId) || 0) + timePerApp);
    });
  });
  
  return Array.from(appTimes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([appId, seconds]) => ({
      id: appId,
      label: prettifyAppId(appId),
      timeSeconds: seconds,
      timeFormatted: formatHrsMins(seconds)
    }));
}

export function computeProductivityScore(history = [], targetDailyMinutes = 60) {
  // Calculate a 0-100 productivity score based on consistency and target achievement
  const last7Days = history.filter(r => {
    const daysAgo = (Date.now() - (r.endAt || r.startAt)) / (24 * 60 * 60 * 1000);
    return daysAgo <= 7;
  });
  
  const dailyMinutes = Array(7).fill(0);
  last7Days.forEach(r => {
    const daysAgo = Math.floor((Date.now() - (r.endAt || r.startAt)) / (24 * 60 * 60 * 1000));
    if (daysAgo >= 0 && daysAgo < 7) {
      dailyMinutes[6 - daysAgo] += (r.durationSeconds || 0) / 60;
    }
  });
  
  // Score based on: average achievement + consistency bonus
  const avgAchievement = dailyMinutes.reduce((a, b) => a + b, 0) / 7;
  const achievementScore = Math.min(100, (avgAchievement / targetDailyMinutes) * 70); // max 70 points
  
  // Consistency bonus: days with at least some focus time
  const activeDays = dailyMinutes.filter(m => m > 0).length;
  const consistencyScore = (activeDays / 7) * 30; // max 30 points
  
  return Math.round(achievementScore + consistencyScore);
}
