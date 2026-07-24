import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  useColorScheme,
  useWindowDimensions,
  Alert,
  ScrollView,
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
import StagingPanel from '../../src/components/StagingPanel';
import AddToListModal from '../../src/components/AddToListModal';
import CreateListModal from '../../src/components/CreateListModal';
import FilterChips from '../../src/components/FilterChips';
import ListsManagementModal from '../../src/components/ListsManagementModal';

const RepositoriesScreen = () => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'starred_at' | 'name' | 'stars' | 'updated'>('starred_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Filter state
  const [filters, setFilters] = useState<{language?: string; topics?: string[]; minStars?: number}>({});
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [displayCount, setDisplayCount] = useState(50);

  // List-related state
  const [addToListModalVisible, setAddToListModalVisible] = useState(false);
  const [createListModalVisible, setCreateListModalVisible] = useState(false);
  const [listsModalVisible, setListsModalVisible] = useState(false);
  const [selectedRepoForList, setSelectedRepoForList] = useState<any>(null);

  // Queries
  const repositories = useQuery(
    api.repositories.getUserRepositories,
    user?.id
      ? {
          clerkUserId: user.id,
          sort: sortBy,
          direction: sortDirection,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        }
      : 'skip'
  );

  const languages = useQuery(
    api.repositories.getLanguages,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const topics = useQuery(
    api.repositories.getTopics,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const repositoryStats = useQuery(
    api.repositories.getRepositoryStats,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // AI settings
  const aiSettings = useQuery(
    api.ai.getAiSettings,
    user?.id ? { clerkUserId: user.id } : 'skip'
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

  // Filtered + paginated repository list
  const displayedRepositories = useMemo(() => {
    if (!repositories) return [];
    if (!uncategorizedOnly) return repositories;
    return repositories.filter((repo: any) => !repo.categories || repo.categories.length === 0);
  }, [repositories, uncategorizedOnly]);

  const paginatedRepositories = useMemo(() => {
    return displayedRepositories.slice(0, displayCount);
  }, [displayedRepositories, displayCount]);

  // Reset pagination when filters/sort change
  useEffect(() => {
    setDisplayCount(50);
  }, [sortBy, sortDirection, filters, uncategorizedOnly]);

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
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
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
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
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
      gap: 8,
      paddingRight: 12,
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
    toolbarButtonActive: {
      backgroundColor: '#3b82f6',
    },
    toolbarButtonTextActive: {
      color: '#ffffff',
    },
    filterChipsContainer: {
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
      paddingHorizontal: 20,
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    loadMoreContainer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: 13,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
    },
    repositoryList: {
      width: '100%',
      maxWidth: 980,
      alignSelf: 'center',
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open GitHub sync"
        style={styles.syncButton}
        onPress={() => router.push('/(tabs)/sync')}
      >
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarLeft}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sort repositories"
            style={styles.toolbarButton}
            onPress={showSortOptions}
          >
            <Feather name="sliders" size={16} color={isDark ? '#ffffff' : '#374151'} />
            <Text style={styles.toolbarButtonText}>Sort</Text>
          </Pressable>
          
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open categories"
            style={styles.toolbarButton}
            onPress={handleCategoryPress}
          >
            <Feather name="folder" size={16} color={isDark ? '#ffffff' : '#374151'} />
            <Text style={styles.toolbarButtonText}>Categories</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open AI settings"
            style={styles.toolbarButton}
            onPress={handleOpenAISettings}
          >
            <Feather name="settings" size={16} color={isDark ? '#ffffff' : '#374151'} />
            <Text style={styles.toolbarButtonText}>AI</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage lists"
            style={styles.toolbarButton}
            onPress={() => setListsModalVisible(true)}
          >
            <Feather name="layers" size={16} color={isDark ? '#ffffff' : '#374151'} />
            <Text style={styles.toolbarButtonText}>Lists</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show only uncategorized repositories"
            accessibilityState={{ selected: uncategorizedOnly }}
            style={[styles.toolbarButton, uncategorizedOnly && styles.toolbarButtonActive]}
            onPress={() => setUncategorizedOnly(!uncategorizedOnly)}
          >
            <Feather name="inbox" size={16} color={uncategorizedOnly ? '#ffffff' : isDark ? '#ffffff' : '#374151'} />
            <Text style={[styles.toolbarButtonText, uncategorizedOnly && styles.toolbarButtonTextActive]}>Unsorted</Text>
          </Pressable>
        </ScrollView>

        {!isCompact && (
          <Text style={styles.resultCount}>
            {displayedRepositories.length} repositories
          </Text>
        )}
      </View>

      {/* Quick Filter Chips */}
      <View style={styles.filterChipsContainer}>
        <FilterChips
          availableLanguages={(languages || []).map((l: any) => l.language)}
          availableTopics={(topics || []).map((t: any) => t.topic)}
          onFilterChange={setFilters}
        />
      </View>

      <View style={styles.content}>
        {/* AI Organize + Staging Panel */}
        {aiSettings?.enableAI && repositories && repositories.length > 0 && (
          <StagingPanel
            onOpenAISettings={handleOpenAISettings}
          />
        )}

        <FlatList
          data={paginatedRepositories}
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
          onEndReached={() => {
            if (displayCount < displayedRepositories.length) {
              setDisplayCount(prev => prev + 50);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            displayCount < displayedRepositories.length ? (
              <View style={styles.loadMoreContainer}>
                <Text style={styles.loadMoreText}>
                  Showing {paginatedRepositories.length} of {displayedRepositories.length}
                </Text>
              </View>
            ) : null
          }
        />
      </View>

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

      {/* Lists Management Modal */}
      <ListsManagementModal
        visible={listsModalVisible}
        onClose={() => setListsModalVisible(false)}
        onNavigateToList={(listId) => router.push(`/list/${listId}`)}
      />
    </SafeAreaView>
  );
};

export default RepositoriesScreen;
