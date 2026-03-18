import React, { useState, useEffect } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  useColorScheme,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface AIOrganizeButtonProps {
  selectedRepositories?: Id<'repositories'>[];
  onStartProcessing?: () => void;
  onComplete?: (result: { jobId: string; suggestionCount: number }) => void;
  onError?: (error: string) => void;
  categorizeAll?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

const AIOrganizeButton: React.FC<AIOrganizeButtonProps> = ({
  selectedRepositories = [],
  onStartProcessing,
  onComplete,
  onError,
  categorizeAll = false,
  disabled = false,
  compact = false,
}) => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);

  // Queries
  const aiSettings = useQuery(
    api.ai.getAiSettings,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const activeJobs = useQuery(
    api.ai.getActiveJobs,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // Mutations and actions
  const requestJob = useMutation(api.ai.requestCategorizationJob);
  const processNextBatch = useAction(api.ai.processNextBatch);

  // Check if there's already an active job
  const hasActiveJob = activeJobs && activeJobs.length > 0;

  // Monitor active job progress
  useEffect(() => {
    if (hasActiveJob && activeJobs) {
      const job = activeJobs[0];
      if (job.progress) {
        setProgress({
          processed: job.progress.processed,
          total: job.progress.total,
        });
      }
    } else {
      setProgress(null);
    }
  }, [activeJobs, hasActiveJob]);

  const handlePress = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to use AI categorization');
      return;
    }

    if (!aiSettings?.enableAI) {
      Alert.alert(
        'AI Not Enabled',
        'Please enable AI features in Settings > AI Settings before using this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => {
              // Navigation handled by parent if needed
            },
          },
        ]
      );
      return;
    }

    setIsProcessing(true);
    onStartProcessing?.();

    try {
      // Request the job
      const jobResult = await requestJob({
        clerkUserId: user.id,
        repositoryIds: selectedRepositories.length > 0 ? selectedRepositories : undefined,
        categorizeAll: categorizeAll || selectedRepositories.length === 0,
      });

      setProgress({ processed: 0, total: jobResult.repositoryCount });

      // Process the job
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
          setProgress({
            processed: batchResult.progress.processed,
            total: batchResult.progress.total,
          });
        }
      }

      // Job complete
      setProgress(null);
      setIsProcessing(false);

      onComplete?.({
        jobId: jobResult.jobId,
        suggestionCount: totalSuggestions,
      });

      if (totalSuggestions > 0) {
        Alert.alert(
          'Categorization Complete',
          `AI generated ${totalSuggestions} category suggestion${totalSuggestions === 1 ? '' : 's'} for your repositories. Review them to apply.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Suggestions',
          'AI could not generate any category suggestions for the selected repositories.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      setIsProcessing(false);
      setProgress(null);

      const message = error instanceof Error ? error.message : 'Failed to categorize repositories';
      onError?.(message);

      Alert.alert('Categorization Failed', message, [{ text: 'OK' }]);
    }
  };

  const isDisabled = disabled || isProcessing || hasActiveJob || !aiSettings?.enableAI;

  const styles = StyleSheet.create({
    button: {
      backgroundColor: isDisabled ? (isDark ? '#4B5563' : '#D1D5DB') : '#6366F1',
      paddingHorizontal: compact ? 16 : 24,
      paddingVertical: compact ? 10 : 14,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDisabled ? 0 : 0.2,
      shadowRadius: 8,
      elevation: isDisabled ? 0 : 4,
    },
    buttonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: compact ? 14 : 16,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '500',
    },
    badge: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 4,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
  });

  // Render progress state
  if (isProcessing || hasActiveJob) {
    return (
      <View style={styles.button}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {progress
              ? `Processing ${progress.processed}/${progress.total}`
              : 'Starting...'}
          </Text>
        </View>
      </View>
    );
  }

  // Render normal button
  const repoCount = selectedRepositories.length;
  const showBadge = repoCount > 0 && !categorizeAll;

  return (
    <Pressable
      style={styles.button}
      onPress={handlePress}
      disabled={isDisabled}
    >
      <Feather name="zap" size={compact ? 16 : 18} color="#FFFFFF" />
      <Text style={styles.buttonText}>
        {categorizeAll ? 'AI Organize All' : 'AI Organize'}
      </Text>
      {showBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{repoCount}</Text>
        </View>
      )}
    </Pressable>
  );
};

export default AIOrganizeButton;
