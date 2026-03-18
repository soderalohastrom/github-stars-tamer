import React from "react";
import { View, Text, StyleSheet, Pressable, useColorScheme } from "react-native";
import { Feather } from "@expo/vector-icons";

interface ListDetailHeaderProps {
  list: {
    name: string;
    description?: string;
    visibility: "private" | "public";
    color?: string;
    icon?: string;
    repositoryCount: number;
    shareId?: string;
    createdAt: number;
  };
  onEdit: () => void;
  onShare: () => void;
  onExport: () => void;
  onBack: () => void;
}

const ListDetailHeader: React.FC<ListDetailHeaderProps> = ({
  list,
  onEdit,
  onShare,
  onExport,
  onBack,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const listColor = list.color || "#3b82f6";

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
      paddingTop: 8,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    backText: {
      fontSize: 16,
      color: "#3b82f6",
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    actionButton: {
      padding: 4,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 16,
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
      backgroundColor: `${listColor}20`,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    titleContainer: {
      flex: 1,
    },
    name: {
      fontSize: 24,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    visibilityBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    visibilityText: {
      fontSize: 12,
      color:
        list.visibility === "public"
          ? "#10b981"
          : isDark
          ? "#9ca3af"
          : "#6b7280",
    },
    description: {
      fontSize: 15,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginTop: 8,
      lineHeight: 22,
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
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Feather name="chevron-left" size={24} color="#3b82f6" />
          <Text style={styles.backText}>Lists</Text>
        </Pressable>
        <View style={styles.actions}>
          {list.visibility === "public" && (
            <Pressable style={styles.actionButton} onPress={onShare}>
              <Feather
                name="share-2"
                size={20}
                color={isDark ? "#ffffff" : "#111827"}
              />
            </Pressable>
          )}
          <Pressable style={styles.actionButton} onPress={onExport}>
            <Feather
              name="download"
              size={20}
              color={isDark ? "#ffffff" : "#111827"}
            />
          </Pressable>
          <Pressable style={styles.actionButton} onPress={onEdit}>
            <Feather
              name="edit-2"
              size={20}
              color={isDark ? "#ffffff" : "#111827"}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.iconContainer}>
            <Feather
              name={(list.icon as any) || "list"}
              size={24}
              color={listColor}
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.name}>{list.name}</Text>
            <View style={styles.visibilityBadge}>
              <Feather
                name={list.visibility === "public" ? "globe" : "lock"}
                size={12}
                color={
                  list.visibility === "public"
                    ? "#10b981"
                    : isDark
                    ? "#9ca3af"
                    : "#6b7280"
                }
              />
              <Text style={styles.visibilityText}>
                {list.visibility === "public" ? "Public" : "Private"}
              </Text>
            </View>
          </View>
        </View>

        {list.description && (
          <Text style={styles.description}>{list.description}</Text>
        )}

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Feather
              name="book"
              size={16}
              color={isDark ? "#9ca3af" : "#6b7280"}
            />
            <Text style={styles.statText}>
              {list.repositoryCount}{" "}
              {list.repositoryCount === 1 ? "repository" : "repositories"}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Feather
              name="calendar"
              size={16}
              color={isDark ? "#9ca3af" : "#6b7280"}
            />
            <Text style={styles.statText}>
              Created {formatDate(list.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ListDetailHeader;
