import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useColorScheme,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Feather } from "@expo/vector-icons";
import ListDetailHeader from "../../src/components/ListDetailHeader";
import CreateListModal from "../../src/components/CreateListModal";
import ShareListModal from "../../src/components/ShareListModal";
import ExportModal from "../../src/components/ExportModal";
import LoadingSpinner from "../../src/components/LoadingSpinner";

export default function ListDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);

  const listData = useQuery(
    api.lists.getList,
    user?.id && id ? { clerkUserId: user.id, listId: id as Id<"lists"> } : "skip"
  );

  const updateList = useMutation(api.lists.update);
  const removeRepository = useMutation(api.lists.removeRepository);

  const exportMarkdown = useQuery(
    api.export.exportListToMarkdown,
    user?.id && id && exportModalVisible
      ? { clerkUserId: user.id, listId: id as Id<"lists"> }
      : "skip"
  );

  const exportJson = useQuery(
    api.export.exportListToJson,
    user?.id && id && exportModalVisible
      ? { clerkUserId: user.id, listId: id as Id<"lists"> }
      : "skip"
  );

  const handleUpdateList = async (listData: {
    name: string;
    description?: string;
    visibility: "private" | "public";
    color: string;
    icon: string;
  }) => {
    if (!user?.id || !id) return;

    try {
      await updateList({
        clerkUserId: user.id,
        listId: id as Id<"lists">,
        ...listData,
      });
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert("Error", "Failed to update list");
    }
  };

  const handleToggleVisibility = async (visibility: "private" | "public") => {
    if (!user?.id || !id) return;

    try {
      await updateList({
        clerkUserId: user.id,
        listId: id as Id<"lists">,
        visibility,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to update visibility");
    }
  };

  const handleRemoveRepository = (repoId: string, repoName: string) => {
    Alert.alert(
      "Remove from List",
      `Remove "${repoName}" from this list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!user?.id || !id) return;
            try {
              await removeRepository({
                clerkUserId: user.id,
                listId: id as Id<"lists">,
                repositoryId: repoId as Id<"repositories">,
              });
            } catch (error) {
              Alert.alert("Error", "Failed to remove repository");
            }
          },
        },
      ]
    );
  };

  const handleExportMarkdown = async () => {
    if (exportMarkdown) {
      return exportMarkdown;
    }
    throw new Error("Export not ready");
  };

  const handleExportJson = async () => {
    if (exportJson) {
      return exportJson;
    }
    throw new Error("Export not ready");
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#0f0f23" : "#f9fafb",
    },
    content: {
      flex: 1,
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
      marginBottom: 8,
    },
    repoInfo: {
      flex: 1,
    },
    repoName: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 4,
    },
    repoFullName: {
      fontSize: 12,
      color: "#3b82f6",
    },
    removeButton: {
      padding: 4,
    },
    repoDescription: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
      lineHeight: 20,
      marginBottom: 12,
    },
    repoStats: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    statText: {
      fontSize: 12,
      color: isDark ? "#9ca3af" : "#6b7280",
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
      fontSize: 18,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
      textAlign: "center",
    },
    topicsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8,
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
  });

  if (!listData) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ListDetailHeader
        list={listData}
        onEdit={() => setEditModalVisible(true)}
        onShare={() => setShareModalVisible(true)}
        onExport={() => setExportModalVisible(true)}
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        {listData.repositories && listData.repositories.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather
                name="inbox"
                size={36}
                color={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>
            <Text style={styles.emptyTitle}>No Repositories</Text>
            <Text style={styles.emptyText}>
              Add repositories to this list from the Repositories tab
            </Text>
          </View>
        ) : (
          <FlatList
            data={listData.repositories.filter((r): r is NonNullable<typeof r> => r !== null)}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item: repo }) => (
              <Pressable
                style={styles.repoCard}
                onPress={() => router.push(`/repository/${repo._id}`)}
              >
                <View style={styles.repoHeader}>
                  <View style={styles.repoInfo}>
                    <Text style={styles.repoName}>{repo.name}</Text>
                    <Text style={styles.repoFullName}>{repo.fullName}</Text>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveRepository(repo._id, repo.name)}
                  >
                    <Feather name="x" size={20} color={isDark ? "#6b7280" : "#9ca3af"} />
                  </Pressable>
                </View>

                {repo.description && (
                  <Text style={styles.repoDescription} numberOfLines={2}>
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
                    {repo.topics.length > 5 && (
                      <View style={styles.topicChip}>
                        <Text style={styles.topicText}>
                          +{repo.topics.length - 5}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {repo.listNotes && (
                  <View style={styles.repoNotes}>
                    <Text style={styles.notesLabel}>Note</Text>
                    <Text style={styles.notesText}>{repo.listNotes}</Text>
                  </View>
                )}
              </Pressable>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <CreateListModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSubmit={handleUpdateList}
        editingList={listData}
      />

      <ShareListModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        list={listData}
        onToggleVisibility={handleToggleVisibility}
      />

      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onExportMarkdown={handleExportMarkdown}
        onExportJson={handleExportJson}
        listName={listData.name}
      />
    </SafeAreaView>
  );
}
