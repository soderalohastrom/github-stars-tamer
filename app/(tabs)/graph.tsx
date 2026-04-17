import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Feather } from "@expo/vector-icons";
import GraphGeneratorPanel from "../../src/components/GraphGeneratorPanel";
import GraphVisualization from "../../src/components/GraphVisualization";
import DocumentReaderPanel from "../../src/components/DocumentReaderPanel";

export default function GraphScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const { user } = useUser();
  const [openPanel, setOpenPanel] = useState<"builder" | "reader" | null>(null);
  const [readerRepoId, setReaderRepoId] = useState<string | null>(null);

  const status = useQuery(
    api.knowledge.getKnowledgeStatus,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const graphData = useQuery(
    api.knowledge.getGraphData,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const handleNodePress = (nodeId: string) => {
    setReaderRepoId(nodeId);
    setOpenPanel("reader");
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#0f0f23" : "#f9fafb",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    settingsButton: {
      padding: 6,
    },
    body: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      color: isDark ? "#9ca3af" : "#6b7280",
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 24,
    },
    buildButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#3b82f6",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 10,
    },
    buildButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#ffffff",
    },
    fab: {
      position: "absolute",
      bottom: 24,
      left: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: isDark ? "#374151" : "#1f2937",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    fabText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#ffffff",
    },
  });

  const hasProcessed = (status?.processed ?? 0) > 0;
  const statusLabel = status
    ? `${status.processed}/${status.total}`
    : "...";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>AI Graph</Text>
          {status && (
            <View style={styles.statusBadge}>
              <Feather name="activity" size={12} color={isDark ? "#9ca3af" : "#6b7280"} />
              <Text style={styles.statusText}>{statusLabel} processed</Text>
            </View>
          )}
        </View>
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push("/ai-settings")}
        >
          <Feather
            name="settings"
            size={20}
            color={isDark ? "#9ca3af" : "#6b7280"}
          />
        </Pressable>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {!hasProcessed ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather
                name="share-2"
                size={36}
                color={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>
            <Text style={styles.emptyTitle}>No Knowledge Graph Yet</Text>
            <Text style={styles.emptyText}>
              Build your knowledge graph to see connections between your starred
              repositories. Each repo gets a distilled wiki page with
              cross-references.
            </Text>
            <Pressable
              style={styles.buildButton}
              onPress={() => setOpenPanel("builder")}
            >
              <Feather name="zap" size={18} color="#ffffff" />
              <Text style={styles.buildButtonText}>Build Graph</Text>
            </Pressable>
          </View>
        ) : (
          <GraphVisualization
            graphData={graphData ?? { nodes: [], edges: [] }}
            onNodePress={handleNodePress}
            isDark={isDark}
          />
        )}
      </View>

      {/* FAB to toggle generator panel */}
      {hasProcessed && (
        <Pressable
          style={styles.fab}
          onPress={() => setOpenPanel("builder")}
        >
          <Feather name="cpu" size={16} color="#ffffff" />
          <Text style={styles.fabText}>Builder</Text>
        </Pressable>
      )}

      {/* Generator panel (left) */}
      <GraphGeneratorPanel
        visible={openPanel === "builder"}
        onClose={() => setOpenPanel(null)}
      />

      {/* Document reader panel (right) */}
      <DocumentReaderPanel
        repoId={readerRepoId}
        visible={openPanel === "reader"}
        onClose={() => setOpenPanel(null)}
        onNavigateToRepo={(id) => setReaderRepoId(id)}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}
