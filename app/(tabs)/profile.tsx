import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  useColorScheme,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// Components
import UserAvatar from '../../src/components/UserAvatar';
import PreferenceItem from '../../src/components/PreferenceItem';
import GitHubOAuthCard from '../../src/components/GitHubOAuthCard';

const ProfileScreen = () => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Queries
  const userProfile = useQuery(
    api.users.getUserProfile,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const repositoryStats = useQuery(
    api.repositories.getRepositoryStats,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // Mutations
  const updatePreferences = useMutation(api.users.updateUserPreferences);

  const handlePreferenceUpdate = async (key: string, value: any) => {
    if (!user?.id) return;

    try {
      await updatePreferences({
        clerkUserId: user.id,
        preferences: { [key]: value },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await signOut();
              router.replace('/(auth)/welcome');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'This feature will allow you to export your categories and repository organization. Coming soon!',
      [{ text: 'OK' }]
    );
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'This feature will allow you to import categories and repository organization from a file. Coming soon!',
      [{ text: 'OK' }]
    );
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
    content: {
      flex: 1,
    },
    section: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      marginVertical: 8,
      paddingVertical: 20,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 16,
    },
    userInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    userDetails: {
      flex: 1,
      marginLeft: 16,
    },
    userName: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginBottom: 8,
    },
    userStats: {
      flexDirection: 'row',
      gap: 16,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: '#3b82f6',
    },
    statLabel: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginTop: 2,
    },
    preferenceItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    preferenceItemLast: {
      borderBottomWidth: 0,
    },
    preferenceLabel: {
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    actionButtonLast: {
      borderBottomWidth: 0,
    },
    actionButtonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    actionButtonText: {
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
    },
    actionButtonDestructive: {
      color: '#ef4444',
    },
    version: {
      textAlign: 'center',
      fontSize: 12,
      color: isDark ? '#6b7280' : '#9ca3af',
      marginTop: 20,
      marginBottom: 10,
    },
  });

  const themeOptions = [
    { label: 'System', value: 'system' },
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ];

  const sortOptions = [
    { label: 'Recently Starred', value: 'created' },
    { label: 'Recently Updated', value: 'updated' },
    { label: 'Most Stars', value: 'stars' },
    { label: 'Name', value: 'name' },
  ];

  const syncOptions = [
    { label: 'Manual', value: 'manual' },
    { label: 'Daily', value: 'daily' },
    { label: 'Hourly', value: 'hourly' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* User Info Section */}
        <View style={styles.section}>
          <View style={styles.userInfoContainer}>
            <UserAvatar 
              imageUrl={user?.imageUrl} 
              name={user?.fullName || user?.firstName || 'User'}
              size={64}
            />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {user?.fullName || `${user?.firstName} ${user?.lastName}`.trim()}
              </Text>
              <Text style={styles.userEmail}>
                {user?.primaryEmailAddress?.emailAddress}
              </Text>
              {repositoryStats && (
                <View style={styles.userStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{repositoryStats.totalCount}</Text>
                    <Text style={styles.statLabel}>Repos</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{repositoryStats.totalStars}</Text>
                    <Text style={styles.statLabel}>Stars</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{repositoryStats.topLanguages.length}</Text>
                    <Text style={styles.statLabel}>Languages</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* GitHub Connection (OAuth) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GitHub Connection</Text>
          <GitHubOAuthCard />
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <PreferenceItem
            title="Theme"
            options={themeOptions}
            value={userProfile?.preferences?.theme || 'system'}
            onValueChange={(value) => handlePreferenceUpdate('theme', value)}
          />
          
          <PreferenceItem
            title="Default Sort"
            options={sortOptions}
            value={userProfile?.preferences?.defaultSort || 'created'}
            onValueChange={(value) => handlePreferenceUpdate('defaultSort', value)}
          />
          
          <PreferenceItem
            title="Sync Frequency"
            options={syncOptions}
            value={userProfile?.preferences?.syncFrequency || 'manual'}
            onValueChange={(value) => handlePreferenceUpdate('syncFrequency', value)}
          />
          
          <View style={[styles.preferenceItem, styles.preferenceItemLast]}>
            <Text style={styles.preferenceLabel}>Haptic Feedback</Text>
            <Switch
              value={userProfile?.preferences?.enableHaptics ?? true}
              onValueChange={(value) => handlePreferenceUpdate('enableHaptics', value)}
              trackColor={{ false: '#767577', true: '#3b82f6' }}
              thumbColor={isDark ? '#ffffff' : '#ffffff'}
            />
          </View>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <Pressable style={styles.actionButton} onPress={handleExportData}>
            <View style={styles.actionButtonLeft}>
              <Feather name="download" size={20} color={isDark ? '#ffffff' : '#111827'} />
              <Text style={styles.actionButtonText}>Export Data</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
          </Pressable>
          
          <Pressable style={[styles.actionButton, styles.actionButtonLast]} onPress={handleImportData}>
            <View style={styles.actionButtonLeft}>
              <Feather name="upload" size={20} color={isDark ? '#ffffff' : '#111827'} />
              <Text style={styles.actionButtonText}>Import Data</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
          </Pressable>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <Pressable style={[styles.actionButton, styles.actionButtonLast]} onPress={handleSignOut}>
            <View style={styles.actionButtonLeft}>
              <Feather name="log-out" size={20} color="#ef4444" />
              <Text style={[styles.actionButtonText, styles.actionButtonDestructive]}>
                {isSigningOut ? 'Signing Out...' : 'Sign Out'}
              </Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.version}>GitHub Stars Organizer v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
