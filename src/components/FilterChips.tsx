import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface FilterChipsProps {
  availableLanguages: string[];
  availableTopics: string[];
  onFilterChange: (filters: any) => void;
}

const FilterChips: React.FC<FilterChipsProps> = ({
  availableLanguages,
  availableTopics,
  onFilterChange,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [minStars, setMinStars] = useState<number | null>(null);

  const handleLanguageSelect = (language: string) => {
    const newLanguage = selectedLanguage === language ? null : language;
    setSelectedLanguage(newLanguage);
    updateFilters({ language: newLanguage });
  };

  const handleTopicSelect = (topic: string) => {
    let newTopics: string[];
    if (selectedTopics.includes(topic)) {
      newTopics = selectedTopics.filter(t => t !== topic);
    } else {
      newTopics = [...selectedTopics, topic];
    }
    setSelectedTopics(newTopics);
    updateFilters({ topics: newTopics.length > 0 ? newTopics : undefined });
  };

  const handleStarsFilter = (stars: number) => {
    const newMinStars = minStars === stars ? null : stars;
    setMinStars(newMinStars);
    updateFilters({ minStars: newMinStars });
  };

  const updateFilters = (newFilter: any) => {
    const filters = {
      ...(selectedLanguage && { language: selectedLanguage }),
      ...(selectedTopics.length > 0 && { topics: selectedTopics }),
      ...(minStars && { minStars }),
      ...newFilter,
    };
    
    // Remove null/undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === null || filters[key] === undefined) {
        delete filters[key];
      }
    });
    
    onFilterChange(filters);
  };

  const clearAllFilters = () => {
    setSelectedLanguage(null);
    setSelectedTopics([]);
    setMinStars(null);
    onFilterChange({});
  };

  const hasActiveFilters = selectedLanguage || selectedTopics.length > 0 || minStars;

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 8,
    },
    section: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#9ca3af' : '#6b7280',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chipContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: '#3b82f6',
      borderColor: '#3b82f6',
    },
    chipText: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? '#d1d5db' : '#374151',
    },
    chipTextActive: {
      color: '#ffffff',
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: '#ef4444',
      gap: 4,
    },
    clearButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#ffffff',
    },
  });

  const starsOptions = [10, 50, 100, 500, 1000];

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <View style={styles.chipContainer}>
        {/* Clear filters button */}
        {hasActiveFilters && (
          <Pressable style={styles.clearButton} onPress={clearAllFilters}>
            <Feather name="x" size={12} color="#ffffff" />
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        )}
        
        {/* Language filters */}
        {availableLanguages.slice(0, 5).map((language) => (
          <Pressable
            key={language}
            style={[
              styles.chip,
              selectedLanguage === language && styles.chipActive,
            ]}
            onPress={() => handleLanguageSelect(language)}
          >
            <Text
              style={[
                styles.chipText,
                selectedLanguage === language && styles.chipTextActive,
              ]}
            >
              {language}
            </Text>
          </Pressable>
        ))}
        
        {/* Stars filters */}
        {starsOptions.map((stars) => (
          <Pressable
            key={stars}
            style={[
              styles.chip,
              minStars === stars && styles.chipActive,
            ]}
            onPress={() => handleStarsFilter(stars)}
          >
            <Text
              style={[
                styles.chipText,
                minStars === stars && styles.chipTextActive,
              ]}
            >
              {stars}+ ⭐
            </Text>
          </Pressable>
        ))}
        
        {/* Topic filters */}
        {availableTopics.slice(0, 8).map((topic) => (
          <Pressable
            key={topic}
            style={[
              styles.chip,
              selectedTopics.includes(topic) && styles.chipActive,
            ]}
            onPress={() => handleTopicSelect(topic)}
          >
            <Text
              style={[
                styles.chipText,
                selectedTopics.includes(topic) && styles.chipTextActive,
              ]}
            >
              {topic}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
};

export default FilterChips;
