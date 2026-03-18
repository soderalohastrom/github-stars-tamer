import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// Components
import CategoryCard from '../../src/components/CategoryCard';
import CreateCategoryModal from '../../src/components/CreateCategoryModal';
import LoadingSpinner from '../../src/components/LoadingSpinner';

const CategoriesScreen = () => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Queries
  const categories = useQuery(
    api.categories.getUserCategories,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // Mutations
  const createCategory = useMutation(api.categories.createCategory);
  const deleteCategory = useMutation(api.categories.deleteCategory);
  const reorderCategories = useMutation(api.categories.reorderCategories);

  const handleCreateCategory = async (categoryData: any) => {
    if (!user?.id) return;

    try {
      await createCategory({
        clerkUserId: user.id,
        ...categoryData,
      });
      setShowCreateModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to create category');
    }
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            try {
              await deleteCategory({
                clerkUserId: user.id,
                categoryId: categoryId as any,
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const handleCategoryPress = (category: any) => {
    router.push({
      pathname: '/category/[id]',
      params: { id: category._id },
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f0f23' : '#f9fafb',
    },
    header: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#111827',
    },
    createButton: {
      backgroundColor: '#3b82f6',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    createButtonText: {
      color: '#ffffff',
      fontWeight: '600',
      fontSize: 14,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    categoryGrid: {
      gap: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    emptyButton: {
      backgroundColor: '#3b82f6',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    emptyButtonText: {
      color: '#ffffff',
      fontWeight: '600',
    },
  });

  if (!categories) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const renderCategory = (category: any, depth: number = 0) => (
    <View key={category._id}>
      <CategoryCard
        category={category}
        onPress={() => handleCategoryPress(category)}
        onDelete={() => handleDeleteCategory(category._id, category.name)}
        depth={depth}
      />
      {category.children && category.children.length > 0 && (
        <View style={{ marginLeft: 16 }}>
          {category.children.map((child: any) => renderCategory(child, depth + 1))}
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="folder" size={64} color="#9ca3af" style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No Categories Yet</Text>
      <Text style={styles.emptyDescription}>
        Create categories to organize your starred repositories. You can group repositories by technology, project type, or any way that makes sense to you.
      </Text>
      <Pressable style={styles.emptyButton} onPress={() => setShowCreateModal(true)}>
        <Feather name="plus" size={16} color="#ffffff" />
        <Text style={styles.emptyButtonText}>Create Category</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Categories</Text>
          <Pressable
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Feather name="plus" size={16} color="#ffffff" />
            <Text style={styles.createButtonText}>New</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Organize your repositories with custom categories
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.categoryGrid}>
        {categories.length === 0 ? (
          renderEmptyState()
        ) : (
          categories.map((category: any) => renderCategory(category))
        )}
      </ScrollView>

      <CreateCategoryModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateCategory}
      />
    </SafeAreaView>
  );
};

export default CategoriesScreen;
