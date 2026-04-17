import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import BuildProgressDisplay from "./BuildProgressDisplay";

interface GraphGeneratorPanelProps {
  visible: boolean;
  onClose: () => void;
}

const GraphGeneratorPanel: React.FC<GraphGeneratorPanelProps> = ({
  visible,
  onClose,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useUser();
  const [isBuilding, setIsBuilding] = useState(false);

  const status = useQuery(
    api.knowledge.getKnowledgeStatus,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const activeJobs = useQuery(
    api.ai.getActiveJobs,
    user?.id ? { clerkUserId: user.id } : "skip"
  );
  const activeKnowledgeJob = (activeJobs ?? []).find(
    (j: any) =>
      j.jobType === "knowledge_build" || j.jobType === "knowledge_update"
  );

  const startBuild = useMutation(api.knowledge.startKnowledgeBuild);
  const startUpdate = useMutation(api.knowledge.startKnowledgeUpdate);
  const resetFailed = useMutation(api.knowledge.resetFailedKnowledge);

  // Animation
  const progress = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(visible ? 1 : 0, {
      damping: 20,
      stiffness: 200,
    });
  }, [visible]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-320, 0]),
      },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    pointerEvents: progress.value > 0.5 ? ("auto" as const) : ("none" as const),
  }));

  const handleBuild = async () => {
    if (!user?.id) return;
    setIsBuilding(true);
    try {
      const result = await startBuild({ clerkUserId: user.id });
      if (result.totalToProcess === 0) {
        Alert.alert("Up to Date", "All repositories have been processed.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to start build");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleUpdate = async () => {
    if (!user?.id) return;
    setIsBuilding(true);
    try {
      const result = await startUpdate({ clerkUserId: user.id });
      if (result.totalToProcess === 0) {
        Alert.alert("Up to Date", "No repositories need updating.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to start update");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleResetFailed = (includeNoReadme: boolean) => {
    if (!user?.id) return;
    const label = includeNoReadme
      ? `${status?.failed ?? 0} failed + ${status?.noReadme ?? 0} no-README`
      : `${status?.failed ?? 0} failed`;
    Alert.alert(
      "Reset Entries?",
      `This will delete ${label} knowledge entries so Build Graph can retry them. Your repositories are not affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await resetFailed({
                clerkUserId: user.id,
                includeNoReadme,
              });
              Alert.alert(
                "Reset Complete",
                `${result.deleted} entries cleared. Tap "Build Graph" to retry.`
              );
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to reset");
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
      zIndex: 10,
    },
    panel: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width: 300,
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderRightWidth: 1,
      borderRightColor: isDark ? "#374151" : "#e5e7eb",
      zIndex: 11,
      paddingTop: 16,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    closeButton: {
      padding: 4,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: isDark ? "#6b7280" : "#9ca3af",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    statLabel: {
      fontSize: 14,
      color: isDark ? "#d1d5db" : "#374151",
    },
    statValue: {
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
    },
    statHighlight: {
      color: "#3b82f6",
      fontWeight: "700",
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? "#374151" : "#e5e7eb",
    },
    buildButton: {
      backgroundColor: "#3b82f6",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 10,
    },
    buildButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#ffffff",
    },
    updateButton: {
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 10,
      borderRadius: 8,
    },
    updateButtonText: {
      fontSize: 14,
      fontWeight: "500",
      color: isDark ? "#d1d5db" : "#374151",
    },
    hint: {
      fontSize: 12,
      color: isDark ? "#6b7280" : "#9ca3af",
      marginTop: 12,
      lineHeight: 16,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });

  if (!visible && progress.value === 0) return null;

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.panel, panelStyle]}>
        <View style={styles.header}>
          <Text style={styles.title}>Knowledge Builder</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Feather
              name="x"
              size={22}
              color={isDark ? "#9ca3af" : "#6b7280"}
            />
          </Pressable>
        </View>

        {/* Status — live progress when a job is active, summary counts otherwise */}
        <View style={styles.section}>
          {activeKnowledgeJob ? (
            <BuildProgressDisplay isDark={isDark} />
          ) : (
            <>
              <Text style={styles.sectionTitle}>Status</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Processed</Text>
                <Text style={styles.statValue}>{status?.processed ?? 0}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Failed</Text>
                <Text style={styles.statValue}>{status?.failed ?? 0}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>No README</Text>
                <Text style={styles.statValue}>{status?.noReadme ?? 0}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Unprocessed</Text>
                <Text style={[styles.statValue, styles.statHighlight]}>
                  {status?.unprocessed ?? 0}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total repos</Text>
                <Text style={styles.statValue}>{status?.total ?? 0}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.divider} />

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <Pressable
            style={[
              styles.buildButton,
              (isBuilding || (status?.unprocessed ?? 0) === 0) &&
                styles.disabledButton,
            ]}
            onPress={handleBuild}
            disabled={isBuilding || (status?.unprocessed ?? 0) === 0}
          >
            {isBuilding ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="zap" size={16} color="#ffffff" />
            )}
            <Text style={styles.buildButtonText}>
              {isBuilding
                ? "Building..."
                : `Build Graph (${status?.unprocessed ?? 0} new)`}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.updateButton, isBuilding && styles.disabledButton]}
            onPress={handleUpdate}
            disabled={isBuilding}
          >
            <Feather
              name="refresh-cw"
              size={14}
              color={isDark ? "#d1d5db" : "#374151"}
            />
            <Text style={styles.updateButtonText}>Update Graph</Text>
          </Pressable>

          <Text style={styles.hint}>
            Build processes unprocessed repos. Update re-checks repos with
            changed READMEs.
          </Text>
        </View>

        {/* Recovery section — only shown if there are entries to reset */}
        {((status?.failed ?? 0) > 0 || (status?.noReadme ?? 0) > 0) && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recovery</Text>

              {(status?.failed ?? 0) > 0 && (
                <Pressable
                  style={[styles.updateButton, { marginBottom: 8 }]}
                  onPress={() => handleResetFailed(false)}
                >
                  <Feather
                    name="rotate-ccw"
                    size={14}
                    color={isDark ? "#d1d5db" : "#374151"}
                  />
                  <Text style={styles.updateButtonText}>
                    Reset {status?.failed ?? 0} failed
                  </Text>
                </Pressable>
              )}

              {(status?.noReadme ?? 0) > 10 && (
                <Pressable
                  style={styles.updateButton}
                  onPress={() => handleResetFailed(true)}
                >
                  <Feather
                    name="alert-triangle"
                    size={14}
                    color={isDark ? "#d1d5db" : "#374151"}
                  />
                  <Text style={styles.updateButtonText}>
                    Reset failed + no-README
                  </Text>
                </Pressable>
              )}

              <Text style={styles.hint}>
                Use if a batch failed due to token expiry or rate limits. Clears
                stuck entries so Build Graph can retry them.
              </Text>
            </View>
          </>
        )}
      </Animated.View>
    </>
  );
};

export default GraphGeneratorPanel;
