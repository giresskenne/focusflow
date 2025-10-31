// A resilient countdown hook that derives remaining time from a fixed endAt timestamp.
// This avoids drift and UI pauses when the app goes to background, since it always
// recomputes from Date.now rather than relying on incremental timers.

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * useSessionCountdown
 * @param {number} endAtMs - absolute epoch ms when the session should end
 * @param {number} totalSeconds - total planned seconds of the session (for progress)
 * @param {number} [tickMs=1000] - update interval
 * @returns {{ seconds: number, progress: number }}
 */
export default function useSessionCountdown(endAtMs, totalSeconds, tickMs = 1000) {
  const computeRemaining = () => {
    if (!endAtMs) return 0;
    const now = Date.now();
    const remainingMs = Math.max(0, endAtMs - now);
    return Math.ceil(remainingMs / 1000);
  };

  const [seconds, setSeconds] = useState(computeRemaining());
  const timerRef = useRef(null);

  useEffect(() => {
    // Recompute immediately when endAt changes
    setSeconds(computeRemaining());

    if (timerRef.current) clearInterval(timerRef.current);
    if (!endAtMs) return;

    timerRef.current = setInterval(() => {
      setSeconds(computeRemaining());
    }, Math.max(250, tickMs));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [endAtMs, tickMs]);

  const progress = useMemo(() => {
    if (!totalSeconds || totalSeconds <= 0) return 0;
    return Math.max(0, Math.min(100, (seconds / totalSeconds) * 100));
  }, [seconds, totalSeconds]);

  return { seconds, progress };
}
