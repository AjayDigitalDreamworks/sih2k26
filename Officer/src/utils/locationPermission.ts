import { Platform, Linking, Alert } from 'react-native';
import * as Location from 'expo-location';

export interface LocationPermissionState {
  servicesEnabled: boolean;
  status: Location.PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Check current status of location services and permissions without prompting.
 */
export async function checkLocationPermission(): Promise<LocationPermissionState> {
  let servicesEnabled = true;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    servicesEnabled = true;
  }

  let permResult: Location.LocationPermissionResponse;
  try {
    permResult = await Location.getForegroundPermissionsAsync();
  } catch {
    permResult = {
      status: Location.PermissionStatus.UNDETERMINED,
      granted: false,
      canAskAgain: true,
      expires: 'never',
    };
  }

  return {
    servicesEnabled,
    status: permResult.status,
    granted: permResult.granted,
    canAskAgain: permResult.canAskAgain,
  };
}

/**
 * Request location permission and prompt to enable device GPS if disabled.
 */
export async function requestLocationPermission(showSettingsPrompt = true): Promise<LocationPermissionState> {
  let servicesEnabled = true;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled && Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
        servicesEnabled = await Location.hasServicesEnabledAsync();
      } catch {}
    }
  } catch {
    servicesEnabled = true;
  }

  let permResult: Location.LocationPermissionResponse;
  try {
    permResult = await Location.requestForegroundPermissionsAsync();
  } catch (err) {
    permResult = {
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    };
  }

  if (!permResult.granted && Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
        );
      });
      return {
        servicesEnabled: true,
        status: Location.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
      };
    } catch {}
  }

  if (!permResult.granted && !permResult.canAskAgain && showSettingsPrompt && Platform.OS !== 'web') {
    Alert.alert(
      'Location Permission Required',
      'Field Officer requires location access to tag and verify ground truth incidents. Please allow location in device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings().catch(() => {});
          },
        },
      ]
    );
  } else if (!servicesEnabled && showSettingsPrompt) {
    Alert.alert(
      'Device Location Disabled',
      'Please turn on device location (GPS) in your phone settings to tag field reports.',
      [
        { text: 'OK', style: 'default' },
        ...(Platform.OS !== 'web'
          ? [
              {
                text: 'Open Settings',
                onPress: () => {
                  Linking.openSettings().catch(() => {});
                },
              },
            ]
          : []),
      ]
    );
  }

  return {
    servicesEnabled,
    status: permResult.status,
    granted: permResult.granted,
    canAskAgain: permResult.canAskAgain,
  };
}

export async function openLocationSettings(): Promise<void> {
  if (Platform.OS !== 'web') {
    await Linking.openSettings().catch(() => {});
  }
}

