import { Platform, NativeModules } from 'react-native';

const Native = NativeModules.InstalledApps;

export async function getInstalledApps() {
  if (Platform.OS !== 'android' || !Native?.getInstalledApps) {
    // Fallback placeholder list on iOS/unsupported
    return [
      { packageName: 'com.social.app', label: 'Social App' },
      { packageName: 'com.video.stream', label: 'Video Stream' },
      { packageName: 'com.games.arcade', label: 'Arcade Games' },
    ];
  }
  try {
    const apps = await Native.getInstalledApps();
    // Sort by label
    return apps.sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}

