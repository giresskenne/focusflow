export function formatSeconds(total) {
  const safe = Math.max(0, Math.floor(total || 0));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return { minutes: m, seconds: s };
}

