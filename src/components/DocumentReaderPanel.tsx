import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import MarkdownRenderer from "./MarkdownRenderer";
import LoadingSpinner from "./LoadingSpinner";

interface DocumentReaderPanelProps {
  repoId: string | null;
  visible: boolean;
  onClose: () => void;
  onNavigateToRepo: (repoId: string) => void;
  isDark: boolean;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  "C++": "#f34b7d",
  C: "#555555",
  Shell: "#89e051",
  Dart: "#00B4AB",
  Lua: "#000080",
};

function getLanguageColor(language: string | null | undefined): string {
  if (!language) return "#6b7280";
  return LANGUAGE_COLORS[language] || "#6b7280";
}

function extractWikilinks(markdown: string): string[] {
  const matches = markdown.match(/\[\[([^\]]+?)\]\]/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  llm_discovered: "AI",
  shared_topic: "Topic",
  shared_language: "Language",
  same_owner: "Owner",
};

const DocumentReaderPanel: React.FC<DocumentReaderPanelProps> = ({
  repoId,
  visible,
  onClose,
  onNavigateToRepo,
  isDark,
}) => {
  const { user } = useUser();
  const { width: screenWidth } = useWindowDimensions();
  const [history, setHistory] = useState<string[]>([]);

  // Panel width: ~420px on web, ~85% on mobile
  const panelWidth =
    Platform.OS === "web"
      ? Math.min(480, Math.max(380, screenWidth * 0.35))
      : screenWidth * 0.85;

  // Slide animation
  const slideProgress = useSharedValue(0);

  useEffect(() => {
    slideProgress.value = withTiming(visible ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          slideProgress.value,
          [0, 1],
          [panelWidth + 20, 0]
        ),
      },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideProgress.value, [0, 1], [0, 0.4]),
    pointerEvents:
      slideProgress.value > 0.5
        ? ("auto" as const)
        : ("none" as const),
  }));

  // Current repoId (from prop or internal navigation)
  const currentRepoId = repoId;

  const page = useQuery(
    api.knowledge.getKnowledgePage,
    user?.id && currentRepoId
      ? {
          clerkUserId: user.id,
          repositoryId: currentRepoId as Id<"repositories">,
        }
      : "skip"
  );

  const wikilinkNames = useMemo(() => {
    if (!page?.markdownContent) return [];
    return extractWikilinks(page.markdownContent);
  }, [page?.markdownContent]);

  const wikilinkResolutions = useQuery(
    api.knowledge.resolveWikilinks,
    user?.id && wikilinkNames.length > 0
      ? { clerkUserId: user.id, fullNames: wikilinkNames }
      : "skip"
  );

  const resolvedWikilinks = useMemo(() => {
    if (!wikilinkResolutions) return {};
    const map: Record<string, any> = {};
    for (const r of wikilinkResolutions) map[r.fullName] = r;
    return map;
  }, [wikilinkResolutions]);

  const handleWikilinkPress = useCallback(
    (targetRepoId: string) => {
      if (currentRepoId) {
        setHistory((prev) => [...prev, currentRepoId]);
      }
      onNavigateToRepo(targetRepoId);
    },
    [currentRepoId, onNavigateToRepo]
  );

  const handleBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      onNavigateToRepo(prev);
    } else {
      onClose();
    }
  }, [history, onNavigateToRepo, onClose]);

  const handleExternalLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const handleCopyCloneUrl = useCallback(async () => {
    if (!page?.repository?.htmlUrl) return;
    const cloneUrl = `${page.repository.htmlUrl}.git`;
    if (Platform.OS === "web") {
      await navigator.clipboard.writeText(cloneUrl);
    } else {
      const Clipboard = require("expo-clipboard");
      await Clipboard.setStringAsync(cloneUrl);
    }
  }, [page?.repository?.htmlUrl]);

  const handleDownloadZip = useCallback(() => {
    if (!page?.repository?.htmlUrl || !page?.repository?.defaultBranch) return;
    Linking.openURL(
      `${page.repository.htmlUrl}/archive/refs/heads/${page.repository.defaultBranch}.zip`
    );
  }, [page?.repository?.htmlUrl, page?.repository?.defaultBranch]);

  const handleOpenDesktop = useCallback(() => {
    if (!page?.repository?.htmlUrl) return;
    Linking.openURL(
      `x-github-client://openRepo/${page.repository.htmlUrl}`
    );
  }, [page?.repository?.htmlUrl]);

  const formatStars = (count: number): string => {
    if (count >= 1000) return (count / 1000).toFixed(1) + "k";
    return count.toString();
  };

  // Reset history when panel opens with a new repo
  useEffect(() => {
    if (visible) setHistory([]);
  }, [visible]);

  const styles = StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "#000000",
      zIndex: 20,
    },
    panel: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      width: panelWidth,
      backgroundColor: isDark ? "#0f0f23" : "#ffffff",
      borderLeftWidth: 1,
      borderLeftColor: isDark ? "#374151" : "#e5e7eb",
      zIndex: 21,
      shadowColor: "#000",
      shadowOffset: { width: -4, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    header: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    navButton: {
      padding: 6,
      marginRight: 8,
    },
    headerInfo: {
      flex: 1,
    },
    repoName: {
      fontSize: 17,
      fontWeight: "bold",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 3,
    },
    headerMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    languageBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    languageDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    metaText: {
      fontSize: 12,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    starBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    closeButton: {
      padding: 6,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 8,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    actionText: {
      fontSize: 11,
      fontWeight: "500",
      color: isDark ? "#d1d5db" : "#374151",
    },
    scrollContent: {
      padding: 14,
      paddingBottom: 40,
    },
    relatedSection: {
      marginTop: 20,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#374151" : "#e5e7eb",
    },
    relatedTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 10,
    },
    relatedCard: {
      backgroundColor: isDark ? "#1a1a2e" : "#f9fafb",
      borderRadius: 8,
      padding: 10,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: isDark ? "#374151" : "#e5e7eb",
    },
    relatedHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 3,
    },
    relatedName: {
      fontSize: 13,
      fontWeight: "600",
      color: "#3b82f6",
      flex: 1,
    },
    edgeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 3,
      backgroundColor: isDark ? "#374151" : "#e5e7eb",
    },
    edgeBadgeText: {
      fontSize: 10,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    relatedReason: {
      fontSize: 12,
      color: isDark ? "#9ca3af" : "#6b7280",
      lineHeight: 16,
    },
    emptyRelated: {
      fontSize: 13,
      color: isDark ? "#6b7280" : "#9ca3af",
      fontStyle: "italic",
    },
    emptyPanel: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? "#6b7280" : "#9ca3af",
      textAlign: "center",
      marginTop: 12,
    },
    historyHint: {
      fontSize: 11,
      color: isDark ? "#6b7280" : "#9ca3af",
      marginLeft: 8,
    },
  });

  if (!visible && slideProgress.value === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[styles.panel, panelStyle]}>
        {!currentRepoId || page === undefined ? (
          <View style={styles.emptyPanel}>
            <LoadingSpinner size="small" />
          </View>
        ) : page === null ? (
          <View style={styles.emptyPanel}>
            <Feather
              name="file-text"
              size={32}
              color={isDark ? "#6b7280" : "#9ca3af"}
            />
            <Text style={styles.emptyText}>
              No knowledge page found for this repository.
            </Text>
            <Pressable
              style={[styles.actionButton, { marginTop: 16 }]}
              onPress={onClose}
            >
              <Text style={styles.actionText}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Pressable style={styles.navButton} onPress={handleBack}>
                  <Feather
                    name={history.length > 0 ? "arrow-left" : "x"}
                    size={20}
                    color={isDark ? "#ffffff" : "#111827"}
                  />
                </Pressable>
                {history.length > 0 && (
                  <Text style={styles.historyHint}>
                    {history.length} back
                  </Text>
                )}
                <View style={{ flex: 1 }} />
                <Pressable style={styles.closeButton} onPress={onClose}>
                  <Feather
                    name="x"
                    size={18}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                </Pressable>
              </View>

              <View style={styles.headerInfo}>
                <Text style={styles.repoName} numberOfLines={1}>
                  {page.repository?.fullName || "Unknown"}
                </Text>
                <View style={styles.headerMeta}>
                  {page.repository?.language && (
                    <View style={styles.languageBadge}>
                      <View
                        style={[
                          styles.languageDot,
                          {
                            backgroundColor: getLanguageColor(
                              page.repository.language
                            ),
                          },
                        ]}
                      />
                      <Text style={styles.metaText}>
                        {page.repository.language}
                      </Text>
                    </View>
                  )}
                  <View style={styles.starBadge}>
                    <Feather name="star" size={12} color="#f59e0b" />
                    <Text style={styles.metaText}>
                      {formatStars(page.repository?.stargazersCount || 0)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action buttons */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.actionsRow}
              >
                <Pressable
                  style={styles.actionButton}
                  onPress={() =>
                    page.repository?.htmlUrl &&
                    Linking.openURL(page.repository.htmlUrl)
                  }
                >
                  <Feather
                    name="external-link"
                    size={12}
                    color={isDark ? "#d1d5db" : "#374151"}
                  />
                  <Text style={styles.actionText}>GitHub</Text>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={handleCopyCloneUrl}
                >
                  <Feather
                    name="copy"
                    size={12}
                    color={isDark ? "#d1d5db" : "#374151"}
                  />
                  <Text style={styles.actionText}>Clone</Text>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={handleDownloadZip}
                >
                  <Feather
                    name="download"
                    size={12}
                    color={isDark ? "#d1d5db" : "#374151"}
                  />
                  <Text style={styles.actionText}>ZIP</Text>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={handleOpenDesktop}
                >
                  <Feather
                    name="monitor"
                    size={12}
                    color={isDark ? "#d1d5db" : "#374151"}
                  />
                  <Text style={styles.actionText}>Desktop</Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* Body */}
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <MarkdownRenderer
                content={page.markdownContent}
                resolvedWikilinks={resolvedWikilinks}
                onWikilinkPress={handleWikilinkPress}
                onExternalLinkPress={handleExternalLink}
              />

              {/* Related Repos */}
              <View style={styles.relatedSection}>
                <Text style={styles.relatedTitle}>Related Repos</Text>
                {page.crossReferences.length === 0 ? (
                  <Text style={styles.emptyRelated}>
                    No cross-references found yet.
                  </Text>
                ) : (
                  page.crossReferences.map((ref: any, index: number) => (
                    <Pressable
                      key={`ref-${index}`}
                      style={styles.relatedCard}
                      onPress={() => handleWikilinkPress(ref.targetRepositoryId)}
                    >
                      <View style={styles.relatedHeader}>
                        <Text style={styles.relatedName} numberOfLines={1}>
                          {ref.targetRepoName}
                        </Text>
                        <View style={styles.edgeBadge}>
                          <Text style={styles.edgeBadgeText}>
                            {EDGE_TYPE_LABELS[ref.edgeType] || ref.edgeType}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.relatedReason}>{ref.reason}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
          </>
        )}
      </Animated.View>
    </>
  );
};

export default DocumentReaderPanel;
