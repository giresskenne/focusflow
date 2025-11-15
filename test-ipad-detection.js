// iPad Detection Test
// Run this to verify our iPad detection works correctly

// Mock React Native Platform for Node.js testing
const mockPlatform = { OS: 'ios' };
const mockDimensions = {
  get: (dim) => {
    // Simulate different device dimensions
    const devices = {
      // iPhone 14 Pro - should NOT be detected as iPad
      iphone: { width: 393, height: 852 },
      // iPad Pro 12.9" - should be detected as iPad  
      ipad: { width: 1024, height: 1366 },
      // iPad Air - should be detected as iPad
      ipadAir: { width: 820, height: 1180 }
    };
    
    // Test with different device dimensions
    const testDevice = process.argv[2] || 'ipad'; // Default to iPad for crash testing
    return devices[testDevice] || devices.iphone;
  }
};

// Simple iPad detection logic (extracted from our utility)
function testIsIPad() {
  if (mockPlatform.OS !== 'ios') return false;
  
  try {
    const { width, height } = mockDimensions.get('window');
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    
    // iPad detection heuristics:
    const isTabletAspectRatio = aspectRatio < 1.6; // Less elongated than phones
    const isTabletSize = Math.min(width, height) > 700; // Larger than most phones
    
    return isTabletAspectRatio && isTabletSize;
  } catch {
    return false;
  }
}

// Test safe call wrapper
function testSafeTurboModuleCall(fn, fallbackValue = null) {
  const isIpad = testIsIPad();
  if (isIpad) {
    console.warn('[DeviceCompat] Skipping TurboModule call on iPad to prevent crash');
    return Promise.resolve(fallbackValue);
  }
  
  try {
    const result = fn();
    if (result && typeof result.catch === 'function') {
      return result.catch(error => {
        console.error('[DeviceCompat] TurboModule call failed:', error.message);
        return fallbackValue;
      });
    }
    return result;
  } catch (error) {
    console.error('[DeviceCompat] TurboModule call failed:', error.message);
    return fallbackValue;
  }
}

console.log('🧪 Testing iPad Detection & Safety...\n');

// Test 1: iPad Detection
console.log('1. Testing iPad Detection:');
const iPadDetected = testIsIPad();
console.log(`   isIPad(): ${iPadDetected}`);

// Test 2: Safe TurboModule Call
console.log('\n2. Testing Safe TurboModule Call:');
try {
  // Simulate a call that would crash on iPad
  const mockTurboCall = () => {
    if (testIsIPad()) throw new Error('Simulated TurboModule crash on iPad');
    return { success: true };
  };
  
  const result = testSafeTurboModuleCall(mockTurboCall, { success: false, reason: 'iPad safety' });
  console.log(`   Result:`, result);
} catch (error) {
  console.log(`   ❌ Unexpected error:`, error.message);
}

// Test 3: Safe DeviceActivity Call  
console.log('\n3. Testing Safe DeviceActivity Call:');
try {
  // Simulate DeviceActivity call
  const mockDeviceActivityCall = () => {
    if (testIsIPad()) throw new Error('DeviceActivity not supported on iPad');
    return 'approved';
  };
  
  const result = testSafeTurboModuleCall(mockDeviceActivityCall, 'not-available');
  console.log(`   Authorization Status:`, result);
} catch (error) {
  console.log(`   ❌ Unexpected error:`, error.message);
}

// Test 4: Screen dimensions (for iPad detection debugging)
console.log('\n4. Screen Information:');
try {
  const { width, height } = mockDimensions.get('window');
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  const minDimension = Math.min(width, height);
  
  console.log(`   Screen: ${width}x${height}`);
  console.log(`   Aspect Ratio: ${aspectRatio.toFixed(2)}`);
  console.log(`   Min Dimension: ${minDimension}`);
  console.log(`   iPad Heuristics: aspectRatio < 1.6? ${aspectRatio < 1.6}, minDim > 700? ${minDimension > 700}`);
} catch (error) {
  console.log(`   ℹ️  Cannot test dimensions: ${error.message}`);
}

console.log('\n✅ iPad Safety Test Complete!\n');

if (iPadDetected) {
  console.log('🚨 IPAD DETECTED - App will run in compatibility mode');
  console.log('   - TurboModule calls will be skipped safely');
  console.log('   - DeviceActivity calls will return fallbacks');
  console.log('   - No crashes should occur\n');
} else {
  console.log('📱 iPhone detected - Normal operation mode');
  console.log('   - All features available');
  console.log('   - DeviceActivity enabled\n');
}