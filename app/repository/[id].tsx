import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUser } from '@clerk/clerk-expo';

const RepositoryDetailsScreen = () => {
  const { id } = useLocalSearchParams();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const repository = useQuery(
    api.repositories.getRepository,
    user?.id
      ? {
          userId: user.id as any,
          repositoryId: id as any,
        }
      : 'skip'
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f0f23' : '#f9fafb',
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    repoName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#ffffff' : '#000000',
    },
    content: {
      padding: 20,
    },
  });

  if (!repository) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.repoName}>{repository.name}</Text>
      </View>
      <View style={styles.content}>
        <Text>{repository.description}</Text>
      </View>
    </SafeAreaView>
  );
};

export default RepositoryDetailsScreen;
