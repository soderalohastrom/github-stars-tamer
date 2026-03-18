import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  isLoading?: boolean;
  autoFocus?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSearch,
  placeholder = 'Search repositories...',
  debounceMs = 300,
  isLoading = false,
  autoFocus = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [localValue, setLocalValue] = useState(value);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync local value when prop changes (e.g., from saved filter)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced search
  const debouncedSearch = useCallback(
    (text: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        onSearch(text);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleChangeText = (text: string) => {
    setLocalValue(text);
    onChangeText(text);
    debouncedSearch(text);
  };

  const handleClear = () => {
    setLocalValue('');
    onChangeText('');
    onSearch('');
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  };

  const handleSubmit = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    onSearch(localValue);
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    searchIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
      paddingVertical: 0,
    },
    clearButton: {
      padding: 4,
      marginLeft: 8,
    },
    loadingIndicator: {
      marginLeft: 8,
    },
  });

  return (
    <View style={styles.container}>
      <Feather
        name="search"
        size={20}
        color={isDark ? '#9ca3af' : '#6b7280'}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
        value={localValue}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        autoFocus={autoFocus}
      />
      {isLoading && (
        <ActivityIndicator
          size="small"
          color={isDark ? '#9ca3af' : '#6b7280'}
          style={styles.loadingIndicator}
        />
      )}
      {localValue.length > 0 && !isLoading && (
        <Pressable style={styles.clearButton} onPress={handleClear}>
          <Feather name="x" size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
        </Pressable>
      )}
    </View>
  );
};

export default SearchBar;
