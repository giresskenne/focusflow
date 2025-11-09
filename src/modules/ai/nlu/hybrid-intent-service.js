// Hybrid intent service: local-first with cloud fallback
// Tries local regex parsing first, falls back to cloud AI only for ambiguous commands

import { parseIntent as parseLocalIntent } from './intent-parser';
import { parseIntentWithAI, isAIParserAvailable } from './ai-intent-parser';
import { getRemainingCloudCalls, incrementCloudUsage } from '../usage-tracker';

function getEnv(name, fallback) {
  const v = process.env[name] ?? process.env[`EXPO_PUBLIC_${name}`];
  return v !== undefined ? v : fallback;
}

// Configuration
const HYBRID_MODE = getEnv('AI_HYBRID_MODE', 'true') === 'true';
const CONFIDENCE_THRESHOLD = parseFloat(getEnv('AI_CONFIDENCE_THRESHOLD', '0.7'));
const CLOUD_FALLBACK_ENABLED = getEnv('AI_CLOUD_FALLBACK_ENABLED', 'true') === 'true';
const AI_INTENTS_ENABLED = getEnv('AI_INTENTS_ENABLED', 'false') === 'true';

// Telemetry tracking
let telemetry = {
  totalParses: 0,
  localSuccess: 0,
  cloudFallback: 0,
  cloudSuccess: 0,
  avgLocalTime: 0,
  avgCloudTime: 0,
  avgResponseTime: 0, // End-to-end: stop speaking → AI reply
  confidenceDistribution: {
    high: 0,    // >= 0.8
    medium: 0,  // 0.5-0.8
    low: 0,     // < 0.5
  },
};

/**
 * Parse intent using hybrid approach
 * @param {string} text - User utterance
 * @param {Object} options - Parse options
 * @returns {Promise<Object>} Parsed intent with metadata
 */
export async function parseIntentHybrid(text, options = {}) {
  const startTime = Date.now();
  telemetry.totalParses++;

  // Step 1: Try local parsing first (always fast, always works)
  const localStart = Date.now();
  const localResult = await parseLocalIntent(text, options);
  const localTime = Date.now() - localStart;

  // Update average local time
  telemetry.avgLocalTime = (telemetry.avgLocalTime * (telemetry.totalParses - 1) + localTime) / telemetry.totalParses;

  // If local parsing failed completely, try cloud if available
  if (!localResult || !localResult.action) {
    if (CLOUD_FALLBACK_ENABLED && AI_INTENTS_ENABLED && isAIParserAvailable()) {
      return await tryCloudFallback(text, options, null);
    }
    return null;
  }

  // Extract confidence from local result (default to medium if not present)
  const confidence = localResult.confidence ?? 0.6;

  // Track confidence distribution
  if (confidence >= 0.8) telemetry.confidenceDistribution.high++;
  else if (confidence >= 0.5) telemetry.confidenceDistribution.medium++;
  else telemetry.confidenceDistribution.low++;

  // Step 2: Check if confidence meets threshold
  if (!HYBRID_MODE || confidence >= CONFIDENCE_THRESHOLD) {
    // High confidence → use local result
    telemetry.localSuccess++;
    return {
      ...localResult,
      metadata: {
        source: 'local',
        confidence,
        parseTime: localTime,
      },
    };
  }

  // Step 3: Low confidence → try cloud fallback if enabled
  if (CLOUD_FALLBACK_ENABLED && AI_INTENTS_ENABLED && isAIParserAvailable()) {
    return await tryCloudFallback(text, options, localResult);
  }

  // Cloud disabled → use local result anyway
  telemetry.localSuccess++;
  return {
    ...localResult,
    metadata: {
      source: 'local',
      confidence,
      parseTime: localTime,
      note: 'low-confidence-no-cloud',
    },
  };
}

/**
 * Try cloud AI fallback for ambiguous commands
 * @param {string} text - User utterance
 * @param {Object} options - Parse options
 * @param {Object} localResult - Local parse result (for fallback)
 * @returns {Promise<Object>} Cloud or local result
 */
