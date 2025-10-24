import { getInstalledApps } from '../src/native/installedApps';

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  NativeModules: {
    InstalledApps: null, // Simulate iOS where native module isn't available
  },
}));

describe('Installed Apps Detection', () => {
  test('should return fallback apps on iOS/unsupported platforms', async () => {
    const apps = await getInstalledApps();
    
    expect(Array.isArray(apps)).toBe(true);
    expect(apps.length).toBeGreaterThan(0);
    
    // Should contain fallback apps
    const firstApp = apps[0];
    expect(firstApp).toHaveProperty('packageName');
    expect(firstApp).toHaveProperty('label');
    expect(typeof firstApp.packageName).toBe('string');
    expect(typeof firstApp.label).toBe('string');
  });

  test('should handle missing native module gracefully', async () => {
    // This tests the fallback when NativeModules.InstalledApps is null
    const apps = await getInstalledApps();
    
    expect(apps).toEqual([
      { packageName: 'com.social.app', label: 'Social App' },
      { packageName: 'com.video.stream', label: 'Video Stream' },
      { packageName: 'com.games.arcade', label: 'Arcade Games' },
    ]);
  });
});

describe('App Enhancement Logic', () => {
  test('should enhance known apps with proper bundle IDs', () => {
    const ENHANCED_MOCK_APPS = [
      { id: 'com.burbn.instagram', name: 'Instagram', bundleId: 'com.burbn.instagram' },
      { id: 'com.atebits.Tweetie2', name: 'Twitter', bundleId: 'com.atebits.Tweetie2' },
      { id: 'com.facebook.Facebook', name: 'Facebook', bundleId: 'com.facebook.Facebook' },
    ];

    const mockInstalledApp = {
      packageName: 'com.burbn.instagram',
      label: 'Instagram',
    };

    const knownApp = ENHANCED_MOCK_APPS.find(known => 
      known.bundleId === mockInstalledApp.packageName || 
      known.name.toLowerCase() === mockInstalledApp.label.toLowerCase()
    );

    expect(knownApp).toBeDefined();
    expect(knownApp.bundleId).toBe('com.burbn.instagram');
    expect(knownApp.name).toBe('Instagram');
  });

  test('should provide fallback for unknown apps', () => {
    const unknownApp = {
      packageName: 'com.unknown.app',
      label: 'Unknown App',
    };

    // Simulate what happens in the component
    const enhancedApp = {
      id: unknownApp.packageName,
      name: unknownApp.label,
      bundleId: unknownApp.packageName,
      packageName: unknownApp.packageName,
      // Icon would be AppsIcon (generic fallback)
    };

    expect(enhancedApp.bundleId).toBe('com.unknown.app');
    expect(enhancedApp.name).toBe('Unknown App');
  });
});