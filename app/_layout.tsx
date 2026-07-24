import { Stack } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { StatusBar } from 'expo-status-bar';
import { CrossPlatformStorage } from '../src/utils/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StyleSheet, Text, View } from 'react-native';
import UserInitializer from '../src/components/UserInitializer';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.trim();
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
const convex = convexUrl
  ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
  : null;

// Token cache for Clerk
const tokenCache = {
  async getToken(key: string) {
    try {
      return CrossPlatformStorage.getItem(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await CrossPlatformStorage.setItem(key, value);
    } catch (err) {
      return;
    }
  },
};

function ConfigurationRequired() {
  const missing = [
    !convexUrl && 'EXPO_PUBLIC_CONVEX_URL',
    !clerkPublishableKey && 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  ].filter(Boolean);

  return (
    <View style={styles.configurationScreen}>
      <View style={styles.configurationCard}>
        <Text style={styles.eyebrow}>STAR SHELF / SETUP</Text>
        <Text style={styles.configurationTitle}>This build needs its public service keys.</Text>
        <Text style={styles.configurationBody}>
          Copy .env.example to .env.local, add the missing values, then restart Expo.
          No private API keys belong in the client bundle.
        </Text>
        <View style={styles.missingList}>
          {missing.map((name) => (
            <Text key={String(name)} style={styles.missingItem}>{String(name)}</Text>
          ))}
        </View>
        {Platform.OS === 'web' && (
          <Text style={styles.configurationHint}>See README.md for deployment setup.</Text>
        )}
      </View>
    </View>
  );
}

export default function RootLayout() {
  if (!convex || !clerkPublishableKey) {
    return (
      <SafeAreaProvider>
        <ConfigurationRequired />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ClerkProvider
          publishableKey={clerkPublishableKey}
          tokenCache={Platform.OS === 'web' ? undefined : tokenCache}
        >
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <UserInitializer />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="list/[id]" />
              <Stack.Screen name="shared/[shareId]" />
              <Stack.Screen name="repository/[id]" />
              <Stack.Screen name="graph/[repoId]" />
              <Stack.Screen name="ai-settings" />
            </Stack>
            <StatusBar style="auto" />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  configurationScreen: {
    flex: 1,
    backgroundColor: '#10100F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  configurationCard: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#F5F0E6',
    borderWidth: 2,
    borderColor: '#10100F',
    padding: 32,
  },
  eyebrow: {
    color: '#C23B22',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 18,
  },
  configurationTitle: {
    color: '#10100F',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    marginBottom: 16,
  },
  configurationBody: {
    color: '#3D3B36',
    fontSize: 16,
    lineHeight: 24,
  },
  missingList: {
    marginTop: 24,
    gap: 8,
  },
  missingItem: {
    color: '#F5F0E6',
    backgroundColor: '#10100F',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '700',
  },
  configurationHint: {
    marginTop: 24,
    color: '#10100F',
    fontSize: 14,
    fontWeight: '800',
  },
});
