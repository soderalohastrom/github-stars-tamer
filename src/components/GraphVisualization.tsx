import React, { useRef, useMemo, useEffect, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Platform } from "react-native";

interface GraphNode {
  id: string;
  label: string;
  language: string | null;
  stars: number;
  status: string;
  summary: string;
  categoryNames: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  reason: string;
  edgeType: string;
}

interface GraphVisualizationProps {
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] };
  onNodePress: (nodeId: string) => void;
  isDark: boolean;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  "C++": "#f34b7d",
  C: "#555555",
  Shell: "#89e051",
  Dart: "#00B4AB",
  Lua: "#000080",
  HTML: "#e34c26",
  CSS: "#563d7c",
  PHP: "#4F5D95",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
};

const EDGE_COLORS: Record<string, string> = {
  llm_discovered: "#3b82f6",
  shared_topic: "#10b981",
  shared_language: "#6b7280",
  same_owner: "#f59e0b",
};

function getLanguageColor(lang: string | null): string {
  if (!lang) return "#6b7280";
  return LANGUAGE_COLORS[lang] || "#6b7280";
}

function buildHtml(
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] },
  isDark: boolean
): string {
  const bgColor = isDark ? "#0f0f23" : "#f9fafb";
  const fontColor = isDark ? "#d1d5db" : "#374151";

  const visNodes = graphData.nodes.map((n) => {
    const size = Math.log(n.stars + 1) * 3 + 8;
    const color = getLanguageColor(n.language);
    const opacity = n.status === "processed" ? 1.0 : 0.4;
    const shortLabel =
      n.label.length > 20 ? n.label.split("/")[1] || n.label : n.label;
    return {
      id: n.id,
      label: shortLabel,
      size,
      color: {
        background: color,
        border: color,
        highlight: { background: "#3b82f6", border: "#2563eb" },
      },
      opacity,
      font: { color: fontColor, size: 10 },
      borderWidth: 1,
    };
  });

  const visEdges = graphData.edges.map((e, i) => ({
    id: `edge-${i}`,
    from: e.source,
    to: e.target,
    color: {
      color: EDGE_COLORS[e.edgeType] || "#6b7280",
      opacity: 0.6,
    },
    width: e.edgeType === "llm_discovered" ? 2 : 1,
  }));

  // Build tooltip data lookup (separate from vis DataSet so we control rendering)
  const tooltipData: Record<string, { owner: string; repo: string; lang: string | null; langColor: string; stars: number; summary: string }> = {};
  for (const n of graphData.nodes) {
    const owner = n.label.split("/")[0] || "";
    const repo = n.label.split("/")[1] || n.label;
    const summary = n.summary
      ? n.summary.length > 120 ? n.summary.slice(0, 120) + "..." : n.summary
      : "Not yet processed";
    tooltipData[n.id] = { owner, repo, lang: n.language, langColor: getLanguageColor(n.language), stars: n.stars, summary };
  }

  const edgeTooltipData: Record<string, string> = {};
  for (const e of graphData.edges) {
    edgeTooltipData[`edge-${graphData.edges.indexOf(e)}`] = e.reason;
  }

  // postMessage bridges: ReactNativeWebView for native, window.parent for web iframe
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${bgColor}; overflow: hidden; }
    #graph { width: 100vw; height: 100vh; }
    .vis-tooltip { display: none !important; }
    #tooltip {
      position: fixed;
      display: none;
      background: ${isDark ? "#1a1a2e" : "#ffffff"};
      border: 1px solid ${isDark ? "#374151" : "#e5e7eb"};
      border-radius: 10px;
      padding: 12px 14px;
      max-width: 280px;
      box-shadow: 0 4px 16px rgba(0,0,0,${isDark ? "0.4" : "0.12"});
      font-family: -apple-system, system-ui, sans-serif;
      pointer-events: none;
      z-index: 100;
      transition: opacity 0.15s ease;
    }
    #tooltip.visible { display: block; opacity: 1; }
    .tt-name { font-size: 14px; font-weight: 700; color: ${isDark ? "#fff" : "#111827"}; margin-bottom: 2px; }
    .tt-owner { font-size: 11px; color: ${isDark ? "#9ca3af" : "#6b7280"}; margin-bottom: 6px; }
    .tt-meta { margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .tt-lang-dot { width: 8px; height: 8px; border-radius: 4px; display: inline-block; }
    .tt-lang, .tt-stars { font-size: 11px; color: ${isDark ? "#d1d5db" : "#6b7280"}; }
    .tt-star-icon { color: #f59e0b; font-size: 11px; }
    .tt-summary { font-size: 12px; line-height: 1.4; color: ${isDark ? "#d1d5db" : "#374151"}; }
    .tt-edge { font-size: 12px; line-height: 1.4; color: ${isDark ? "#d1d5db" : "#374151"}; }
  </style>
</head>
<body>
  <div id="graph"></div>
  <div id="tooltip"></div>
  <script>
    var tooltipData = ${JSON.stringify(tooltipData)};
    var edgeTooltipData = ${JSON.stringify(edgeTooltipData)};
    var tooltip = document.getElementById('tooltip');
    var nodes = new vis.DataSet(${JSON.stringify(visNodes)});
    var edges = new vis.DataSet(${JSON.stringify(visEdges)});
    var container = document.getElementById('graph');
    var data = { nodes: nodes, edges: edges };
    var options = {
      physics: {
        forceAtlas2Based: {
          gravitationalConstant: -30,
          centralGravity: 0.005,
          springLength: 120,
          springConstant: 0.04,
          damping: 0.4,
        },
        solver: 'forceAtlas2Based',
        stabilization: {
          enabled: true,
          iterations: 150,
          updateInterval: 25,
        },
        maxVelocity: 50,
      },
      nodes: {
        shape: 'dot',
        scaling: { min: 8, max: 30 },
        font: { face: '-apple-system, system-ui, sans-serif' },
      },
      edges: {
        smooth: { type: 'continuous' },
        selectionWidth: 2,
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        multiselect: false,
        navigationButtons: false,
        keyboard: false,
      },
    };

    var network = new vis.Network(container, data, options);

    network.on('stabilizationIterationsDone', function() {
      network.setOptions({ physics: { enabled: false } });
    });

    function sendMessage(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    }

    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        tooltip.className = '';
        sendMessage(JSON.stringify({
          type: 'nodeClick',
          nodeId: params.nodes[0]
        }));
      }
    });

    function showTooltip(x, y, html) {
      tooltip.innerHTML = html;
      tooltip.className = 'visible';
      var pad = 12;
      var tx = x + pad;
      var ty = y + pad;
      if (tx + 280 > window.innerWidth) tx = x - 280 - pad;
      if (ty + 200 > window.innerHeight) ty = y - 200;
      tooltip.style.left = Math.max(4, tx) + 'px';
      tooltip.style.top = Math.max(4, ty) + 'px';
    }

    function hideTooltip() {
      tooltip.className = '';
    }

    network.on('hoverNode', function(params) {
      var d = tooltipData[params.node];
      if (!d) return;
      var langHtml = d.lang
        ? '<span class="tt-lang-dot" style="background:' + d.langColor + '"></span><span class="tt-lang">' + d.lang + '</span>'
        : '';
      var starsStr = d.stars >= 1000 ? (d.stars / 1000).toFixed(1) + 'k' : d.stars;
      var html = '<div class="tt-name">' + d.repo + '</div>'
        + '<div class="tt-owner">' + d.owner + '</div>'
        + '<div class="tt-meta">' + langHtml + '<span class="tt-star-icon">&#9733;</span><span class="tt-stars">' + starsStr + '</span></div>'
        + '<div class="tt-summary">' + d.summary + '</div>';
      var pos = params.event.center || { x: params.event.clientX || 0, y: params.event.clientY || 0 };
      showTooltip(pos.x, pos.y, html);
    });

    network.on('blurNode', hideTooltip);

    network.on('hoverEdge', function(params) {
      var reason = edgeTooltipData[params.edge];
      if (!reason) return;
      var pos = params.event.center || { x: params.event.clientX || 0, y: params.event.clientY || 0 };
      showTooltip(pos.x, pos.y, '<div class="tt-edge">' + reason + '</div>');
    });

    network.on('blurEdge', hideTooltip);
  </script>
