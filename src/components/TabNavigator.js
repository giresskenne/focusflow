import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '@react-navigation/native';

const Tab = createBottomTabNavigator();

// Custom Tab Bar Button with liquid glass effect
function CustomTabBarButton({ children, onPress, accessibilityState }) {
  const focused = accessibilityState?.selected || false;
  
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.tabButton,
        focused && styles.tabButtonActive,
      ]}
      activeOpacity={0.7}
    >
      {focused && (
        <View style={styles.activeIndicator}>
          <BlurView 
            intensity={20} 
            tint="light"
            style={styles.activeBlur}
          />
        </View>
      )}
      {children}
    </TouchableOpacity>
  );
}

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
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Reminders') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return (
            <View style={styles.iconContainer}>
              <Ionicons 
                name={iconName} 
                size={focused ? 26 : 24} 
                color={color}
                style={[
                  focused && {
                    shadowColor: '#8900f5',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.6,
                    shadowRadius: 8,
                  }
                ]}
              />
              {focused && (
                <View style={styles.activeDot} />
              )}
            </View>
          );
        },
        tabBarButton: (props) => (
          <CustomTabBarButton {...props} />
        ),
        tabBarActiveTintColor: '#8900f5',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)',
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            <BlurView 
              tint="dark" 
              intensity={100} 
              style={styles.blurView}
            >
              <View style={styles.glassOverlay} />
            </BlurView>
          </View>
        ),
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

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    paddingBottom: 0,
    paddingTop: 0,
  },
  tabBarBackground: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: 'rgba(137, 0, 245, 0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  blurView: {
    flex: 1,
    backgroundColor: 'rgba(15, 10, 30, 0.5)',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)',
    borderRadius: 32,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.2)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  tabButtonActive: {
    transform: [{ scale: 1.1 }],
  },
  activeIndicator: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(137, 0, 245, 0.25)',
    borderWidth: 0.5,
    borderColor: 'rgba(137, 0, 245, 0.4)',
    shadowColor: '#8900f5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  activeBlur: {
    flex: 1,
    backgroundColor: 'rgba(137, 0, 245, 0.2)',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8900f5',
    marginTop: 8,
    shadowColor: '#8900f5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
});
