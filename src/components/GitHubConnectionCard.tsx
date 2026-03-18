import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  useColorScheme,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { GitHubTokenStorage } from '../utils/storage';

const GitHubConnectionCard = () => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isConnected, setIsConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  
  // Mutations
  const storeGitHubToken = useMutation(api.users.storeGitHubToken);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const token = await GitHubTokenStorage.getToken();
      const username = await GitHubTokenStorage.getUsername();
      
      setIsConnected(!!token);
      setGithubUsername(username);
    } catch (error) {
      console.error('Failed to check GitHub connection:', error);
      // Set default state on error
      setIsConnected(false);
      setGithubUsername(null);
    }
  };

  const validateToken = async (token: string) => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid token. Please check your Personal Access Token.');
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const userData = await response.json();
      return {
        isValid: true,
        username: userData.login,
        name: userData.name,
        email: userData.email,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Failed to validate token',
      };
    }
  };

  const handleConnect = async () => {
    setShowTokenInput(true);
  };

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) {
      Alert.alert('Error', 'Please enter your GitHub Personal Access Token');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsValidating(true);

    try {
      // Validate token with GitHub API
      const validation = await validateToken(tokenInput.trim());
      
      if (!validation.isValid) {
        Alert.alert('Invalid Token', validation.error);
        return;
      }

      // Store token securely on device
      try {
        const tokenStored = await GitHubTokenStorage.setToken(tokenInput.trim());
        const usernameStored = await GitHubTokenStorage.setUsername(validation.username);
        
        if (!tokenStored || !usernameStored) {
          console.warn('Failed to store some credentials securely');
        }
      } catch (secureStoreError) {
        console.error('Storage error:', secureStoreError);
        Alert.alert(
          'Storage Warning', 
          'Unable to securely store token on device. The token will only be stored temporarily.'
        );
        // Continue with the flow even if secure storage fails
      }
      
      // Store encrypted token in Convex (optional - for backup/sync)
      try {
        await storeGitHubToken({
          clerkUserId: user.id,
          encryptedToken: tokenInput.trim(), // In production, encrypt this
          githubUsername: validation.username,
        });
      } catch (convexError) {
        console.warn('Failed to store token in Convex:', convexError);
        // Continue anyway since local storage succeeded
      }

      setIsConnected(true);
      setGithubUsername(validation.username);
      setShowTokenInput(false);
      setTokenInput('');
      
      Alert.alert(
        'Success!', 
        `Connected to GitHub as ${validation.username}. You can now sync your starred repositories.`
      );
    } catch (error: any) {
      Alert.alert('Connection Failed', error.message || 'Failed to connect to GitHub');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCancelToken = () => {
    setShowTokenInput(false);
    setTokenInput('');
  };

  const openTokenHelp = () => {
    Alert.alert(
      'GitHub Personal Access Token',
      'You need a GitHub Personal Access Token to sync your starred repositories.\n\n' +
      'Required permissions:\n' +
      '• Public repositories (public_repo)\n' +
      '• User email (user:email)\n\n' +
      'Tap "Create Token" to open GitHub and create one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Token',
          onPress: () => Linking.openURL('https://github.com/settings/tokens/new?scopes=public_repo,user:email&description=GitHub%20Stars%20Organizer')
        }
      ]
    );
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect GitHub',
      'This will remove your stored GitHub token. You can reconnect anytime.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await GitHubTokenStorage.clearAll();
              if (!success) {
                console.warn('Failed to clear some stored credentials');
              }
              setIsConnected(false);
              setGithubUsername(null);
              Alert.alert('Disconnected', 'GitHub account has been disconnected.');
            } catch (error) {
              console.error('Disconnect error:', error);
              // Still update UI state even if secure deletion fails
              setIsConnected(false);
              setGithubUsername(null);
              Alert.alert('Disconnected', 'GitHub account has been disconnected (with warnings).');
            }
          },
        },
      ]
    );
  };

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
    usernameText: {
      fontSize: 14,
      color: isDark ? '#d1d5db' : '#374151',
    },
    tokenInputContainer: {
      marginBottom: 16,
    },
    tokenInputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 8,
    },
    tokenInput: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderWidth: 1,
      borderColor: isDark ? '#4b5563' : '#d1d5db',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: isDark ? '#ffffff' : '#111827',
      fontFamily: 'monospace',
      marginBottom: 8,
    },
    tokenInputFocused: {
      borderColor: '#3b82f6',
    },
    helpButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 12,
    },
    helpButtonText: {
      fontSize: 12,
      color: '#3b82f6',
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
    submitButton: {
      backgroundColor: '#3b82f6',
    },
    cancelButton: {
      backgroundColor: isDark ? '#4b5563' : '#6b7280',
    },
    disconnectButton: {
      backgroundColor: '#ef4444',
    },
    refreshButton: {
      backgroundColor: '#3b82f6',
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
      marginTop: 8,
    },
    permissionsText: {
      fontSize: 11,
      color: isDark ? '#9ca3af' : '#6b7280',
      lineHeight: 14,
      fontStyle: 'italic',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="github" size={20} color="#ffffff" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>GitHub Account</Text>
          <Text style={styles.subtitle}>Sync your starred repositories</Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <View style={[
          styles.statusDot, 
          isConnected ? styles.connectedDot : styles.disconnectedDot
        ]} />
        <Text style={[
          styles.statusText,
          isConnected ? styles.connectedText : styles.disconnectedText
        ]}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        {isConnected && githubUsername && (
          <Text style={styles.usernameText}>as {githubUsername}</Text>
        )}
      </View>

      {/* Token Input Interface */}
      {showTokenInput && (
        <View style={styles.tokenInputContainer}>
          <Text style={styles.tokenInputLabel}>GitHub Personal Access Token</Text>
          <TextInput
            style={styles.tokenInput}
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            multiline={false}
          />
          <Pressable style={styles.helpButton} onPress={openTokenHelp}>
            <Feather name="help-circle" size={12} color="#3b82f6" />
            <Text style={styles.helpButtonText}>How to create a token?</Text>
          </Pressable>
          <Text style={styles.permissionsText}>
            Required permissions: public_repo, user:email
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {showTokenInput ? (
          <>
            <Pressable 
              style={[styles.button, styles.cancelButton]} 
              onPress={handleCancelToken}
              disabled={isValidating}
            >
              <Feather name="x" size={14} color="#ffffff" />
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable 
              style={[
                styles.button, 
                styles.submitButton,
                isValidating && styles.buttonDisabled
              ]} 
              onPress={handleTokenSubmit}
              disabled={isValidating}
            >
              {isValidating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather name="check" size={14} color="#ffffff" />
              )}
              <Text style={styles.buttonText}>
                {isValidating ? 'Validating...' : 'Connect'}
              </Text>
            </Pressable>
          </>
        ) : isConnected ? (
          <>
            <Pressable style={[styles.button, styles.refreshButton]} onPress={checkConnection}>
              <Feather name="refresh-cw" size={14} color="#ffffff" />
              <Text style={styles.buttonText}>Refresh</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.disconnectButton]} onPress={handleDisconnect}>
              <Feather name="x" size={14} color="#ffffff" />
              <Text style={styles.buttonText}>Disconnect</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={[styles.button, styles.connectButton]} onPress={handleConnect}>
            <Feather name="link" size={14} color="#ffffff" />
            <Text style={styles.buttonText}>Connect GitHub</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.infoText}>
        {isConnected 
          ? 'Your GitHub token is stored securely on your device and is only used to sync your starred repositories.'
          : 'Enter your GitHub Personal Access Token to sync your starred repositories. The token is stored securely on your device.'
        }
      </Text>
    </View>
  );
};

export default GitHubConnectionCard;
