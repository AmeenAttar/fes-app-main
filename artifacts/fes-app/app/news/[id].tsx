import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import React, { useLayoutEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { useColors } from "@/hooks/useColors";
import {
  fetchNewsArticle,
  newsArticleDetailQueryKey,
  type NewsArticle,
} from "@/lib/api";
import { FESCENTER_SITE_ORIGIN } from "@/lib/site";

function escapePlainForHtml(text: string): string {
  return text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/"/gu, "&quot;");
}

function normalizeWsChunk(s: string): string {
  return s.replace(/\s+/gu, " ").trim();
}

/** WP/Gutenberg often emits the same columns row twice in migrated posts. */
function stripLeadingDuplicateWpColumns(html: string): string {
  const oneCol =
    /^(<!--\s*wp:columns\b[^>]*-->[\s\S]*?<!--\s*\/wp:columns\s*-->)/iu;
  let s = html.trimStart();
  const m1 = oneCol.exec(s);
  if (!m1 || m1.index !== 0) return html;
  const rest = s.slice(m1[0].length).trimStart();
  const m2 = oneCol.exec(rest);
  if (!m2 || m2.index !== 0) return html;
  if (normalizeWsChunk(m1[0]) === normalizeWsChunk(m2[0])) {
    return (m1[0] + rest.slice(m2[0].length)).trimStart();
  }
  return html;
}

function stripLeadingDuplicateFigures(html: string): string {
  const fig = /^<figure\b[^>]*>[\s\S]*?<\/figure>/iu;
  let s = html.trimStart();
  const m1 = fig.exec(s);
  if (!m1 || m1.index !== 0) return html;
  const rest = s.slice(m1[0].length).trimStart();
  const m2 = fig.exec(rest);
  if (!m2 || m2.index !== 0) return html;
  if (normalizeWsChunk(m1[0]) === normalizeWsChunk(m2[0])) {
    return (m1[0] + rest.slice(m2[0].length)).trimStart();
  }
  return html;
}

function untilStable(transform: (s: string) => string, html: string): string {
  let s = html;
  for (let i = 0; i < 8; i += 1) {
    const n = transform(s);
    if (n === s) return s;
    s = n;
  }
  return s;
}

function prepareArticleBodyHtml(raw: string): string {
  let html = raw.trim();
  if (!html) return html;
  html = untilStable(stripLeadingDuplicateWpColumns, html);
  html = untilStable(stripLeadingDuplicateFigures, html);
  return html;
}

function buildArticleHtml(payload: {
  foreground: string;
  mutedForeground: string;
  primary: string;
  bodyHtml: string;
}): string {
  const { foreground, mutedForeground, primary, bodyHtml } = payload;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
:root { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
*{box-sizing:border-box;}
body{
  margin:0;
  padding:20px 16px 48px;
  font-size:17px;
  line-height:1.55;
  color:${foreground};
}
p{margin:12px 0;}
h1,h2,h3,h4{font-weight:700;line-height:1.25;color:${foreground};margin:20px 0 8px;}
h1{font-size:1.55rem;}
h2{font-size:1.35rem;}
h3{font-size:1.15rem;}
ul,ol{padding-left:1.25rem;margin:12px 0;}
li{margin:4px 0;}
blockquote{border-left:3px solid ${primary};margin:16px 0;padding:4px 0 4px 12px;color:${mutedForeground};}
figcaption{font-size:.85rem;color:${mutedForeground};margin-bottom:16px;}
a{color:${primary};text-underline-offset:2px;}
img,video,svg{display:block;max-width:100% !important;height:auto !important;}
iframe{max-width:100%;border:0;}
figure{margin:16px 0;}
figure:first-child{margin-top:4px;}
hr{border:0;border-top:1px solid ${mutedForeground};opacity:0.25;margin:20px 0;}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:.95rem;}
th,td{border:1px solid ${mutedForeground};padding:8px;text-align:left;}
</style>
</head><body>${bodyHtml}</body></html>`;
}

function formatWhen(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function NewsArticleScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = params.id;
  const articleId =
    typeof rawId === "string"
      ? rawId
      : Array.isArray(rawId)
        ? rawId[0]
        : undefined;

  const idTrimmed = articleId?.trim() ?? "";
  const idValid = idTrimmed.length > 0 && /^\d+$/u.test(idTrimmed);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: idValid ? newsArticleDetailQueryKey(idTrimmed) : ["news", "article", "skip"],
    queryFn: () => fetchNewsArticle(idTrimmed),
    enabled: idValid,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  useLayoutEffect(() => {
    if (!data?.title) return;
    const t = data.title;
    navigation.setOptions({
      title: t.length > 36 ? `${t.slice(0, 36)}\u2026` : t,
    });
  }, [navigation, data?.title]);

  const shellHtml = useMemo(() => {
    if (!data) return "";
    const hasBody = data.contentHtml.trim().length > 0;
    const body = hasBody
      ? prepareArticleBodyHtml(data.contentHtml)
      : `<p>${escapePlainForHtml(
            data.excerpt.trim().length > 0
              ? data.excerpt
              : "Full article text unavailable in the app. Use “Open on website.”",
          )}</p>`;
    return buildArticleHtml({
      foreground: colors.foreground,
      mutedForeground: colors.mutedForeground,
      primary: colors.primary,
      bodyHtml: body,
    });
  }, [data, colors.foreground, colors.mutedForeground, colors.primary]);

  const openCanonical = async (article: Pick<NewsArticle, "canonicalLink">) => {
    const url = article.canonicalLink;
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.primary,
        controlsColor: "#FFFFFF",
      });
    } catch {
      Linking.openURL(url).catch(() => undefined);
    }
  };

  if (!articleId?.trim()) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.dim, { color: colors.mutedForeground }]}>
          Missing article link.
        </Text>
      </View>
    );
  }

  if (!idValid) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.dim, { color: colors.mutedForeground }]}>
          Invalid article link.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingHorizontal: 32 },
        ]}
      >
        <Feather name="wifi-off" size={28} color={colors.mutedForeground} />
        <Text style={[styles.errTitle, { color: colors.foreground }]}>
          Couldn’t load this article
        </Text>
        <Text
          style={[styles.dim, { color: colors.mutedForeground, textAlign: "center" }]}
        >
          {error instanceof Error ? error.message : "Try again shortly."}
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={[
            styles.retryBtn,
            { backgroundColor: colors.primary, borderRadius: colors.radius },
          ]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.leadMeta, { color: colors.secondary }]}>
          {formatWhen(data.date).toUpperCase()}
        </Text>
        {data.categories[0] ? (
          <View
            style={[
              styles.chipWrap,
              { borderColor: colors.border, backgroundColor: colors.muted },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
              {data.categories[0]}
            </Text>
          </View>
        ) : null}
      </View>

      {data.featuredImageUrl && !data.contentHtml.trim() ? (
        <Image
          source={{ uri: data.featuredImageUrl }}
          style={styles.hero}
          contentFit="cover"
        />
      ) : null}

      <WebView
        key={`article-body-${colors.scheme}`}
        style={[styles.web, styles.webBelowMeta, { backgroundColor: colors.background }]}
        originWhitelist={["*"]}
        source={{ html: shellHtml, baseUrl: FESCENTER_SITE_ORIGIN }}
        setSupportMultipleWindows={false}
        allowsFullscreenVideo
        accessibilityLabel={`Article body: ${data.title}`}
      />

      <View
        style={[
          styles.footerBar,
          { borderTopColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <Pressable
          onPress={() => openCanonical(data)}
          style={({ pressed }) => [
            styles.openOriginal,
            {
              borderRadius: colors.radius,
              borderColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="external-link" size={16} color={colors.primary} />
          <Text style={[styles.openOriginalText, { color: colors.primary }]}>
            Open on website
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  leadMeta: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    lineHeight: 16,
  },
  chipWrap: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: "50%",
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  hero: {
    width: "100%",
    height: 200,
    marginBottom: 12,
  },
  web: { flex: 1 },
  webBelowMeta: {
    marginTop: 4,
  },
  footerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
  },
  openOriginal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
  },
  openOriginalText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  dim: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
  errTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 6 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FFFFFF" },
});
