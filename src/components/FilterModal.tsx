import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Id } from '../../convex/_generated/dataModel';

export interface SearchFilters {
  language?: string;
  categoryId?: Id<'categories'>;
  minStars?: number;
  maxStars?: number;
  topics?: string[];
  isFork?: boolean;
  archived?: boolean;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
  languages: Array<{ language: string; count: number }>;
  topics: Array<{ topic: string; count: number }>;
  categories: Array<{ _id: Id<'categories'>; name: string; color: string }>;
}

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters = {},
  languages,
  topics,
  categories,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Local state for filters
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(
    initialFilters.language
  );
  const [selectedCategory, setSelectedCategory] = useState<Id<'categories'> | undefined>(
    initialFilters.categoryId
  );
  const [minStars, setMinStars] = useState<number>(initialFilters.minStars || 0);
  const [maxStars, setMaxStars] = useState<number>(initialFilters.maxStars || 100000);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialFilters.topics || []);
  const [showForks, setShowForks] = useState<boolean | undefined>(initialFilters.isFork);
  const [showArchived, setShowArchived] = useState<boolean | undefined>(initialFilters.archived);

  // Reset to initial filters when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedLanguage(initialFilters.language);
      setSelectedCategory(initialFilters.categoryId);
      setMinStars(initialFilters.minStars || 0);
      setMaxStars(initialFilters.maxStars || 100000);
      setSelectedTopics(initialFilters.topics || []);
      setShowForks(initialFilters.isFork);
      setShowArchived(initialFilters.archived);
    }
  }, [visible, initialFilters]);

  const handleApply = () => {
    const filters: SearchFilters = {};

    if (selectedLanguage) filters.language = selectedLanguage;
    if (selectedCategory) filters.categoryId = selectedCategory;
    if (minStars > 0) filters.minStars = minStars;
    if (maxStars < 100000) filters.maxStars = maxStars;
    if (selectedTopics.length > 0) filters.topics = selectedTopics;
    if (showForks !== undefined) filters.isFork = showForks;
    if (showArchived !== undefined) filters.archived = showArchived;

    onApply(filters);
    onClose();
  };

  const handleClear = () => {
    setSelectedLanguage(undefined);
    setSelectedCategory(undefined);
    setMinStars(0);
    setMaxStars(100000);
    setSelectedTopics([]);
    setShowForks(undefined);
    setShowArchived(undefined);
  };

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const formatStars = (value: number): string => {
    if (value >= 100000) return '100k+';
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return String(value);
  };

  const hasActiveFilters =
    selectedLanguage ||
    selectedCategory ||
    minStars > 0 ||
    maxStars < 100000 ||
    selectedTopics.length > 0 ||
    showForks !== undefined ||
    showArchived !== undefined;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
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
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#111827',
    },
    closeButton: {
      padding: 4,
    },
    content: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#9ca3af' : '#6b7280',
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: '#3b82f6',
      borderColor: '#3b82f6',
    },
    chipText: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#d1d5db' : '#374151',
    },
    chipTextActive: {
      color: '#ffffff',
    },
    chipCount: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginLeft: 4,
    },
    chipCountActive: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    sliderContainer: {
      paddingHorizontal: 8,
    },
    sliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sliderLabel: {
      fontSize: 14,
      color: isDark ? '#ffffff' : '#111827',
      fontWeight: '500',
    },
    slider: {
      width: '100%',
      height: 40,
    },
    sliderValues: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    sliderValue: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    toggleLabel: {
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
    },
    toggleDescription: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginTop: 2,
    },
    footer: {
      flexDirection: 'row',
      padding: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
      gap: 12,
    },
    clearButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      alignItems: 'center',
    },
    clearButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#374151',
    },
    applyButton: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: '#3b82f6',
      alignItems: 'center',
    },
    applyButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderWidth: 1,
      borderColor: 'transparent',
      gap: 6,
    },
    categoryColor: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filters</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather
                name="x"
                size={24}
                color={isDark ? '#9ca3af' : '#6b7280'}
              />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Language Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Language</Text>
              <View style={styles.chipContainer}>
                {languages.slice(0, 12).map(({ language, count }) => (
                  <Pressable
                    key={language}
                    style={[
                      styles.chip,
                      selectedLanguage === language && styles.chipActive,
                    ]}
                    onPress={() =>
                      setSelectedLanguage(
                        selectedLanguage === language ? undefined : language
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedLanguage === language && styles.chipTextActive,
                      ]}
                    >
                      {language}
                      <Text
                        style={[
                          styles.chipCount,
                          selectedLanguage === language && styles.chipCountActive,
                        ]}
                      >
                        {' '}
                        ({count})
                      </Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Category Filter */}
            {categories.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Category</Text>
                <View style={styles.chipContainer}>
                  {categories.map((category) => (
                    <Pressable
                      key={category._id}
                      style={[
                        styles.categoryChip,
                        selectedCategory === category._id && styles.chipActive,
                      ]}
                      onPress={() =>
                        setSelectedCategory(
                          selectedCategory === category._id ? undefined : category._id
                        )
                      }
                    >
                      <View
                        style={[
                          styles.categoryColor,
                          { backgroundColor: category.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          selectedCategory === category._id && styles.chipTextActive,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Star Range */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stars Range</Text>
              <View style={styles.sliderContainer}>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>Minimum Stars</Text>
                  <Text style={styles.sliderLabel}>{formatStars(minStars)}</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100000}
                  step={100}
                  value={minStars}
                  onValueChange={setMinStars}
                  minimumTrackTintColor="#3b82f6"
                  maximumTrackTintColor={isDark ? '#374151' : '#d1d5db'}
                  thumbTintColor="#3b82f6"
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>Maximum Stars</Text>
                  <Text style={styles.sliderLabel}>{formatStars(maxStars)}</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100000}
                  step={100}
                  value={maxStars}
                  onValueChange={setMaxStars}
                  minimumTrackTintColor="#3b82f6"
                  maximumTrackTintColor={isDark ? '#374151' : '#d1d5db'}
                  thumbTintColor="#3b82f6"
                />
              </View>
            </View>

            {/* Topics Filter */}
            {topics.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Topics</Text>
                <View style={styles.chipContainer}>
                  {topics.slice(0, 15).map(({ topic, count }) => (
                    <Pressable
                      key={topic}
                      style={[
                        styles.chip,
                        selectedTopics.includes(topic) && styles.chipActive,
                      ]}
                      onPress={() => toggleTopic(topic)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedTopics.includes(topic) && styles.chipTextActive,
                        ]}
                      >
                        {topic}
                        <Text
                          style={[
                            styles.chipCount,
                            selectedTopics.includes(topic) && styles.chipCountActive,
                          ]}
                        >
                          {' '}
                          ({count})
                        </Text>
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Toggle Filters */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Repository Type</Text>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Show Forks Only</Text>
                  <Text style={styles.toggleDescription}>
                    {showForks === true
                      ? 'Only showing forks'
                      : showForks === false
                      ? 'Excluding forks'
                      : 'Showing all repositories'}
                  </Text>
                </View>
                <Switch
                  value={showForks === true}
                  onValueChange={(value) => setShowForks(value ? true : undefined)}
                  trackColor={{ false: isDark ? '#374151' : '#d1d5db', true: '#3b82f6' }}
                  thumbColor="#ffffff"
                />
              </View>
              <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                <View>
                  <Text style={styles.toggleLabel}>Show Archived Only</Text>
                  <Text style={styles.toggleDescription}>
                    {showArchived === true
                      ? 'Only showing archived'
                      : showArchived === false
                      ? 'Excluding archived'
                      : 'Showing all repositories'}
                  </Text>
                </View>
                <Switch
                  value={showArchived === true}
                  onValueChange={(value) => setShowArchived(value ? true : undefined)}
                  trackColor={{ false: isDark ? '#374151' : '#d1d5db', true: '#3b82f6' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {hasActiveFilters && (
              <Pressable style={styles.clearButton} onPress={handleClear}>
                <Text style={styles.clearButtonText}>Clear All</Text>
              </Pressable>
            )}
            <Pressable style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default FilterModal;
