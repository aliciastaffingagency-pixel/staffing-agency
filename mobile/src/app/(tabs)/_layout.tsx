import Ionicons from '@expo/vector-icons/Ionicons'
import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { Brand } from '@/constants/brand'

type IconName = React.ComponentProps<typeof Ionicons>['name']
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />
  }

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Brand.magenta,
        tabBarInactiveTintColor: Brand.navyMuted,
        headerStyle: { backgroundColor: Brand.cream },
        headerShadowVisible: false,
        headerTintColor: Brand.navy,
        tabBarStyle: { backgroundColor: Brand.white },
        sceneStyle: { backgroundColor: Brand.cream },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Find staff', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="match" options={{ title: 'Smart match', tabBarIcon: icon('sparkles') }} />
      <Tabs.Screen name="hires" options={{ title: 'My hires', tabBarIcon: icon('briefcase') }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('chatbubbles') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  )
}
