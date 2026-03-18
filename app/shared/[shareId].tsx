import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useColorScheme,
  Linking,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Feather } from "@expo/vector-icons";
import LoadingSpinner from "../../src/components/LoadingSpinner";

export default function SharedListScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const { shareId } = useLocalSearchParams<{ shareId: string }>();

  const listData = useQuery(
    api.lists.getPublicList,
    shareId ? { shareId } : "skip"
  );

  const handleOpenRepo = (url: string) => {
    Linking.openURL(url);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#0f0f23" : "#f9fafb",
    },
    header: {
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 16,
    },
    backText: {
      fontSize: 16,
      color: "#3b82f6",
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
      flex: 1,
    },
    description: {
      fontSize: 15,
      color: isDark ? "#9ca3af" : "#6b7280",
      lineHeight: 22,
      marginBottom: 12,
    },
    ownerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    ownerAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? "#374151" : "#e5e7eb",
    },
    ownerText: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    stats: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#374151" : "#e5e7eb",
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statText: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    listContent: {
      padding: 16,
    },
    repoCard: {
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? "#374151" : "#e5e7eb",
    },
    repoHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    repoAvatarContainer: {
      marginRight: 12,
    },
    repoAvatar: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: isDark ? "#374151" : "#e5e7eb",
    },
    repoInfo: {
      flex: 1,
    },
    repoName: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 2,
    },
    repoFullName: {
      fontSize: 12,
      color: "#3b82f6",
    },
    repoDescription: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
      lineHeight: 20,
      marginTop: 12,
    },
    repoStats: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginTop: 12,
    },
    languageContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    languageColor: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#3b82f6",
    },
    topicsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 12,
    },
    topicChip: {
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    topicText: {
      fontSize: 11,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    repoNotes: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#374151" : "#e5e7eb",
    },
    notesLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: isDark ? "#6b7280" : "#9ca3af",
      textTransform: "uppercase",
      marginBottom: 4,
    },
    notesText: {
      fontSize: 13,
      color: isDark ? "#d1d5db" : "#4b5563",
      fontStyle: "italic",
    },
    notFoundContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    notFoundIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    notFoundTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 8,
    },
    notFoundText: {
      fontSize: 15,
      color: isDark ? "#9ca3af" : "#6b7280",
      textAlign: "center",
    },
    publicBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isDark ? "#10b98120" : "#dcfce7",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    publicBadgeText: {
      fontSize: 12,
      color: "#10b981",
      fontWeight: "500",
    },
  });

  if (listData === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (listData === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundContainer}>
          <View style={styles.notFoundIcon}>
            <Feather
              name="alert-circle"
              size={36}
              color={isDark ? "#6b7280" : "#9ca3af"}
            />
          </View>
          <Text style={styles.notFoundTitle}>List Not Found</Text>
          <Text style={styles.notFoundText}>
            This list may have been deleted or made private by its owner.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const listColor = listData.color || "#3b82f6";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color="#3b82f6" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <View
            style={[styles.iconContainer, { backgroundColor: `${listColor}20` }]}
          >
            <Feather
              name={(listData.icon as any) || "list"}
              size={24}
              color={listColor}
            />
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {listData.name}
          </Text>
        </View>

        {listData.description && (
          <Text style={styles.description}>{listData.description}</Text>
        )}

        <View style={styles.ownerRow}>
          {listData.ownerAvatar ? (
            <Image
              source={{ uri: listData.ownerAvatar }}
              style={styles.ownerAvatar}
            />
          ) : (
            <View style={styles.ownerAvatar}>
              <Feather name="user" size={14} color={isDark ? "#6b7280" : "#9ca3af"} />
            </View>
          )}
          <Text style={styles.ownerText}>Curated by {listData.ownerName}</Text>
          <View style={styles.publicBadge}>
            <Feather name="globe" size={12} color="#10b981" />
            <Text style={styles.publicBadgeText}>Public</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Feather
              name="book"
              size={16}
              color={isDark ? "#9ca3af" : "#6b7280"}
            />
            <Text style={styles.statText}>
              {listData.repositoryCount}{" "}
              {listData.repositoryCount === 1 ? "repository" : "repositories"}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Feather
              name="calendar"
              size={16}
              color={isDark ? "#9ca3af" : "#6b7280"}
            />
            <Text style={styles.statText}>
              {formatDate(listData.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={listData.repositories.filter((r): r is NonNullable<typeof r> => r !== null)}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: repo }) => (
          <Pressable
            style={styles.repoCard}
            onPress={() => handleOpenRepo(repo.htmlUrl)}
          >
            <View style={styles.repoHeader}>
              <View style={styles.repoAvatarContainer}>
                <Image
                  source={{ uri: repo.owner.avatarUrl }}
                  style={styles.repoAvatar}
                />
              </View>
              <View style={styles.repoInfo}>
                <Text style={styles.repoName}>{repo.name}</Text>
                <Text style={styles.repoFullName}>{repo.fullName}</Text>
              </View>
              <Feather
                name="external-link"
                size={18}
                color={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>

            {repo.description && (
              <Text style={styles.repoDescription} numberOfLines={3}>
                {repo.description}
              </Text>
            )}

            <View style={styles.repoStats}>
              <View style={styles.statItem}>
                <Feather name="star" size={14} color="#f59e0b" />
                <Text style={styles.statText}>
                  {formatNumber(repo.stargazersCount)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Feather name="git-branch" size={14} color="#6b7280" />
                <Text style={styles.statText}>
                  {formatNumber(repo.forksCount)}
                </Text>
              </View>
              {repo.language && (
                <View style={styles.languageContainer}>
                  <View style={styles.languageColor} />
                  <Text style={styles.statText}>{repo.language}</Text>
                </View>
              )}
            </View>

            {repo.topics && repo.topics.length > 0 && (
              <View style={styles.topicsContainer}>
                {repo.topics.slice(0, 5).map((topic: string) => (
                  <View key={topic} style={styles.topicChip}>
                    <Text style={styles.topicText}>{topic}</Text>
                  </View>
                ))}
              </View>
            )}

            {repo.listNotes && (
              <View style={styles.repoNotes}>
                <Text style={styles.notesLabel}>Curator's Note</Text>
                <Text style={styles.notesText}>{repo.listNotes}</Text>
              </View>
            )}
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
