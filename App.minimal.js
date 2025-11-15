// Minimal crash-safe version for debugging
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import ErrorBoundary from './src/components/ErrorBoundary';

const Stack = createNativeStackNavigator();

function MinimalHome() {
  const [initStatus, setInitStatus] = useState('Initializing...');
  
  useEffect(() => {
    // Test each module one by one
    (async () => {
      try {
        setInitStatus('Testing AsyncStorage...');
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.getItem('test');
        
        setInitStatus('Testing SecureStore...');
        const SecureStore = require('expo-secure-store');
        await SecureStore.getItemAsync('test').catch(() => {});
        
        setInitStatus('Testing Notifications...');
        const Notifications = require('expo-notifications');
        await Notifications.getPermissionsAsync();
        
        setInitStatus('Testing Supabase...');
        const { getSupabase } = require('./src/lib/supabase');
        const supabase = getSupabase();
        
        setInitStatus('Testing IAP...');
        const IAP = require('./src/lib/iap').default;
        console.log('IAP ready:', IAP.isReady());
        
        setInitStatus('All modules loaded successfully! 🎉');
        
        // Show success for 2 seconds, then offer to load full app
        setTimeout(() => {
          Alert.alert(
            'Modules Test Complete',
            'All core modules loaded successfully. Load full app?',
            [
              { text: 'Stay in Safe Mode', style: 'cancel' },
              { text: 'Load Full App', onPress: () => setInitStatus('Loading full app...') }
            ]
          );
        }, 2000);
        
      } catch (error) {
        setInitStatus(`❌ Failed at: ${error.message}`);
        console.error('Module test failed:', error);
        
        Alert.alert(
          'Module Test Failed',
          `Error: ${error.message}\n\nThis is likely the cause of your production crash.`,
          [{ text: 'OK' }]
        );
      }
    })();
  }, []);
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, textAlign: 'center' }}>
        FocusFlow - Safe Mode
      </Text>
      <Text style={{ marginTop: 20, textAlign: 'center', color: '#666' }}>
        {initStatus}
      </Text>
    </View>
  );
}

export default function MinimalApp() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <ExpoStatusBar style="dark" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={MinimalHome} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}