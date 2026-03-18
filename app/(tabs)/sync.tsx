import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  useColorScheme,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Doc } from '../../convex/_generated/dataModel';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// Components
import LoadingSpinner from '../../src/components/LoadingSpinner';
import SyncStatusCard from '../../src/components/SyncStatusCard';

const SyncScreen = () => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  // Queries
  const syncHistory = useQuery(
    api.syncHistory.getSyncHistory,
    user?.id ? { clerkUserId: user.id, limit: 5 } : 'skip'
  );

  const latestSync = useQuery(
    api.syncHistory.getLatestSyncStatus,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const repositoryStats = useQuery(
    api.repositories.getRepositoryStats,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // Query GitHub connection status (OAuth)
  const githubStatus = useQuery(
    api.github.getGithubConnectionStatus,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // Check if GitHub is connected via OAuth
  const isGithubConnected = githubStatus?.isConnected || false;

  // Actions
  const syncStarredRepos = useAction(api.sync.syncStarredRepositories);
  const getRateLimit = useAction(api.sync.getRateLimitStatus);

  const handleFullSync = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in first.');
      return;
    }

    if (!isGithubConnected) {
      Alert.alert(
        'GitHub Not Connected',
        'Please connect your GitHub account first to sync your starred repositories.',
        [
          {
            text: 'Go to Profile',
            onPress: () => router.push('/(tabs)/profile'),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setIsSyncing(true);
    setSyncProgress('Starting sync...');

    try {
      // No token parameter needed - fetched from database via OAuth
      const result = await syncStarredRepos({
        clerkUserId: user.id,
        fullSync: true,
      });

      setSyncProgress(`Sync completed: ${result.repositoriesAdded} added, ${result.repositoriesUpdated} updated`);

      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress('');
      }, 2000);

      Alert.alert(
        'Sync Completed',
        `Successfully synced ${result.repositoriesProcessed} repositories.\n\n` +
        `Added: ${result.repositoriesAdded}\n` +
        `Updated: ${result.repositoriesUpdated}\n` +
        `API calls used: ${result.apiCallsUsed}\n` +
        `Rate limit remaining: ${result.rateLimitRemaining}`
      );
    } catch (error: any) {
      setIsSyncing(false);
      setSyncProgress('');

      // Check for specific OAuth-related errors
      if (error.message?.includes('reconnect') || error.message?.includes('token')) {
        Alert.alert(
          'GitHub Connection Issue',
          'Your GitHub connection needs to be refreshed. Please reconnect your account.',
          [
            {
              text: 'Go to Profile',
              onPress: () => router.push('/(tabs)/profile'),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'Sync Failed',
          error.message || 'An error occurred during sync'
        );
      }
    }
  };

  const handleIncrementalSync = async () => {
    if (!user?.id || !isGithubConnected) return;

    setIsSyncing(true);
    setSyncProgress('Checking for new repositories...');

    try {
      // No token parameter needed - fetched from database via OAuth
      const result = await syncStarredRepos({
        clerkUserId: user.id,
        fullSync: false,
      });

      setSyncProgress('Incremental sync completed');

      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress('');
      }, 1500);

      if (result.repositoriesAdded > 0 || result.repositoriesUpdated > 0) {
        Alert.alert(
          'Sync Completed',
          `Found ${result.repositoriesAdded + result.repositoriesUpdated} changes.`
        );
      }
    } catch (error: any) {
      setIsSyncing(false);
      setSyncProgress('');
      Alert.alert('Sync Failed', error.message || 'An error occurred during sync');
    }
  };

  const checkRateLimit = async () => {
    if (!user?.id || !isGithubConnected) {
      Alert.alert('Error', 'GitHub account not connected.');
      return;
    }

    try {
      // Use clerkUserId for OAuth-based token retrieval
      const rateLimit = await getRateLimit({ clerkUserId: user.id });
      Alert.alert(
        'GitHub Rate Limit Status',
        `Core API: ${rateLimit.core.remaining}/${rateLimit.core.limit} remaining\n` +
        `Reset time: ${new Date(rateLimit.core.reset * 1000).toLocaleTimeString()}\n\n` +
        `Search API: ${rateLimit.search.remaining}/${rateLimit.search.limit} remaining`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to check rate limit status');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f0f23' : '#f9fafb',
    },
    header: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 16,
    },
    buttonContainer: {
      gap: 12,
    },
    primaryButton: {
      backgroundColor: '#3b82f6',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryButtonDisabled: {
      backgroundColor: '#9ca3af',
    },
    secondaryButton: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    outlineButton: {
      borderWidth: 2,
      borderColor: isDark ? '#374151' : '#d1d5db',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButtonText: {
      color: isDark ? '#ffffff' : '#374151',
      fontSize: 16,
      fontWeight: '600',
    },
    outlineButtonText: {
      color: isDark ? '#ffffff' : '#374151',
      fontSize: 16,
      fontWeight: '600',
    },
    progressContainer: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    progressText: {
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: '#3b82f6',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
    },
    syncHistoryContainer: {
      gap: 12,
    },
    connectionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    },
    connectionBannerTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    connectionBannerText: {
      fontSize: 12,
    },
  });

  const formatLastSync = () => {
    if (!repositoryStats?.lastSyncAt) {
      return 'Never synced';
    }
    
    const lastSync = new Date(repositoryStats.lastSyncAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sync</Text>
        <Text style={styles.headerSubtitle}>
          Keep your repositories up to date with GitHub
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* GitHub Connection Banner */}
        {!isGithubConnected && (
          <Pressable
            style={[styles.connectionBanner, { backgroundColor: isDark ? '#422006' : '#fef3c7' }]}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Feather name="alert-circle" size={20} color="#d97706" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.connectionBannerTitle, { color: isDark ? '#fcd34d' : '#92400e' }]}>
                GitHub Not Connected
              </Text>
              <Text style={[styles.connectionBannerText, { color: isDark ? '#fde68a' : '#b45309' }]}>
                Connect your GitHub account to sync starred repositories.
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#d97706" />
          </Pressable>
        )}

        {/* Progress Indicator */}
        {isSyncing && (
          <View style={styles.progressContainer}>
            <LoadingSpinner size="small" />
            <Text style={styles.progressText}>{syncProgress}</Text>
          </View>
        )}

        {/* Repository Stats */}
        {repositoryStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repository Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{repositoryStats.totalCount}</Text>
                <Text style={styles.statLabel}>Total Repos</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{repositoryStats.totalStars}</Text>
                <Text style={styles.statLabel}>Total Stars</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatLastSync()}</Text>
                <Text style={styles.statLabel}>Last Sync</Text>
              </View>
            </View>
          </View>
        )}

        {/* Sync Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Actions</Text>
          <View style={styles.buttonContainer}>
            <Pressable
              style={[
                styles.primaryButton,
                (isSyncing || !isGithubConnected) && styles.primaryButtonDisabled,
              ]}
              onPress={handleFullSync}
              disabled={isSyncing || !isGithubConnected}
            >
              <Feather name="refresh-cw" size={20} color="#ffffff" />
              <Text style={styles.primaryButtonText}>
                {isSyncing ? 'Syncing...' : 'Full Sync'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryButton,
                (isSyncing || !isGithubConnected) && styles.primaryButtonDisabled,
              ]}
              onPress={handleIncrementalSync}
              disabled={isSyncing || !isGithubConnected}
            >
              <Feather name="download" size={20} color={isDark ? '#ffffff' : '#374151'} />
              <Text style={styles.secondaryButtonText}>Quick Sync</Text>
            </Pressable>

            <Pressable
              style={[styles.outlineButton, !isGithubConnected && styles.primaryButtonDisabled]}
              onPress={checkRateLimit}
              disabled={!isGithubConnected}
            >
              <Feather name="activity" size={20} color={isDark ? '#ffffff' : '#374151'} />
              <Text style={styles.outlineButtonText}>Check Rate Limit</Text>
            </Pressable>
          </View>
        </View>

        {/* Sync History */}
        {syncHistory && syncHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Syncs</Text>
            <View style={styles.syncHistoryContainer}>
              {syncHistory.map((sync: Doc<"syncHistory">) => (
                <SyncStatusCard key={sync._id} sync={sync} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SyncScreen;
