import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabNavigator from './src/components/TabNavigator';
import AppSelectionScreen from './src/screens/AppSelectionScreen';
import FocusSessionScreen from './src/screens/FocusSessionScreen';
import ActiveSessionScreen from './src/screens/ActiveSessionScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import AccountScreen from './src/screens/AccountScreen';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
// Static splash is configured in app.json; no animated overlay
import { AppState } from 'react-native';
import theme from './src/theme';
import { initializeAuth, setupAuthListener } from './src/lib/auth';
import { getReminders, getAuthUser, getLastSyncAt, getDirtySince, clearDirty, getSignInNudgeId, setSignInNudgeId, clearSignInNudgeId, getSignInNudgeOptOut, hasLocalData, getMigrationFlag, setMigrationFlag, getSession, getOnboardingCompleted, setOnboardingCompleted } from './src/storage';
import { mergeCloudToLocal, performMigrationUpload, hasCloudData, pullCloudToLocal } from './src/lib/sync';
import MigrationPrompt from './src/components/MigrationPrompt';
import DataSyncPrompt from './src/components/DataSyncPrompt';
import IAP from './src/lib/iap';
import StoreKitTest from './src/lib/storekeittest';
import { setPremiumStatus } from './src/storage';
import ErrorBoundary from './src/components/ErrorBoundary';
import { setupGlobalErrorHandling } from './src/utils/errorHandling';
import PolicyScreen from './src/screens/PolicyScreen';
import { ToastProvider } from './src/contexts/ToastContext';

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showMigration, setShowMigration] = useState(false);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  // Animated splash removed; rely on Expo static splash
  const [onboardingCompleted, setOnboardingCompletedState] = useState(false);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);

  // No animated splash overlay

  // Load onboarding completion status
  useEffect(() => {
    (async () => {
      try {
        const completed = await getOnboardingCompleted();
        setOnboardingCompletedState(completed);
      } catch (error) {
        console.error('Failed to load onboarding status:', error);
        // Default to not completed on error
        setOnboardingCompletedState(false);
      } finally {
        setIsOnboardingLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // Initialize global error handling
    setupGlobalErrorHandling();

    // Request notification permissions early (required for iOS background notifications)
    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.warn('[App] Notification permissions not granted');
        } else {
          console.log('[App] Notification permissions granted');
        }
      } catch (error) {
        console.error('[App] Error requesting notification permissions:', error);
      }
    })();

    // Global notifications behavior: Handle foreground presentation
    // For background, iOS system handles delivery automatically
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification?.request?.content?.data || {};
        const intendedAt = typeof data?.intendedAt === 'number' ? data.intendedAt : null;
        const isFallback = data?.isFallback === true;
        const now = Date.now();
        const type = data?.type;

        const isFocusEnd = type === 'focus-end';
        const isOneTime = type === 'one-time';
        // Suppress early foreground banners for both focus-end and one-time, unless it's an explicit fallback
        const shouldCheckPremature = (isFocusEnd || isOneTime) && intendedAt && !isFallback;
        const premature = shouldCheckPremature && now < (intendedAt - 2500);

        return {
          // Prefer explicit banner/list flags; omit deprecated shouldShowAlert to avoid warnings
          shouldShowBanner: !premature,
          shouldShowList: !premature,
          shouldPlaySound: !premature,
          shouldSetBadge: false,
        };
      },
    });

    // Initialize auth session
    (async () => {
      const user = await initializeAuth();
      setAuthUser(user);
      setIsAuthLoading(false);
      await manageSignInNudge(user);

      // Configure IAP when enabled
      try {
        console.log('[App] IAP ready at startup?', IAP.isReady());
        if (IAP.isReady()) {
          await IAP.configure(user?.id || null);
          const info = await IAP.getCustomerInfo();
          if (info != null) {
            const active = IAP.hasPremiumEntitlement(info);
            await setPremiumStatus(!!active);
            console.log('[App] IAP configured. Premium active?', !!active);
          }
        } else if (StoreKitTest.isReady()) {
          await StoreKitTest.initConnection();
          const purchases = await StoreKitTest.restorePurchases();
          const active = StoreKitTest.hasActivePurchase(purchases);
          await setPremiumStatus(!!active);
          console.log('[App] StoreKitTest active?', !!active);
        }
      } catch {}
    })();

    // Set up auth state listener
    const unsubscribe = setupAuthListener(async (user) => {
      setAuthUser(user);
      // Update sign-in nudge whenever auth state changes
      manageSignInNudge(user);

      // Clear premium status if user signs out (subscriptions are account-based)
      if (!user) {
        await setPremiumStatus(false);
      }

      // One-time migration flow on first sign-in
      try {
        if (user?.id) {
          const [alreadyMigrated, local, cloud] = await Promise.all([
            getMigrationFlag(user.id),
            hasLocalData(),
            hasCloudData(user.id).catch(() => false),
          ]);

          if (!alreadyMigrated && local && !cloud) {
            // Offer to save local data to account
            setShowMigration(true);
          } else if (!alreadyMigrated && local && cloud) {
            // Both exist: ask which to keep on this device
            setShowSyncPrompt(true);
          } else if (!local && cloud) {
            // Auto-pull if no local data
            try {
              const pulled = await pullCloudToLocal(user.id);
              if (pulled) {
                // mark migrated implicitly to avoid re-prompts
                await setMigrationFlag(user.id, true);
              }
            } catch {}
          }
        }
      } catch {}

      // Update IAP identity on auth changes
      try {
        console.log('[Auth] IAP ready on auth change?', IAP.isReady(), 'user:', user?.id || null);
        if (IAP.isReady()) {
          await IAP.configure(user?.id || null);
          console.log('[Auth] IAP configure called for user');
        }
      } catch {}
    });

    // Optional: On app start, ensure reminders scheduled are in a sane state
    // (MVP: We just read reminders so any future rescheduling logic can hook here.)
    (async () => {
      try { await getReminders(); } catch {}
    })();

    return unsubscribe;
  }, []);

  // No overlay timing needed

  // Listen for entitlement changes (e.g., refunds, renewals) and mirror to premium flag
  useEffect(() => {
    const remove = IAP.onCustomerInfoUpdate(async (info) => {
      try {
        const active = IAP.hasPremiumEntitlement(info);
        await setPremiumStatus(!!active);
      } catch {}
    });
    return () => { try { remove?.(); } catch {} };
  }, []);

  // Handle notification actions (like "End Session Early")
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const { actionIdentifier } = response;
      if (actionIdentifier === 'end-early') {
        // User tapped "End Session Early" - navigate to home and let ActiveSession cleanup
        if (navigationRef.isReady()) {
          navigationRef.navigate('MainTabs', { screen: 'Home' });
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Background pull on app focus (signed-in only), with a minimal cooldown
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      try {
        // Restore an active focus session if it exists and we're not already on ActiveSession
        try {
          const s = await getSession();
          if (s?.active && s?.endAt && s.endAt > Date.now() && navigationRef.isReady()) {
            const currentRoute = navigationRef.getCurrentRoute();
            if (currentRoute?.name !== 'ActiveSession') {
              const remaining = Math.max(1, Math.floor((s.endAt - Date.now()) / 1000));
              navigationRef.navigate('ActiveSession', { durationSeconds: remaining });
            }
          }
        } catch {}

        const user = await getAuthUser();

        // 1) Signed-in: push local changes to cloud if dirty
        if (user?.id) {
          const dirtySince = await getDirtySince();
          if (dirtySince) {
            try {
              await performMigrationUpload(user.id);
              await clearDirty();
            } catch (e) {
              // best-effort; will retry next foreground
            }
          }

          // 2) Pull cloud → local periodically (5 min cooldown)
          const last = await getLastSyncAt();
          const FIVE_MIN = 5 * 60 * 1000;
          if (Date.now() - last >= FIVE_MIN) {
            await mergeCloudToLocal(user.id);
          }
        } else {
          // 3) Signed-out: ensure weekly sign-in nudge is scheduled
          await manageSignInNudge(null);
        }
      } catch {}
    });
    return () => sub.remove();
  }, []);

  // Manage weekly sign-in nudge (schedule when signed-out; cancel when signed-in)
  async function manageSignInNudge(user) {
    try {
      const isSignedIn = !!user?.id;
      const existingId = await getSignInNudgeId();
      if (isSignedIn) {
        if (existingId) {
          try { await Notifications.cancelScheduledNotificationAsync(existingId); } catch {}
          await clearSignInNudgeId();
        }
        return;
      }

      // Signed-out path: schedule if not opted out and not already scheduled
      const optedOut = await getSignInNudgeOptOut();
      if (optedOut || existingId) return;

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return; // don't prompt; stay silent per "light app"

      // Schedule every Monday at 9:00 local time
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Keep your FocusFlow data safe',
          body: 'Sign in to back up your reminders and sessions across devices.',
        },
        trigger: { type: 'weekly', weekday: 2, hour: 9, minute: 0, repeats: true },
      });
      await setSignInNudgeId(id);
    } catch {}
  }

  // Handle onboarding completion
  async function handleOnboardingComplete() {
    try {
      await setOnboardingCompleted(true);
      setOnboardingCompletedState(true);
      if (navigationRef.isReady()) {
        navigationRef.navigate('MainTabs');
      }
    } catch (error) {
      console.error('Failed to save onboarding completion:', error);
    }
  }
  


  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <NavigationContainer theme={theme} ref={navigationRef}
            onReady={async () => {
              // On app start, restore any active session only once
              try {
                const s = await getSession();
                if (s?.active && s?.endAt && s.endAt > Date.now()) {
                  const remaining = Math.max(1, Math.floor((s.endAt - Date.now()) / 1000));
                // Small delay to ensure navigation is ready
                setTimeout(() => {
                  if (navigationRef.isReady()) {
                    navigationRef.navigate('ActiveSession', { durationSeconds: remaining });
                  }
                }, 100);
              }
            } catch {}
          }}
        >
          <ExpoStatusBar style="light" backgroundColor="transparent" translucent />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
          {!isOnboardingLoading && !onboardingCompleted ? (
            <Stack.Screen 
              name="Onboarding" 
              options={{ headerShown: false }}
            >
              {(props) => <OnboardingScreen {...props} onComplete={handleOnboardingComplete} />}
            </Stack.Screen>
          ) : null}
          <Stack.Screen name="MainTabs" component={TabNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="AppSelection" component={AppSelectionScreen} options={{ title: 'Select Apps' }} />
          <Stack.Screen name="FocusSession" component={FocusSessionScreen} options={{ title: 'Focus Session' }} />
          <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} options={{ title: 'Active Session', gestureEnabled: false }} />
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms of Service' }} />
          <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
          <Stack.Screen 
            name="PolicyScreen" 
            component={PolicyScreen} 
            options={{ title: 'Policy' }} 
          />
        </Stack.Navigator>

      {/* One-time migration prompt: only local data exists after sign-in */}
      <MigrationPrompt
        visible={!!authUser && showMigration}
        loading={isMigrating}
        onKeepLocal={async () => {
          if (!authUser?.id) return;
          await setMigrationFlag(authUser.id, true);
          setShowMigration(false);
        }}
        onSaveToAccount={async () => {
          if (!authUser?.id) return;
          const ENABLE_MIGRATION_UPLOAD = process.env.EXPO_PUBLIC_ENABLE_MIGRATION_UPLOAD === 'true';
          if (!ENABLE_MIGRATION_UPLOAD) {
            await setMigrationFlag(authUser.id, true);
            setShowMigration(false);
            return;
          }
          try {
            setIsMigrating(true);
            await performMigrationUpload(authUser.id);
            await setMigrationFlag(authUser.id, true);
            setShowMigration(false);
          } catch (e) {
            // keep the prompt open for retry; consider surfacing a toast in future
          } finally {
            setIsMigrating(false);
          }
        }}
        onClose={() => setShowMigration(false)}
      />

        {/* Data sync decision: both local and cloud exist after sign-in */}
        <DataSyncPrompt
          visible={!!authUser && showSyncPrompt}
          loading={isMigrating}
          onKeepLocal={async () => {
            if (!authUser?.id) return;
            await setMigrationFlag(authUser.id, true);
            setShowSyncPrompt(false);
          }}
          onReplaceWithCloud={async () => {
            if (!authUser?.id) return;
            try {
              setIsMigrating(true);
              await pullCloudToLocal(authUser.id);
              await setMigrationFlag(authUser.id, true);
              setShowSyncPrompt(false);
            } catch (e) {
              // leave prompt for retry
            } finally {
              setIsMigrating(false);
            }
          }}
          onLater={() => setShowSyncPrompt(false)}
          onClose={() => setShowSyncPrompt(false)}
        />

        {/* Animated splash removed */}
        </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
