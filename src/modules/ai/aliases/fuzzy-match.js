// Lightweight fuzzy matcher (Levenshtein and simple score)

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function findClosest(input, candidates, minScore = 0.5) {
  if (!input || !Array.isArray(candidates) || candidates.length === 0) return null;
  const s = input.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const t = String(c).toLowerCase();
    if (t === s) return c;
    const dist = levenshtein(s, t);
    const maxLen = Math.max(s.length, t.length);
    const score = 1 - dist / Math.max(1, maxLen);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= minScore ? best : null;
}
