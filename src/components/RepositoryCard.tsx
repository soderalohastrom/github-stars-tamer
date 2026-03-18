import React from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface RepositoryCardProps {
  repository: any;
  onPress: () => void;
  onCategoryPress?: () => void;
  onAddToList?: () => void;
  listsContaining?: any[];
}

const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  onPress,
  onCategoryPress,
  onAddToList,
  listsContaining = [],
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    repoName: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      flex: 1,
    },
    description: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginBottom: 12,
      lineHeight: 20,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    languageContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    languageColor: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    categoryContainer: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryChip: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    categoryText: {
      fontSize: 12,
      color: isDark ? '#ffffff' : '#374151',
      fontWeight: '500',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
    },
    addToListButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    addToListText: {
      fontSize: 12,
      color: isDark ? '#ffffff' : '#374151',
      fontWeight: '500',
    },
    listBadgesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      flex: 1,
      marginRight: 8,
    },
    listBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? '#3b82f620' : '#eff6ff',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    listBadgeText: {
      fontSize: 11,
      color: '#3b82f6',
      fontWeight: '500',
    },
  });

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.repoName}>{repository.name}</Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {repository.description}
      </Text>
      <View style={styles.footer}>
        <View style={styles.statItem}>
          <Feather name="star" size={14} color="#f59e0b" />
          <Text style={styles.statText}>{repository.stargazersCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="git-branch" size={14} color="#6b7280" />
          <Text style={styles.statText}>{repository.forksCount}</Text>
        </View>
        {repository.language && (
          <View style={styles.languageContainer}>
            <View style={[styles.languageColor, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.statText}>{repository.language}</Text>
          </View>
        )}
      </View>
      {repository.categories && repository.categories.length > 0 && (
        <View style={styles.categoryContainer}>
          {repository.categories.map((category: any) => (
            <Pressable key={category._id} onPress={onCategoryPress} style={styles.categoryChip}>
              <Text style={styles.categoryText}>{category.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {(onAddToList || listsContaining.length > 0) && (
        <View style={styles.actionsRow}>
          <View style={styles.listBadgesContainer}>
            {listsContaining.slice(0, 3).map((list: any) => (
              <View key={list._id} style={styles.listBadge}>
                <Feather name="layers" size={10} color="#3b82f6" />
                <Text style={styles.listBadgeText} numberOfLines={1}>
                  {list.name}
                </Text>
              </View>
            ))}
            {listsContaining.length > 3 && (
              <View style={styles.listBadge}>
                <Text style={styles.listBadgeText}>
                  +{listsContaining.length - 3}
                </Text>
              </View>
            )}
          </View>
          {onAddToList && (
            <Pressable
              style={styles.addToListButton}
              onPress={() => onAddToList()}
            >
              <Feather name="plus" size={14} color={isDark ? '#ffffff' : '#374151'} />
              <Text style={styles.addToListText}>
                {listsContaining.length > 0 ? 'Lists' : 'Add to List'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
};

export default RepositoryCard;