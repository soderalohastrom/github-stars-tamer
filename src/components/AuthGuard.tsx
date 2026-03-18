import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useConvexAuth } from 'convex/react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const { isLoaded: isUserLoaded, isSignedIn, user } = useUser();
  const { isLoading: isConvexLoading, isAuthenticated: isConvexAuth } = useConvexAuth();

  console.log('AuthGuard state:', {
    isUserLoaded,
    isSignedIn,
    userId: user?.id,
    isConvexLoading,
    isConvexAuth,
  });

  // Show loading while Clerk is initializing
  if (!isUserLoaded || isConvexLoading) {
    return fallback || (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Initializing authentication...</Text>
      </View>
    );
  }

  // User not signed in - this should redirect to auth screens
  if (!isSignedIn || !user) {
    console.log('User not signed in, AuthGuard should not be reached');
    return fallback || (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Authentication required</Text>
      </View>
    );
  }

  // User signed in but Convex not authenticated - wait for sync
  if (!isConvexAuth) {
    return fallback || (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Syncing with database...</Text>
      </View>
    );
  }

  // All good - render children
  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
});

export default AuthGuard;