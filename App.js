import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import AppSelectionScreen from './src/screens/AppSelectionScreen';
import FocusSessionScreen from './src/screens/FocusSessionScreen';
import ActiveSessionScreen from './src/screens/ActiveSessionScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import AccountScreen from './src/screens/AccountScreen';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import theme from './src/theme';
import { initializeAuth, setupAuthListener } from './src/lib/auth';
import { getReminders, getAuthUser, getLastSyncAt } from './src/storage';
import { mergeCloudToLocal } from './src/lib/sync';

const Stack = createNativeStackNavigator();

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    // Initialize auth session
    (async () => {
      const user = await initializeAuth();
      setAuthUser(user);
      setIsAuthLoading(false);
    })();

    // Set up auth state listener
    const unsubscribe = setupAuthListener((user) => {
      setAuthUser(user);
    });

    // Optional: On app start, ensure reminders scheduled are in a sane state
    // (MVP: We just read reminders so any future rescheduling logic can hook here.)
    (async () => {
      try { await getReminders(); } catch {}
    })();

    return unsubscribe;
  }, []);

  // Background pull on app focus (signed-in only), with a minimal cooldown
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      try {
        const user = await getAuthUser();
        if (!user?.id) return;
        const last = await getLastSyncAt();
        const FIVE_MIN = 5 * 60 * 1000;
        if (Date.now() - last < FIVE_MIN) return;
        await mergeCloudToLocal(user.id);
      } catch {}
    });
    return () => sub.remove();
  }, []);
  return (
    <NavigationContainer theme={theme}>
      <ExpoStatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AppSelection" component={AppSelectionScreen} options={{ title: 'Select Apps' }} />
        <Stack.Screen name="FocusSession" component={FocusSessionScreen} options={{ title: 'Focus Session' }} />
        <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} options={{ title: 'Active Session', gestureEnabled: false }} />
        <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: 'Smart Reminders' }} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign In' }} />
        <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Sign Up' }} />
        <Stack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms of Service' }} />
        <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
