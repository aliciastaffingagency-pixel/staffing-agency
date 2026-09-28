import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { api } from './api'

// Show notifications while the app is open too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
})

// Registers this device's Expo push token with the agency (booking, contract, payment updates).
export async function registerForPush() {
  if (!Device.isDevice) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Updates',
      importance: Notifications.AndroidImportance.MAX,
      lightColor: '#D61F7A',
    })
  }

  const existing = await Notifications.getPermissionsAsync()
  const status = existing.status === 'granted' ? existing.status : (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return null

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId
  if (!projectId) return null // set by `eas init`; needed for Expo push tokens
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  await api.op('push-token', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' })
  return token
}
