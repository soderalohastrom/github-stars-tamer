import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  useColorScheme,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUser, useClerk, useOAuth } from '@clerk/clerk-expo';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import * as WebBrowser from 'expo-web-browser';

// Required for OAuth redirect handling in Expo
WebBrowser.maybeCompleteAuthSession();

interface GitHubOAuthCardProps {
  onConnectionChange?: (isConnected: boolean) => void;
}

const GitHubOAuthCard: React.FC<GitHubOAuthCardProps> = ({ onConnectionChange }) => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Clerk OAuth hook for GitHub
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_github' });

  // Query GitHub connection status from Convex
  const connectionStatus = useQuery(
    api.github.getGithubConnectionStatus,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // Mutations
  const linkGithubAccount = useMutation(api.github.linkGithubAccount);
  const unlinkGithubAccount = useMutation(api.github.unlinkGithubAccount);

  // Actions
  const refreshToken = useAction(api.github.refreshGithubToken);

  // Check for GitHub external account in Clerk user data
  // The provider string varies by Clerk version - check for both variants
  const githubAccount = user?.externalAccounts?.find(
    (account) => account.provider === 'github' || (account.provider as string) === 'oauth_github'
  );

  // Determine connection state
  const isConnected = connectionStatus?.isConnected || !!githubAccount;
  const githubUsername = connectionStatus?.githubUsername || githubAccount?.username;
  const hasValidToken = connectionStatus?.hasValidToken;

  // Notify parent of connection changes
  useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(isConnected);
    }
  }, [isConnected, onConnectionChange]);

  // Sync GitHub account from Clerk to Convex when detected
  useEffect(() => {
    const syncGithubAccount = async () => {
      if (!user?.id || !githubAccount) return;

      // Only sync if not already synced in Convex
      if (connectionStatus?.isConnected && connectionStatus?.githubUsername === githubAccount.username) {
        return;
      }

      try {
        await linkGithubAccount({
          clerkUserId: user.id,
          githubExternalAccountId: githubAccount.id,
          githubUsername: githubAccount.username || '',
          githubEmail: githubAccount.emailAddress,
        });
        console.log('GitHub account linked to Convex');
      } catch (error) {
        console.error('Failed to link GitHub account:', error);
      }
    };

    syncGithubAccount();
  }, [user?.id, githubAccount, connectionStatus?.isConnected, connectionStatus?.githubUsername, linkGithubAccount]);

  // Handle OAuth connection
  const handleConnect = useCallback(async () => {
    if (!isUserLoaded) return;

    setIsConnecting(true);

    try {
      // Start Clerk OAuth flow for GitHub
      const result = await startOAuthFlow({
        redirectUrl: 'exp://localhost:8081/--/oauth-callback',
      });

      if (result.createdSessionId) {
        // OAuth was successful, user should now have GitHub connected
        // The useEffect above will detect the new external account and sync to Convex
        Alert.alert(
          'Connected!',
          'Your GitHub account has been connected. You can now sync your starred repositories.',
        );
      } else if (result.signUp || result.signIn) {
        // User needs to complete sign up/in
        Alert.alert(
          'Almost there!',
          'Please complete the sign-in process to connect your GitHub account.',
        );
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      Alert.alert(
        'Connection Failed',
        error.message || 'Failed to connect GitHub account. Please try again.',
      );
    } finally {
      setIsConnecting(false);
    }
  }, [isUserLoaded, startOAuthFlow]);

  // Handle token refresh
  const handleRefreshToken = useCallback(async () => {
    if (!user?.id) return;

    setIsRefreshing(true);

    try {
      const result = await refreshToken({ clerkUserId: user.id });

      if (result.success) {
        Alert.alert('Success', 'GitHub token has been refreshed.');
      } else {
        Alert.alert(
          'Refresh Failed',
          result.error || 'Failed to refresh token. You may need to reconnect your GitHub account.',
        );
      }
    } catch (error: any) {
      console.error('Token refresh error:', error);
      Alert.alert('Error', error.message || 'Failed to refresh token.');
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id, refreshToken]);

  // Handle disconnect
  const handleDisconnect = useCallback(async () => {
    if (!user?.id) return;

    Alert.alert(
      'Disconnect GitHub',
      'This will remove your GitHub connection from this app. To fully revoke access, you\'ll need to do so in your GitHub settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from Convex
              await unlinkGithubAccount({ clerkUserId: user.id });

              // Note: We can't programmatically remove the external account from Clerk
              // without deleting the user. The user would need to manage this in Clerk's
              // user profile or through GitHub's authorized apps settings.

              Alert.alert(
                'Disconnected',
                'GitHub connection has been removed from this app. To revoke OAuth access completely, visit your GitHub settings.',
              );

              if (onConnectionChange) {
                onConnectionChange(false);
              }
            } catch (error: any) {
              console.error('Disconnect error:', error);
              Alert.alert('Error', error.message || 'Failed to disconnect GitHub account.');
            }
          },
        },
      ]
    );
  }, [user?.id, unlinkGithubAccount, onConnectionChange]);

  // Open GitHub authorized apps page
  const openGitHubSettings = useCallback(() => {
    Linking.openURL('https://github.com/settings/applications');
  }, []);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? '#4b5563' : '#e5e7eb',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#24292e',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginTop: 2,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    connectedDot: {
      backgroundColor: '#10b981',
    },
    disconnectedDot: {
      backgroundColor: '#ef4444',
    },
    warningDot: {
      backgroundColor: '#f59e0b',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '500',
    },
    connectedText: {
      color: '#10b981',
    },
    disconnectedText: {
      color: '#ef4444',
    },
    warningText: {
      color: '#f59e0b',
    },
    usernameText: {
      fontSize: 14,
      color: isDark ? '#d1d5db' : '#374151',
    },
    scopesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    scopeBadge: {
      backgroundColor: isDark ? '#1f2937' : '#e5e7eb',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    scopeText: {
      fontSize: 11,
      color: isDark ? '#9ca3af' : '#6b7280',
      fontFamily: 'monospace',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    connectButton: {
      backgroundColor: '#10b981',
    },
    refreshButton: {
      backgroundColor: '#3b82f6',
    },
    disconnectButton: {
      backgroundColor: '#ef4444',
    },
    settingsButton: {
      backgroundColor: isDark ? '#4b5563' : '#6b7280',
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#ffffff',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    infoText: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
      lineHeight: 16,
      marginTop: 12,
    },
    oauthBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? '#1f2937' : '#dbeafe',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginLeft: 8,
    },
    oauthBadgeText: {
      fontSize: 10,
      color: '#3b82f6',
      fontWeight: '600',
    },
  });

  // Loading state
  if (!isUserLoaded || connectionStatus === undefined) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { justifyContent: 'center' }]}>
          <ActivityIndicator size="small" color={isDark ? '#ffffff' : '#111827'} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="github" size={20} color="#ffffff" />
        </View>
        <View style={styles.headerText}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.title}>GitHub Account</Text>
            <View style={styles.oauthBadge}>
              <Feather name="shield" size={10} color="#3b82f6" />
              <Text style={styles.oauthBadgeText}>OAuth</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Sync your starred repositories</Text>
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusDot,
            isConnected
              ? hasValidToken
                ? styles.connectedDot
                : styles.warningDot
              : styles.disconnectedDot,
          ]}
        />
        <Text
          style={[
            styles.statusText,
            isConnected
              ? hasValidToken
                ? styles.connectedText
                : styles.warningText
              : styles.disconnectedText,
          ]}
        >
          {isConnected
            ? hasValidToken
              ? 'Connected'
              : 'Token Expired'
            : 'Not Connected'}
        </Text>
        {isConnected && githubUsername && (
          <Text style={styles.usernameText}>as @{githubUsername}</Text>
        )}
      </View>

      {/* OAuth Scopes (if connected) */}
      {isConnected && connectionStatus?.scopes && connectionStatus.scopes.length > 0 && (
        <View style={styles.scopesContainer}>
          {connectionStatus.scopes.map((scope: string, index: number) => (
            <View key={index} style={styles.scopeBadge}>
              <Text style={styles.scopeText}>{scope}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {isConnected ? (
          <>
            {!hasValidToken ? (
              <Pressable
                style={[styles.button, styles.refreshButton, isRefreshing && styles.buttonDisabled]}
                onPress={handleRefreshToken}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather name="refresh-cw" size={14} color="#ffffff" />
                )}
                <Text style={styles.buttonText}>
                  {isRefreshing ? 'Refreshing...' : 'Refresh Token'}
                </Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.button, styles.settingsButton]} onPress={openGitHubSettings}>
                <Feather name="external-link" size={14} color="#ffffff" />
                <Text style={styles.buttonText}>GitHub Apps</Text>
              </Pressable>
            )}
            <Pressable style={[styles.button, styles.disconnectButton]} onPress={handleDisconnect}>
              <Feather name="x" size={14} color="#ffffff" />
              <Text style={styles.buttonText}>Disconnect</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.button, styles.connectButton, isConnecting && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="github" size={14} color="#ffffff" />
            )}
            <Text style={styles.buttonText}>
              {isConnecting ? 'Connecting...' : 'Connect with GitHub'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Info Text */}
      <Text style={styles.infoText}>
        {isConnected
          ? hasValidToken
            ? 'Connected via OAuth. Your GitHub access is securely managed through Clerk. No passwords are stored.'
            : 'Your OAuth token has expired. Please refresh to continue syncing repositories.'
          : 'Sign in with GitHub to securely sync your starred repositories. Uses OAuth - no passwords stored.'}
      </Text>
    </View>
  );
};

export default GitHubOAuthCard;
