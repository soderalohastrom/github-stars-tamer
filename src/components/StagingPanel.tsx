import React, { useState } from 'react';
import {
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
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface StagingPanelProps {
  onOpenAISettings?: () => void;
}

const StagingPanel: React.FC<StagingPanelProps> = ({ onOpenAISettings }) => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [expanded, setExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingTaxonomy, setIsGeneratingTaxonomy] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);

  // Queries
  const pendingCount = useQuery(
    api.ai.getPendingSuggestionsCount,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const suggestions = useQuery(
    api.ai.getSuggestionsWithDetails,
    user?.id && expanded ? { clerkUserId: user.id, status: 'pending' } : 'skip'
  );

  const categories = useQuery(
    api.categories.getUserCategories,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // Mutations & actions
  const requestJob = useMutation(api.ai.requestCategorizationJob);
  const processNextBatch = useAction(api.ai.processNextBatch);
  const applySuggestion = useMutation(api.ai.applySuggestion);
  const rejectSuggestion = useMutation(api.ai.rejectSuggestion);
  const generateTaxonomy = useAction(api.claudeAi.generateCategoryTaxonomy);
  const saveTaxonomy = useMutation(api.ai.saveTaxonomyAsCategories);

  const hasPending = (pendingCount || 0) > 0;
  const hasCategories = categories && categories.length > 0;

  // Generate taxonomy
  const handleGenerateTaxonomy = async () => {
    if (!user?.id) return;
    setIsGeneratingTaxonomy(true);
    try {
      const result = await generateTaxonomy({ clerkUserId: user.id });

      if (result.categories.length > 0) {
        // Auto-save the taxonomy
        const saveResult = await saveTaxonomy({
          clerkUserId: user.id,
          categories: result.categories.map((c: any) => ({
            name: c.name,
            description: c.description || '',
            color: c.color || '#6366f1',
            icon: c.icon,
          })),
          clearExisting: true,
        });

        Alert.alert(
          'Categories Generated',
          `Created ${saveResult.created.length} categories${saveResult.skipped.length > 0 ? `, ${saveResult.skipped.length} already existed` : ''}. You can edit them in the Categories tab.`,
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate taxonomy');
    } finally {
      setIsGeneratingTaxonomy(false);
    }
  };

  // Run AI categorization
  const handleCategorize = async () => {
    if (!user?.id) return;
    setIsProcessing(true);

    try {
      const jobResult = await requestJob({
        clerkUserId: user.id,
        categorizeAll: true,
      });

      setProgress({ processed: 0, total: jobResult.repositoryCount });

      let complete = false;
      let totalSuggestions = 0;

      while (!complete) {
        const batchResult = await processNextBatch({
          clerkUserId: user.id,
          jobId: jobResult.jobId,
        });

        if (batchResult.complete) {
          complete = true;
          totalSuggestions = batchResult.result?.totalSuggestions || 0;
        } else if (batchResult.progress) {
          setProgress(batchResult.progress);
        }
      }

      setProgress(null);
      setExpanded(true); // Auto-expand to show results

      if (totalSuggestions > 0) {
        Alert.alert('Done', `${totalSuggestions} suggestions ready for review.`);
      } else {
        Alert.alert('Done', 'No new suggestions generated.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Categorization failed');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  // Apply single suggestion
  const handleApply = async (suggestionId: Id<'aiCategorizationSuggestions'>) => {
    if (!user?.id) return;
    setApplyingId(suggestionId);
    try {
      await applySuggestion({ clerkUserId: user.id, suggestionId });
    } catch (error) {
      Alert.alert('Error', 'Failed to apply suggestion');
    } finally {
      setApplyingId(null);
    }
  };

  // Reject single suggestion
  const handleReject = async (suggestionId: Id<'aiCategorizationSuggestions'>) => {
    if (!user?.id) return;
    setRejectingId(suggestionId);
    try {
      await rejectSuggestion({ clerkUserId: user.id, suggestionId });
    } catch (error) {
      Alert.alert('Error', 'Failed to reject suggestion');
    } finally {
      setRejectingId(null);
    }
  };

  // Apply all pending
  const handleApplyAll = async () => {
    if (!user?.id || !suggestions) return;
    Alert.alert('Apply All', `Apply all ${suggestions.length} suggestions?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Apply All',
        onPress: async () => {
          for (const s of suggestions) {
            await applySuggestion({ clerkUserId: user.id, suggestionId: s._id });
          }
        },
      },
    ]);
  };

  // Reject all pending
  const handleRejectAll = async () => {
    if (!user?.id || !suggestions) return;
    Alert.alert('Reject All', `Reject all ${suggestions.length} suggestions?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject All',
        style: 'destructive',
        onPress: async () => {
          for (const s of suggestions) {
            await rejectSuggestion({ clerkUserId: user.id, suggestionId: s._id });
          }
        },
      },
    ]);
  };

  const getConfidenceColor = (c: number) =>
    c >= 0.8 ? '#10B981' : c >= 0.6 ? '#F59E0B' : '#EF4444';

  // Group suggestions by category
  const groupedSuggestions = (suggestions || []).reduce((acc: any, s: any) => {
    const cat = s.suggestedCategoryName;
    if (!acc[cat]) acc[cat] = { color: s.suggestedCategoryColor || '#6366f1', items: [] };
    acc[cat].items.push(s);
    return acc;
  }, {} as Record<string, { color: string; items: any[] }>);

  const s = StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
    },
    // Action buttons row
    actionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
    },
    primaryButton: {
      backgroundColor: '#6366F1',
    },
    secondaryButton: {
      backgroundColor: isDark ? '#374151' : '#E5E7EB',
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
    secondaryButtonText: {
      color: isDark ? '#D1D5DB' : '#374151',
      fontWeight: '600',
      fontSize: 14,
    },
    // Staging banner
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#2D2D5A' : '#EEF2FF',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 8,
    },
    bannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bannerBadge: {
      backgroundColor: '#6366F1',
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    bannerText: {
      color: isDark ? '#C7D2FE' : '#4338CA',
      fontWeight: '600',
      fontSize: 14,
    },
    // Inline suggestions panel
    panel: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      borderRadius: 12,
      marginTop: 8,
      overflow: 'hidden',
      maxHeight: 400,
    },
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
    },
    panelTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    bulkActions: {
      flexDirection: 'row',
      gap: 8,
    },
    bulkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    acceptAllButton: {
      backgroundColor: '#10B981',
    },
    rejectAllButton: {
      backgroundColor: isDark ? '#4B5563' : '#E5E7EB',
    },
    bulkButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    rejectAllText: {
      color: isDark ? '#D1D5DB' : '#374151',
    },
    // Category group
    categoryGroup: {
      paddingHorizontal: 14,
      paddingTop: 10,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    categoryDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    categoryName: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#C7D2FE' : '#4338CA',
    },
    categoryCount: {
      fontSize: 11,
      color: isDark ? '#9CA3AF' : '#6B7280',
    },
    // Suggestion item
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? '#374151' : '#F3F4F6',
    },
    suggestionInfo: {
      flex: 1,
      marginRight: 8,
    },
    suggestionName: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    suggestionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    confidencePill: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    confidenceText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    reasoningText: {
      fontSize: 11,
      color: isDark ? '#9CA3AF' : '#6B7280',
      flex: 1,
    },
    suggestionActions: {
      flexDirection: 'row',
      gap: 6,
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptButton: {
      backgroundColor: '#10B981',
    },
    rejectButton: {
      backgroundColor: isDark ? '#4B5563' : '#E5E7EB',
    },
    progressBar: {
      height: 4,
      backgroundColor: isDark ? '#374151' : '#E5E7EB',
      borderRadius: 2,
      marginTop: 8,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#6366F1',
      borderRadius: 2,
    },
  });

  return (
    <View style={s.container}>
      {/* Action buttons */}
      <View style={s.actionRow}>
        {!hasCategories ? (
          <Pressable
            style={[s.actionButton, s.primaryButton]}
            onPress={handleGenerateTaxonomy}
            disabled={isGeneratingTaxonomy}
          >
            {isGeneratingTaxonomy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="grid" size={16} color="#FFFFFF" />
            )}
            <Text style={s.actionButtonText}>
              {isGeneratingTaxonomy ? 'Generating Categories...' : 'Generate Categories'}
            </Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[s.actionButton, s.primaryButton]}
              onPress={handleCategorize}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="zap" size={16} color="#FFFFFF" />
              )}
              <Text style={s.actionButtonText}>
                {isProcessing
                  ? progress
                    ? `${progress.processed}/${progress.total}`
                    : 'Starting...'
                  : 'AI Categorize'}
              </Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, s.secondaryButton]}
              onPress={handleGenerateTaxonomy}
              disabled={isGeneratingTaxonomy}
            >
              {isGeneratingTaxonomy ? (
                <ActivityIndicator size="small" color={isDark ? '#D1D5DB' : '#374151'} />
              ) : (
                <Feather name="refresh-cw" size={14} color={isDark ? '#D1D5DB' : '#374151'} />
              )}
              <Text style={s.secondaryButtonText}>Regen</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Progress bar */}
      {isProcessing && progress && (
        <View style={s.progressBar}>
          <View
            style={[
              s.progressFill,
              { width: `${(progress.processed / progress.total) * 100}%` },
            ]}
          />
        </View>
      )}

      {/* Staging banner (when pending suggestions exist) */}
      {hasPending && !expanded && (
        <Pressable style={s.banner} onPress={() => setExpanded(true)}>
          <View style={s.bannerLeft}>
            <View style={s.bannerBadge}>
              <Text style={s.bannerBadgeText}>{pendingCount}</Text>
            </View>
            <Text style={s.bannerText}>pending suggestions — tap to review</Text>
          </View>
          <Feather name="chevron-down" size={18} color={isDark ? '#C7D2FE' : '#4338CA'} />
        </Pressable>
      )}

      {/* Inline suggestions panel */}
      {expanded && suggestions && suggestions.length > 0 && (
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Pressable onPress={() => setExpanded(false)}>
              <Text style={s.panelTitle}>
                {suggestions.length} Suggestions{' '}
                <Feather name="chevron-up" size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </Text>
            </Pressable>
            <View style={s.bulkActions}>
              <Pressable style={[s.bulkButton, s.rejectAllButton]} onPress={handleRejectAll}>
                <Feather name="x" size={12} color={isDark ? '#D1D5DB' : '#374151'} />
                <Text style={[s.bulkButtonText, s.rejectAllText]}>All</Text>
              </Pressable>
              <Pressable style={[s.bulkButton, s.acceptAllButton]} onPress={handleApplyAll}>
                <Feather name="check" size={12} color="#FFFFFF" />
                <Text style={s.bulkButtonText}>All</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {Object.entries(groupedSuggestions).map(([catName, group]: [string, any]) => (
              <View key={catName} style={s.categoryGroup}>
                <View style={s.categoryHeader}>
                  <View style={[s.categoryDot, { backgroundColor: group.color }]} />
                  <Text style={s.categoryName}>{catName}</Text>
                  <Text style={s.categoryCount}>({group.items.length})</Text>
                </View>

                {group.items.map((suggestion: any) => (
                  <View key={suggestion._id} style={s.suggestionItem}>
                    <View style={s.suggestionInfo}>
                      <Text style={s.suggestionName} numberOfLines={1}>
                        {suggestion.repository?.name || 'Unknown'}
                      </Text>
                      <View style={s.suggestionMeta}>
                        <View
                          style={[
                            s.confidencePill,
                            { backgroundColor: getConfidenceColor(suggestion.confidence) },
                          ]}
                        >
                          <Text style={s.confidenceText}>
                            {Math.round(suggestion.confidence * 100)}%
                          </Text>
                        </View>
                        {suggestion.reasoning && (
                          <Text style={s.reasoningText} numberOfLines={1}>
                            {suggestion.reasoning}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={s.suggestionActions}>
                      <Pressable
                        style={[s.iconButton, s.rejectButton]}
                        onPress={() => handleReject(suggestion._id)}
                        disabled={rejectingId === suggestion._id}
                      >
                        {rejectingId === suggestion._id ? (
                          <ActivityIndicator size="small" color={isDark ? '#D1D5DB' : '#374151'} />
                        ) : (
                          <Feather name="x" size={16} color={isDark ? '#D1D5DB' : '#374151'} />
                        )}
                      </Pressable>
                      <Pressable
                        style={[s.iconButton, s.acceptButton]}
                        onPress={() => handleApply(suggestion._id)}
                        disabled={applyingId === suggestion._id}
                      >
                        {applyingId === suggestion._id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Feather name="check" size={16} color="#FFFFFF" />
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 12 }} />
          </ScrollView>
        </View>
      )}

      {/* Expanded but empty */}
      {expanded && suggestions && suggestions.length === 0 && (
        <Pressable style={s.banner} onPress={() => setExpanded(false)}>
          <View style={s.bannerLeft}>
            <Feather name="check-circle" size={18} color="#10B981" />
            <Text style={[s.bannerText, { color: '#10B981' }]}>All caught up!</Text>
          </View>
          <Feather name="chevron-up" size={18} color={isDark ? '#C7D2FE' : '#4338CA'} />
        </Pressable>
      )}
    </View>
  );
};

export default StagingPanel;
