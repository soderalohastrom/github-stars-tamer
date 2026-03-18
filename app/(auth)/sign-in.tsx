import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  useColorScheme,
} from 'react-native';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const SignInScreen = () => {
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_github' });
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const onSignInWithGitHub = useCallback(async () => {
    console.log('Starting GitHub OAuth flow...');
    setIsLoading(true);
    try {
      const redirectUrl = Linking.createURL('/(tabs)', { scheme: 'github-stars-organizer' });
      console.log('Using redirect URL:', redirectUrl);
      
      const result = await startOAuthFlow({
        redirectUrl,
      });
      
      console.log('OAuth flow result:', result);
      const { createdSessionId, signIn, signUp, setActive } = result;

      if (createdSessionId) {
        console.log('Session created:', createdSessionId);
        if (setActive) {
          await setActive({ session: createdSessionId });
          console.log('Session activated, redirecting to tabs...');
          router.replace('/(tabs)');
        } else {
          console.error('setActive function not available');
        }
      } else {
        console.log('No session created, checking signIn/signUp:', { signIn: !!signIn, signUp: !!signUp });
        // Use signIn or signUp for next steps such as MFA
        Alert.alert('Additional Steps Required', 'Please complete the authentication process.');
      }
    } catch (err: any) {
      console.error('OAuth error details:', err);
      Alert.alert(
        'Authentication Error',
        err.errors?.[0]?.longMessage || err.message || 'Failed to sign in with GitHub. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [startOAuthFlow]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f0f23' : '#ffffff',
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 48,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      textAlign: 'center',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      color: isDark ? '#9ca3af' : '#6b7280',
      lineHeight: 24,
    },
    buttonContainer: {
      gap: 16,
      marginBottom: 32,
    },
    githubButton: {
      backgroundColor: '#24292e',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    githubButtonDisabled: {
      opacity: 0.6,
    },
    githubButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    backButton: {
      borderWidth: 2,
      borderColor: isDark ? '#374151' : '#d1d5db',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
    },
    backButtonText: {
      color: isDark ? '#ffffff' : '#111827',
      fontSize: 16,
      fontWeight: '600',
    },
    infoSection: {
      backgroundColor: isDark ? '#1a1a2e' : '#f9fafb',
      padding: 20,
      borderRadius: 12,
      marginBottom: 24,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
      lineHeight: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in with your GitHub account to access your starred repositories
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Required GitHub Permissions</Text>
          <Text style={styles.infoText}>
            • Access to your public repositories{"\n"}
            • Read your starred repositories{"\n"}
            • Manage your stars (add/remove)
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.githubButton, isLoading && styles.githubButtonDisabled]}
            onPress={onSignInWithGitHub}
            disabled={isLoading}
          >
            <Text style={styles.githubButtonText}>
              {isLoading ? 'Connecting...' : 'Continue with GitHub'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SignInScreen;
