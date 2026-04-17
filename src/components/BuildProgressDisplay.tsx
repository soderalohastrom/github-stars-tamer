import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface BuildProgressDisplayProps {
  isDark: boolean;
}

// Average cost per repo on Haiku (measured empirically, ~$0.011 observed)
// Kept as a simple coefficient; swap per-provider if needed later.
const EST_COST_PER_REPO = 0.011;

const BuildProgressDisplay: React.FC<BuildProgressDisplayProps> = ({ isDark }) => {
  const { user } = useUser();

  const jobs = useQuery(
    api.ai.getActiveJobs,
    user?.id ? { clerkUserId: user.id } : "skip"
  );
  const recent = useQuery(
    api.knowledge.getRecentKnowledgeEntries,
    user?.id ? { clerkUserId: user.id, limit: 5 } : "skip"
  );

  // Pick the most recent knowledge_build or knowledge_update job
  const job = (jobs ?? [])
    .filter(
      (j: any) =>
        j.jobType === "knowledge_build" || j.jobType === "knowledge_update"
    )
    .sort((a: any, b: any) => b.startedAt - a.startedAt)[0];

  const processed = job?.progress?.processed ?? 0;
  const total = job?.progress?.total ?? 0;
  const current: string | undefined = job?.progress?.currentRepository;
  const pct = total > 0 ? Math.min(100, (processed / total) * 100) : 0;

  // Track when processed last changed so we can detect stalls
  const [lastTickAt, setLastTickAt] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());
  const lastProcessedRef = useRef<number>(processed);

  useEffect(() => {
    if (processed !== lastProcessedRef.current) {
      lastProcessedRef.current = processed;
      setLastTickAt(Date.now());
    }
  }, [processed]);

  // Heartbeat — 500ms local tick so the stall countdown keeps advancing visually
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const msSinceTick = now - lastTickAt;
  let health: "healthy" | "slow" | "stalled";
  if (msSinceTick < 15_000) health = "healthy";
  else if (msSinceTick < 60_000) health = "slow";
  else health = "stalled";

  // Animated progress bar width
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withTiming(pct, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as any,
  }));

  // Pulsing health dot — scale between 1 and 1.35
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (health === "healthy") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.35, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [health]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.35], [0.9, 0.5]),
  }));

  // ETA from job start pace (self-correcting as the run progresses)
  const elapsedMs = job?.startedAt ? now - job.startedAt : 0;
  const avgMsPerRepo = processed > 0 ? elapsedMs / processed : 0;
  const remaining = Math.max(0, total - processed);
  const etaMs = remaining * avgMsPerRepo;

  const estCostSoFar = processed * EST_COST_PER_REPO;

  const styles = StyleSheet.create({
    container: {
      gap: 12,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    dotWrap: {
      width: 14,
      height: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dotHealthy: { backgroundColor: "#10b981" },
    dotSlow: { backgroundColor: "#f59e0b" },
    dotStalled: { backgroundColor: "#ef4444" },
    headerTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
      flex: 1,
    },
    healthLabel: {
      fontSize: 11,
      fontWeight: "600",
      color:
        health === "healthy"
          ? "#10b981"
          : health === "slow"
          ? "#f59e0b"
          : "#ef4444",
    },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: isDark ? "#374151" : "#e5e7eb",
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      backgroundColor: "#3b82f6",
      borderRadius: 4,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    countText: {
      fontSize: 13,
      color: isDark ? "#d1d5db" : "#374151",
    },
    countStrong: {
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    pctText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#3b82f6",
    },
    metaGrid: {
      flexDirection: "row",
      gap: 12,
    },
    metaCell: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metaText: {
      fontSize: 12,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    metaValue: {
      fontSize: 12,
      color: isDark ? "#d1d5db" : "#374151",
      fontWeight: "600",
    },
    currentBox: {
      padding: 10,
      borderRadius: 8,
      backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
      borderLeftWidth: 3,
      borderLeftColor:
        health === "healthy"
          ? "#10b981"
          : health === "slow"
          ? "#f59e0b"
          : "#ef4444",
    },
    currentLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: isDark ? "#6b7280" : "#9ca3af",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    currentText: {
      fontSize: 13,
      color: isDark ? "#e5e7eb" : "#1f2937",
      fontFamily: "System",
    },
    recentList: {
      gap: 4,
    },
    recentItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    recentText: {
      fontSize: 11,
      color: isDark ? "#9ca3af" : "#6b7280",
      flex: 1,
    },
    recentHeaderText: {
      fontSize: 10,
      fontWeight: "700",
      color: isDark ? "#6b7280" : "#9ca3af",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 4,
    },
    stallMessage: {
      fontSize: 11,
      color: "#ef4444",
      marginTop: 4,
      fontStyle: "italic",
    },
  });

  // No active job: parent component should render the idle view, not this
  if (!job) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.dotWrap}>
          <Animated.View
            style={[
              styles.dot,
              health === "healthy" && styles.dotHealthy,
              health === "slow" && styles.dotSlow,
              health === "stalled" && styles.dotStalled,
              health === "healthy" && pulseStyle,
            ]}
          />
        </View>
        <Text style={styles.headerTitle}>Building Knowledge Graph</Text>
        <Text style={styles.healthLabel}>
          {health === "healthy"
            ? "LIVE"
            : health === "slow"
            ? `SLOW · ${Math.floor(msSinceTick / 1000)}s`
            : `STALLED · ${Math.floor(msSinceTick / 1000)}s`}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, barStyle]} />
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.countText}>
          <Text style={styles.countStrong}>{processed}</Text>
          <Text> / {total} processed</Text>
        </Text>
        <Text style={styles.pctText}>{pct.toFixed(1)}%</Text>
      </View>

      {/* Meta row: ETA, pace, cost */}
      <View style={styles.metaGrid}>
        <View style={styles.metaCell}>
          <Feather name="clock" size={12} color={isDark ? "#9ca3af" : "#6b7280"} />
          <Text style={styles.metaText}>ETA</Text>
          <Text style={styles.metaValue}>
            {health === "stalled" ? "—" : formatEta(etaMs)}
          </Text>
        </View>
        <View style={styles.metaCell}>
          <Feather name="zap" size={12} color={isDark ? "#9ca3af" : "#6b7280"} />
          <Text style={styles.metaText}>Pace</Text>
          <Text style={styles.metaValue}>
            {avgMsPerRepo > 0 ? `${(avgMsPerRepo / 1000).toFixed(1)}s/repo` : "—"}
          </Text>
        </View>
        <View style={styles.metaCell}>
          <Feather
            name="dollar-sign"
            size={12}
            color={isDark ? "#9ca3af" : "#6b7280"}
          />
          <Text style={styles.metaValue}>${estCostSoFar.toFixed(2)}</Text>
        </View>
      </View>

      {/* Current repo */}
      {current && (
        <View style={styles.currentBox}>
          <Text style={styles.currentLabel}>Now processing</Text>
          <Text style={styles.currentText} numberOfLines={1}>
            {current}
          </Text>
          {health === "stalled" && (
            <Text style={styles.stallMessage}>
              No progress for {Math.floor(msSinceTick / 1000)}s — check Convex dashboard
            </Text>
          )}
        </View>
      )}

      {/* Recent completions */}
      {recent && recent.length > 0 && (
        <View style={styles.recentList}>
          <Text style={styles.recentHeaderText}>Recently completed</Text>
          {recent.slice(0, 3).map((r, i) => (
            <View
              key={r._id}
              style={[styles.recentItem, { opacity: 1 - i * 0.25 }]}
            >
              <Feather
                name={r.status === "processed" ? "check" : r.status === "no_readme" ? "minus" : "x"}
                size={11}
                color={
                  r.status === "processed"
                    ? "#10b981"
                    : r.status === "no_readme"
                    ? "#6b7280"
                    : "#ef4444"
                }
              />
              <Text style={styles.recentText} numberOfLines={1}>
                {r.fullName}
              </Text>
              {r.processingTimeMs && (
                <Text style={styles.metaText}>
                  {(r.processingTimeMs / 1000).toFixed(1)}s
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

function formatEta(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return `${hr}h ${rem}m`;
}

export default BuildProgressDisplay;
