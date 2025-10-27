// StoreKit Test integration for local development without RevenueCat.
// Works with .storekit configuration files in Xcode for Simulator testing.

const ENABLE_STOREKIT_TEST = process.env.EXPO_PUBLIC_ENABLE_STOREKIT_TEST === 'true';

// Optional require and normalize default export so Metro won't hard-resolve when unused
let RNIapRaw = null;
try {
  // eslint-disable-next-line no-eval
  const optRequire = eval('require');
  RNIapRaw = optRequire && optRequire('react-native-iap');
} catch (e) {
  RNIapRaw = null;
}
const StoreKit = RNIapRaw?.default ?? RNIapRaw; // some bundlers place API on .default

const PRODUCT_IDS = ['com.focusflow.monthly', 'com.focusflow.annual']; // Match your .storekit file
const isReady = () => ENABLE_STOREKIT_TEST && !!StoreKit;

async function initConnection() {
  if (!isReady()) return false;
  try {
    await StoreKit.initConnection?.();
    return true;
  } catch {
    return false;
  }
}

async function endConnection() {
  if (!isReady()) return;
  try {
    await StoreKit.endConnection?.();
  } catch {}
}

async function getProducts() {
  if (!isReady()) return [];
  try {
    const products = await StoreKit.getSubscriptions?.(PRODUCT_IDS);
    return products || [];
  } catch {
    return [];
  }
}

async function purchaseProduct(productId) {
  if (!isReady()) throw new Error('StoreKit Test disabled');
  try {
    // RN-IAP v14 uses an options object; older versions accepted a string.
    const requestFn = StoreKit.requestSubscription || StoreKit.requestPurchase || StoreKit.requestSubscriptions;
    if (typeof requestFn !== 'function') {
      throw new Error('StoreKit.requestSubscription is not available');
    }
    const arg = requestFn.length <= 1 ? { sku: productId } : productId;
    const purchase = await requestFn(arg);
    return purchase;
  } catch (error) {
    throw error;
  }
}

async function restorePurchases() {
  if (!isReady()) throw new Error('StoreKit Test disabled');
  try {
    const purchases = await StoreKit.getAvailablePurchases?.();
    return purchases || [];
  } catch {
    return [];
  }
}

function hasActivePurchase(purchases) {
  if (!Array.isArray(purchases) || purchases.length === 0) return false;
  // In StoreKit Test, purchases don't expire, so any purchase means premium
  return purchases.some(p => PRODUCT_IDS.includes(p.productId));
}

async function purchasePlan(plan) {
  if (!isReady()) throw new Error('StoreKit Test disabled');
  
  const productId = plan === 'annual' ? 'com.focusflow.annual' : 'com.focusflow.monthly';
  const purchase = await purchaseProduct(productId);
  
  // Return a simple success indicator
  return { success: true, productId: purchase?.productId };
}

export default {
  isReady,
  initConnection,
  endConnection,
  getProducts,
  purchasePlan,
  restorePurchases,
  hasActivePurchase,
};