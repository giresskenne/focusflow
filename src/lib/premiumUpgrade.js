import { Alert } from 'react-native';
import IAP from './iap';
import StoreKitTest from './storekeittest';
import { getAuthUser, setPremiumStatus } from '../storage';

/**
 * Perform Premium upgrade flow from a single source of truth.
 * - Requires user to be signed in
 * - Uses RevenueCat when enabled; falls back to StoreKitTest if available
 * - Updates local premium flag on success
 *
 * @param {'annual'|'monthly'} plan
 * @param {{ onRequireSignIn?: () => void }} options
 * @returns {Promise<boolean>} true if upgraded successfully
 */
export async function performUpgrade(plan = 'annual', options = {}) {
  const { onRequireSignIn } = options || {};
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to purchase Premium. This ensures your subscription is linked to your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => { try { onRequireSignIn?.(); } catch {} } },
        ]
      );
      return false;
    }

    // Prefer RevenueCat path when available
    if (IAP.isReady()) {
      const info = await IAP.purchasePlan(plan === 'annual' ? 'annual' : 'monthly');
      const active = IAP.hasPremiumEntitlement(info);
      await setPremiumStatus(!!active);
      if (active) {
        Alert.alert('Success!', 'Premium activated. Enjoy unlimited access!');
        return true;
      }
      // If RC returned but entitlement missing, still show generic success path guarded by fallback in hasPremiumEntitlement
      return !!active;
    }

    // Local StoreKit testing path
    if (typeof StoreKitTest.isReady === 'function' && StoreKitTest.isReady()) {
      const result = await StoreKitTest.purchasePlan(plan);
      if (result?.success) {
        await setPremiumStatus(true);
        Alert.alert('Success!', 'Premium activated. Enjoy unlimited access!');
        return true;
      }
      return false;
    }

    Alert.alert(
      'Not Available',
      'In-app purchases are not enabled in this build. Please rebuild the app with:\n\n' +
      'npx expo prebuild --clean\n' +
      'npx expo run:ios --device',
      [{ text: 'OK' }]
    );
    return false;
  } catch (e) {
    console.warn('[Upgrade] Purchase error:', e?.message || e);
    Alert.alert('Purchase Failed', e?.message || 'Purchase was cancelled or failed.');
    return false;
  }
}
