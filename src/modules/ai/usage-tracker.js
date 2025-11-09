/**
 * AI Usage Tracker
 * 
 * Tracks daily AI cloud call usage for free tier limits.
 * Free users: 5 cloud calls per day
 * Premium users: unlimited
 * 
 * Resets daily at midnight.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyVoiceLimit } from '../../lib/permissions/premium-gates';

const USAGE_KEY = '@focusflow_ai_usage';

/**
 * Get today's usage data
 * @returns {Promise<{date: string, count: number}>}
 */
export async function getUsageToday() {
  try {
    const stored = await AsyncStorage.getItem(USAGE_KEY);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!stored) {
      return { date: today, count: 0 };
    }
    
    const usage = JSON.parse(stored);
    
    // Reset if it's a new day
    if (usage.date !== today) {
      return { date: today, count: 0 };
    }
    
    return usage;
  } catch (error) {
    console.error('[Usage Tracker] Error reading usage:', error);
    return { date: new Date().toISOString().split('T')[0], count: 0 };
  }
}

/**
 * Increment today's cloud usage count
 * @returns {Promise<number>} - New count
 */
export async function incrementCloudUsage() {
  try {
    const usage = await getUsageToday();
    const newUsage = {
      date: usage.date,
      count: usage.count + 1
    };
    
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(newUsage));
    
    if (__DEV__) {
      console.log(`[Usage Tracker] AI call ${newUsage.count} today`);
    }
    
    return newUsage.count;
  } catch (error) {
    console.error('[Usage Tracker] Error incrementing usage:', error);
    throw error;
  }
}

/**
 * Get remaining cloud calls for today
 * @returns {Promise<{remaining: number, used: number, limit: number, canUse: boolean}>}
 */
export async function getRemainingCloudCalls() {
  try {
    const usage = await getUsageToday();
    const { limit, isPremium } = await getDailyVoiceLimit();
    
    if (isPremium) {
      return {
        remaining: Infinity,
        used: usage.count,
        limit: Infinity,
        canUse: true
      };
    }
    
    const remaining = Math.max(0, limit - usage.count);
    
    return {
      remaining,
      used: usage.count,
      limit,
      canUse: remaining > 0
    };
  } catch (error) {
    console.error('[Usage Tracker] Error getting remaining calls:', error);
    // Fail open for premium users, fail closed for errors
    return {
      remaining: 0,
      used: 0,
      limit: 5,
      canUse: false
    };
  }
}

/**
 * Reset usage (for testing or manual reset)
 */
export async function resetUsage() {
  try {
    await AsyncStorage.removeItem(USAGE_KEY);
    if (__DEV__) {
      console.log('[Usage Tracker] Usage reset');
    }
  } catch (error) {
    console.error('[Usage Tracker] Error resetting usage:', error);
  }
}

/**
 * Get usage stats for display
 * @returns {Promise<{used: number, limit: number, percentage: number, isPremium: boolean}>}
 */
export async function getUsageStats() {
  try {
    const usage = await getUsageToday();
    const { limit, isPremium } = await getDailyVoiceLimit();
    
    if (isPremium) {
      return {
        used: usage.count,
        limit: Infinity,
        percentage: 0,
        isPremium: true
      };
    }
    
    const percentage = Math.round((usage.count / limit) * 100);
    
    return {
      used: usage.count,
      limit,
      percentage,
      isPremium: false
    };
  } catch (error) {
    console.error('[Usage Tracker] Error getting stats:', error);
    return {
      used: 0,
      limit: 5,
      percentage: 0,
      isPremium: false
    };
  }
}
