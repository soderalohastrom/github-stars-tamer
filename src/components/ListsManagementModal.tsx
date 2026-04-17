import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  useColorScheme,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import ListCard from "./ListCard";
import CreateListModal from "./CreateListModal";

interface ListsManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToList: (listId: string) => void;
}

const ListsManagementModal: React.FC<ListsManagementModalProps> = ({
  visible,
  onClose,
  onNavigateToList,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useUser();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);

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
      `Are you sure you want to delete "${list.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            try {
              await deleteList({ clerkUserId: user.id, listId: list._id });
            } catch (error) {
              Alert.alert("Error", "Failed to delete list");
            }
          },
        },
      ]
    );
  };

  const handleListPress = (list: any) => {
    onClose();
    onNavigateToList(list._id);
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "80%",
      minHeight: "50%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    newButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#3b82f6",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    newButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#ffffff",
    },
    closeButton: {
      padding: 4,
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
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
      textAlign: "center",
      lineHeight: 20,
    },
    statsBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      paddingBottom: 12,
    },
    statsText: {
      fontSize: 13,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Lists</Text>
            <View style={styles.headerActions}>
              <Pressable
                style={styles.newButton}
                onPress={() => {
                  setEditingList(null);
                  setCreateModalVisible(true);
                }}
              >
                <Feather name="plus" size={16} color="#ffffff" />
                <Text style={styles.newButtonText}>New</Text>
              </Pressable>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Feather
                  name="x"
                  size={24}
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.content}>
            {lists && lists.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather
                    name="layers"
                    size={28}
                    color={isDark ? "#6b7280" : "#9ca3af"}
                  />
                </View>
                <Text style={styles.emptyTitle}>No Lists Yet</Text>
                <Text style={styles.emptyText}>
                  Create lists to organize and share your repositories
                </Text>
              </View>
            ) : (
              <>
                {lists && lists.length > 0 && (
                  <View style={styles.statsBar}>
                    <Text style={styles.statsText}>
                      {lists.length} {lists.length === 1 ? "list" : "lists"}
                    </Text>
                  </View>
                )}
                <FlatList
                  data={lists || []}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <ListCard
                      list={item}
                      onPress={() => handleListPress(item)}
                      onLongPress={() => {
                        Alert.alert(item.name, "What would you like to do?", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Edit",
                            onPress: () => {
                              setEditingList(item);
                              setCreateModalVisible(true);
                            },
                          },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => handleDeleteList(item),
                          },
                        ]);
                      }}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>
        </Pressable>
      </Pressable>

      <CreateListModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingList(null);
        }}
        onSubmit={handleCreateList}
        editingList={editingList}
      />
    </Modal>
  );
};

export default ListsManagementModal;
