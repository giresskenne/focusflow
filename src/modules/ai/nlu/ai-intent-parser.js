/**
 * AI-powered intent parser using OpenAI (or compatible API)
 * Replaces regex-based parsing with real NLU
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.EXPO_PUBLIC_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.EXPO_PUBLIC_AI_INTENT_MODEL || process.env.AI_INTENT_MODEL || 'gpt-4o-mini';
const AI_TEMP = parseFloat(process.env.EXPO_PUBLIC_AI_TEMPERATURE || process.env.AI_TEMPERATURE || '0.2');

const SYSTEM_PROMPT = `You are an intent parser for a focus/distraction blocking app.
Parse user commands into structured intents.

Actions:
- "block" or "start": Block distracting apps/categories
- "stop" or "end": Stop current blocking session

Targets (aliases user has configured):
- User will say things like "social", "test", "entertainment", "news", etc.
- These map to pre-configured app bundles

Duration:
- Parse natural time expressions: "2 minutes", "30 min", "1 hour", "half an hour"
- Convert to integer minutes
- If no duration given for block commands, return 0 (caller will prompt)

Examples:
"Block social for 30 minutes" → {action: "block", target: "social", durationMinutes: 30}
"Start test" → {action: "block", target: "test", durationMinutes: 0}
"Block TikTok for 2 hours" → {action: "block", target: "tiktok", durationMinutes: 120}
"Stop blocking" → {action: "stop", target: "", durationMinutes: 0}

Return JSON only. If you can't parse it, return null.`;

let cachedFetch = null;
async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  // Use global fetch or React Native fetch
  const f = cachedFetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error('fetch not available');
  cachedFetch = f;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await f(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Call OpenAI (or compatible) to parse intent
 */
export async function parseIntentWithAI(text) {
  if (!OPENAI_API_KEY || !text?.trim()) return null;

  try {
    const payload = {
      model: AI_MODEL,
      temperature: AI_TEMP,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.trim() }
      ],
      response_format: { type: 'json_object' }, // request JSON mode if supported
    };

    const res = await fetchWithTimeout(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    }, 10000);

    if (!res.ok) {
      console.warn('[AI Parser] API error:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    if (!content) return null;

    const parsed = JSON.parse(content);
    // Expected shape: { action, target, durationMinutes }
    if (!parsed || !parsed.action) return null;

    // Normalize action
    let action = String(parsed.action).toLowerCase();
    if (action === 'start') action = 'block';
    if (action !== 'block' && action !== 'stop') action = 'block';

    return {
      action,
      targetType: 'alias', // always alias for now (user-defined bundles)
      target: String(parsed.target || '').trim(),
      durationMinutes: parseInt(parsed.durationMinutes, 10) || 0,
    };
  } catch (e) {
    console.warn('[AI Parser] Failed to parse intent:', e?.message);
    return null;
  }
}

/**
 * Check if AI parsing is available (API key configured)
 */
export function isAIParserAvailable() {
  return !!OPENAI_API_KEY;
}
