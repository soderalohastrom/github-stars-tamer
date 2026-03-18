import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  useColorScheme,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  onExportMarkdown: () => Promise<{ content: string; filename: string }>;
  onExportJson: () => Promise<{ content: string; filename: string }>;
  listName: string;
}

const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onClose,
  onExportMarkdown,
  onExportJson,
  listName,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isExporting, setIsExporting] = useState<"markdown" | "json" | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    if (Platform.OS === "web") {
      // Web: Create blob and download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Native: Use expo-file-system and expo-sharing
      // For now, we'll show the content - full native support would need additional packages
      console.log("Export content:", content.substring(0, 500));
    }
  };

  const handleExportMarkdown = async () => {
    setIsExporting("markdown");
    try {
      const result = await onExportMarkdown();
      downloadFile(result.content, result.filename, "text/markdown");
      setExportSuccess(`Exported ${result.filename}`);
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportJson = async () => {
    setIsExporting("json");
    try {
      const result = await onExportJson();
      downloadFile(result.content, result.filename, "application/json");
      setExportSuccess(`Exported ${result.filename}`);
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(null);
    }
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
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#111827",
    },
    closeButton: {
      padding: 4,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginBottom: 24,
    },
    exportOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      borderRadius: 12,
      marginBottom: 12,
    },
    exportOptionDisabled: {
      opacity: 0.6,
    },
    exportIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    markdownIcon: {
      backgroundColor: isDark ? "#3b82f620" : "#eff6ff",
    },
    jsonIcon: {
      backgroundColor: isDark ? "#10b98120" : "#dcfce7",
    },
    exportInfo: {
      flex: 1,
    },
    exportTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
    },
    exportDescription: {
      fontSize: 13,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginTop: 2,
    },
    exportArrow: {
      marginLeft: 8,
    },
    successMessage: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      backgroundColor: isDark ? "#10b98120" : "#dcfce7",
      borderRadius: 8,
      marginTop: 8,
    },
    successText: {
      fontSize: 14,
      color: "#10b981",
      fontWeight: "500",
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Export List</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather
                name="x"
                size={24}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Export "{listName}" as:</Text>

          <Pressable
            style={[
              styles.exportOption,
              isExporting === "markdown" && styles.exportOptionDisabled,
            ]}
            onPress={handleExportMarkdown}
            disabled={isExporting !== null}
          >
            <View style={[styles.exportIconContainer, styles.markdownIcon]}>
              {isExporting === "markdown" ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Feather name="file-text" size={24} color="#3b82f6" />
              )}
            </View>
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>Markdown (.md)</Text>
              <Text style={styles.exportDescription}>
                GitHub README style format
              </Text>
            </View>
            <Feather
              name="download"
              size={20}
              color={isDark ? "#9ca3af" : "#6b7280"}
              style={styles.exportArrow}
            />
          </Pressable>

          <Pressable
            style={[
              styles.exportOption,
              isExporting === "json" && styles.exportOptionDisabled,
            ]}
            onPress={handleExportJson}
            disabled={isExporting !== null}
          >
            <View style={[styles.exportIconContainer, styles.jsonIcon]}>
              {isExporting === "json" ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <Feather name="code" size={24} color="#10b981" />
              )}
            </View>
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>JSON (.json)</Text>
              <Text style={styles.exportDescription}>
                Full data for backup/import
              </Text>
            </View>
            <Feather
              name="download"
              size={20}
              color={isDark ? "#9ca3af" : "#6b7280"}
              style={styles.exportArrow}
            />
          </Pressable>

          {exportSuccess && (
            <View style={styles.successMessage}>
              <Feather name="check-circle" size={18} color="#10b981" />
              <Text style={styles.successText}>{exportSuccess}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ExportModal;
