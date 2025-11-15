// Runtime crash debugging utilities for production apps
// Use this to identify and prevent startup crashes

import { Alert } from 'react-native';

// Track initialization steps to pinpoint crash location
const initSteps = [];
let crashHandler = null;

export function logInitStep(step, details = {}) {
  const timestamp = Date.now();
  const stepInfo = {
    step,
    details,
    timestamp,
    memoryUsage: global.performance?.memory?.usedJSHeapSize || 'unknown'
  };
  
  initSteps.push(stepInfo);
  console.log(`[Init] ${step}`, details);
  
  // In production, also log to a crash reporting service
  if (process.env.EXPO_PUBLIC_ENV === 'production') {
    // This would go to Sentry, Bugsnag, etc.
    console.log(`[PRODUCTION-INIT] ${step}:`, JSON.stringify(stepInfo));
  }
}

export function getInitializationHistory() {
  return [...initSteps];
}

// Safe wrapper for async initialization functions
export function safeAsyncInit(fn, stepName, options = {}) {
  const { timeout = 10000, fallback = null, critical = false } = options;
  
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      logInitStep(`${stepName}_TIMEOUT`, { timeout });
      if (critical) {
        Alert.alert(
          'Initialization Error',
          `${stepName} timed out. The app may not work correctly.`,
          [{ text: 'Continue', onPress: () => resolve(fallback) }]
        );
      } else {
        resolve(fallback);
      }
    }, timeout);
    
    logInitStep(`${stepName}_START`);
    
    fn()
      .then((result) => {
        clearTimeout(timeoutId);
        logInitStep(`${stepName}_SUCCESS`);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        logInitStep(`${stepName}_ERROR`, { 
          error: error.message, 
          stack: error.stack?.substring(0, 200) 
        });
        
        if (critical) {
          Alert.alert(
            'Initialization Error',
            `${stepName} failed: ${error.message}`,
            [
              { text: 'Continue', onPress: () => resolve(fallback) },
              { text: 'Retry', onPress: () => {
                // Retry once
                setTimeout(() => {
                  resolve(safeAsyncInit(fn, `${stepName}_RETRY`, { ...options, critical: false }));
                }, 1000);
              }}
            ]
          );
        } else {
          resolve(fallback);
        }
      });
  });
}

// Test native module availability without crashing
export function testNativeModule(moduleName, testFn) {
  try {
    logInitStep(`NATIVE_MODULE_TEST_${moduleName}_START`);
    testFn();
    logInitStep(`NATIVE_MODULE_TEST_${moduleName}_SUCCESS`);
    return true;
  } catch (error) {
    logInitStep(`NATIVE_MODULE_TEST_${moduleName}_ERROR`, {
      error: error.message,
      code: error.code
    });
    return false;
  }
}

// Environment validation
export function validateEnvironment() {
  logInitStep('ENV_VALIDATION_START');
  
  const issues = [];
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_ENV'
  ];
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value || value.includes('YOUR-') || value === '') {
      issues.push(`Missing or invalid ${varName}`);
    }
  }
  
  // Validate URLs
  if (process.env.EXPO_PUBLIC_SUPABASE_URL && !process.env.EXPO_PUBLIC_SUPABASE_URL.startsWith('https://')) {
    issues.push('EXPO_PUBLIC_SUPABASE_URL must be https');
  }
  
  if (issues.length > 0) {
    logInitStep('ENV_VALIDATION_FAILED', { issues });
    return false;
  }
  
  logInitStep('ENV_VALIDATION_SUCCESS');
  return true;
}

// Setup global crash handler that preserves initialization history
export function setupCrashDebugging() {
  logInitStep('CRASH_DEBUG_SETUP');
  
  // Override global error handler to preserve our logs
  if (global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      logInitStep('GLOBAL_ERROR_CAUGHT', {
        message: error.message,
        isFatal,
        initStepsCount: initSteps.length,
        lastStep: initSteps[initSteps.length - 1]?.step
      });
      
      // In development, show our initialization history
      if (__DEV__) {
        console.error('=== INITIALIZATION HISTORY ===');
        initSteps.forEach((step, i) => {
          console.error(`${i + 1}. ${step.step}`, step.details);
        });
        console.error('=== END INIT HISTORY ===');
      }
      
      // Call original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
  
  // Unhandled promise rejections
  if (global.addEventListener) {
    global.addEventListener('unhandledrejection', (event) => {
      logInitStep('UNHANDLED_PROMISE_REJECTION', {
        reason: event.reason?.toString?.() || 'unknown',
        initStepsCount: initSteps.length
      });
    });
  }
}

// Emergency reset function for testing
export function emergencyReset() {
  logInitStep('EMERGENCY_RESET_TRIGGERED');
  
  Alert.alert(
    'Emergency Reset',
    'Reset app data to recover from crashes?',
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Reset', 
        style: 'destructive',
        onPress: async () => {
          try {
            // Clear AsyncStorage
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.clear();
            
            // Clear SecureStore
            const SecureStore = require('expo-secure-store');
            const keys = ['supabase.auth.token', 'authUser', 'session'];
            for (const key of keys) {
              try {
                await SecureStore.deleteItemAsync(key);
              } catch {}
            }
            
            logInitStep('EMERGENCY_RESET_COMPLETE');
            Alert.alert('Reset Complete', 'Please restart the app.');
          } catch (error) {
            logInitStep('EMERGENCY_RESET_FAILED', { error: error.message });
          }
        }
      }
    ]
  );
}

export default {
  logInitStep,
  getInitializationHistory,
  safeAsyncInit,
  testNativeModule,
  validateEnvironment,
  setupCrashDebugging,
  emergencyReset
};