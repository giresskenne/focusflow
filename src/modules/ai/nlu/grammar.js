// Simple grammar-based parser for voice commands
// Examples:
//  - block tiktok for 30 minutes
//  - block social for 45m
//  - block youtube for 1h30
//  - start focus for 25 minutes

export function parseCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.trim().toLowerCase();

  // Core pattern: action target for duration
  // action: block|start|stop
  const re = /\b(block|start|stop)\b\s+([^\n]+?)(?:\s+for\s+([^\n]+))?$/i;
  const m = s.match(re);
  if (!m) return null;

  const action = m[1];
  const targetText = (m[2] || '').trim();
  const durationText = (m[3] || '').trim();

  return { action, targetText, durationText };
}
