export function formatSeconds(total) {
  const safe = Math.max(0, Math.floor(total || 0));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return { minutes: m, seconds: s };
}


// --- AI Voice: duration parsing helpers ---
function toMinutes(n) {
  const v = typeof n === 'string' ? parseInt(n, 10) : n;
  return Number.isFinite(v) ? v : 0;
}

// Parse strings like "30m", "45 minutes", "1h30", "2 hours", "until 6pm" into minutes
export function parseDurationToMinutes(input) {
  if (!input || typeof input !== 'string') return 0;
  const s = input.trim().toLowerCase();

  // 1) 1h30 / 2h / 90m
  const hmin = s.match(/^(\d+)\s*h(?:\s*(\d+)\s*m(in(?:utes)?)?)?$/);
  if (hmin) {
    const h = toMinutes(hmin[1]);
    const m = toMinutes(hmin[2] || 0);
    return h * 60 + m;
  }
  const onlyMin = s.match(/^(\d+)\s*m(in(?:utes)?)?$/);
  if (onlyMin) return toMinutes(onlyMin[1]);
  const onlyHours = s.match(/^(\d+)\s*h(ours?)?$/);
  if (onlyHours) return toMinutes(onlyHours[1]) * 60;

  // 2) natural: 30 minutes, 2 hours
  const naturalMin = s.match(/(\d+)\s*min(ute)?s?/);
  const naturalHr = s.match(/(\d+)\s*h(our)?s?/);
  if (naturalMin || naturalHr) {
    const mins = naturalMin ? toMinutes(naturalMin[1]) : 0;
    const hrs = naturalHr ? toMinutes(naturalHr[1]) : 0;
    return hrs * 60 + mins;
  }

  // 3) until 6pm (today only)
  const until = s.match(/until\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (until) {
    const h = parseInt(until[1], 10);
    const m = until[2] ? parseInt(until[2], 10) : 0;
    const mer = until[3];
    const now = new Date();
    let hour24 = h;
    if (mer) {
      if (mer === 'pm' && hour24 < 12) hour24 += 12;
      if (mer === 'am' && hour24 === 12) hour24 = 0;
    }
    const end = new Date(now);
    end.setHours(hour24, m, 0, 0);
    if (end <= now) return 0;
    return Math.round((end - now) / 60000);
  }

  return 0;
}

export function formatMinutesToEndTime(minutes) {
  const end = new Date(Date.now() + Math.max(0, minutes) * 60000);
  const hh = end.getHours();
  const mm = end.getMinutes();
  const label = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
  return label;
}