async function tryCloudFallback(text, options, localResult) {
  telemetry.cloudFallback++;
  
  // Check usage limits before making cloud call
  try {
    const usage = await getRemainingCloudCalls();
    
    if (!usage.canUse) {
      console.log('[HybridIntent] Daily cloud limit reached, using local result');
      
      if (__DEV__) {
        console.log(`[Telemetry] Free user hit AI limit (${usage.used}/${usage.limit})`);
      }
      
      // Return local result if available, otherwise null
      if (localResult) {
        return {
          ...localResult,
          metadata: {
            source: 'local',
            confidence: localResult.confidence ?? 0.5,
            parseTime: 0,
            note: 'cloud-limit-reached',
          },
        };
      }
      
      return {
        action: null,
        error: 'You\'ve reached your daily AI limit. Upgrade to Premium for unlimited AI commands.',
        metadata: {
          source: 'none',
          confidence: 0,
          note: 'limit-reached-no-local-fallback',
        },
      };
    }
  } catch (error) {
    console.error('[HybridIntent] Failed to check usage limits:', error);
    // Continue with cloud call on error (fail open for premium users)
  }
  
  const cloudStart = Date.now();
  try {
    const cloudResult = await parseIntentWithAI(text);
    const cloudTime = Date.now() - cloudStart;

    // Increment usage counter after successful cloud call
    try {
      await incrementCloudUsage();
      if (__DEV__) {
        const newUsage = await getRemainingCloudCalls();
        console.log(`[HybridIntent] Cloud call used (${newUsage.used}/${newUsage.limit || '∞'} today)`);
      }
    } catch (usageError) {
      console.error('[HybridIntent] Failed to increment usage:', usageError);
    }

    // Update average cloud time
    telemetry.avgCloudTime = (telemetry.avgCloudTime * (telemetry.cloudFallback - 1) + cloudTime) / telemetry.cloudFallback;

    if (cloudResult && cloudResult.action) {
      telemetry.cloudSuccess++;
      return {
        ...cloudResult,
        metadata: {
          source: 'cloud',
          confidence: 0.9, // Cloud results assumed high confidence
          parseTime: cloudTime,
          localFallback: localResult ? 'available' : 'unavailable',
        },
      };
    }
  } catch (error) {
    console.warn('[HybridIntent] Cloud fallback failed:', error?.message);
  }

  // Cloud failed → fall back to local result (if available)
  if (localResult) {
    return {
      ...localResult,
      metadata: {
        source: 'local',
        confidence: localResult.confidence ?? 0.5,
        parseTime: Date.now() - cloudStart,
        note: 'cloud-failed-using-local',
      },
    };
  }

  return null;
}

/**
 * Track end-to-end response time (stop speaking → AI reply)
 * @param {number} responseTime - Time in milliseconds
 */
export function trackResponseTime(responseTime) {
  if (!responseTime || responseTime < 0) return;
  
  const count = telemetry.totalParses || 1;
  telemetry.avgResponseTime = (telemetry.avgResponseTime * (count - 1) + responseTime) / count;
}

/**
 * Get telemetry data (for debugging/analytics)
 * @returns {Object} Telemetry stats
 */
export function getTelemetry() {
  const localRate = telemetry.totalParses > 0 
    ? (telemetry.localSuccess / telemetry.totalParses * 100).toFixed(1)
    : 0;
  const cloudRate = telemetry.totalParses > 0
    ? (telemetry.cloudSuccess / telemetry.totalParses * 100).toFixed(1)
    : 0;
  const fallbackRate = telemetry.totalParses > 0
    ? (telemetry.cloudFallback / telemetry.totalParses * 100).toFixed(1)
    : 0;

  return {
    ...telemetry,
    rates: {
      local: `${localRate}%`,
      cloud: `${cloudRate}%`,
      fallback: `${fallbackRate}%`,
    },
    config: {
      hybridMode: HYBRID_MODE,
      threshold: CONFIDENCE_THRESHOLD,
      cloudEnabled: CLOUD_FALLBACK_ENABLED,
    },
  };
}

/**
 * Reset telemetry (for testing)
 */
export function resetTelemetry() {
  telemetry = {
    totalParses: 0,
    localSuccess: 0,
    cloudFallback: 0,
    cloudSuccess: 0,
    avgLocalTime: 0,
    avgCloudTime: 0,
    avgResponseTime: 0,
    confidenceDistribution: {
      high: 0,
      medium: 0,
      low: 0,
    },
  };
}
