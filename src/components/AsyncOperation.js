import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@react-navigation/native';

export default function AsyncOperation({ 
  operation, 
  onSuccess, 
  onError, 
  loadingMessage = 'Loading...', 
  children,
  showRetry = true 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { colors } = useTheme();

  const executeOperation = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await operation();
      onSuccess?.(result);
    } catch (err) {
      setError(err.message || 'An error occurred');
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeOperation();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.message, { color: colors.text }]}>{loadingMessage}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={[styles.error, { color: colors.notification }]}>{error}</Text>
        {showRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={executeOperation}
          >
            <Text style={[styles.retryText, { color: colors.card }]}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  error: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  },
});