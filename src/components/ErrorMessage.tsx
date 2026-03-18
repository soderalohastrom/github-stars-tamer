import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';

const ErrorMessage = ({ message }: { message: string }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: isDark ? '#0f0f23' : '#f9fafb',
    },
    iconContainer: {
      marginBottom: 16,
    },
    message: {
      fontSize: 16,
      color: isDark ? '#fca5a5' : '#ef4444',
      textAlign: 'center',
      lineHeight: 24,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Feather name="alert-circle" size={48} color={isDark ? '#fca5a5' : '#ef4444'} />
      </View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

export default ErrorMessage;