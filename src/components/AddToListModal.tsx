import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useColorScheme,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";

interface List {
  _id: string;
  name: string;
  description?: string;
  visibility: "private" | "public";
  color?: string;
  icon?: string;
  repositoryCount: number;
}

interface AddToListModalProps {
  visible: boolean;
  onClose: () => void;
  lists: List[];
  listsInRepo: string[]; // IDs of lists that already contain this repo
  onAddToList: (listId: string) => void;
  onRemoveFromList: (listId: string) => void;
  onCreateNewList: () => void;
  isLoading?: boolean;
  repositoryName?: string;
}

const AddToListModal: React.FC<AddToListModalProps> = ({
  visible,
  onClose,
  lists,
  listsInRepo,
  onAddToList,
  onRemoveFromList,
  onCreateNewList,
  isLoading,
  repositoryName,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modal: {
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: "70%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginTop: 2,
    },
    closeButton: {
      padding: 4,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      borderRadius: 8,
      paddingHorizontal: 12,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 16,
      color: isDark ? "#ffffff" : "#111827",
      marginLeft: 8,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
    },
    listItemActive: {
      backgroundColor: isDark ? "#3b82f620" : "#eff6ff",
      borderWidth: 1,
      borderColor: "#3b82f6",
    },
    listIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    listInfo: {
      flex: 1,
    },
    listName: {
      fontSize: 15,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
    },
    listMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    listCount: {
      fontSize: 12,
      color: isDark ? "#9ca3af" : "#6b7280",
    },
    checkboxContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "#3b82f6",
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: {
      backgroundColor: "#3b82f6",
    },
    createNewButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 14,
      borderRadius: 10,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      borderWidth: 1,
      borderColor: isDark ? "#4b5563" : "#e5e7eb",
      borderStyle: "dashed",
      marginTop: 8,
    },
    createNewText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#3b82f6",
      marginLeft: 8,
    },
    emptyState: {
      alignItems: "center",
      padding: 24,
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginTop: 8,
    },
    loadingContainer: {
      padding: 40,
      alignItems: "center",
    },
  });

  const handleToggleList = (listId: string) => {
    if (listsInRepo.includes(listId)) {
      onRemoveFromList(listId);
    } else {
      onAddToList(listId);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Add to List</Text>
              {repositoryName && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {repositoryName}
                </Text>
              )}
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather
                name="x"
                size={24}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
            </Pressable>
          </View>

          {lists.length > 5 && (
            <View style={styles.searchContainer}>
              <Feather
                name="search"
                size={18}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search lists..."
                placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
              />
            </View>
          )}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredLists.length === 0 && searchQuery === "" ? (
                <View style={styles.emptyState}>
                  <Feather
                    name="inbox"
                    size={40}
                    color={isDark ? "#4b5563" : "#d1d5db"}
                  />
                  <Text style={styles.emptyText}>
                    No lists yet. Create your first list!
                  </Text>
                </View>
              ) : (
                filteredLists.map((list) => {
                  const isInList = listsInRepo.includes(list._id);
                  const listColor = list.color || "#3b82f6";

                  return (
                    <Pressable
                      key={list._id}
                      style={[styles.listItem, isInList && styles.listItemActive]}
                      onPress={() => handleToggleList(list._id)}
                    >
                      <View
                        style={[
                          styles.listIconContainer,
                          { backgroundColor: `${listColor}20` },
                        ]}
                      >
                        <Feather
                          name={(list.icon as any) || "list"}
                          size={18}
                          color={listColor}
                        />
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={styles.listName}>{list.name}</Text>
                        <View style={styles.listMeta}>
                          <Text style={styles.listCount}>
                            {list.repositoryCount} repos
                          </Text>
                          <Feather
                            name={list.visibility === "public" ? "globe" : "lock"}
                            size={10}
                            color={isDark ? "#6b7280" : "#9ca3af"}
                          />
                        </View>
                      </View>
                      <View
                        style={[
                          styles.checkboxContainer,
                          isInList && styles.checkboxChecked,
                        ]}
                      >
                        {isInList && (
                          <Feather name="check" size={14} color="#ffffff" />
                        )}
                      </View>
                    </Pressable>
                  );
                })
              )}

              <Pressable style={styles.createNewButton} onPress={onCreateNewList}>
                <Feather name="plus" size={20} color="#3b82f6" />
                <Text style={styles.createNewText}>Create New List</Text>
              </Pressable>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default AddToListModal;
