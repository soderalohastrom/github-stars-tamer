import { Redirect } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useEffect } from 'react';

export default function Index() {
  const { isSignedIn, isLoaded, user } = useUser();

  useEffect(() => {
    console.log('Auth state changed:', {
      isLoaded,
      isSignedIn,
      userId: user?.id,
      userExists: !!user,
    });
  }, [isLoaded, isSignedIn, user]);

  // Show loading state while auth is initializing
  if (!isLoaded) {
    console.log('Auth not loaded yet, showing loading...');
    return null; // or a loading spinner
  }

  if (isSignedIn && user) {
    console.log('User is signed in, redirecting to tabs...');
    return <Redirect href="/(tabs)" />;
  }

  console.log('User not signed in, redirecting to welcome...');
  return <Redirect href="/(auth)/welcome" />;
}
