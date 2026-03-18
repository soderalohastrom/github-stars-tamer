import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  useColorScheme,
} from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const SignUpScreen = () => {
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_github' });
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const onSignUpWithGitHub = useCallback(async () => {
    setIsLoading(true);
    try {
      const { createdSessionId, signIn, signUp, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL('/(tabs)', { scheme: 'github-stars-organizer' }),
      });

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
        router.replace('/(tabs)');
      } else {
        // Use signIn or signUp for next steps such as MFA
      }
    } catch (err: any) {
      console.error('OAuth error', err);
      Alert.alert(
        'Authentication Error',
        err.errors?.[0]?.longMessage || err.message || 'Failed to create account with GitHub. Please try again.'
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
    signInText: {
      textAlign: 'center',
      color: isDark ? '#9ca3af' : '#6b7280',
      fontSize: 14,
      marginTop: 16,
    },
    signInLink: {
      color: '#3b82f6',
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Get started by connecting your GitHub account
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What you get:</Text>
          <Text style={styles.infoText}>
            • Organize your starred repositories{"\n"}
            • Advanced search and filtering{"\n"}
            • Offline access to your library{"\n"}
            • Real-time sync across devices
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.githubButton, isLoading && styles.githubButtonDisabled]}
            onPress={onSignUpWithGitHub}
            disabled={isLoading}
          >
            <Text style={styles.githubButtonText}>
              {isLoading ? 'Creating Account...' : 'Continue with GitHub'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>

        <Text style={styles.signInText}>
          Already have an account?{' '}
          <Text 
            style={styles.signInLink}
            onPress={() => router.replace('/(auth)/sign-in')}
          >
            Sign In
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default SignUpScreen;
