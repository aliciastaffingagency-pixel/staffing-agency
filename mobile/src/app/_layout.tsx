import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Brand } from '@/constants/brand'
import { AuthProvider, useAuth } from '@/lib/auth'

SplashScreen.preventAutoHideAsync()

function RootStack() {
  const { ready, session } = useAuth()

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])
  if (!ready) return null

  const signedIn = Boolean(session)
  return (
    <Stack
      screenOptions={{
        headerTintColor: Brand.navy,
        headerStyle: { backgroundColor: Brand.cream },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Brand.cream },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="staff/[id]" options={{ title: 'Staff profile' }} />
        <Stack.Screen name="book" options={{ title: 'Request staff', presentation: 'modal' }} />
        <Stack.Screen name="bookings/[id]" options={{ title: 'My booking' }} />
        <Stack.Screen name="messages/[id]" options={{ title: 'Conversation' }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootStack />
    </AuthProvider>
  )
}
