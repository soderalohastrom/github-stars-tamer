import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface SyncStatusCardProps {
  sync: {
    _id: string;
    syncType: 'full' | 'incremental' | 'manual';
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt: number;
    completedAt?: number;
    repositoriesProcessed: number;
    repositoriesAdded: number;
    repositoriesUpdated: number;
    repositoriesRemoved: number;
    errorMessage?: string;
  };
}

const SyncStatusCard: React.FC<SyncStatusCardProps> = ({ sync }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getStatusIcon = () => {
    switch (sync.status) {
      case 'completed':
        return <Feather name="check-circle" size={20} color="#10b981" />;
      case 'failed':
        return <Feather name="x-circle" size={20} color="#ef4444" />;
      case 'running':
        return <Feather name="loader" size={20} color="#f59e0b" />;
      case 'pending':
        return <Feather name="clock" size={20} color="#6b7280" />;
      default:
        return <Feather name="help-circle" size={20} color="#6b7280" />;
    }
  };

  const getStatusColor = () => {
    switch (sync.status) {
      case 'completed':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      case 'running':
        return '#f59e0b';
      case 'pending':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60)
      );
      return `${diffInMinutes}m ago`;
    }
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  const getDuration = () => {
    if (!sync.completedAt) return null;
    
    const duration = sync.completedAt - sync.startedAt;
    const seconds = Math.floor(duration / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getSyncTypeLabel = () => {
    switch (sync.syncType) {
      case 'full':
        return 'Full Sync';
      case 'incremental':
        return 'Quick Sync';
      case 'manual':
        return 'Manual Sync';
      default:
        return 'Sync';
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#e5e7eb',
      borderLeftWidth: 4,
      borderLeftColor: getStatusColor(),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    leftHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    syncType: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
    },
    timestamp: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    status: {
      fontSize: 14,
      fontWeight: '500',
      color: getStatusColor(),
      textTransform: 'capitalize',
    },
    stats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: sync.status === 'failed' ? 8 : 0,
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
    },
    statLabel: {
      fontSize: 11,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginTop: 2,
    },
    duration: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
    },
    errorContainer: {
      backgroundColor: isDark ? '#7f1d1d' : '#fef2f2',
      borderRadius: 6,
      padding: 8,
      marginTop: 8,
    },
    errorText: {
      fontSize: 12,
      color: isDark ? '#fca5a5' : '#dc2626',
      lineHeight: 16,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          {getStatusIcon()}
          <Text style={styles.syncType}>{getSyncTypeLabel()}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.status}>{sync.status}</Text>
          <Text style={styles.timestamp}>{formatDate(sync.startedAt)}</Text>
        </View>
      </View>

      {sync.status !== 'pending' && sync.status !== 'running' && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{sync.repositoriesProcessed}</Text>
            <Text style={styles.statLabel}>Processed</Text>
          </View>
          
          {sync.repositoriesAdded > 0 && (
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: '#10b981' }]}>
                +{sync.repositoriesAdded}
              </Text>
              <Text style={styles.statLabel}>Added</Text>
            </View>
          )}
          
          {sync.repositoriesUpdated > 0 && (
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: '#f59e0b' }]}>
                ~{sync.repositoriesUpdated}
              </Text>
              <Text style={styles.statLabel}>Updated</Text>
            </View>
          )}
          
          {sync.repositoriesRemoved > 0 && (
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>
                -{sync.repositoriesRemoved}
              </Text>
              <Text style={styles.statLabel}>Removed</Text>
            </View>
          )}
          
          {getDuration() && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>{getDuration()}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          )}
        </View>
      )}

      {sync.status === 'failed' && sync.errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{sync.errorMessage}</Text>
        </View>
      )}
    </View>
  );
};

export default SyncStatusCard;
