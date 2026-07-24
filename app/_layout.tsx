import { Stack } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { StatusBar } from 'expo-status-bar';
import { CrossPlatformStorage } from '../src/utils/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import UserInitializer from '../src/components/UserInitializer';
import { UpdateBanner } from '@convex-dev/static-hosting/react';
import { api } from '../convex/_generated/api';
import { getConvexUrl } from '@convex-dev/static-hosting';

// Initialize Convex client
// Use .convex.site hostname in production, fall back to env var in dev
const convexUrl = (typeof window !== 'undefined' && window.location?.hostname?.includes('.convex.site'))
  ? getConvexUrl()
  : process.env.EXPO_PUBLIC_CONVEX_URL!;

const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ClerkProvider
          publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
          tokenCache={tokenCache}
        >
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <UserInitializer />
            <UpdateBanner
              getCurrentDeployment={api.staticHosting.getCurrentDeployment}
              message="New version available!"
              buttonText="Refresh"
            />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="list/[id]" />
              <Stack.Screen name="shared/[shareId]" />
              <Stack.Screen name="repository/[id]" />
              <Stack.Screen name="ai-settings" />
            </Stack>
            <StatusBar style="auto" />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
