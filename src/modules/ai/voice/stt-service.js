// Speech-to-Text service with resilient dynamic import and runtime checks.
// If the native module isn't available (Expo Go, missing build, etc.),
// we expose isAvailable=false and fall back to typed input in the UI.

let RNVoice = null;
let interimTimer = null;
let lastText = '';
let startWatchdog = null;

async function loadVoiceModule() {
  if (RNVoice) return RNVoice;
  try {
    // Prefer dynamic import which plays nicer with Metro/Hermes
    const mod = await import('@react-native-voice/voice');
    RNVoice = mod?.default ?? mod;
  } catch (e) {
    try {
      // Fallback to guarded require for older bundlers
      // eslint-disable-next-line no-eval
      const req = eval('require');
      const m = req && req('@react-native-voice/voice');
      RNVoice = m?.default ?? m ?? null;
    } catch {}
  }
  return RNVoice;
}

export function isAvailable() {
  // Only report available if the module is loaded AND has a start function
  return !!(RNVoice && typeof RNVoice.start === 'function');
}

export async function ensureLoaded() {
  await loadVoiceModule();
  return isAvailable();
}

export async function start(onResult, onError) {
  const loaded = await ensureLoaded();
  if (!loaded) {
    onError?.(new Error('stt-unavailable'));
    return;
  }
  try {
    // CRITICAL: Always destroy previous session completely before starting new one
    await stop();
    
    // Clear any existing listeners
    if (RNVoice.removeAllListeners) {
      try { RNVoice.removeAllListeners(); } catch {}
    }
    
    // Reset module state
    lastText = '';
    if (interimTimer) { 
      try { clearTimeout(interimTimer); } catch {} 
      interimTimer = null; 
    }
    
    // Set up fresh listeners for this session
    let didStart = false;
    RNVoice.onSpeechStart = () => { didStart = true; };
    RNVoice.onSpeechPartialResults = (e) => {
      const text = (e?.value && e.value[0]) || '';
      if (!text) return;
      lastText = text;
      // Debounce partials: only emit if stable for 600ms
      if (interimTimer) clearTimeout(interimTimer);
      interimTimer = setTimeout(() => {
        onResult?.(lastText, { final: false });
      }, 600);
    };
    
    RNVoice.onSpeechResults = (e) => {
      const text = (e?.value && e.value[0]) || '';
      if (interimTimer) { 
        try { clearTimeout(interimTimer); } catch {} 
        interimTimer = null; 
      }
      if (text) onResult?.(text, { final: true });
    };
    
    RNVoice.onSpeechEnd = () => {
      if (interimTimer) { 
        try { clearTimeout(interimTimer); } catch {} 
        interimTimer = null; 
      }
    };
    
    RNVoice.onSpeechError = (e) => {
      if (interimTimer) { 
        try { clearTimeout(interimTimer); } catch {} 
        interimTimer = null; 
      }
      onError?.(new Error(e?.error?.message || 'stt-error'));
    };

    // iOS will prompt for mic/speech permissions the first time start() is invoked
    await RNVoice.start?.('en-US');
    // Watchdog: if engine doesn't report start within 1200ms, treat as failure
    startWatchdog = setTimeout(async () => {
      if (!didStart) {
        try { await RNVoice.cancel?.(); } catch {}
        try { await RNVoice.destroy?.(); } catch {}
        onError?.(new Error('stt-not-started'));
      }
    }, 1200);
  } catch (e) {
    onError?.(e);
  }
}

export async function stop() {
  if (!RNVoice) return;

  // Clear timers
  if (interimTimer) { try { clearTimeout(interimTimer); } catch {} interimTimer = null; }
  if (startWatchdog) { try { clearTimeout(startWatchdog); } catch {} startWatchdog = null; }

  // Attempt graceful stop, then cancel/destroy to fully reset audio session
  try { await RNVoice.stop?.(); } catch {}
  try { await RNVoice.cancel?.(); } catch {}
  try { await RNVoice.destroy?.(); } catch {}

  // Clear listeners to prevent stale callbacks
  try { RNVoice.removeAllListeners?.(); } catch {}

  // Reset state
  lastText = '';
}
