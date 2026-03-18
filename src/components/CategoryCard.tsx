import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CategoryCardProps {
  category: {
    _id: string;
    name: string;
    description?: string;
    color: string;
    icon?: string;
    metadata?: {
      repositoryCount: number;
      lastUsedAt?: number;
    };
  };
  onPress: () => void;
  onDelete: () => void;
  depth?: number;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  onPress,
  onDelete,
  depth = 0,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleDeletePress = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  };

  const getIconName = (iconName?: string): any => {
    const iconMap: { [key: string]: any } = {
      'book-open': 'book-open',
      'wrench': 'tool',
      'light-bulb': 'zap',
      'briefcase': 'briefcase',
      'code': 'code',
      'database': 'database',
      'globe': 'globe',
      'heart': 'heart',
      'star': 'star',
      'folder': 'folder',
    };
    return iconMap[iconName || 'folder'] || 'folder';
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      marginLeft: depth * 16,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#e5e7eb',
      borderLeftWidth: 4,
      borderLeftColor: category.color,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    leftHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: category.color,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    titleContainer: {
      flex: 1,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 2,
    },
    repositoryCount: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      padding: 4,
    },
    description: {
      fontSize: 14,
      color: isDark ? '#d1d5db' : '#374151',
      lineHeight: 20,
      marginBottom: 8,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lastUsed: {
      fontSize: 12,
      color: isDark ? '#6b7280' : '#9ca3af',
    },
    emptyState: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    emptyText: {
      fontSize: 12,
      color: isDark ? '#6b7280' : '#9ca3af',
      fontStyle: 'italic',
    },
  });

  const formatLastUsed = (timestamp?: number) => {
    if (!timestamp) return null;
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w ago`;
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          <View style={styles.iconContainer}>
            <Feather 
              name={getIconName(category.icon)} 
              size={20} 
              color="#ffffff" 
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.categoryName} numberOfLines={1}>
              {category.name}
            </Text>
            <Text style={styles.repositoryCount}>
              {category.metadata?.repositoryCount || 0} repositories
            </Text>
          </View>
        </View>
        
        <View style={styles.actions}>
          <Pressable style={styles.actionButton}>
            <Feather 
              name="edit-3" 
              size={16} 
              color={isDark ? '#9ca3af' : '#6b7280'} 
            />
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleDeletePress}>
            <Feather 
              name="trash-2" 
              size={16} 
              color="#ef4444" 
            />
          </Pressable>
        </View>
      </View>

      {category.description && (
        <Text style={styles.description} numberOfLines={2}>
          {category.description}
        </Text>
      )}

      <View style={styles.footer}>
        {category.metadata?.repositoryCount === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={12} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={styles.emptyText}>No repositories yet</Text>
          </View>
        ) : (
          <View />
        )}
        
        {category.metadata?.lastUsedAt && (
          <Text style={styles.lastUsed}>
            {formatLastUsed(category.metadata.lastUsedAt)}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export default CategoryCard;
