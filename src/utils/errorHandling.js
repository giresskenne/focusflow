// Comprehensive error handling utilities for production resilience

import { Alert } from 'react-native';

// Error types for better categorization
export const ErrorTypes = {
  NETWORK: 'NETWORK',
  STORAGE: 'STORAGE', 
  AUTHENTICATION: 'AUTHENTICATION',
  VALIDATION: 'VALIDATION',
  SYNC: 'SYNC',
  NOTIFICATION: 'NOTIFICATION',
  UNKNOWN: 'UNKNOWN'
};

// User-friendly error messages
const ErrorMessages = {
  [ErrorTypes.NETWORK]: 'Network connection issue. Please check your internet connection and try again.',
  [ErrorTypes.STORAGE]: 'Unable to save data. Please ensure you have sufficient storage space.',
  [ErrorTypes.AUTHENTICATION]: 'Authentication failed. Please sign in again.',
  [ErrorTypes.VALIDATION]: 'Invalid input. Please check your data and try again.',
  [ErrorTypes.SYNC]: 'Sync failed. Your data will be synchronized when connection is restored.',
  [ErrorTypes.NOTIFICATION]: 'Notification permission required. Please enable notifications in Settings.',
  [ErrorTypes.UNKNOWN]: 'An unexpected error occurred. Please try again.'
};

// Enhanced error class with context
export class AppError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, context = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.context = context;
    this.timestamp = Date.now();
    this.userMessage = ErrorMessages[type] || ErrorMessages[ErrorTypes.UNKNOWN];
  }
}

// Error reporting (for analytics/crash reporting)
export function logError(error, context = {}) {
  const errorData = {
    message: error.message,
    stack: error.stack,
    type: error.type || ErrorTypes.UNKNOWN,
    context,
    timestamp: Date.now(),
    userAgent: global.navigator?.userAgent,
  };

  if (__DEV__) {
    console.error('App Error:', errorData);
  } else {
    // In production, send to crash reporting service
    // Example: Sentry, Bugsnag, or custom analytics
    console.log('Error logged for reporting:', errorData);
  }
}

// Safe async wrapper with automatic error handling
export function withErrorHandling(asyncFn, options = {}) {
  const {
    showAlert = true,
    logError: shouldLog = true,
    fallbackValue = null,
    context = {}
  } = options;

  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError(
        error.message, 
        categorizeError(error),
        context
      );

      if (shouldLog) {
        logError(appError, context);
      }

      if (showAlert) {
        showErrorAlert(appError);
      }

      return fallbackValue;
    }
  };
}

// Categorize errors based on common patterns
function categorizeError(error) {
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return ErrorTypes.NETWORK;
  }
  if (message.includes('storage') || message.includes('quota')) {
    return ErrorTypes.STORAGE;
  }
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('token')) {
    return ErrorTypes.AUTHENTICATION;
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorTypes.VALIDATION;
  }
  if (message.includes('sync') || message.includes('supabase')) {
    return ErrorTypes.SYNC;
  }
  if (message.includes('notification') || message.includes('permission')) {
    return ErrorTypes.NOTIFICATION;
  }
  
  return ErrorTypes.UNKNOWN;
}

// Show user-friendly error alerts
export function showErrorAlert(error, options = {}) {
  const {
    title = 'Error',
    showRetry = false,
    onRetry = null
  } = options;

  const buttons = [
    { text: 'OK', style: 'default' }
  ];

  if (showRetry && onRetry) {
    buttons.unshift({ text: 'Try Again', onPress: onRetry });
  }

  Alert.alert(
    title,
    error instanceof AppError ? error.userMessage : error.message,
    buttons
  );
}

// Storage error handlers with retry logic
export const StorageErrorHandler = {
  async withRetry(storageOperation, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await storageOperation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw new AppError(
            `Storage operation failed after ${maxRetries} attempts: ${error.message}`,
            ErrorTypes.STORAGE,
            { attempts: maxRetries, originalError: error.message }
          );
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }
};

// Network error handlers with offline support
export const NetworkErrorHandler = {
  async withOfflineSupport(networkOperation, fallbackOperation = null) {
    try {
      return await networkOperation();
    } catch (error) {
      if (this.isNetworkError(error)) {
        if (fallbackOperation) {
          console.log('Network failed, using offline fallback');
          return await fallbackOperation();
        }
        
        throw new AppError(
          'Network unavailable. Data will sync when connection is restored.',
          ErrorTypes.NETWORK,
          { originalError: error.message }
        );
      }
      
      throw error; // Re-throw non-network errors
    }
  },
  
  isNetworkError(error) {
    const message = error.message?.toLowerCase() || '';
    return message.includes('network') || 
           message.includes('fetch') || 
           message.includes('connection') ||
           message.includes('timeout') ||
           error.code === 'NETWORK_ERROR';
  }
};

// Validation helpers
export const ValidationHelpers = {
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Please enter a valid email address', ErrorTypes.VALIDATION);
    }
  },
  
  validatePassword(password) {
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', ErrorTypes.VALIDATION);
    }
  },
  
  validateRequired(value, fieldName) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      throw new AppError(`${fieldName} is required`, ErrorTypes.VALIDATION);
    }
  }
};

// Global error handler for unhandled promise rejections
export function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections
  if (global.addEventListener) {
    global.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      logError(new AppError(
        'Unhandled promise rejection',
        ErrorTypes.UNKNOWN,
        { reason: event.reason }
      ));
    });
  }

  // React Native global error handler
  if (global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      logError(new AppError(
        error.message,
        ErrorTypes.UNKNOWN,
        { isFatal, stack: error.stack }
      ));
      
      // Call the original handler
      originalHandler(error, isFatal);
    });
  }
}

export default {
  AppError,
  ErrorTypes,
  withErrorHandling,
  StorageErrorHandler,
  NetworkErrorHandler,
  ValidationHelpers,
  showErrorAlert,
  logError,
  setupGlobalErrorHandling
};