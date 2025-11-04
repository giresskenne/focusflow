// RevenueCat integration wrapper (react-native-purchases v9).
// Design goals:
// - Configure once at app startup with API key
// - Identify users with logIn/logOut instead of re-configuring
// - Safe no-ops when disabled by env flag
// - Clear, consistent logging and resilient error handling
// - Tiny cache for customerInfo to reduce chatter

const ENABLE_IAP = process.env.EXPO_PUBLIC_ENABLE_IAP === 'true';
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT || 'premium';
// Prefer EXPO_PUBLIC_ vars at runtime; fallback to non-public if provided
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || process.env.REVENUECAT_IOS_API_KEY || '';
const DEBUG = false; // set to false to quiet logs

function log(...args) {
  if (!DEBUG) return;
  try {
    // eslint-disable-next-line no-console
    console.log('[IAP]', ...args);
  } catch {}
}

// IMPORTANT: use an optional require so Metro doesn't statically resolve it when not installed
let Purchases = null;
try {
  // Use a direct require so Metro includes the native module in the bundle
  const mod = require('react-native-purchases');
  // In many RN setups, the module is exported as default
  Purchases = (mod && mod.default) ? mod.default : mod;
} catch (e) {
  Purchases = null;
}

// Log initial environment and module presence once at module load
log('ENV', {
  ENABLE_IAP,
  ENTITLEMENT_ID,
  IOS_API_KEY_PRESENT: !!IOS_API_KEY,
});
log('Module loaded:', !!Purchases, 'keys:', Purchases ? Object.keys(Purchases) : []);
log('Methods:', {
  configure: typeof (Purchases && Purchases.configure),
  getOfferings: typeof (Purchases && Purchases.getOfferings),
  getCustomerInfo: typeof (Purchases && Purchases.getCustomerInfo),
});

let hasLoggedReady = false;
const isReady = () => {
  const ready = ENABLE_IAP && !!Purchases;
  if (!hasLoggedReady) {
    hasLoggedReady = true;
    log('isReady():', ready, { ENABLE_IAP, PurchasesLoaded: !!Purchases });
  }
  return ready;
};

let configured = false;
let lastUserId = null;
let infoCache = { value: null, at: 0 };
const INFO_TTL_MS = 20_000; // 20s cache to avoid spamming RC

async function ensureConfigured() {
  if (!isReady()) return false;
  if (configured) return true;
  // If SDK reports already configured (e.g., after Fast Refresh), honor it
  try {
    if (Purchases?.isConfigured?.()) {
      configured = true;
      return true;
    }
  } catch {}
  if (!IOS_API_KEY) {
    log('ensureConfigured(): missing IOS_API_KEY');
    return false;
  }
  try {
    // Quiet RevenueCat logs BEFORE any potential output from configure
    try { Purchases.setLogLevel?.(Purchases.LOG_LEVEL?.ERROR || 'ERROR'); } catch {}
    try { Purchases.setDebugLogsEnabled?.(false); } catch {}
    try {
      // Swallow non-error logs entirely; forward only errors if needed
      Purchases.setLogHandler?.((level, message) => {
        const isError =
          level === 'ERROR' || level === Purchases?.LOG_LEVEL?.ERROR || String(level).toUpperCase() === 'ERROR';
        if (isError) {
          try { console.error('[RevenueCat]', message); } catch {}
        }
      });
    } catch {}

    // Configure once with API key; user identity handled via logIn/logOut
    log('Purchases.configure(apiKey)');
    await Purchases.configure({ apiKey: IOS_API_KEY });
    configured = true;
    return true;
  } catch (e) {
    log('ensureConfigured() failed:', e?.message || e);
    return false;
  }
}

// Backwards-compatible API: calling configure(userId) will ensure configured, then logIn if provided
async function configure(appUserID) {
  if (!isReady()) return false;
  const ok = await ensureConfigured();
  if (!ok) return false;
  if (!appUserID) return true;
  return await logIn(appUserID);
}

async function logIn(appUserID) {
  if (!isReady()) return false;
  const ok = await ensureConfigured();
  if (!ok) return false;
  try {
    const current = await Purchases.getAppUserID?.();
    if (current && current === appUserID) {
      log('logIn(): already identified as', appUserID);
      lastUserId = appUserID;
      return true;
    }
    log('Purchases.logIn()', appUserID);
    const result = await Purchases.logIn?.(appUserID);
    lastUserId = appUserID;
    // Invalidate cache on identity change
    infoCache.at = 0; infoCache.value = null;
    log('logIn() success', { created: !!result?.created });
    return true;
  } catch (e) {
    log('logIn() failed:', e?.message || e);
    return false;
  }
}

async function logOut() {
  if (!isReady()) return false;
  const ok = await ensureConfigured();
  if (!ok) return false;
  try {
    await Purchases.logOut?.();
    lastUserId = null;
    infoCache.at = 0; infoCache.value = null;
    return true;
  } catch (e) {
    log('logOut() failed:', e?.message || e);
    return false;
  }
}

