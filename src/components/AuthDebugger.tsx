import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useConvexAuth } from 'convex/react';
import { CrossPlatformStorage } from '../utils/storage';

const AuthDebugger = () => {
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const { isLoaded: isAuthLoaded, userId, signOut } = useAuth();
  const { isLoading: isConvexLoading, isAuthenticated: isConvexAuth } = useConvexAuth();
  const [tokenCache, setTokenCache] = useState<any>({});

  useEffect(() => {
    const checkTokenCache = async () => {
      try {
        const clerkToken = await CrossPlatformStorage.getItem('clerk-session-token');
        const githubToken = await CrossPlatformStorage.getItem('github_token');
        setTokenCache({ clerkToken, githubToken });
      } catch (error) {
        console.error('Error checking token cache:', error);
      }
    };
    
    checkTokenCache();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      console.log('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const clearTokens = async () => {
    try {
      await CrossPlatformStorage.removeItem('clerk-session-token');
      await CrossPlatformStorage.removeItem('github_token');
      await CrossPlatformStorage.removeItem('github_username');
      console.log('Tokens cleared');
      setTokenCache({});
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Auth Debug Info</Text>
      
      <Text style={styles.label}>Clerk User Hook:</Text>
      <Text style={styles.value}>isLoaded: {isUserLoaded ? 'true' : 'false'}</Text>
      <Text style={styles.value}>isSignedIn: {isSignedIn ? 'true' : 'false'}</Text>
      <Text style={styles.value}>user.id: {user?.id || 'null'}</Text>
      <Text style={styles.value}>user.email: {user?.primaryEmailAddress?.emailAddress || 'null'}</Text>
      
      <Text style={styles.label}>Clerk Auth Hook:</Text>
      <Text style={styles.value}>isLoaded: {isAuthLoaded ? 'true' : 'false'}</Text>
      <Text style={styles.value}>userId: {userId || 'null'}</Text>
      
      <Text style={styles.label}>Convex Auth:</Text>
      <Text style={styles.value}>isLoading: {isConvexLoading ? 'true' : 'false'}</Text>
      <Text style={styles.value}>isAuthenticated: {isConvexAuth ? 'true' : 'false'}</Text>
      
      <Text style={styles.label}>Token Cache:</Text>
      <Text style={styles.value}>clerkToken: {tokenCache.clerkToken ? 'present' : 'null'}</Text>
      <Text style={styles.value}>githubToken: {tokenCache.githubToken ? 'present' : 'null'}</Text>
      
      <View style={styles.buttonContainer}>
        <Pressable style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={clearTokens}>
          <Text style={styles.buttonText}>Clear Tokens</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f0f0f0',
    margin: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
  },
  value: {
    fontSize: 12,
    color: '#666',
    marginLeft: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AuthDebugger;