import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface AISuggestionsReviewProps {
  visible: boolean;
  onClose: () => void;
  jobId?: string;
  onApplyAll?: () => void;
}

interface SuggestionWithDetails {
  _id: Id<'aiCategorizationSuggestions'>;
  suggestedCategoryName: string;
  suggestedCategoryColor?: string;
  confidence: number;
  reasoning?: string;
  status: string;
  repository: {
    name: string;
    fullName: string;
    description?: string;
    language?: string;
    stargazersCount: number;
  } | null;
  metadata?: {
    aiModel?: string;
    processingTimeMs?: number;
  };
}

const AISuggestionsReview: React.FC<AISuggestionsReviewProps> = ({
  visible,
  onClose,
  jobId,
  onApplyAll,
}) => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);

  // Query pending suggestions
  const suggestions = useQuery(
    api.ai.getSuggestionsWithDetails,
    user?.id ? { clerkUserId: user.id, status: 'pending' } : 'skip'
  ) as SuggestionWithDetails[] | undefined;

  // Mutations
  const applySuggestion = useMutation(api.ai.applySuggestion);
  const rejectSuggestion = useMutation(api.ai.rejectSuggestion);

  const handleApply = async (suggestionId: Id<'aiCategorizationSuggestions'>) => {
    if (!user?.id) return;

    setApplyingId(suggestionId);
    try {
      await applySuggestion({
        clerkUserId: user.id,
        suggestionId,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to apply suggestion');
    } finally {
      setApplyingId(null);
    }
  };

  const handleReject = async (suggestionId: Id<'aiCategorizationSuggestions'>) => {
    if (!user?.id) return;

    setRejectingId(suggestionId);
    try {
      await rejectSuggestion({
        clerkUserId: user.id,
        suggestionId,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to reject suggestion');
    } finally {
      setRejectingId(null);
    }
  };

  const handleApplyAll = async () => {
    if (!user?.id || !suggestions) return;

    Alert.alert(
      'Apply All Suggestions',
      `Apply all ${suggestions.length} category suggestions?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply All',
          onPress: async () => {
            setApplyingAll(true);
            try {
              for (const suggestion of suggestions) {
                await applySuggestion({
                  clerkUserId: user.id,
                  suggestionId: suggestion._id,
                });
              }
              onApplyAll?.();
            } catch (error) {
              Alert.alert('Error', 'Failed to apply some suggestions');
            } finally {
              setApplyingAll(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectAll = async () => {
    if (!user?.id || !suggestions) return;

    Alert.alert(
      'Reject All Suggestions',
      `Reject all ${suggestions.length} suggestions?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject All',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const suggestion of suggestions) {
                await rejectSuggestion({
                  clerkUserId: user.id,
                  suggestionId: suggestion._id,
                });
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to reject some suggestions');
            }
          },
        },
      ]
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#10B981'; // Green
    if (confidence >= 0.6) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    if (confidence >= 0.4) return 'Low';
    return 'Very Low';
  };

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      flex: 1,
      backgroundColor: isDark ? '#0F0F23' : '#F9FAFB',
      marginTop: 60,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    header: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 2,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#111827',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      textAlign: 'center',
    },
    suggestionCard: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    repoInfo: {
      flex: 1,
    },
    repoName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    repoFullName: {
      fontSize: 13,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 2,
    },
    confidenceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    confidenceText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2D2D5A' : '#EEF2FF',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      marginBottom: 12,
    },
    categoryDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 10,
    },
    categoryName: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#4F46E5',
      flex: 1,
    },
    reasoningContainer: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    reasoningLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 4,
    },
    reasoningText: {
      fontSize: 14,
      color: isDark ? '#D1D5DB' : '#374151',
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 12,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    applyButton: {
      flex: 1,
      backgroundColor: '#10B981',
      paddingVertical: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    rejectButton: {
      flex: 1,
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      paddingVertical: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    applyButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
    rejectButtonText: {
      color: isDark ? '#D1D5DB' : '#374151',
      fontWeight: '600',
      fontSize: 14,
    },
    footer: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#E5E7EB',
      flexDirection: 'row',
      gap: 12,
    },
    footerButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    applyAllButton: {
      backgroundColor: '#10B981',
    },
    rejectAllButton: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
    },
    footerButtonText: {
      fontWeight: '600',
      fontSize: 15,
    },
    applyAllText: {
      color: '#FFFFFF',
    },
    rejectAllText: {
      color: isDark ? '#D1D5DB' : '#374151',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const pendingSuggestions = suggestions || [];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>AI Suggestions</Text>
              <Text style={styles.headerSubtitle}>
                {pendingSuggestions.length} pending suggestion{pendingSuggestions.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {pendingSuggestions.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather
                  name="check-circle"
                  size={48}
                  color={isDark ? '#6B7280' : '#9CA3AF'}
                  style={styles.emptyIcon}
                />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptyText}>
                  No pending suggestions. Use the AI Organize button to generate new category suggestions.
                </Text>
              </View>
            ) : (
              <>
                {pendingSuggestions.map((suggestion) => (
                  <View key={suggestion._id} style={styles.suggestionCard}>
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.repoInfo}>
                        <Text style={styles.repoName}>
                          {suggestion.repository?.name || 'Unknown Repository'}
                        </Text>
                        <Text style={styles.repoFullName}>
                          {suggestion.repository?.fullName || ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.confidenceBadge,
                          { backgroundColor: getConfidenceColor(suggestion.confidence) },
                        ]}
                      >
                        <Text style={styles.confidenceText}>
                          {Math.round(suggestion.confidence * 100)}%
                        </Text>
                      </View>
                    </View>

                    {/* Suggested Category */}
                    <View style={styles.categoryRow}>
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: suggestion.suggestedCategoryColor || '#6366F1' },
                        ]}
                      />
                      <Text style={styles.categoryName}>{suggestion.suggestedCategoryName}</Text>
                    </View>

                    {/* Reasoning */}
                    {suggestion.reasoning && (
                      <View style={styles.reasoningContainer}>
                        <Text style={styles.reasoningLabel}>AI Reasoning</Text>
                        <Text style={styles.reasoningText}>{suggestion.reasoning}</Text>
                      </View>
                    )}

                    {/* Meta Info */}
                    <View style={styles.metaRow}>
                      {suggestion.repository?.language && (
                        <View style={styles.metaItem}>
                          <Feather name="code" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          <Text style={styles.metaText}>{suggestion.repository.language}</Text>
                        </View>
                      )}
                      {suggestion.repository?.stargazersCount !== undefined && (
                        <View style={styles.metaItem}>
                          <Feather name="star" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          <Text style={styles.metaText}>
                            {suggestion.repository.stargazersCount.toLocaleString()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.metaItem}>
                        <Feather name="zap" size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        <Text style={styles.metaText}>
                          {getConfidenceLabel(suggestion.confidence)}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.rejectButton}
                        onPress={() => handleReject(suggestion._id)}
                        disabled={rejectingId === suggestion._id}
                      >
                        {rejectingId === suggestion._id ? (
                          <ActivityIndicator size="small" color={isDark ? '#D1D5DB' : '#374151'} />
                        ) : (
                          <>
                            <Feather name="x" size={16} color={isDark ? '#D1D5DB' : '#374151'} />
                            <Text style={styles.rejectButtonText}>Reject</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        style={styles.applyButton}
                        onPress={() => handleApply(suggestion._id)}
                        disabled={applyingId === suggestion._id}
                      >
                        {applyingId === suggestion._id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="check" size={16} color="#FFFFFF" />
                            <Text style={styles.applyButtonText}>Apply</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}
                {/* Bottom spacing */}
                <View style={{ height: 20 }} />
              </>
            )}
          </ScrollView>

          {/* Footer with bulk actions */}
          {pendingSuggestions.length > 0 && (
            <View style={styles.footer}>
              <Pressable
                style={[styles.footerButton, styles.rejectAllButton]}
                onPress={handleRejectAll}
              >
                <Feather name="x" size={18} color={isDark ? '#D1D5DB' : '#374151'} />
                <Text style={[styles.footerButtonText, styles.rejectAllText]}>Reject All</Text>
              </Pressable>
              <Pressable
                style={[styles.footerButton, styles.applyAllButton]}
                onPress={handleApplyAll}
                disabled={applyingAll}
              >
                {applyingAll ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={18} color="#FFFFFF" />
                    <Text style={[styles.footerButtonText, styles.applyAllText]}>Apply All</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default AISuggestionsReview;
