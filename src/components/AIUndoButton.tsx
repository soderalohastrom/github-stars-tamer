import React from 'react';
import { Pressable, Text, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';

const AIUndoButton = ({ onUndoComplete }: any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    // Simulate AI undo
    setTimeout(() => {
      onUndoComplete();
    }, 1000);
  };

  const styles = StyleSheet.create({
    button: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 20,
    },
    buttonText: {
      color: isDark ? '#ffffff' : '#374151',
      fontWeight: '600',
    },
  });

  return (
    <Pressable style={styles.button} onPress={handlePress}>
      <Feather name="rotate-ccw" size={16} color={isDark ? '#ffffff' : '#374151'} />
      <Text style={styles.buttonText}>Undo</Text>
    </Pressable>
  );
};

export default AIUndoButton;
