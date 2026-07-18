import { Alert, Platform, ToastAndroid } from 'react-native';

/** Brief "it worked" feedback after a save/add. */
// ponytail: native toast on Android (the only test target); Alert on iOS — swap in a
// custom toast component when iOS becomes a test target.
export function toast(message: string): void {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
}
