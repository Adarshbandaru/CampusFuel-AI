import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../../src/context/ThemeContext';
import { ErrorBoundary } from '../../src/components/common/ErrorBoundary';


export default function TabLayout() {
  const { colors, theme } = useTheme();

  useEffect(() => {
    // Global listener for network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log("[Network State]", state.isConnected ? "Online" : "Offline");
      if (state.isConnected) {
        // Firestore handles auto-syncing upon reconnect
      }

    });

    return () => unsubscribe();
  }, []);

  const renderIcon = (IconComponent: any, name: string, color: string, focused: boolean, size: number) => (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
      <IconComponent name={name as any} size={size} color={color} />
      {focused && (
        <View 
          style={{ 
            width: 4, 
            height: 4, 
            borderRadius: 2, 
            backgroundColor: color, 
            position: 'absolute',
            bottom: -8,
            shadowColor: color, 
            shadowOpacity: 0.6, 
            shadowRadius: 3,
            elevation: 1 
          }} 
        />
      )}
    </View>
  );

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: colors.tabIconSelected,
          tabBarInactiveTintColor: colors.tabIconDefault,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 72,
            elevation: 0,
            shadowOpacity: 0,
            paddingBottom: 12,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
          },
          headerStyle: {
            backgroundColor: colors.headerBg,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '800',
            fontSize: 18,
            color: colors.text,
          },
        }}
      >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => renderIcon(Ionicons, "home", color, focused, 24),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          headerShown: false,
          tabBarLabel: 'Log',
          tabBarIcon: ({ color, focused }) => renderIcon(Ionicons, "add-circle", color, focused, 28),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          headerShown: false,
          tabBarLabel: 'Insights',
          tabBarIcon: ({ color, focused }) => renderIcon(Ionicons, "analytics", color, focused, 24),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'AI Coach',
          headerShown: false,
          tabBarLabel: 'Coach',
          tabBarIcon: ({ color, focused }) => renderIcon(MaterialCommunityIcons, "robot", color, focused, 24),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Me',
          headerShown: false,
          tabBarLabel: 'Me',
          tabBarIcon: ({ color, focused }) => renderIcon(Ionicons, "person", color, focused, 24),
        }}
      />
      {/* Hidden secondary screens */}
      <Tabs.Screen name="timetable" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="settings" options={{ href: null, headerShown: false }} />
      </Tabs>
    </ErrorBoundary>
  );
}
