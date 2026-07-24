import { Tabs } from 'expo-router';
import { Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 960;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarStyle: isDesktop
          ? {
              width: 224,
              backgroundColor: isDark ? '#10100F' : '#F5F0E6',
              borderRightColor: isDark ? '#45433E' : '#CFC6B8',
              borderRightWidth: 1,
              borderTopWidth: 0,
              paddingTop: 24,
              paddingHorizontal: 12,
            }
          : {
              backgroundColor: isDark ? '#10100F' : '#F5F0E6',
              borderTopColor: isDark ? '#45433E' : '#CFC6B8',
              paddingBottom: 8,
              height: 82,
            },
        tabBarItemStyle: isDesktop
          ? {
              minHeight: 50,
              marginVertical: 3,
              borderRadius: 8,
              paddingHorizontal: 10,
            }
          : undefined,
        tabBarLabelPosition: isDesktop ? 'beside-icon' : 'below-icon',
        tabBarActiveBackgroundColor: isDesktop
          ? isDark ? '#24211B' : '#FFF3BE'
          : 'transparent',
        tabBarActiveTintColor: isDark ? '#FFD84D' : '#A33A23',
        tabBarInactiveTintColor: isDark ? '#AAA59B' : '#625E57',
        tabBarLabelStyle: {
          fontSize: isDesktop ? 13 : 11,
          fontWeight: '700',
          letterSpacing: isDesktop ? 0.2 : 0,
          marginBottom: isDesktop ? 0 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Repositories',
          tabBarIcon: ({ color, size }) => (
            <Feather name="star" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color, size }) => (
            <Feather name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          title: 'AI Graph',
          tabBarIcon: ({ color, size }) => (
            <Feather name="share-2" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Feather name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color, size }) => (
            <Feather name="refresh-cw" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
