import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface PreferenceItemProps {
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onValueChange: (value: string) => void;
}

const PreferenceItem: React.FC<PreferenceItemProps> = ({
  title,
  options,
  value,
  onValueChange,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    const currentLabel = options.find(option => option.value === value)?.label || 'Unknown';
    
    Alert.alert(
      title,
      `Current: ${currentLabel}`,
      [
        ...options.map(option => ({
          text: option.label,
          onPress: () => onValueChange(option.value),
          style: (option.value === value ? 'default' : undefined) as 'default' | 'cancel' | 'destructive' | undefined,
        })),
        {
          text: 'Cancel',
          style: 'cancel' as const,
        },
      ]
    );
  };

  const currentOption = options.find(option => option.value === value);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    leftContainer: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
    },
    rightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    value: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
  });

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.leftContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.rightContainer}>
        <Text style={styles.value}>{currentOption?.label || 'Unknown'}</Text>
        <Feather name="chevron-right" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
      </View>
    </Pressable>
  );
};

export default PreferenceItem;
