import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const WelcomeScreen = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f0f23' : '#ffffff',
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: 48,
    },
    logo: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? '#1a1a2e' : '#f3f4f6',
      marginBottom: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoText: {
      fontSize: 32,
      fontWeight: '700',
      color: '#3b82f6',
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      textAlign: 'center',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 16,
      lineHeight: 38,
    },
    subtitle: {
      fontSize: 18,
      textAlign: 'center',
      color: isDark ? '#9ca3af' : '#6b7280',
      lineHeight: 26,
      marginBottom: 8,
    },
    featuresList: {
      marginTop: 32,
      marginBottom: 48,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      paddingHorizontal: 16,
    },
    featureIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#3b82f6',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    featureIconText: {
      fontSize: 20,
      color: '#ffffff',
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
      lineHeight: 20,
    },
    buttonContainer: {
      gap: 16,
      paddingBottom: 32,
    },
    primaryButton: {
      backgroundColor: '#3b82f6',
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      borderWidth: 2,
      borderColor: isDark ? '#374151' : '#d1d5db',
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: isDark ? '#ffffff' : '#111827',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const features = [
    {
      icon: '📚',
      title: 'Smart Organization',
      description: 'Create custom categories and subcategories for your starred repositories',
    },
    {
      icon: '🔍',
      title: 'Advanced Search',
      description: 'Filter by language, topics, stars, and more to find repositories quickly',
    },
    {
      icon: '📱',
      title: 'Offline Access',
      description: 'Access your organized repositories even when offline',
    },
    {
      icon: '🔄',
      title: 'Real-time Sync',
      description: 'Automatically sync your starred repositories across all devices',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>⭐</Text>
          </View>
          <Text style={styles.title}>GitHub Stars{"\n"}Organizer</Text>
          <Text style={styles.subtitle}>
            Transform your starred repositories into an organized, searchable library
          </Text>
        </View>

        <View style={styles.featuresList}>
          {features.map((feature, index) => (
            <View key={index} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>{feature.icon}</Text>
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
          
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default WelcomeScreen;
