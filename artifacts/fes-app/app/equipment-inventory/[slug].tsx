import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  equipmentDetailQueryKey,
  fetchEquipmentDetail,
  type EquipmentParameter,
} from "@/lib/api";
import { openMailtoDraft } from "@/lib/mailto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;

/**
 * A parameter row is tappable when its *value* looks like an email or a URL —
 * detected by shape, not by matching a specific label. The Center's labels
 * already vary ("Contact PI" vs "Contact Person"); this way a new "Vendor
 * Support Email" field gets the same tap-to-email behavior automatically.
 */
function rowKind(value: string): "email" | "url" | "text" {
  if (EMAIL_RE.test(value.trim())) return "email";
  if (URL_RE.test(value.trim())) return "url";
  return "text";
}

export default function EquipmentDetailScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = params.slug;
  const colors = useColors();
  const navigation = useNavigation();
  // Scraped image URLs are sometimes dead links on the Center's own site —
  // fall back to the placeholder when the fetch itself fails, not just when
  // the URL is absent.
  const [imageFailed, setImageFailed] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: equipmentDetailQueryKey(slug ?? ""),
    queryFn: () => fetchEquipmentDetail(slug),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });

  // Header starts blank and fills in once the name loads (matches investigators/[slug]).
  useEffect(() => {
    if (!data?.name) return;
    const n = data.name;
    navigation.setOptions({ title: n.length > 36 ? `${n.slice(0, 36)}…` : n });
  }, [navigation, data?.name]);

  const onPressRow = async (param: EquipmentParameter) => {
    const kind = rowKind(param.value);
    if (kind === "email") {
      const ok = await openMailtoDraft({ to: param.value.trim() });
      if (!ok) Linking.openURL(`mailto:${param.value.trim()}`).catch(() => undefined);
      return;
    }
    if (kind === "url") {
      try {
        await WebBrowser.openBrowserAsync(param.value.trim(), {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          toolbarColor: colors.primary,
          controlsColor: colors.primaryForeground,
        });
      } catch {
        Linking.openURL(param.value.trim()).catch(() => undefined);
      }
    }
  };


  if (!slug) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.dim, { color: colors.mutedForeground }]}>
          Missing equipment.
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
          Couldn't load this item
        </Text>
        <Text
          style={[
            styles.dim,
            { color: colors.mutedForeground, textAlign: "center" },
          ]}
        >
          {error instanceof Error ? error.message : "Try again in a moment."}
        </Text>
        <Pressable
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry"
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {data.imageUrl && !imageFailed ? (
        <Image
          source={{ uri: data.imageUrl }}
          style={[
            styles.hero,
            { backgroundColor: colors.muted, borderRadius: colors.radius },
          ]}
          contentFit="contain"
          transition={150}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View
          style={[
            styles.hero,
            styles.heroPlaceholder,
            { backgroundColor: `${colors.secondary}18`, borderRadius: colors.radius },
          ]}
        >
          <Feather name="package" size={56} color={colors.secondary} />
        </View>
      )}

      <Text style={[styles.name, { color: colors.foreground }]}>
        {data.name}
      </Text>

      {data.parameters.length === 0 ? (
        <Text style={[styles.dim, { color: colors.mutedForeground, marginTop: 8 }]}>
          No further details are listed for this item.
        </Text>
      ) : (
        <View
          style={[
            styles.paramCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          {data.parameters.map((param, idx) => {
            const kind = rowKind(param.value);
            const tappable = kind !== "text";
            return (
              <Pressable
                key={`${param.label}-${idx}`}
                disabled={!tappable}
                onPress={() => onPressRow(param)}
                accessibilityRole={tappable ? "button" : undefined}
                accessibilityLabel={
                  tappable ? `${param.label}: ${param.value}` : undefined
                }
                style={({ pressed }) => [
                  styles.paramRow,
                  idx > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  tappable && pressed ? { backgroundColor: colors.muted } : null,
                ]}
              >
                <Text style={[styles.paramLabel, { color: colors.mutedForeground }]}>
                  {param.label}
                </Text>
                <View style={styles.paramValueRow}>
                  <Text
                    style={[
                      styles.paramValue,
                      { color: tappable ? colors.primary : colors.foreground },
                    ]}
                  >
                    {param.value}
                  </Text>
                  {tappable ? (
                    <Feather
                      name={kind === "email" ? "mail" : "external-link"}
                      size={14}
                      color={colors.primary}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  dim: { fontFamily: "Inter_400Regular", fontSize: 14 },
  errTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 4,
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  hero: {
    width: "100%",
    height: 220,
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 21,
    lineHeight: 27,
  },
  paramCard: {
    borderWidth: 1,
    overflow: "hidden",
  },
  paramRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  paramLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  paramValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  paramValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 21,
    flexShrink: 1,
  },
});