async function getOfferings() {
  if (!isReady()) return null;
  const ok = await ensureConfigured();
  if (!ok) return null;
  try {
    log('getOfferings()...');
    const offerings = await Purchases.getOfferings();
    const count = offerings?.current?.availablePackages?.length || 0;
    log('getOfferings() -> current?', !!offerings?.current, 'packages:', count);
    if (!offerings?.current) {
      log('Offerings empty. This is expected until App Store products are approved and synced.');
    }
    return offerings;
  } catch (e) {
    log('getOfferings() failed:', e?.message || e);
    return null;
  }
}

function pickPackage(offerings, plan) {
  if (!offerings?.current?.availablePackages?.length) return null;
  const pkgs = offerings.current.availablePackages;
  const matchByType = (pkg, type) => (pkg.packageType ? String(pkg.packageType).toLowerCase().includes(type) : false);
  const matchById = (pkg, type) => (pkg.identifier ? pkg.identifier.toLowerCase().includes(type) : false);
  const isMonthly = (pkg) => matchByType(pkg, 'monthly') || matchById(pkg, 'monthly');
  const isAnnual = (pkg) => matchByType(pkg, 'annual') || matchById(pkg, 'annual') || matchById(pkg, 'yearly');
  if (plan === 'monthly') return pkgs.find(isMonthly) || pkgs[0] || null;
  if (plan === 'annual') return pkgs.find(isAnnual) || pkgs[0] || null;
  return pkgs[0] || null;
}

async function purchasePlan(plan) {
  if (!isReady()) throw new Error('IAP disabled');
  const ok = await ensureConfigured();
  if (!ok) throw new Error('IAP not configured');
  log('purchasePlan()', plan);
  const offerings = await getOfferings();
  const pkg = pickPackage(offerings, plan);
  if (!pkg) throw new Error('No available package in current offering');
  log('purchasePackage() with pkg id:', pkg?.identifier || '(unknown)');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  log('purchasePackage() success. has entitlement?', hasPremiumEntitlement(customerInfo));
  // Update cache
  infoCache.value = customerInfo; infoCache.at = Date.now();
  return customerInfo;
}

async function restorePurchases() {
  if (!isReady()) throw new Error('IAP disabled');
  const ok = await ensureConfigured();
  if (!ok) throw new Error('IAP not configured');
  log('restorePurchases()...');
  const info = await Purchases.restorePurchases();
  log('restorePurchases() success. has entitlement?', hasPremiumEntitlement(info));
  infoCache.value = info; infoCache.at = Date.now();
  return info;
}

async function getCustomerInfo({ useCache = true } = {}) {
  if (!isReady()) return null;
  const ok = await ensureConfigured();
  if (!ok) return null;
  try {
    const now = Date.now();
    if (useCache && infoCache.value && now - infoCache.at < INFO_TTL_MS) {
      log('getCustomerInfo() -> cache');
      return infoCache.value;
    }
    log('getCustomerInfo() -> network');
    const info = await Purchases.getCustomerInfo();
    log('getCustomerInfo() success. has entitlement?', hasPremiumEntitlement(info));
    infoCache.value = info; infoCache.at = now;
    return info;
  } catch (e) {
    log('getCustomerInfo() failed:', e?.message || e);
    return null;
  }
}

function hasPremiumEntitlement(info) {
  try {
    // Primary: explicit entitlement mapping from RevenueCat dashboard
    const entitled = !!info?.entitlements?.active?.[ENTITLEMENT_ID];
    if (entitled) return true;

    // Fallback 1: any active subscription indicates premium (useful if entitlement not configured yet)
    const activeSubs = Array.isArray(info?.activeSubscriptions) ? info.activeSubscriptions : [];
    if (activeSubs.length > 0) return true;

    // Fallback 2: any purchased product identifiers includes our known SKUs
    const purchased = Array.isArray(info?.allPurchasedProductIdentifiers)
      ? info.allPurchasedProductIdentifiers
      : [];
    const KNOWN_SKUS = [
      'com.giress.focusflow_app.Monthly',
      'com.giress.focusflow_app.Annual',
    ];
    if (purchased.some((pid) => KNOWN_SKUS.includes(String(pid)))) return true;

    return false;
  } catch {
    return false;
  }
}

async function canMakePayments() {
  if (!isReady()) return false;
  const ok = await ensureConfigured();
  if (!ok) return false;
  try {
    const res = await Purchases.canMakePayments?.();
    log('canMakePayments():', !!res);
    return !!res;
  } catch (e) {
    log('canMakePayments() failed:', e?.message || e);
    return false;
  }
}

function onCustomerInfoUpdate(cb) {
  if (!isReady() || typeof cb !== 'function') return () => {};
  log('addCustomerInfoUpdateListener() attached');
  const remove = Purchases.addCustomerInfoUpdateListener?.((info) => {
    try {
      infoCache.value = info; infoCache.at = Date.now();
      cb(info);
    } catch {}
  });
  return typeof remove === 'function' ? remove : () => {};
}

export default {
  isReady,
  configure,
  logIn,
  logOut,
  canMakePayments,
  getOfferings,
  purchasePlan,
  restorePurchases,
  getCustomerInfo,
  hasPremiumEntitlement,
  onCustomerInfoUpdate,
};
