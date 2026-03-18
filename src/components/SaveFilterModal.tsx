import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SearchFilters } from './FilterModal';
import { SortOption } from './SortMenu';

interface SaveFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => void;
  searchQuery?: string;
  filters: SearchFilters;
  sort?: SortOption;
}

const colorOptions = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

const iconOptions: Array<{ name: keyof typeof Feather.glyphMap; label: string }> = [
  { name: 'filter', label: 'Filter' },
  { name: 'star', label: 'Star' },
  { name: 'code', label: 'Code' },
  { name: 'terminal', label: 'Terminal' },
  { name: 'cpu', label: 'CPU' },
  { name: 'database', label: 'Database' },
  { name: 'globe', label: 'Globe' },
  { name: 'zap', label: 'Zap' },
  { name: 'heart', label: 'Heart' },
  { name: 'bookmark', label: 'Bookmark' },
  { name: 'folder', label: 'Folder' },
  { name: 'tag', label: 'Tag' },
];

const SaveFilterModal: React.FC<SaveFilterModalProps> = ({
  visible,
  onClose,
  onSave,
  searchQuery,
  filters,
  sort,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  const [selectedIcon, setSelectedIcon] = useState<keyof typeof Feather.glyphMap>('filter');

  const handleSave = () => {
    if (name.trim().length === 0) return;

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color: selectedColor,
      icon: selectedIcon,
    });

    // Reset form
    setName('');
    setDescription('');
    setSelectedColor(colorOptions[0]);
    setSelectedIcon('filter');
    onClose();
  };

  // Build filter summary for preview
  const buildFilterSummary = (): string[] => {
    const parts: string[] = [];

    if (searchQuery) {
      parts.push(`Search: "${searchQuery}"`);
    }
    if (filters.language) {
      parts.push(`Language: ${filters.language}`);
    }
    if (filters.minStars) {
      parts.push(`Min Stars: ${filters.minStars}`);
    }
    if (filters.maxStars && filters.maxStars < 100000) {
      parts.push(`Max Stars: ${filters.maxStars}`);
    }
    if (filters.topics && filters.topics.length > 0) {
      parts.push(`Topics: ${filters.topics.join(', ')}`);
    }
    if (filters.isFork !== undefined) {
      parts.push(filters.isFork ? 'Forks only' : 'No forks');
    }
    if (filters.archived !== undefined) {
      parts.push(filters.archived ? 'Archived only' : 'Not archived');
    }
    if (sort) {
      const sortLabel = {
        stargazersCount: 'Stars',
        starredAt: 'Starred Date',
        updatedAt: 'Updated',
        name: 'Name',
      }[sort.field];
      parts.push(`Sort: ${sortLabel} (${sort.order === 'desc' ? 'High-Low' : 'Low-High'})`);
    }

    return parts;
  };

  const filterSummary = buildFilterSummary();

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    container: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: 20,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#111827',
    },
    closeButton: {
      padding: 4,
    },
    content: {
      padding: 20,
      maxHeight: 400,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#9ca3af' : '#6b7280',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
    },
    multilineInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    colorOption: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorOptionSelected: {
      borderWidth: 3,
      borderColor: isDark ? '#ffffff' : '#111827',
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    iconOption: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconOptionSelected: {
      backgroundColor: selectedColor,
    },
    previewSection: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderRadius: 12,
      padding: 12,
    },
    previewTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#9ca3af' : '#6b7280',
      marginBottom: 8,
    },
    previewItem: {
      fontSize: 13,
      color: isDark ? '#d1d5db' : '#374151',
      marginBottom: 4,
    },
    previewEmpty: {
      fontSize: 13,
      color: isDark ? '#9ca3af' : '#6b7280',
      fontStyle: 'italic',
    },
    footer: {
      flexDirection: 'row',
      padding: 20,
      paddingTop: 0,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#374151',
    },
    saveButton: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: '#3b82f6',
      alignItems: 'center',
    },
    saveButtonDisabled: {
      backgroundColor: isDark ? '#374151' : '#d1d5db',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Save Filter</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather
                name="x"
                size={24}
                color={isDark ? '#9ca3af' : '#6b7280'}
              />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., TypeScript Projects"
                placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="What does this filter find?"
                placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Color Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Color</Text>
              <View style={styles.colorGrid}>
                {colorOptions.map((color) => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Feather name="check" size={18} color="#ffffff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Icon Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconGrid}>
                {iconOptions.map((icon) => (
                  <Pressable
                    key={icon.name}
                    style={[
                      styles.iconOption,
                      selectedIcon === icon.name && styles.iconOptionSelected,
                    ]}
                    onPress={() => setSelectedIcon(icon.name)}
                  >
                    <Feather
                      name={icon.name}
                      size={20}
                      color={
                        selectedIcon === icon.name
                          ? '#ffffff'
                          : isDark
                          ? '#9ca3af'
                          : '#6b7280'
                      }
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Filter Preview */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Filter Settings</Text>
              <View style={styles.previewSection}>
                {filterSummary.length > 0 ? (
                  filterSummary.map((item, index) => (
                    <Text key={index} style={styles.previewItem}>
                      {item}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.previewEmpty}>No filters applied</Text>
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.saveButton,
                name.trim().length === 0 && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={name.trim().length === 0}
            >
              <Text style={styles.saveButtonText}>Save Filter</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SaveFilterModal;
