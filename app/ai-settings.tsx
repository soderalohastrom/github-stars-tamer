import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { router } from 'expo-router';

// Provider and model options
const PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude',
    description: 'Recommended - Best quality categorization',
    icon: 'cpu',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models via OpenAI API',
    icon: 'zap',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local AI - Free but requires setup',
    icon: 'hard-drive',
  },
] as const;

const MODEL_OPTIONS: Record<string, Array<{ id: string; name: string; description: string }>> = {
  claude: [
    { id: 'claude-haiku-4-5', name: 'Claude 4.5 Haiku', description: 'Fast, cost-effective (~$1/1M tokens)' },
    { id: 'claude-sonnet-4-6', name: 'Claude 4.6 Sonnet', description: 'Best quality (~$3/1M tokens)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Best quality' },
  ],
  ollama: [
    { id: 'gemma:2b', name: 'Gemma 2B', description: 'Small, fast, good for testing' },
    { id: 'llama2:7b', name: 'Llama 2 7B', description: 'Balanced performance' },
    { id: 'mistral:7b', name: 'Mistral 7B', description: 'Good quality' },
  ],
};

type Provider = 'claude' | 'openai' | 'ollama';

const AISettingsScreen = () => {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Local state for settings
  const [localSettings, setLocalSettings] = useState({
    enableAI: false,
    aiProvider: 'claude' as Provider,
    aiModel: 'claude-haiku-4-5',
    ollamaEndpoint: 'http://localhost:11434',
    includeReadme: true,
    timeoutMs: 30000,
    maxRetries: 3,
    batchSize: 10,
    confidenceThreshold: 0.6,
    autoApplyThreshold: 0.9,
  });

  // Queries
  const aiSettings = useQuery(
    api.ai.getAiSettings,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  const usageStats = useQuery(
    api.ai.getUsageStats,
    user?.id ? { clerkUserId: user.id } : 'skip'
  );

  // Mutations and actions
  const updateAiSettings = useMutation(api.ai.updateAiSettings);
  const testClaudeConnection = useAction(api.claudeAi.testClaudeConnection);
  const testOllamaConnection = useAction(api.ai.testOllamaConnectionAction);

  // Load settings when available
  useEffect(() => {
    if (aiSettings) {
      // Type guard to handle both DB and default settings
      const settings = aiSettings as any;
      setLocalSettings({
        enableAI: settings.enableAI ?? false,
        aiProvider: (settings.aiProvider as Provider) ?? 'claude',
        aiModel: settings.aiModel ?? 'claude-3-haiku-20240307',
        ollamaEndpoint: settings.ollamaEndpoint ?? 'http://localhost:11434',
        includeReadme: settings.includeReadme ?? true,
        timeoutMs: settings.advancedSettings?.timeoutMs ?? 30000,
        maxRetries: settings.advancedSettings?.maxRetries ?? 3,
        batchSize: settings.batchSize ?? 10,
        confidenceThreshold: settings.confidenceThreshold ?? 0.6,
        autoApplyThreshold: settings.autoApplyThreshold ?? 0.9,
      });
    }
  }, [aiSettings]);

  const handleSettingChange = (key: string, value: any) => {
    setLocalSettings((prev) => {
      const newSettings = { ...prev, [key]: value };

      // When provider changes, set default model for that provider
      if (key === 'aiProvider') {
        const provider = value as Provider;
        const models = MODEL_OPTIONS[provider];
        if (models && models.length > 0) {
          newSettings.aiModel = models[0].id;
        }
      }

      return newSettings;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await updateAiSettings({
        clerkUserId: user.id,
        enableAI: localSettings.enableAI,
        aiProvider: localSettings.aiProvider,
        aiModel: localSettings.aiModel,
        ollamaEndpoint: localSettings.ollamaEndpoint,
        includeReadme: localSettings.includeReadme,
        batchSize: localSettings.batchSize,
        confidenceThreshold: localSettings.confidenceThreshold,
        autoApplyThreshold: localSettings.autoApplyThreshold,
        advancedSettings: {
          timeoutMs: localSettings.timeoutMs,
          maxRetries: localSettings.maxRetries,
        },
      });

      setHasChanges(false);
      Alert.alert('Success', 'AI settings saved successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      let result;

      if (localSettings.aiProvider === 'claude') {
        result = await testClaudeConnection({
          model: localSettings.aiModel,
        });
      } else if (localSettings.aiProvider === 'ollama') {
        result = await testOllamaConnection({
          endpoint: localSettings.ollamaEndpoint,
          model: localSettings.aiModel,
          timeoutMs: 10000,
        });
      } else {
        Alert.alert('Info', 'OpenAI connection testing not yet implemented');
        setIsTesting(false);
        return;
      }

      if (result.success) {
        Alert.alert(
          'Connection Successful',
          `Connected to ${localSettings.aiModel}\n\n${result.response || result.message}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Connection Failed',
          result.message || 'Could not connect to AI provider',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert('Connection Error', error.message || 'Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all AI settings to their default values.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setLocalSettings({
              enableAI: false,
              aiProvider: 'claude',
              aiModel: 'claude-haiku-4-5',
              ollamaEndpoint: 'http://localhost:11434',
              includeReadme: true,
              timeoutMs: 30000,
              maxRetries: 3,
              batchSize: 10,
              confidenceThreshold: 0.6,
              autoApplyThreshold: 0.9,
            });
            setHasChanges(true);
          },
        },
      ]
    );
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0F0F23' : '#F9FAFB',
    },
    header: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    backButton: {
      padding: 4,
    },
    content: {
      flex: 1,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#111827',
      marginBottom: 4,
    },
    sectionDescription: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      lineHeight: 20,
    },
    settingItem: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingContent: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#111827',
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      lineHeight: 20,
    },
    textInput: {
      backgroundColor: isDark ? '#374151' : '#F9FAFB',
      borderWidth: 1,
      borderColor: isDark ? '#4B5563' : '#E5E7EB',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: isDark ? '#FFFFFF' : '#111827',
      marginTop: 8,
    },
    providerOption: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
      flexDirection: 'row',
      alignItems: 'center',
    },
    providerOptionSelected: {
      backgroundColor: isDark ? '#2D2D5A' : '#EEF2FF',
    },
    providerIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    providerIconSelected: {
      backgroundColor: '#6366F1',
    },
    providerContent: {
      flex: 1,
    },
    providerName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    providerDescription: {
      fontSize: 13,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 2,
    },
    checkIcon: {
      marginLeft: 8,
    },
    modelOption: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#E5E7EB',
      flexDirection: 'row',
      alignItems: 'center',
    },
    modelOptionSelected: {
      backgroundColor: isDark ? '#2D2D5A' : '#EEF2FF',
    },
    modelContent: {
      flex: 1,
    },
    modelName: {
      fontSize: 15,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    modelDescription: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginTop: 2,
    },
    usageCard: {
      backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
      marginHorizontal: 20,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    usageTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#111827',
      marginBottom: 16,
    },
    usageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    usageStat: {
      width: '47%',
      backgroundColor: isDark ? '#374151' : '#F9FAFB',
      borderRadius: 8,
      padding: 12,
    },
    usageStatLabel: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 4,
    },
    usageStatValue: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    usageStatSubtext: {
      fontSize: 11,
      color: isDark ? '#6B7280' : '#9CA3AF',
      marginTop: 2,
    },
    infoBox: {
      backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF',
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginHorizontal: 20,
      marginVertical: 8,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    infoText: {
      fontSize: 14,
      color: isDark ? '#93C5FD' : '#1E40AF',
      lineHeight: 20,
      flex: 1,
    },
    testButton: {
      backgroundColor: '#6366F1',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 8,
    },
    testButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
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
    saveButton: {
      flex: 1,
      backgroundColor: '#6366F1',
      paddingVertical: 14,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    saveButtonDisabled: {
      backgroundColor: '#9CA3AF',
    },
    resetButton: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    saveButtonText: {
      color: '#FFFFFF',
    },
    resetButtonText: {
      color: isDark ? '#FFFFFF' : '#374151',
    },
    textDark: {
      color: '#FFFFFF',
    },
    textSecondaryDark: {
      color: '#9CA3AF',
    },
  });

  const currentModels = MODEL_OPTIONS[localSettings.aiProvider] || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={styles.headerTitle}>AI Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Enable AI Toggle */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI Features</Text>
            <Text style={styles.sectionDescription}>
              Enable AI-powered repository categorization
            </Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Enable AI Categorization</Text>
              <Text style={styles.settingDescription}>
                Allow AI to analyze and suggest categories for your repositories
              </Text>
            </View>
            <Switch
              value={localSettings.enableAI}
              onValueChange={(value) => handleSettingChange('enableAI', value)}
              trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: '#6366F1' }}
              thumbColor={localSettings.enableAI ? '#FFFFFF' : isDark ? '#9CA3AF' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Usage Statistics */}
        {usageStats && usageStats.requestCount > 0 && (
          <View style={styles.usageCard}>
            <Text style={styles.usageTitle}>Usage Statistics</Text>
            <View style={styles.usageGrid}>
              <View style={styles.usageStat}>
                <Text style={styles.usageStatLabel}>Total Tokens</Text>
                <Text style={styles.usageStatValue}>{formatTokens(usageStats.totalTokens)}</Text>
                <Text style={styles.usageStatSubtext}>All time</Text>
              </View>
              <View style={styles.usageStat}>
                <Text style={styles.usageStatLabel}>Total Cost</Text>
                <Text style={styles.usageStatValue}>{formatCost(usageStats.totalCost)}</Text>
                <Text style={styles.usageStatSubtext}>All time</Text>
              </View>
              <View style={styles.usageStat}>
                <Text style={styles.usageStatLabel}>Recent Tokens</Text>
                <Text style={styles.usageStatValue}>{formatTokens(usageStats.recentTokens)}</Text>
                <Text style={styles.usageStatSubtext}>Last 30 days</Text>
              </View>
              <View style={styles.usageStat}>
                <Text style={styles.usageStatLabel}>Recent Cost</Text>
                <Text style={styles.usageStatValue}>{formatCost(usageStats.recentCost)}</Text>
                <Text style={styles.usageStatSubtext}>Last 30 days</Text>
              </View>
            </View>
          </View>
        )}

        {/* AI Provider Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI Provider</Text>
            <Text style={styles.sectionDescription}>
              Choose which AI service to use for categorization
            </Text>
          </View>

          {PROVIDERS.map((provider) => (
            <Pressable
              key={provider.id}
              style={[
                styles.providerOption,
                localSettings.aiProvider === provider.id && styles.providerOptionSelected,
              ]}
              onPress={() => handleSettingChange('aiProvider', provider.id)}
            >
              <View
                style={[
                  styles.providerIcon,
                  localSettings.aiProvider === provider.id && styles.providerIconSelected,
                ]}
              >
                <Feather
                  name={provider.icon as any}
                  size={20}
                  color={localSettings.aiProvider === provider.id ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'}
                />
              </View>
              <View style={styles.providerContent}>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerDescription}>{provider.description}</Text>
              </View>
              {localSettings.aiProvider === provider.id && (
                <Feather name="check" size={20} color="#6366F1" style={styles.checkIcon} />
              )}
            </Pressable>
          ))}

          {localSettings.aiProvider === 'claude' && (
            <View style={styles.infoBox}>
              <Feather name="info" size={16} color={isDark ? '#93C5FD' : '#3B82F6'} />
              <Text style={styles.infoText}>
                Claude is powered by Anthropic and requires an API key. Set ANTHROPIC_API_KEY in
                your Convex environment variables.
              </Text>
            </View>
          )}

          {localSettings.aiProvider === 'ollama' && (
            <View style={styles.infoBox}>
              <Feather name="info" size={16} color={isDark ? '#93C5FD' : '#3B82F6'} />
              <Text style={styles.infoText}>
                Ollama runs locally on your machine. Install from ollama.ai and pull a model
                before using.
              </Text>
            </View>
          )}
        </View>

        {/* Model Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Model</Text>
            <Text style={styles.sectionDescription}>Select the AI model to use</Text>
          </View>

          {currentModels.map((model) => (
            <Pressable
              key={model.id}
              style={[
                styles.modelOption,
                localSettings.aiModel === model.id && styles.modelOptionSelected,
              ]}
              onPress={() => handleSettingChange('aiModel', model.id)}
            >
              <View style={styles.modelContent}>
                <Text style={styles.modelName}>{model.name}</Text>
                <Text style={styles.modelDescription}>{model.description}</Text>
              </View>
              {localSettings.aiModel === model.id && (
                <Feather name="check" size={18} color="#6366F1" />
              )}
            </Pressable>
          ))}
        </View>

        {/* Ollama Endpoint (only show for Ollama) */}
        {localSettings.aiProvider === 'ollama' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ollama Configuration</Text>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Endpoint URL</Text>
                <Text style={styles.settingDescription}>URL to your local Ollama server</Text>
                <TextInput
                  style={styles.textInput}
                  value={localSettings.ollamaEndpoint}
                  onChangeText={(text) => handleSettingChange('ollamaEndpoint', text)}
                  placeholder="http://localhost:11434"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>
        )}

        {/* Test Connection Button */}
        <Pressable
          style={styles.testButton}
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="wifi" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.testButtonText}>
            {isTesting ? 'Testing Connection...' : 'Test Connection'}
          </Text>
        </Pressable>

        {/* Processing Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Processing Settings</Text>
            <Text style={styles.sectionDescription}>Configure how AI processes repositories</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Include README</Text>
              <Text style={styles.settingDescription}>
                Fetch and analyze README files for better categorization
              </Text>
            </View>
            <Switch
              value={localSettings.includeReadme}
              onValueChange={(value) => handleSettingChange('includeReadme', value)}
              trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: '#6366F1' }}
              thumbColor={localSettings.includeReadme ? '#FFFFFF' : isDark ? '#9CA3AF' : '#F3F4F6'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Batch Size</Text>
              <Text style={styles.settingDescription}>
                Repositories to process per API call (5-20)
              </Text>
              <TextInput
                style={styles.textInput}
                value={String(localSettings.batchSize)}
                onChangeText={(text) => {
                  const num = parseInt(text) || 10;
                  handleSettingChange('batchSize', Math.min(20, Math.max(5, num)));
                }}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              />
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Confidence Threshold</Text>
              <Text style={styles.settingDescription}>
                Minimum confidence to show suggestions (0.1-1.0)
              </Text>
              <TextInput
                style={styles.textInput}
                value={String(localSettings.confidenceThreshold)}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0.6;
                  handleSettingChange('confidenceThreshold', Math.min(1.0, Math.max(0.1, num)));
                }}
                keyboardType="decimal-pad"
                placeholder="0.6"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              />
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Auto-Apply Threshold</Text>
              <Text style={styles.settingDescription}>
                Confidence level to auto-apply suggestions (0.8-1.0)
              </Text>
              <TextInput
                style={styles.textInput}
                value={String(localSettings.autoApplyThreshold)}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0.9;
                  handleSettingChange('autoApplyThreshold', Math.min(1.0, Math.max(0.8, num)));
                }}
                keyboardType="decimal-pad"
                placeholder="0.9"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              />
            </View>
          </View>
        </View>

        {/* Advanced Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Advanced</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Request Timeout (ms)</Text>
              <Text style={styles.settingDescription}>
                Maximum time to wait for AI response
              </Text>
              <TextInput
                style={styles.textInput}
                value={String(localSettings.timeoutMs)}
                onChangeText={(text) => {
                  const num = parseInt(text) || 30000;
                  handleSettingChange('timeoutMs', num);
                }}
                keyboardType="numeric"
                placeholder="30000"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              />
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Max Retries</Text>
              <Text style={styles.settingDescription}>Number of retry attempts for failed requests</Text>
              <TextInput
                style={styles.textInput}
                value={String(localSettings.maxRetries)}
                onChangeText={(text) => {
                  const num = parseInt(text) || 3;
                  handleSettingChange('maxRetries', Math.min(5, Math.max(0, num)));
                }}
                keyboardType="numeric"
                placeholder="3"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              />
            </View>
          </View>
        </View>

        {/* Spacer for footer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Text style={[styles.buttonText, styles.resetButtonText]}>Reset</Text>
        </Pressable>

        <Pressable
          style={[styles.saveButton, (!hasChanges || isLoading) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="save" size={20} color="#FFFFFF" />
          )}
          <Text style={[styles.buttonText, styles.saveButtonText]}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default AISettingsScreen;
