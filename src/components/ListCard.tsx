import React from "react";
import { View, Text, StyleSheet, Pressable, useColorScheme } from "react-native";
import { Feather } from "@expo/vector-icons";

interface ListCardProps {
  list: {
    _id: string;
    name: string;
    description?: string;
    visibility: "private" | "public";
    color?: string;
    icon?: string;
    repositoryCount: number;
    createdAt: number;
  };
  onPress: () => void;
  onLongPress?: () => void;
}

const ListCard: React.FC<ListCardProps> = ({ list, onPress, onLongPress }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const iconName = list.icon || "list";
  const listColor = list.color || "#3b82f6";

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? "#374151" : "#e5e7eb",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: `${listColor}20`,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    titleContainer: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
    },
    description: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginTop: 4,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 12,
    },
    stats: {
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
    visibilityBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor:
        list.visibility === "public"
          ? isDark
            ? "#065f4620"
            : "#dcfce7"
          : isDark
          ? "#37415120"
          : "#f3f4f6",
    },
    visibilityText: {
      fontSize: 11,
      fontWeight: "500",
      color:
        list.visibility === "public"
          ? "#10b981"
          : isDark
          ? "#9ca3af"
          : "#6b7280",
    },
  });

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name={iconName as any} size={20} color={listColor} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.name}>{list.name}</Text>
          {list.description && (
            <Text style={styles.description} numberOfLines={2}>
              {list.description}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Feather
              name="book"
              size={14}
              color={isDark ? "#9ca3af" : "#6b7280"}
            />
            <Text style={styles.statText}>
              {list.repositoryCount} {list.repositoryCount === 1 ? "repo" : "repos"}
            </Text>
          </View>
        </View>
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
    </Pressable>
  );
};

export default ListCard;
