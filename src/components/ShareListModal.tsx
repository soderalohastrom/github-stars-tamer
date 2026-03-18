import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  useColorScheme,
  TextInput,
  Switch,
  Alert,
  Platform,
  Share,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

interface ShareListModalProps {
  visible: boolean;
  onClose: () => void;
  list: {
    name: string;
    visibility: "private" | "public";
    shareId?: string;
  };
  onToggleVisibility: (visibility: "private" | "public") => void;
}

const ShareListModal: React.FC<ShareListModalProps> = ({
  visible,
  onClose,
  list,
  onToggleVisibility,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [copied, setCopied] = useState(false);

  // Generate share URL (adjust domain as needed)
  const shareUrl = list.shareId
    ? `https://yourdomain.com/shared/${list.shareId}`
    : "";

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert("Error", "Failed to copy link");
    }
  };

  const handleTogglePublic = () => {
    const newVisibility = list.visibility === "public" ? "private" : "public";

    if (newVisibility === "private") {
      Alert.alert(
        "Make Private?",
        "This will disable the share link. Anyone with the link will no longer be able to view this list.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Make Private",
            style: "destructive",
            onPress: () => onToggleVisibility("private"),
          },
        ]
      );
    } else {
      onToggleVisibility("public");
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;

    if (Platform.OS === "web") {
      // For web, just copy to clipboard
      handleCopyLink();
    } else {
      // For native, use Share API
      try {
        await Share.share({
          title: list.name,
          message: `Check out my GitHub stars list "${list.name}": ${shareUrl}`,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or error
      }
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
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      borderRadius: 12,
      padding: 16,
    },
    switchLabel: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        list.visibility === "public"
          ? "#10b98120"
          : isDark
          ? "#4b5563"
          : "#e5e7eb",
      justifyContent: "center",
      alignItems: "center",
    },
    switchTextContainer: {
      flex: 1,
    },
    switchTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
    },
    switchDescription: {
      fontSize: 13,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginTop: 2,
    },
    linkSection: {
      opacity: list.visibility === "public" ? 1 : 0.5,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 8,
    },
    linkContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      borderRadius: 8,
      overflow: "hidden",
    },
    linkInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      color: isDark ? "#ffffff" : "#111827",
    },
    copyButton: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: copied ? "#10b981" : "#3b82f6",
    },
    copyButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#ffffff",
    },
    shareButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#3b82f6",
      borderRadius: 10,
      padding: 14,
      marginTop: 8,
      gap: 8,
    },
    shareButtonDisabled: {
      backgroundColor: isDark ? "#374151" : "#e5e7eb",
    },
    shareButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#ffffff",
    },
    shareButtonTextDisabled: {
      color: isDark ? "#6b7280" : "#9ca3af",
    },
    privateNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      backgroundColor: isDark ? "#374151" : "#fef3c7",
      borderRadius: 8,
      marginTop: 16,
    },
    privateNoteText: {
      flex: 1,
      fontSize: 13,
      color: isDark ? "#fcd34d" : "#92400e",
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
            <Text style={styles.title}>Share List</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather
                name="x"
                size={24}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <View style={styles.iconContainer}>
                  <Feather
                    name={list.visibility === "public" ? "globe" : "lock"}
                    size={20}
                    color={
                      list.visibility === "public"
                        ? "#10b981"
                        : isDark
                        ? "#9ca3af"
                        : "#6b7280"
                    }
                  />
                </View>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.switchTitle}>
                    {list.visibility === "public" ? "Public" : "Private"}
                  </Text>
                  <Text style={styles.switchDescription}>
                    {list.visibility === "public"
                      ? "Anyone with the link can view"
                      : "Only you can see this list"}
                  </Text>
                </View>
              </View>
              <Switch
                value={list.visibility === "public"}
                onValueChange={handleTogglePublic}
                trackColor={{ false: "#767577", true: "#10b98180" }}
                thumbColor={list.visibility === "public" ? "#10b981" : "#f4f3f4"}
              />
            </View>
          </View>

          <View style={[styles.section, styles.linkSection]}>
            <Text style={styles.label}>Share Link</Text>
            <View style={styles.linkContainer}>
              <TextInput
                style={styles.linkInput}
                value={shareUrl || "Enable public to get share link"}
                editable={false}
                selectTextOnFocus
              />
              <Pressable
                style={styles.copyButton}
                onPress={handleCopyLink}
                disabled={!shareUrl}
              >
                <Text style={styles.copyButtonText}>
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.shareButton,
                !shareUrl && styles.shareButtonDisabled,
              ]}
              onPress={handleShare}
              disabled={!shareUrl}
            >
              <Feather
                name="share-2"
                size={18}
                color={shareUrl ? "#ffffff" : isDark ? "#6b7280" : "#9ca3af"}
              />
              <Text
                style={[
                  styles.shareButtonText,
                  !shareUrl && styles.shareButtonTextDisabled,
                ]}
              >
                Share
              </Text>
            </Pressable>
          </View>

          {list.visibility === "private" && (
            <View style={styles.privateNote}>
              <Feather name="info" size={16} color={isDark ? "#fcd34d" : "#92400e"} />
              <Text style={styles.privateNoteText}>
                Turn on public sharing above to get a shareable link
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ShareListModal;
