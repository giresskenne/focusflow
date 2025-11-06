import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info',
    duration: 4000,
    action: null,
  });

  const showToast = useCallback((message, options = {}) => {
    setToast({
      visible: true,
      message,
      type: options.type || 'info',
      duration: options.duration || 4000,
      action: options.action || null,
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const showSuccess = useCallback((message, options = {}) => {
    showToast(message, { ...options, type: 'success' });
  }, [showToast]);

  const showError = useCallback((message, options = {}) => {
    showToast(message, { ...options, type: 'error' });
  }, [showToast]);

  const showInfo = useCallback((message, options = {}) => {
    showToast(message, { ...options, type: 'info' });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, hideToast }}>
      {children}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        action={toast.action}
        onDismiss={hideToast}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
