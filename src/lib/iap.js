// Minimal RevenueCat integration wrapper with safe fallbacks.
// All calls are no-ops unless EXPO_PUBLIC_ENABLE_IAP=true and the native module is installed.

const ENABLE_IAP = process.env.EXPO_PUBLIC_ENABLE_IAP === 'true';
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT || 'premium';
const IOS_API_KEY = process.env.REVENUECAT_IOS_API_KEY || '';

// IMPORTANT: use an optional require so Metro doesn't statically resolve it when not installed
let Purchases = null;
try {
  // eslint-disable-next-line no-eval
  const optRequire = eval('require');
  Purchases = optRequire && optRequire('react-native-purchases');
} catch (e) {
  Purchases = null;
}

const isReady = () => ENABLE_IAP && !!Purchases;

async function configure(appUserID) {
  if (!isReady()) return false;
  try {
    await Purchases.configure({ apiKey: IOS_API_KEY, appUserID: appUserID || null });
    return true;
  } catch {
    return false;
  }
}

async function logOut() {
  if (!isReady()) return false;
  try {
    await Purchases.logOut?.();
    return true;
  } catch {
    return false;
  }
}

async function getOfferings() {
  if (!isReady()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch {
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
  const offerings = await getOfferings();
  const pkg = pickPackage(offerings, plan);
  if (!pkg) throw new Error('No available package');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

async function restorePurchases() {
  if (!isReady()) throw new Error('IAP disabled');
  const info = await Purchases.restorePurchases();
  return info;
}

async function getCustomerInfo() {
  if (!isReady()) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    return info;
  } catch {
    return null;
  }
}

function hasPremiumEntitlement(info) {
  try {
    return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

function onCustomerInfoUpdate(cb) {
  if (!isReady() || typeof cb !== 'function') return () => {};
  const remove = Purchases.addCustomerInfoUpdateListener?.((info) => {
    try { cb(info); } catch {}
  });
  // SDK returns a function or nothing; normalize
  return typeof remove === 'function' ? remove : () => {};
}

export default {
  isReady,
  configure,
  logOut,
  getOfferings,
  purchasePlan,
  restorePurchases,
  getCustomerInfo,
  hasPremiumEntitlement,
  onCustomerInfoUpdate,
};