</body>
</html>`;
}

// Native: WebView renderer
function NativeGraph({
  html,
  onMessage,
  isDark,
}: {
  html: string;
  onMessage: (data: string) => void;
  isDark: boolean;
}) {
  const WebView = require("react-native-webview").WebView;
  const webViewRef = useRef(null);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      onMessage(event.nativeEvent.data);
    },
    [onMessage]
  );

  return (
    <WebView
      ref={webViewRef}
      source={{ html }}
      style={styles.webview}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={isDark ? "#ffffff" : "#000000"}
          />
        </View>
      )}
      startInLoadingState
    />
  );
}

// Web: iframe renderer — vis-network runs directly in the browser
function WebGraph({
  html,
  onMessage,
}: {
  html: string;
  onMessage: (data: string) => void;
}) {
  const containerRef = useRef<View>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        onMessage(event.data);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMessage]);

  // React Native Web renders View as <div>, so we can use createElement
  // for the iframe which RN Web's JSX doesn't directly support.
  return React.createElement("iframe", {
    srcDoc: html,
    style: {
      width: "100%",
      height: "100%",
      border: "none",
      display: "block",
    },
    sandbox: "allow-scripts allow-same-origin",
  });
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  graphData,
  onNodePress,
  isDark,
}) => {
  const html = useMemo(
    () => buildHtml(graphData, isDark),
    [graphData, isDark]
  );

  const handleMessage = useCallback(
    (data: string) => {
      try {
        const message = JSON.parse(data);
        if (message.type === "nodeClick" && message.nodeId) {
          onNodePress(message.nodeId);
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onNodePress]
  );

  if (graphData.nodes.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#000000"} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS === "web" ? (
        <WebGraph html={html} onMessage={handleMessage} />
      ) : (
        <NativeGraph html={html} onMessage={handleMessage} isDark={isDark} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default GraphVisualization;
