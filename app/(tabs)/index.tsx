import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// Components
import RepositoryCard from '../../src/components/RepositoryCard';
import LoadingSpinner from '../../src/components/LoadingSpinner';
import ErrorMessage from '../../src/components/ErrorMessage';
import AIOrganizeButton from '../../src/components/AIOrganizeButton';
import AIUndoButton from '../../src/components/AIUndoButton';
import AISuggestionsReview from '../../src/components/AISuggestionsReview';
import AddToListModal from '../../src/components/AddToListModal';
import CreateListModal from '../../src/components/CreateListModal';

const RepositoriesScreen = () => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'starred_at' | 'name' | 'stars' | 'updated'>('starred_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // AI-related state
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiProcessingJobId, setAiProcessingJobId] = useState<string | null>(null);

  // List-related state
  const [addToListModalVisible, setAddToListModalVisible] = useState(false);
  const [createListModalVisible, setCreateListModalVisible] = useState(false);
  const [selectedRepoForList, setSelectedRepoForList] = useState<any>(null);

  // Queries
  const repositories = useQuery(
    api.repositories.getUserRepositories,
    user?.id
      ? {
          clerkUserId: user.id,
          sort: sortBy,
          direction: sortDirection,
        }
      : 'skip'
  );

  const repositoryStats = useQuery(
    api.repositories.getRepositoryStats,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // AI-related queries
  const aiSettings = useQuery(
    api.ai.getAiSettings,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const pendingSuggestions = useQuery(
    api.ai.getUserSuggestions,
    user?.id ? { clerkUserId: user.id, status: 'pending' } : 'skip'
  );

  // Mutations
  const addToCategory = useMutation(api.repositories.addRepositoryToCategory);
  const removeFromCategory = useMutation(api.repositories.removeRepositoryFromCategory);

  // List-related queries and mutations
  const userLists = useQuery(
    api.lists.getMyLists,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const listsForSelectedRepo = useQuery(
    api.lists.getListsForRepository,
    user?.id && selectedRepoForList
      ? { clerkUserId: user.id, repositoryId: selectedRepoForList._id as Id<'repositories'> }
      : 'skip'
  );

  const addToList = useMutation(api.lists.addRepository);
  const removeFromList = useMutation(api.lists.removeRepository);
  const createList = useMutation(api.lists.create);

  const onRefresh = async () => {
    setRefreshing(true);
    // Trigger a manual sync
    router.push('/(tabs)/sync');
    setRefreshing(false);
  };

  const handleRepositoryPress = (repository: any) => {
    router.push({
      pathname: '/repository/[id]',
      params: { id: repository._id },
    });
  };

  const handleCategoryPress = () => {
    router.push('/(tabs)/categories');
  };

  const showSortOptions = () => {
    Alert.alert(
      'Sort Repositories',
      'Choose how to sort your repositories',
      [
        {
          text: 'Recently Starred',
          onPress: () => {
            setSortBy('starred_at');
            setSortDirection('desc');
          },
        },
        {
          text: 'Name (A-Z)',
          onPress: () => {
            setSortBy('name');
            setSortDirection('asc');
          },
        },
        {
          text: 'Most Stars',
          onPress: () => {
            setSortBy('stars');
            setSortDirection('desc');
          },
        },
        {
          text: 'Recently Updated',
          onPress: () => {
            setSortBy('updated');
            setSortDirection('desc');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // AI-related handlers
  const handleAIProcessingStart = () => {
    console.log('AI processing started');
  };

  const handleAIProcessingComplete = (result: any) => {
    console.log('AI processing complete:', result);
    setAiProcessingJobId(result.jobId);
    setShowAISuggestions(true);
  };

  const handleAIUndo = () => {
    console.log('AI undo completed');
  };

  const handleOpenAISettings = () => {
    router.push('/ai-settings');
  };

  // List handlers
  const handleAddToListPress = (repo: any) => {
    setSelectedRepoForList(repo);
    setAddToListModalVisible(true);
  };

  const handleAddRepoToList = async (listId: string) => {
    if (!user?.id || !selectedRepoForList) return;
    try {
      await addToList({
        clerkUserId: user.id,
        listId: listId as Id<'lists'>,
        repositoryId: selectedRepoForList._id as Id<'repositories'>,
      });
    } catch (error: any) {
      if (error.message?.includes('already in this list')) {
        // Ignore if already in list
      } else {
        Alert.alert('Error', 'Failed to add to list');
      }
    }
  };

  const handleRemoveRepoFromList = async (listId: string) => {
    if (!user?.id || !selectedRepoForList) return;
    try {
      await removeFromList({
        clerkUserId: user.id,
        listId: listId as Id<'lists'>,
        repositoryId: selectedRepoForList._id as Id<'repositories'>,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to remove from list');
    }
  };

  const handleCreateNewList = () => {
    setAddToListModalVisible(false);
    setCreateListModalVisible(true);
  };

  const handleCreateList = async (listData: {
    name: string;
    description?: string;
    visibility: 'private' | 'public';
    color: string;
    icon: string;
  }) => {
    if (!user?.id) return;
    try {
      const newListId = await createList({
        clerkUserId: user.id,
        ...listData,
      });
      setCreateListModalVisible(false);
      // Reopen the add to list modal to add the repo to the new list
      if (selectedRepoForList) {
        setTimeout(() => {
          setAddToListModalVisible(true);
        }, 300);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create list');
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
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
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
    toolbar: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toolbarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    toolbarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
    },
    toolbarButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#ffffff' : '#374151',
    },
    resultCount: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    content: {
      flex: 1,
    },
    repositoryList: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    syncButton: {
      backgroundColor: '#3b82f6',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    syncButtonText: {
      color: '#ffffff',
      fontWeight: '600',
    },
  });

  if (!repositories) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const renderRepository = ({ item }: { item: any }) => (
    <RepositoryCard
      repository={item}
      onPress={() => handleRepositoryPress(item)}
      onCategoryPress={handleCategoryPress}
      onAddToList={() => handleAddToListPress(item)}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="star" size={64} color="#9ca3af" style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No Starred Repositories</Text>
      <Text style={styles.emptyDescription}>
        Start by syncing your GitHub starred repositories or star some repositories on GitHub to get started.
      </Text>
      <Pressable style={styles.syncButton} onPress={() => router.push('/(tabs)/sync')}>
        <Feather name="refresh-cw" size={16} color="#ffffff" />
        <Text style={styles.syncButtonText}>Sync Now</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Repositories</Text>
        {repositoryStats && (
          <View style={styles.statsContainer}>
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

      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <Pressable style={styles.toolbarButton} onPress={showSortOptions}>
            <Feather name="sliders" size={16} color={isDark ? '#ffffff' : '#374151'} />
            <Text style={styles.toolbarButtonText}>Sort</Text>
          </Pressable>
          
          <Pressable style={styles.toolbarButton} onPress={handleCategoryPress}>
            <Feather name="folder" size={16} color={isDark ? '#ffffff' : '#374151'} />
            <Text style={styles.toolbarButtonText}>Categories</Text>
          </Pressable>

          <Pressable style={styles.toolbarButton} onPress={handleOpenAISettings}>
            <Feather name="settings" size={16} color={isDark ? '#ffffff' : '#374151'} />
            <Text style={styles.toolbarButtonText}>AI</Text>
          </Pressable>
        </View>
        
        <Text style={styles.resultCount}>
          {repositories.length} repositories
        </Text>
      </View>

      <View style={styles.content}>
        {/* AI Components */}
        {aiSettings?.enableAI && repositories && repositories.length > 0 && (
          <>
            <AIOrganizeButton
              selectedRepositories={[]}
              onStartProcessing={handleAIProcessingStart}
              onComplete={handleAIProcessingComplete}
            />
            <AIUndoButton onUndoComplete={handleAIUndo} />
          </>
        )}
        
        <FlatList
          data={repositories}
          renderItem={renderRepository}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.repositoryList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? '#ffffff' : '#000000'}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      </View>

      {/* AI Suggestions Review Modal */}
      <AISuggestionsReview
        visible={showAISuggestions}
        onClose={() => setShowAISuggestions(false)}
        jobId={aiProcessingJobId as any}
      />

      {/* Add to List Modal */}
      <AddToListModal
        visible={addToListModalVisible}
        onClose={() => {
          setAddToListModalVisible(false);
          setSelectedRepoForList(null);
        }}
        lists={userLists || []}
        listsInRepo={(listsForSelectedRepo || []).map((l: any) => l._id)}
        onAddToList={handleAddRepoToList}
        onRemoveFromList={handleRemoveRepoFromList}
        onCreateNewList={handleCreateNewList}
        repositoryName={selectedRepoForList?.name}
      />

      {/* Create List Modal */}
      <CreateListModal
        visible={createListModalVisible}
        onClose={() => setCreateListModalVisible(false)}
        onSubmit={handleCreateList}
      />
    </SafeAreaView>
  );
};

export default RepositoriesScreen;
