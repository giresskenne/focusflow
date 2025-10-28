import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '@react-navigation/native';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Analytics') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Reminders') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={iconName} size={size} color={color} />
              {focused && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#a855f7',
                    marginTop: 6,
                  }}
                />
              )}
            </View>
          );
        },
        tabBarActiveTintColor: '#a855f7', // Bright purple from screenshots
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)', // Dimmed white
        tabBarStyle: {
          backgroundColor: 'rgba(10, 5, 20, 0.95)',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          position: 'absolute',
          paddingBottom: 24,
          paddingTop: 12,
          height: 90, // Increased height for better visual presence
        },
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <BlurView 
            tint="dark" 
            intensity={80} 
            style={{ 
              flex: 1,
              backgroundColor: 'rgba(10, 5, 20, 0.7)' 
            }} 
          />
        ),
        // labels hidden to match reference design (icon + active dot)
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.foreground,
        headerTitleStyle: {
          fontWeight: '600',
          color: colors.foreground,
        },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'FocusFlow',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          title: 'Analytics',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Reminders"
        component={RemindersScreen}
        options={{
          title: 'Smart Reminders',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}
