import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Platform,
} from "react-native";

interface WikilinkResolution {
  fullName: string;
  status: "has_knowledge" | "no_knowledge" | "not_found";
  repositoryId?: string;
  knowledgeId?: string;
}

interface MarkdownRendererProps {
  content: string;
  resolvedWikilinks?: Record<string, WikilinkResolution>;
  onWikilinkPress?: (repositoryId: string) => void;
  onExternalLinkPress?: (url: string) => void;
}

// Parse inline formatting segments from a text string
interface Segment {
  type: "text" | "bold" | "italic" | "code" | "link" | "wikilink";
  text: string;
  url?: string;
  fullName?: string;
}

function parseInlineSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  // Combined regex for all inline patterns
  // Order matters: bold before italic (both use *)
  const pattern =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)]+?)\))|(\[\[([^\]]+?)\]\])/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // **bold**
      segments.push({ type: "bold", text: match[2] });
    } else if (match[3]) {
      // *italic*
      segments.push({ type: "italic", text: match[4] });
    } else if (match[5]) {
      // `code`
      segments.push({ type: "code", text: match[6] });
    } else if (match[7]) {
      // [text](url)
      segments.push({ type: "link", text: match[8], url: match[9] });
    } else if (match[10]) {
      // [[wikilink]]
      segments.push({ type: "wikilink", text: match[11], fullName: match[11] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) });
  }

  return segments;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  resolvedWikilinks = {},
  onWikilinkPress,
  onExternalLinkPress,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const styles = StyleSheet.create({
    h1: {
      fontSize: 24,
      fontWeight: "bold",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 12,
      marginTop: 4,
    },
    h2: {
      fontSize: 20,
      fontWeight: "600",
      color: isDark ? "#ffffff" : "#111827",
      marginBottom: 8,
      marginTop: 16,
    },
    paragraph: {
      fontSize: 15,
      lineHeight: 22,
      color: isDark ? "#d1d5db" : "#374151",
      marginBottom: 8,
    },
    listItem: {
      flexDirection: "row",
      marginBottom: 6,
      paddingLeft: 4,
    },
    bullet: {
      fontSize: 15,
      lineHeight: 22,
      color: isDark ? "#9ca3af" : "#6b7280",
      marginRight: 8,
      width: 12,
    },
    listText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: isDark ? "#d1d5db" : "#374151",
    },
    bold: {
      fontWeight: "bold",
    },
    italic: {
      fontStyle: "italic",
    },
    code: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 13,
      backgroundColor: isDark ? "#374151" : "#f3f4f6",
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
      color: isDark ? "#e5e7eb" : "#1f2937",
    },
    link: {
      color: "#3b82f6",
    },
    wikilinkProcessed: {
      color: "#3b82f6",
    },
    wikilinkUnprocessed: {
      color: isDark ? "#6b7280" : "#9ca3af",
    },
    wikilinkNotFound: {
      color: isDark ? "#6b7280" : "#9ca3af",
      textDecorationLine: "line-through",
    },
    spacing: {
      height: 8,
    },
  });

  const renderSegments = (segments: Segment[], lineKey: string) => {
    return segments.map((segment, i) => {
      const key = `${lineKey}-seg-${i}`;

      switch (segment.type) {
        case "bold":
          return (
            <Text key={key} style={styles.bold}>
              {segment.text}
            </Text>
          );
        case "italic":
          return (
            <Text key={key} style={styles.italic}>
              {segment.text}
            </Text>
          );
        case "code":
          return (
            <Text key={key} style={styles.code}>
              {segment.text}
            </Text>
          );
        case "link":
          return (
            <Text
              key={key}
              style={styles.link}
              onPress={() => onExternalLinkPress?.(segment.url!)}
            >
              {segment.text}
            </Text>
          );
        case "wikilink": {
          const resolution = resolvedWikilinks[segment.fullName!];
          if (!resolution || resolution.status === "not_found") {
            return (
              <Text key={key} style={styles.wikilinkNotFound}>
                {segment.fullName}
              </Text>
            );
          }
          if (resolution.status === "no_knowledge") {
            return (
              <Text key={key} style={styles.wikilinkUnprocessed}>
                {segment.fullName}{" "}
                <Text style={{ fontSize: 12 }}>(not yet processed)</Text>
              </Text>
            );
          }
          // has_knowledge
          return (
            <Text
              key={key}
              style={styles.wikilinkProcessed}
              onPress={() =>
                resolution.repositoryId &&
                onWikilinkPress?.(resolution.repositoryId)
              }
            >
              {segment.fullName}
            </Text>
          );
        }
        default:
          return <Text key={key}>{segment.text}</Text>;
      }
    });
  };

  const lines = content.split("\n");

  return (
    <View>
      {lines.map((line, index) => {
        const key = `line-${index}`;

        // Empty line -> spacing
        if (line.trim() === "") {
          return <View key={key} style={styles.spacing} />;
        }

        // H1
        if (line.startsWith("# ")) {
          const headerText = line.slice(2);
          const segments = parseInlineSegments(headerText);
          return (
            <Text key={key} style={styles.h1}>
              {renderSegments(segments, key)}
            </Text>
          );
        }

        // H2
        if (line.startsWith("## ")) {
          const headerText = line.slice(3);
          const segments = parseInlineSegments(headerText);
          return (
            <Text key={key} style={styles.h2}>
              {renderSegments(segments, key)}
            </Text>
          );
        }

        // List item
        if (line.startsWith("- ")) {
          const itemText = line.slice(2);
          const segments = parseInlineSegments(itemText);
          return (
            <View key={key} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>
                {renderSegments(segments, key)}
              </Text>
            </View>
          );
        }

        // Regular paragraph
        const segments = parseInlineSegments(line);
        return (
          <Text key={key} style={styles.paragraph}>
            {renderSegments(segments, key)}
          </Text>
        );
      })}
    </View>
  );
};

export default MarkdownRenderer;
