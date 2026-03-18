import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export type SortField = 'stargazersCount' | 'starredAt' | 'updatedAt' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  order: SortOrder;
}

interface SortMenuProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const sortOptions: Array<{
  field: SortField;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { field: 'stargazersCount', label: 'Stars', icon: 'star' },
  { field: 'starredAt', label: 'Starred Date', icon: 'calendar' },
  { field: 'updatedAt', label: 'Last Updated', icon: 'clock' },
  { field: 'name', label: 'Name', icon: 'type' },
];

const SortMenu: React.FC<SortMenuProps> = ({ currentSort, onSortChange }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = sortOptions.find((opt) => opt.field === currentSort.field);
  const currentLabel = currentOption?.label || 'Sort';

  const handleSelect = (field: SortField) => {
    // If same field, toggle order; otherwise, default to desc
    const newOrder =
      currentSort.field === field
        ? currentSort.order === 'desc'
          ? 'asc'
          : 'desc'
        : 'desc';

    onSortChange({ field, order: newOrder });
    setIsOpen(false);
  };

  const styles = StyleSheet.create({
    triggerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      gap: 6,
    },
    triggerText: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#ffffff' : '#374151',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
    },
    closeButton: {
      padding: 4,
    },
    optionsList: {
      paddingHorizontal: 8,
      paddingTop: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 4,
    },
    optionActive: {
      backgroundColor: isDark ? '#374151' : '#eff6ff',
    },
    optionIcon: {
      marginRight: 14,
    },
    optionLabel: {
      flex: 1,
      fontSize: 16,
      color: isDark ? '#d1d5db' : '#374151',
    },
    optionLabelActive: {
      color: '#3b82f6',
      fontWeight: '600',
    },
    orderIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    orderText: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
  });

  return (
    <>
      <Pressable style={styles.triggerButton} onPress={() => setIsOpen(true)}>
        <Feather
          name={currentOption?.icon || 'list'}
          size={16}
          color={isDark ? '#ffffff' : '#374151'}
        />
        <Text style={styles.triggerText}>{currentLabel}</Text>
        <Feather
          name={currentSort.order === 'desc' ? 'arrow-down' : 'arrow-up'}
          size={14}
          color={isDark ? '#9ca3af' : '#6b7280'}
        />
      </Pressable>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Sort By</Text>
              <Pressable style={styles.closeButton} onPress={() => setIsOpen(false)}>
                <Feather
                  name="x"
                  size={24}
                  color={isDark ? '#9ca3af' : '#6b7280'}
                />
              </Pressable>
            </View>

            <View style={styles.optionsList}>
              {sortOptions.map((option) => {
                const isActive = currentSort.field === option.field;
                return (
                  <Pressable
                    key={option.field}
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => handleSelect(option.field)}
                  >
                    <Feather
                      name={option.icon}
                      size={20}
                      color={isActive ? '#3b82f6' : isDark ? '#9ca3af' : '#6b7280'}
                      style={styles.optionIcon}
                    />
                    <Text
                      style={[
                        styles.optionLabel,
                        isActive && styles.optionLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isActive && (
                      <View style={styles.orderIndicator}>
                        <Text style={styles.orderText}>
                          {currentSort.order === 'desc' ? 'High to Low' : 'Low to High'}
                        </Text>
                        <Feather
                          name={currentSort.order === 'desc' ? 'arrow-down' : 'arrow-up'}
                          size={16}
                          color="#3b82f6"
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

export default SortMenu;
