// StoreKit Test integration for local development without RevenueCat.
// Works with .storekit configuration files in Xcode for device/simulator testing.

const ENABLE_STOREKIT_TEST = process.env.EXPO_PUBLIC_ENABLE_STOREKIT_TEST === 'true';
const DEBUG = false;
const log = (...args) => { try { DEBUG && console.log('[StoreKitTest]', ...args); } catch {} };

// Direct require so Metro includes the native module when installed
let RNIapRaw = null;
try {
  const mod = require('react-native-iap');
  RNIapRaw = mod && mod.default ? mod.default : mod;
} catch (e) {
  log('Module load failed:', e?.message || e);
  RNIapRaw = null;
}
const StoreKit = RNIapRaw || null; // v14 exposes named exports on the object

// IMPORTANT: these must match the IDs in your FocusFlow.storekit file
const PRODUCT_IDS = ['com.giress.focusflow_app.Monthly', 'com.giress.focusflow_app.Annual'];

let readyLogged = false;
let listenersRegistered = false;
const isReady = () => {
  const ok = ENABLE_STOREKIT_TEST && !!StoreKit;
  if (!readyLogged) {
    readyLogged = true;
    log('ENV', { ENABLE_STOREKIT_TEST, moduleLoaded: !!StoreKit, keys: StoreKit ? Object.keys(StoreKit) : [] });
  }
  return ok;
};

async function initConnection() {
  if (!isReady()) return false;
  try {
    await StoreKit.initConnection?.();
    log('initConnection() success');
    if (!listenersRegistered) {
      try {
        StoreKit.purchaseUpdatedListener?.((purchase) => {
          log('purchaseUpdatedListener', {
            productId: purchase?.productId,
            transactionId: purchase?.transactionId || purchase?.transactionIdIOS,
            acknowledged: purchase?.acknowledged || purchase?.isAcknowledgedAndroid,
          });
          // Finish transaction to prevent duplicates
          try {
            StoreKit.finishTransaction?.({ purchase, isConsumable: false });
          } catch (e) {
            log('finishTransaction error', String(e?.message || e));
          }
        });
        StoreKit.purchaseErrorListener?.((err) => {
          log('purchaseErrorListener', { code: err?.code, message: err?.message || String(err) });
        });
      } catch (e) {
        log('listener registration error', String(e?.message || e));
      }
      listenersRegistered = true;
    }
    return true;
  } catch {
    log('initConnection() failed');
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
    await initConnection();
    let products = [];
    if (typeof StoreKit.fetchProducts === 'function') {
      // NitroIAP expects an object with `skus` and optional `type`.
      // Our items are auto-renewable subscriptions, so ensure type is 'subs' (legacy) -> forwarded to 'subscription'.
      products = await StoreKit.fetchProducts({ skus: PRODUCT_IDS, type: 'subs' });
    } else if (typeof StoreKit.getSubscriptions === 'function') {
      products = await StoreKit.getSubscriptions(PRODUCT_IDS);
    } else if (typeof StoreKit.getProducts === 'function') {
      products = await StoreKit.getProducts(PRODUCT_IDS);
    }
    log('getProducts() -> count', Array.isArray(products) ? products.length : 0);
    return products || [];
  } catch {
    return [];
  }
}

async function purchaseProduct(productId) {
  if (!isReady()) throw new Error('StoreKit Test disabled');
  try {
    await initConnection();
    const products = await getProducts();
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('No StoreKit products available. Ensure FocusFlow.storekit is attached to the Run scheme.');
    }
    // Select the matching product from fetched list (Nitro often prefers full product objects)
    const product = products.find(p => p?.id === productId || p?.productId === productId);
    if (!product) {
      throw new Error(`Product ${productId} not found in fetched list`);
    }
    // Nitro v14 unified shape: requestPurchase({ request: { ios: { sku, ... } } })
    const purchaseFn = StoreKit.requestPurchase;
    if (typeof purchaseFn !== 'function') throw new Error('StoreKit purchase API is not available');
    const nitroPayload = { request: { ios: { sku: productId, andDangerouslyFinishTransactionAutomatically: true } } };
    log('purchase attempt A: requestPurchase({ request: { ios } })', nitroPayload);
    try {
      const purchase = await purchaseFn(nitroPayload);
      return purchase;
    } catch (eA) {
      log('purchase attempt A failed', { message: String(eA?.message || eA), code: eA?.code });
      // Fallback 0: non-wrapped ios payload (older nightly builds)
      const fallbackIos = { ios: { sku: productId, andDangerouslyFinishTransactionAutomatically: true } };
      log('purchase attempt A1: requestPurchase({ ios })', fallbackIos);
      try {
        const purchase = await purchaseFn(fallbackIos);
        return purchase;
      } catch (eA1) {
        log('purchase attempt A1 failed', { message: String(eA1?.message || eA1), code: eA1?.code });
      }
      // Fallback 1: classic flat payload (older shims)
      const fallbackFlat = { sku: productId, andDangerouslyFinishTransactionAutomatically: true };
      log('purchase attempt B: requestPurchase(flatPayload)', fallbackFlat);
      try {
        const purchase = await purchaseFn(fallbackFlat);
        return purchase;
      } catch (eB) {
        log('purchase attempt B failed', { message: String(eB?.message || eB), code: eB?.code });
      }
      // Fallback 2: converted classic product
      let classicProduct = null;
      try {
        if (typeof StoreKit.convertNitroProductToProduct === 'function') {
          classicProduct = StoreKit.convertNitroProductToProduct(product);
          log('converted nitro -> classic product', { keys: classicProduct ? Object.keys(classicProduct) : [] });
        }
      } catch (convErr) {
        log('convertNitroProductToProduct failed', String(convErr?.message || convErr));
      }
      if (classicProduct) {
        try {
          log('purchase attempt C: requestPurchase(classicProduct)');
          const purchase = await purchaseFn(classicProduct);
          return purchase;
        } catch (eC) {
          log('purchase attempt C failed', { message: String(eC?.message || eC), code: eC?.code });
        }
      }
      // Final fallback: pass nitro product as-is
      try {
        log('purchase attempt D: requestPurchase(nitroProduct)', { id: productId });
        const purchase = await purchaseFn(product);
        return purchase;
      } catch (eD) {
        log('purchase attempt D failed', { message: String(eD?.message || eD), code: eD?.code });
        throw eD;
      }
    }
  } catch (error) {
    throw error;
  }
}

async function restorePurchases() {
  if (!isReady()) throw new Error('StoreKit Test disabled');
  try {
    await initConnection();
    const getter = StoreKit.getAvailablePurchases || StoreKit.restorePurchases;
    const purchases = await getter?.();
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
  const productIdMap = {
    monthly: 'com.giress.focusflow_app.Monthly',
    annual: 'com.giress.focusflow_app.Annual',
  };
  const purchase = await purchaseProduct(productIdMap[plan] || productIdMap.monthly);
  
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