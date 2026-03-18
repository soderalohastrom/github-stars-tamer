import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// Components
import RepositoryCard from '../../src/components/RepositoryCard';
import SearchBar from '../../src/components/SearchBar';
import FilterModal, { SearchFilters } from '../../src/components/FilterModal';
import SortMenu, { SortOption, SortField } from '../../src/components/SortMenu';
import SavedFilterChip, { SavedFilter } from '../../src/components/SavedFilterChip';
import SaveFilterModal from '../../src/components/SaveFilterModal';

const SearchScreen = () => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({});
  const [sort, setSort] = useState<SortOption>({ field: 'starredAt', order: 'desc' });
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);

  // Modal state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [saveFilterModalVisible, setSaveFilterModalVisible] = useState(false);

  // Queries
  const searchResults = useQuery(
    api.search.searchRepositories,
    user?.id
      ? {
          clerkUserId: user.id,
          query: searchQuery || undefined,
          filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
          sort,
          limit: 50,
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

  const categories = useQuery(
    api.categories.getUserCategories,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const savedFilters = useQuery(
    api.savedFilters.list,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const recentSearches = useQuery(
    api.search.getRecentSearches,
    user?.id ? { clerkUserId: user.id, limit: 5 } : 'skip'
  );

  // Mutations
  const recordSearch = useMutation(api.search.recordSearch);
  const createSavedFilter = useMutation(api.savedFilters.create);
  const recordFilterUsage = useMutation(api.savedFilters.recordUsage);
  const deleteSavedFilter = useMutation(api.savedFilters.remove);
  const toggleFilterPin = useMutation(api.savedFilters.togglePin);

  // Flatten categories for the filter modal
  const flattenCategories = (cats: any[], result: any[] = []): any[] => {
    if (!cats) return result;
    for (const cat of cats) {
      result.push({ _id: cat._id, name: cat.name, color: cat.color });
      if (cat.children && cat.children.length > 0) {
        flattenCategories(cat.children, result);
      }
    }
    return result;
  };

  const flatCategories = flattenCategories(categories || []);

  // Search handler (called after debounce)
  const handleSearch = useCallback(
    async (query: string) => {
      // Clear active saved filter when manually searching
      if (activeSavedFilterId) {
        setActiveSavedFilterId(null);
      }

      // Record search in history if there's a query or filters
      if (user?.id && (query.length > 0 || Object.keys(activeFilters).length > 0)) {
        const resultCount = searchResults?.totalCount || 0;
        await recordSearch({
          clerkUserId: user.id,
          query,
          filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
          sort,
          resultCount,
        });
      }
    },
    [user?.id, activeFilters, sort, searchResults?.totalCount, activeSavedFilterId]
  );

  // Apply filters from modal
  const handleApplyFilters = useCallback((filters: SearchFilters) => {
    setActiveFilters(filters);
    setActiveSavedFilterId(null);
  }, []);

  // Apply saved filter
  const handleApplySavedFilter = useCallback(
    async (filter: SavedFilter) => {
      setSearchQuery(filter.query || '');
      setActiveFilters(filter.filters);
      if (filter.sort) {
        setSort(filter.sort);
      }
      setActiveSavedFilterId(filter._id);

      // Record usage
      if (user?.id) {
        await recordFilterUsage({
          clerkUserId: user.id,
          filterId: filter._id,
        });
      }
    },
    [user?.id]
  );

  // Long press on saved filter - show options
  const handleSavedFilterLongPress = useCallback(
    (filter: SavedFilter) => {
      Alert.alert(filter.name, 'What would you like to do?', [
        {
          text: filter.isPinned ? 'Unpin' : 'Pin',
          onPress: async () => {
            if (user?.id) {
              await toggleFilterPin({
                clerkUserId: user.id,
                filterId: filter._id,
              });
            }
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (user?.id) {
              await deleteSavedFilter({
                clerkUserId: user.id,
                filterId: filter._id,
              });
              if (activeSavedFilterId === filter._id) {
                setActiveSavedFilterId(null);
              }
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [user?.id, activeSavedFilterId]
  );

  // Save current filter
  const handleSaveFilter = useCallback(
    async (data: { name: string; description?: string; color?: string; icon?: string }) => {
      if (!user?.id) return;

      await createSavedFilter({
        clerkUserId: user.id,
        name: data.name,
        description: data.description,
        query: searchQuery || undefined,
        filters: activeFilters,
        sort,
        color: data.color,
        icon: data.icon,
      });
    },
    [user?.id, searchQuery, activeFilters, sort]
  );

  // Apply recent search
  const handleApplyRecentSearch = useCallback((search: any) => {
    setSearchQuery(search.query);
    if (search.filters) {
      setActiveFilters(search.filters);
    }
    if (search.sort) {
      setSort(search.sort);
    }
    setActiveSavedFilterId(null);
  }, []);

  const handleRepositoryPress = (repository: any) => {
    router.push({
      pathname: '/repository/[id]',
      params: { id: repository._id },
    });
  };

  // Check if filters are active
  const hasActiveFilters = Object.keys(activeFilters).length > 0;
  const hasSearchOrFilters = searchQuery.length > 0 || hasActiveFilters;
  const canSaveFilter = hasSearchOrFilters;

  // Count active filters for badge
  const activeFilterCount = Object.values(activeFilters).filter(
    (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f0f23' : '#f9fafb',
    },
    header: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#111827',
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
    },
    iconButtonActive: {
      backgroundColor: '#3b82f6',
    },
    filterBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: '#ef4444',
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    filterBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#ffffff',
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    savedFiltersContainer: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    savedFiltersScroll: {
      paddingHorizontal: 20,
    },
    savedFiltersContent: {
      flexDirection: 'row',
      gap: 8,
    },
    content: {
      flex: 1,
    },
    resultsContainer: {
      flex: 1,
      paddingHorizontal: 20,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
    },
    resultsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
    },
    resultsCount: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
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
    },
    suggestionContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    suggestionSection: {
      marginBottom: 24,
    },
    suggestionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#9ca3af' : '#6b7280',
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    suggestionList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    suggestionItem: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    suggestionText: {
      fontSize: 14,
      color: isDark ? '#ffffff' : '#374151',
    },
    recentSearchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 8,
      gap: 10,
    },
    recentSearchText: {
      flex: 1,
      fontSize: 14,
      color: isDark ? '#ffffff' : '#374151',
    },
    recentSearchMeta: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    activeFiltersBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginHorizontal: 20,
      marginTop: 12,
      borderRadius: 10,
      gap: 8,
    },
    activeFiltersText: {
      flex: 1,
      fontSize: 13,
      color: isDark ? '#93c5fd' : '#1d4ed8',
    },
    clearFiltersButton: {
      padding: 4,
    },
  });

  const renderRepository = ({ item }: { item: any }) => (
    <RepositoryCard
      repository={item}
      onPress={() => handleRepositoryPress(item)}
      onCategoryPress={() => router.push('/(tabs)/categories')}
    />
  );

  const renderEmptyState = () => {
    if (searchQuery.length === 0 && !hasActiveFilters) {
      // Show suggestions when no search
      return (
        <ScrollView style={styles.suggestionContainer} showsVerticalScrollIndicator={false}>
          {/* Recent Searches */}
          {recentSearches && recentSearches.length > 0 && (
            <View style={styles.suggestionSection}>
              <Text style={styles.suggestionTitle}>Recent Searches</Text>
              {recentSearches.map((search: { query: string; filters?: SearchFilters; sort?: SortOption; resultCount: number }, index: number) => (
                <Pressable
                  key={index}
                  style={styles.recentSearchItem}
                  onPress={() => handleApplyRecentSearch(search)}
                >
                  <Feather
                    name="clock"
                    size={16}
                    color={isDark ? '#9ca3af' : '#6b7280'}
                  />
                  <Text style={styles.recentSearchText} numberOfLines={1}>
                    {search.query || 'Filter search'}
                  </Text>
                  <Text style={styles.recentSearchMeta}>
                    {search.resultCount} results
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Languages */}
          {languages && languages.length > 0 && (
            <View style={styles.suggestionSection}>
              <Text style={styles.suggestionTitle}>Languages</Text>
              <View style={styles.suggestionList}>
                {languages.slice(0, 8).map((lang: { language: string; count: number }, index: number) => (
                  <Pressable
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => {
                      setActiveFilters({ language: lang.language });
                    }}
                  >
                    <Text style={styles.suggestionText}>
                      {lang.language} ({lang.count})
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Topics */}
          {topics && topics.length > 0 && (
            <View style={styles.suggestionSection}>
              <Text style={styles.suggestionTitle}>Popular Topics</Text>
              <View style={styles.suggestionList}>
                {topics.slice(0, 12).map((topic: { topic: string; count: number }, index: number) => (
                  <Pressable
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => setSearchQuery(topic.topic)}
                  >
                    <Text style={styles.suggestionText}>
                      {topic.topic} ({topic.count})
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      );
    }

    // No results found
    return (
      <View style={styles.emptyContainer}>
        <Feather name="search" size={64} color="#9ca3af" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No Results Found</Text>
        <Text style={styles.emptyDescription}>
          Try adjusting your search terms or filters to find what you're looking for.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Search</Text>
          <View style={styles.headerButtons}>
            {/* Save Filter Button */}
            {canSaveFilter && (
              <Pressable
                style={styles.iconButton}
                onPress={() => setSaveFilterModalVisible(true)}
              >
                <Feather
                  name="bookmark"
                  size={20}
                  color={isDark ? '#ffffff' : '#374151'}
                />
              </Pressable>
            )}

            {/* Filter Button */}
            <Pressable
              style={[styles.iconButton, hasActiveFilters && styles.iconButtonActive]}
              onPress={() => setFilterModalVisible(true)}
            >
              <Feather
                name="sliders"
                size={20}
                color={hasActiveFilters ? '#ffffff' : isDark ? '#ffffff' : '#374151'}
              />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <View style={{ flex: 1 }}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSearch={handleSearch}
              placeholder="Search repositories..."
              debounceMs={300}
              isLoading={searchResults === undefined && hasSearchOrFilters}
            />
          </View>
          <SortMenu currentSort={sort} onSortChange={setSort} />
        </View>
      </View>

      {/* Saved Filters */}
      {savedFilters && savedFilters.length > 0 && (
        <View style={styles.savedFiltersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedFiltersScroll}
          >
            <View style={styles.savedFiltersContent}>
              {savedFilters.map((filter: SavedFilter) => (
                <SavedFilterChip
                  key={filter._id}
                  filter={filter}
                  isActive={activeSavedFilterId === filter._id}
                  onPress={() => handleApplySavedFilter(filter)}
                  onLongPress={() => handleSavedFilterLongPress(filter)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <View style={styles.activeFiltersBar}>
          <Feather name="filter" size={16} color={isDark ? '#93c5fd' : '#1d4ed8'} />
          <Text style={styles.activeFiltersText} numberOfLines={1}>
            {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            {activeFilters.language && ` - ${activeFilters.language}`}
            {activeFilters.minStars && ` - ${activeFilters.minStars}+ stars`}
          </Text>
          <Pressable
            style={styles.clearFiltersButton}
            onPress={() => {
              setActiveFilters({});
              setActiveSavedFilterId(null);
            }}
          >
            <Feather name="x" size={18} color={isDark ? '#93c5fd' : '#1d4ed8'} />
          </Pressable>
        </View>
      )}

      <View style={styles.content}>
        {searchResults && searchResults.results.length > 0 ? (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {searchQuery ? 'Search Results' : 'Filtered Results'}
              </Text>
              <Text style={styles.resultsCount}>
                {searchResults.totalCount} repositor{searchResults.totalCount !== 1 ? 'ies' : 'y'}
              </Text>
            </View>
            <FlatList
              data={searchResults.results}
              renderItem={renderRepository}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        ) : (
          renderEmptyState()
        )}
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        initialFilters={activeFilters}
        languages={languages || []}
        topics={topics || []}
        categories={flatCategories}
      />

      {/* Save Filter Modal */}
      <SaveFilterModal
        visible={saveFilterModalVisible}
        onClose={() => setSaveFilterModalVisible(false)}
        onSave={handleSaveFilter}
        searchQuery={searchQuery}
        filters={activeFilters}
        sort={sort}
      />
    </SafeAreaView>
  );
};

export default SearchScreen;
