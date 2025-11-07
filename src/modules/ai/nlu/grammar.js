// Simple grammar-based parser for voice commands
// Examples:
//  - block tiktok for 30 minutes
//  - block social for 45m
//  - block youtube for 1h30
//  - start focus for 25 minutes

/**
 * Calculate confidence score based on match quality
 * @param {Object} parsed - Parsed command
 * @param {string} originalText - Original user input
 * @returns {number} Confidence score 0-1
 */
function calculateConfidence(parsed, originalText) {
  if (!parsed) return 0;
  
  let score = 0.4; // Base score for valid parse (lowered to allow bonuses to matter more)
  
  // Strong action match
  if (parsed.action && /^(block|start|stop)$/i.test(parsed.action)) {
    score += 0.25; // Increased bonus for clear action
  }
  
  // Has explicit duration
  if (parsed.durationText && parsed.durationText.length > 0) {
    score += 0.2; // Increased bonus for duration
  }
  
  // Has clear target
  if (parsed.targetText && parsed.targetText.length > 2) {
    score += 0.15;
  }
  
  // Bonus for complete, natural commands
  if (parsed.action && parsed.targetText && parsed.durationText) {
    score += 0.1; // Bonus for having all components
  }
  
  // Penalize if too short or ambiguous
  if (originalText.length < 10) {
    score -= 0.15;
  }
  
  // Penalize if contains question words (user might be asking, not commanding)
  if (/\b(what|how|why|when|which|should|can|could)\b/i.test(originalText)) {
    score -= 0.2;
  }
  
  return Math.max(0, Math.min(1, score));
}

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

  const parsed = { action, targetText, durationText };
  const confidence = calculateConfidence(parsed, text);

  return { ...parsed, confidence };
}
