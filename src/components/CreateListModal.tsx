import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  useColorScheme,
  Alert,
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";

interface CreateListModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (listData: {
    name: string;
    description?: string;
    visibility: "private" | "public";
    color: string;
    icon: string;
  }) => void;
  editingList?: {
    name: string;
    description?: string;
    visibility: "private" | "public";
    color?: string;
    icon?: string;
  } | null;
}

const CreateListModal: React.FC<CreateListModalProps> = ({
  visible,
  onClose,
  onSubmit,
  editingList,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [selectedIcon, setSelectedIcon] = useState("list");

  useEffect(() => {
    if (editingList) {
      setName(editingList.name);
      setDescription(editingList.description || "");
      setIsPublic(editingList.visibility === "public");
      setSelectedColor(editingList.color || "#3b82f6");
      setSelectedIcon(editingList.icon || "list");
    } else {
      resetForm();
    }
  }, [editingList, visible]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsPublic(false);
    setSelectedColor("#3b82f6");
    setSelectedIcon("list");
  };

  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#f97316",
    "#06b6d4",
    "#84cc16",
    "#f43f5e",
    "#6b7280",
  ];

  const icons = [
    { name: "list", icon: "list" },
    { name: "star", icon: "star" },
    { name: "heart", icon: "heart" },
    { name: "bookmark", icon: "bookmark" },
    { name: "folder", icon: "folder" },
    { name: "code", icon: "code" },
    { name: "layers", icon: "layers" },
    { name: "box", icon: "box" },
    { name: "archive", icon: "archive" },
    { name: "compass", icon: "compass" },
  ];

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Error", "List name is required");
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      visibility: isPublic ? "public" : "private",
      color: selectedColor,
      icon: selectedIcon,
    });

    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modal: {
      backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
      borderRadius: 16,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      maxHeight: "80%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    closeButton: {
      padding: 4,
    },
    section: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: isDark ? "#ffffff" : "#111827",
      borderWidth: 1,
      borderColor: "transparent",
    },
    textArea: {
      height: 80,
      textAlignVertical: "top",
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      borderRadius: 8,
      padding: 12,
    },
    switchLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    switchText: {
      fontSize: 16,
      color: isDark ? "#ffffff" : "#111827",
    },
    switchDescription: {
      fontSize: 12,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginTop: 4,
    },
    colorGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    colorOption: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    colorOptionSelected: {
      borderColor: isDark ? "#ffffff" : "#111827",
    },
    iconGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    iconOption: {
      width: 48,
      height: 48,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      borderWidth: 2,
      borderColor: "transparent",
    },
    iconOptionSelected: {
      borderColor: selectedColor,
      backgroundColor: `${selectedColor}20`,
    },
    buttonContainer: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
    },
    submitButton: {
      backgroundColor: "#3b82f6",
    },
    submitButtonDisabled: {
      backgroundColor: "#9ca3af",
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600",
    },
    cancelButtonText: {
      color: isDark ? "#ffffff" : "#374151",
    },
    submitButtonText: {
      color: "#ffffff",
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editingList ? "Edit List" : "Create List"}
            </Text>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Feather
                name="x"
                size={24}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter list name"
                placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                maxLength={50}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                multiline
                maxLength={200}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Visibility</Text>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Feather
                    name={isPublic ? "globe" : "lock"}
                    size={20}
                    color={isPublic ? "#10b981" : isDark ? "#9ca3af" : "#6b7280"}
                  />
                  <View>
                    <Text style={styles.switchText}>
                      {isPublic ? "Public" : "Private"}
                    </Text>
                    <Text style={styles.switchDescription}>
                      {isPublic
                        ? "Anyone with the link can view"
                        : "Only you can see this list"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: "#767577", true: "#10b98180" }}
                  thumbColor={isPublic ? "#10b981" : "#f4f3f4"}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Color</Text>
              <View style={styles.colorGrid}>
                {colors.map((color) => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Feather name="check" size={20} color="#ffffff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconGrid}>
                {icons.map((iconData) => (
                  <Pressable
                    key={iconData.name}
                    style={[
                      styles.iconOption,
                      selectedIcon === iconData.name && styles.iconOptionSelected,
                    ]}
                    onPress={() => setSelectedIcon(iconData.name)}
                  >
                    <Feather
                      name={iconData.icon as any}
                      size={20}
                      color={
                        selectedIcon === iconData.name
                          ? selectedColor
                          : isDark
                          ? "#9ca3af"
                          : "#6b7280"
                      }
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                styles.submitButton,
                !name.trim() && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!name.trim()}
            >
              <Text style={[styles.buttonText, styles.submitButtonText]}>
                {editingList ? "Save" : "Create"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CreateListModal;
