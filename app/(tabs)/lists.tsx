import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useColorScheme,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Feather } from "@expo/vector-icons";
import ListCard from "../../src/components/ListCard";
import CreateListModal from "../../src/components/CreateListModal";
import LoadingSpinner from "../../src/components/LoadingSpinner";

export default function ListsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const { user } = useUser();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const lists = useQuery(
    api.lists.getMyLists,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const createList = useMutation(api.lists.create);
  const updateList = useMutation(api.lists.update);
  const deleteList = useMutation(api.lists.deleteList);

  const handleCreateList = async (listData: {
    name: string;
    description?: string;
    visibility: "private" | "public";
    color: string;
    icon: string;
  }) => {
    if (!user?.id) return;

    try {
      if (editingList) {
        await updateList({
          clerkUserId: user.id,
          listId: editingList._id,
          ...listData,
        });
      } else {
        await createList({
          clerkUserId: user.id,
          ...listData,
        });
      }
      setCreateModalVisible(false);
      setEditingList(null);
    } catch (error) {
      Alert.alert("Error", "Failed to save list");
    }
  };

  const handleDeleteList = (list: any) => {
    Alert.alert(
      "Delete List",
      `Are you sure you want to delete "${list.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            try {
              await deleteList({
                clerkUserId: user.id,
                listId: list._id,
              });
            } catch (error) {
              Alert.alert("Error", "Failed to delete list");
            }
          },
        },
      ]
    );
  };

  const handleEditList = (list: any) => {
    setEditingList(list);
    setCreateModalVisible(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Query will auto-refresh
    setTimeout(() => setRefreshing(false), 1000);
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
      paddingVertical: 16,
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    createButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#3b82f6",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    createButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#ffffff",
    },
    content: {
      flex: 1,
      padding: 16,
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
    emptyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#3b82f6",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 10,
    },
    emptyButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#ffffff",
    },
    statsBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 4,
      paddingBottom: 12,
    },
    statsText: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
  });

  if (lists === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Lists</Text>
        </View>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const publicLists = lists?.filter((l: any) => l.visibility === "public").length || 0;
  const privateLists = lists?.filter((l: any) => l.visibility === "private").length || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lists</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => {
            setEditingList(null);
            setCreateModalVisible(true);
          }}
        >
          <Feather name="plus" size={18} color="#ffffff" />
          <Text style={styles.createButtonText}>New</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {lists && lists.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather
                name="layers"
                size={36}
                color={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>
            <Text style={styles.emptyTitle}>No Lists Yet</Text>
            <Text style={styles.emptyText}>
              Create lists to organize and share your favorite GitHub repositories
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => setCreateModalVisible(true)}
            >
              <Feather name="plus" size={20} color="#ffffff" />
              <Text style={styles.emptyButtonText}>Create Your First List</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>
                {lists?.length || 0} {lists?.length === 1 ? "list" : "lists"}
              </Text>
              <Text style={styles.statsText}>
                {publicLists} public, {privateLists} private
              </Text>
            </View>
            <FlatList
              data={lists}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <ListCard
                  list={item}
                  onPress={() => router.push(`/list/${item._id}`)}
                  onLongPress={() => {
                    Alert.alert(item.name, "What would you like to do?", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Edit", onPress: () => handleEditList(item) },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => handleDeleteList(item),
                      },
                    ]);
                  }}
                />
              )}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>

      <CreateListModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingList(null);
        }}
        onSubmit={handleCreateList}
        editingList={editingList}
      />
    </SafeAreaView>
  );
}
