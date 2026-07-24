import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

const categories = [
  { name: 'Developer tooling', detail: 'CLI · editors · automation', count: 84, color: '#FFD84D' },
  { name: 'AI & machine learning', detail: 'agents · inference · RAG', count: 61, color: '#F05A3C' },
  { name: 'Web foundations', detail: 'frameworks · CSS · runtime', count: 47, color: '#7DB8A3' },
  { name: 'Reference shelf', detail: 'books · examples · learning', count: 29, color: '#A8A1D6' },
];

const benefits = [
  {
    number: '01',
    title: 'Sync the signal',
    body: 'Import starred repositories with timestamps, topics, languages, and useful metadata intact.',
  },
  {
    number: '02',
    title: 'Stage the sort',
    body: 'Edge AI proposes a clean taxonomy. Every change waits for your review before it lands.',
  },
  {
    number: '03',
    title: 'Browse the why',
    body: 'Search collections, build shareable lists, and follow relationships in the knowledge graph.',
  },
];

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const horizontalPadding = width >= 1280 ? 56 : width >= 720 ? 32 : 20;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.page, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.masthead}>
          <View style={styles.brand}>
            <Image
              accessibilityIgnoresInvertColors
              source={require('../../assets/brand/star-shelf-mark-256.png')}
              style={styles.brandMark}
            />
            <View>
              <Text style={styles.brandName}>STAR SHELF</Text>
              <Text style={styles.brandTag}>A CATALOG FOR GITHUB STARS</Text>
            </View>
          </View>
          <View style={styles.mastheadMeta}>
            <View style={styles.liveDot} />
            {width >= 640 && (
              <Text style={styles.mastheadMetaText}>FREE · REVIEW-FIRST · OPEN SOURCE</Text>
            )}
          </View>
        </View>

        <View style={[styles.hero, isWide && styles.heroWide]}>
          <View style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
            <Text style={styles.eyebrow}>YOUR STARS, WITH A MEMORY</Text>
            <Text style={[styles.headline, width < 480 && styles.headlineCompact]}>
              Stop starring.{'\n'}Start shelving.
            </Text>
            <Text style={styles.lede}>
              Turn the repositories you meant to revisit into a searchable working library.
              Star Shelf syncs GitHub, proposes useful categories, and shows the connections
              hiding in your collection.
            </Text>

            <View style={[styles.actions, !isWide && styles.actionsStacked]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Connect GitHub and create your Star Shelf"
                onPress={() => router.push('/(auth)/sign-up')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              >
                <Feather name="github" size={18} color="#10100F" />
                <Text style={styles.primaryButtonText}>CONNECT GITHUB</Text>
                <Feather name="arrow-up-right" size={18} color="#10100F" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in to an existing Star Shelf"
                onPress={() => router.push('/(auth)/sign-in')}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.secondaryButtonText}>I HAVE A SHELF</Text>
              </Pressable>
            </View>

            <View style={styles.trustRow}>
              <Text style={styles.trustItem}>NO PAYWALL</Text>
              <Text style={styles.trustDivider}>/</Text>
              <Text style={styles.trustItem}>NO AUTO-APPLY</Text>
              <Text style={styles.trustDivider}>/</Text>
              <Text style={styles.trustItem}>EXPORTABLE</Text>
            </View>
          </View>

          <View style={[styles.catalogFrame, isWide && styles.catalogFrameWide]}>
            <View style={styles.catalogTopline}>
              <Text style={styles.catalogKicker}>SHELF INDEX / 2026</Text>
              <View style={styles.catalogCount}>
                <Text style={styles.catalogCountValue}>221</Text>
                <Text style={styles.catalogCountLabel}>CATALOGED</Text>
              </View>
            </View>
            <Text style={styles.catalogTitle}>The useful part{'\n'}of your stars.</Text>
            <View style={styles.categoryList}>
              {categories.map((category, index) => (
                <View key={category.name} style={styles.categoryRow}>
                  <View style={[styles.categoryIndex, { backgroundColor: category.color }]}>
                    <Text style={styles.categoryIndexText}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.categoryCopy}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryDetail}>{category.detail}</Text>
                  </View>
                  <Text style={styles.categoryCount}>{category.count}</Text>
                </View>
              ))}
            </View>
            <View style={styles.catalogFooter}>
              <View style={styles.catalogRule} />
              <Text style={styles.catalogFooterText}>SUGGESTED BY AI · APPROVED BY YOU</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          <Text style={styles.sectionTitle}>A short path from “someday” to findable.</Text>
        </View>

        <View style={[styles.benefitGrid, isWide && styles.benefitGridWide]}>
          {benefits.map((benefit) => (
            <View key={benefit.number} style={[styles.benefitCard, isWide && styles.benefitCardWide]}>
              <Text style={styles.benefitNumber}>{benefit.number}</Text>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitBody}>{benefit.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bottomNote}>
          <Feather name="chrome" size={18} color="#FFD84D" />
          <Text style={styles.bottomNoteText}>
            Includes a Manifest V3 Chrome companion for organizing directly from GitHub.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const displayFont = Platform.select({
  web: 'Georgia, "Times New Roman", serif',
  ios: 'Georgia-Bold',
  default: 'serif',
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#10100F',
  },
  scroll: {
    flex: 1,
  },
  page: {
    width: '100%',
    maxWidth: 1480,
    alignSelf: 'center',
    paddingBottom: 44,
  },
  masthead: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#45433E',
    gap: 18,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 44,
    height: 44,
  },
  brandName: {
    color: '#F5F0E6',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  brandTag: {
    color: '#8F8B82',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.25,
    marginTop: 3,
  },
  mastheadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFD84D',
  },
  mastheadMetaText: {
    color: '#B8B3A8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'right',
  },
  hero: {
    paddingTop: 42,
    paddingBottom: 58,
    gap: 42,
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 650,
    gap: 64,
  },
  heroCopy: {
    flex: 1,
  },
  heroCopyWide: {
    maxWidth: 650,
  },
  eyebrow: {
    color: '#F05A3C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 22,
  },
  headline: {
    color: '#F5F0E6',
    fontFamily: displayFont,
    fontSize: 58,
    lineHeight: 60,
    fontWeight: '800',
    letterSpacing: -2.4,
  },
  headlineCompact: {
    fontSize: 46,
    lineHeight: 49,
    letterSpacing: -1.8,
  },
  lede: {
    color: '#C5C0B5',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 620,
    marginTop: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 34,
  },
  actionsStacked: {
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: 54,
    backgroundColor: '#FFD84D',
    borderWidth: 2,
    borderColor: '#FFD84D',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryButton: {
    minHeight: 54,
    borderWidth: 2,
    borderColor: '#69655D',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    opacity: 0.86,
  },
  primaryButtonText: {
    color: '#10100F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  secondaryButtonText: {
    color: '#F5F0E6',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 25,
  },
  trustItem: {
    color: '#8F8B82',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  trustDivider: {
    color: '#4F4C46',
    fontSize: 10,
  },
  catalogFrame: {
    flex: 1,
    backgroundColor: '#F5F0E6',
    borderWidth: 1,
    borderColor: '#D5CCBC',
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  catalogFrameWide: {
    maxWidth: 550,
    transform: [{ rotate: '1deg' }],
  },
  catalogTopline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  catalogKicker: {
    color: '#6D685F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  catalogCount: {
    alignItems: 'flex-end',
  },
  catalogCountValue: {
    color: '#10100F',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 24,
  },
  catalogCountLabel: {
    color: '#6D685F',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 4,
  },
  catalogTitle: {
    color: '#10100F',
    fontFamily: displayFont,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginTop: 22,
    marginBottom: 24,
  },
  categoryList: {
    borderTopWidth: 2,
    borderTopColor: '#10100F',
  },
  categoryRow: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#BDB5A8',
    gap: 12,
  },
  categoryIndex: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIndexText: {
    color: '#10100F',
    fontSize: 9,
    fontWeight: '900',
  },
  categoryCopy: {
    flex: 1,
  },
  categoryName: {
    color: '#10100F',
    fontSize: 14,
    fontWeight: '800',
  },
  categoryDetail: {
    color: '#726C62',
    fontSize: 11,
    marginTop: 3,
  },
  categoryCount: {
    color: '#10100F',
    fontSize: 20,
    fontWeight: '800',
  },
  catalogFooter: {
    marginTop: 20,
  },
  catalogRule: {
    width: 48,
    height: 4,
    backgroundColor: '#F05A3C',
    marginBottom: 10,
  },
  catalogFooterText: {
    color: '#49453F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sectionHeader: {
    borderTopWidth: 1,
    borderTopColor: '#45433E',
    paddingTop: 28,
    marginBottom: 22,
  },
  sectionLabel: {
    color: '#FFD84D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#F5F0E6',
    fontFamily: displayFont,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  benefitGrid: {
    gap: 12,
  },
  benefitGridWide: {
    flexDirection: 'row',
  },
  benefitCard: {
    backgroundColor: '#1B1A18',
    borderWidth: 1,
    borderColor: '#45433E',
    padding: 22,
  },
  benefitCardWide: {
    flex: 1,
  },
  benefitNumber: {
    color: '#F05A3C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 28,
  },
  benefitTitle: {
    color: '#F5F0E6',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  benefitBody: {
    color: '#AAA59B',
    fontSize: 14,
    lineHeight: 22,
  },
  bottomNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2C2A27',
  },
  bottomNoteText: {
    flex: 1,
    color: '#8F8B82',
    fontSize: 12,
    lineHeight: 18,
  },
});
