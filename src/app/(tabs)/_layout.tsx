import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';
import {
  House,
  Camera,
  ClockCounterClockwise,
  UserCircle,
} from 'phosphor-react-native';

import { hapticLight } from '@/services/haptics';
import { palette } from '@/theme/tokens';

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textTertiary,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter_600SemiBold',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarStyle: {
          backgroundColor: palette.canvasSunken,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        sceneStyle: { backgroundColor: palette.canvas },
      }}>
      <Tabs.Screen
        name="dashboard"
        listeners={{ tabPress: () => hapticLight() }}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <House
              size={size}
              color={String(color)}
              weight={focused ? 'fill' : 'duotone'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scanner"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            hapticLight();
            router.push('/camera');
          },
        }}
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size, focused }) => (
            <Camera
              size={size}
              color={String(color)}
              weight={focused ? 'fill' : 'duotone'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        listeners={{ tabPress: () => hapticLight() }}
        options={{
          title: 'History',
          tabBarIcon: ({ color, size, focused }) => (
            <ClockCounterClockwise
              size={size}
              color={String(color)}
              weight={focused ? 'fill' : 'duotone'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        listeners={{ tabPress: () => hapticLight() }}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <UserCircle
              size={size}
              color={String(color)}
              weight={focused ? 'fill' : 'duotone'}
            />
          ),
        }}
      />
    </Tabs>
  );
}