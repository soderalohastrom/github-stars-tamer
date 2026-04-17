import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Feather } from "@expo/vector-icons";
import LoadingSpinner from "../../src/components/LoadingSpinner";
import ErrorMessage from "../../src/components/ErrorMessage";
import MarkdownRenderer from "../../src/components/MarkdownRenderer";

// Language colors (subset matching existing usage)
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

// Extract [[owner/repo]] patterns from markdown
function extractWikilinks(markdown: string): string[] {
  const matches = markdown.match(/\[\[([^\]]+?)\]\]/g);
  if (!matches) return [];
  const names = matches.map((m) => m.slice(2, -2));
  return [...new Set(names)];
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  llm_discovered: "AI",
  shared_topic: "Topic",
  shared_language: "Language",
  same_owner: "Owner",
};

export default function DocumentReaderScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const { repoId } = useLocalSearchParams<{ repoId: string }>();
  const { user } = useUser();

  const page = useQuery(
    api.knowledge.getKnowledgePage,
    user?.id && repoId
      ? {
          clerkUserId: user.id,
          repositoryId: repoId as Id<"repositories">,
        }
      : "skip"
  );

  // Extract wikilinks from markdown content
  const wikilinkNames = useMemo(() => {
    if (!page?.markdownContent) return [];
    return extractWikilinks(page.markdownContent);
  }, [page?.markdownContent]);

  // Resolve wikilinks
  const wikilinkResolutions = useQuery(
    api.knowledge.resolveWikilinks,
    user?.id && wikilinkNames.length > 0
      ? {
          clerkUserId: user.id,
          fullNames: wikilinkNames,
        }
      : "skip"
  );

  // Build resolution lookup
  const resolvedWikilinks = useMemo(() => {
    if (!wikilinkResolutions) return {};
    const map: Record<string, any> = {};
    for (const r of wikilinkResolutions) {
      map[r.fullName] = r;
    }
    return map;
  }, [wikilinkResolutions]);

  const handleWikilinkPress = (repositoryId: string) => {
    router.push(`/graph/${repositoryId}`);
  };

  const handleExternalLinkPress = (url: string) => {
    Linking.openURL(url);
  };

  const handleViewOnGitHub = () => {
    if (page?.repository?.htmlUrl) {
      Linking.openURL(page.repository.htmlUrl);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#0f0f23" : "#f9fafb",
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    backButton: {
      padding: 4,
      marginRight: 12,
    },
    headerInfo: {
      flex: 1,
    },
    repoName: {
      fontSize: 20,
      fontWeight: "bold",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 4,
    },
    headerMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    languageBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    languageDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    languageText: {
      fontSize: 13,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    starBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    starText: {
      fontSize: 13,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    githubButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    githubButtonText: {
      fontSize: 13,
      fontWeight: "500",
      color: isDark ? "#d1d5db" : "#374151",
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 80,
    },
    relatedSection: {
      marginTop: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#374151" : "#e5e7eb",
    },
    relatedTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 12,
    },
    relatedCard: {
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDark ? "#374151" : "#e5e7eb",
    },
    relatedHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    relatedName: {
      fontSize: 15,
      fontWeight: "600",
      color: "#3b82f6",
      flex: 1,
    },
    edgeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
    },
    edgeBadgeText: {
      fontSize: 11,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    relatedReason: {
      fontSize: 13,
      color: isDark ? "#9ca3af" : "#6b7280",
      lineHeight: 18,
    },
    emptyRelated: {
      fontSize: 14,
      color: isDark ? "#6b7280" : "#9ca3af",
      fontStyle: "italic",
    },
    floatingButton: {
      position: "absolute",
      bottom: 24,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: isDark ? "#3b82f6" : "#2563eb",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    floatingButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#ffffff",
    },
  });

  // Loading state
  if (page === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // Error state — page not found
  if (page === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Feather
                name="arrow-left"
                size={24}
                color={isDark ? "#ffffff" : "#111827"}
              />
            </Pressable>
          </View>
        </View>
        <ErrorMessage message="Knowledge page not found. This repository may not have been processed yet." />
      </SafeAreaView>
    );
  }

  const formatStars = (count: number): string => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "k";
    }
    return count.toString();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather
              name="arrow-left"
              size={24}
              color={isDark ? "#ffffff" : "#111827"}
            />
          </Pressable>
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
                  <Text style={styles.languageText}>
                    {page.repository.language}
                  </Text>
                </View>
              )}
              <View style={styles.starBadge}>
                <Feather name="star" size={14} color="#f59e0b" />
                <Text style={styles.starText}>
                  {formatStars(page.repository?.stargazersCount || 0)}
                </Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.githubButton} onPress={handleViewOnGitHub}>
            <Feather
              name="external-link"
              size={14}
              color={isDark ? "#d1d5db" : "#374151"}
            />
            <Text style={styles.githubButtonText}>GitHub</Text>
          </Pressable>
        </View>
      </View>

      {/* Body */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <MarkdownRenderer
          content={page.markdownContent}
          resolvedWikilinks={resolvedWikilinks}
          onWikilinkPress={handleWikilinkPress}
          onExternalLinkPress={handleExternalLinkPress}
        />

        {/* Related Repos */}
        <View style={styles.relatedSection}>
          <Text style={styles.relatedTitle}>Related Repos</Text>
          {page.crossReferences.length === 0 ? (
            <Text style={styles.emptyRelated}>
              No cross-references found yet.
            </Text>
          ) : (
            page.crossReferences.map((ref, index) => (
              <Pressable
                key={`ref-${index}`}
                style={styles.relatedCard}
                onPress={() =>
                  router.push(`/graph/${ref.targetRepositoryId}`)
                }
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

      {/* Floating "Back to Graph" button */}
      <Pressable
        style={styles.floatingButton}
        onPress={() => router.navigate("/(tabs)/graph")}
      >
        <Feather name="share-2" size={16} color="#ffffff" />
        <Text style={styles.floatingButtonText}>Back to Graph</Text>
      </Pressable>
    </SafeAreaView>
  );
}
