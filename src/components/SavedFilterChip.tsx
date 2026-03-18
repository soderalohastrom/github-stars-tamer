import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Id } from '../../convex/_generated/dataModel';
import { SearchFilters } from './FilterModal';
import { SortOption } from './SortMenu';

export interface SavedFilter {
  _id: Id<'savedFilters'>;
  name: string;
  description?: string;
  query?: string;
  filters: SearchFilters;
  sort?: SortOption;
  isPinned: boolean;
  color?: string;
  icon?: string;
  categoryName?: string;
}

interface SavedFilterChipProps {
  filter: SavedFilter;
  isActive?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

const SavedFilterChip: React.FC<SavedFilterChipProps> = ({
  filter,
  isActive = false,
  onPress,
  onLongPress,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Build a summary of what this filter does
  const buildFilterSummary = (): string => {
    const parts: string[] = [];

    if (filter.query) {
      parts.push(`"${filter.query}"`);
    }
    if (filter.filters.language) {
      parts.push(filter.filters.language);
    }
    if (filter.categoryName) {
      parts.push(filter.categoryName);
    }
    if (filter.filters.minStars) {
      parts.push(`${filter.filters.minStars}+ stars`);
    }
    if (filter.filters.topics && filter.filters.topics.length > 0) {
      parts.push(`${filter.filters.topics.length} topics`);
    }

    return parts.slice(0, 2).join(', ');
  };

  const summary = buildFilterSummary();
  const chipColor = filter.color || '#3b82f6';

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: isActive
        ? chipColor
        : isDark
        ? '#374151'
        : '#f3f4f6',
      borderWidth: 1,
      borderColor: isActive ? chipColor : 'transparent',
      gap: 8,
    },
    pinnedIcon: {
      marginRight: -4,
    },
    iconContainer: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : chipColor + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      maxWidth: 150,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: isActive ? '#ffffff' : isDark ? '#ffffff' : '#374151',
    },
    summary: {
      fontSize: 11,
      color: isActive
        ? 'rgba(255, 255, 255, 0.8)'
        : isDark
        ? '#9ca3af'
        : '#6b7280',
      marginTop: 1,
    },
  });

  // Determine icon to show
  const iconName = filter.icon as keyof typeof Feather.glyphMap || 'filter';

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      {filter.isPinned && (
        <Feather
          name="bookmark"
          size={12}
          color={isActive ? '#ffffff' : chipColor}
          style={styles.pinnedIcon}
        />
      )}
      <View style={styles.iconContainer}>
        <Feather
          name={iconName}
          size={12}
          color={isActive ? '#ffffff' : chipColor}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {filter.name}
        </Text>
        {summary.length > 0 && (
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export default SavedFilterChip;
