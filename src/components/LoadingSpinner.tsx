import React from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'large' }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#0f0f23' : '#f9fafb',
    },
  });

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={isDark ? '#ffffff' : '#000000'} />
    </View>
  );
};

export default LoadingSpinner;