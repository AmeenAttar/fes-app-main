import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { FESCENTER_SITE_HOSTNAME } from "@/lib/site";
import { fetchInvestigatorDetail } from "@/lib/api";

export default function InvestigatorDetailScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = params.slug;
  const colors = useColors();
  const navigation = useNavigation();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["investigator", slug],
    queryFn: () => fetchInvestigatorDetail(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  // Header starts blank and fills in once the name loads (matches news/[id]).
  useEffect(() => {
    if (!data?.name) return;
    const n = data.name;
    navigation.setOptions({
      title: n.length > 36 ? `${n.slice(0, 36)}…` : n,
    });
  }, [navigation, data?.name]);

  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
      >
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
        <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
        <Text style={[styles.errTitle, { color: colors.foreground }]}>
          Couldn’t load this profile
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
          accessibilityLabel="Retry loading this profile"
          style={[
            styles.retryBtn,
            { backgroundColor: colors.primary, borderRadius: colors.radius },
          ]}
        >
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  const openOnWeb = async () => {
    try {
      await WebBrowser.openBrowserAsync(data.detailUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.primary,
        controlsColor: colors.primaryForeground,
      });
    } catch {
      /* noop */
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroWrap}>
        {data.heroImageUrl ? (
          <Image
            source={{ uri: data.heroImageUrl }}
            style={[
              styles.hero,
              { backgroundColor: colors.muted, borderRadius: colors.radius },
            ]}
            contentFit="cover"
            transition={150}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Photograph of ${data.name}`}
          />
        ) : (
          <View
            style={[
              styles.hero,
              styles.heroPlaceholder,
              { backgroundColor: colors.muted, borderRadius: colors.radius },
            ]}
          >
            <Feather
              name="user"
              size={56}
              color={colors.mutedForeground}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
        )}
      </View>

      <Text
        accessibilityRole="header"
        style={[styles.name, { color: colors.foreground }]}
      >
        {data.name}
      </Text>
      {data.title ? (
        <Text style={[styles.title, { color: colors.primary }]}>
          {data.title}
        </Text>
      ) : null}

      {data.bio.length === 0 ? (
        <Text
          style={[styles.dim, { color: colors.mutedForeground, marginTop: 12 }]}
        >
          No biography available.
        </Text>
      ) : (
        <View style={styles.bioWrap}>
          {data.bio.map((para, idx) => (
            <Text
              key={idx}
              style={[styles.para, { color: colors.foreground }]}
            >
              {para}
            </Text>
          ))}
        </View>
      )}

      <Pressable
        onPress={openOnWeb}
        accessibilityRole="button"
        accessibilityLabel={`View this profile on ${FESCENTER_SITE_HOSTNAME}`}
        accessibilityHint="Opens the website in an in-app browser"
        style={({ pressed }) => [
          styles.linkBtn,
          {
            backgroundColor: pressed ? colors.secondary : colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Feather name="external-link" size={16} color={colors.primary} />
        <Text style={[styles.linkBtnText, { color: colors.primary }]}>
          {`View on ${FESCENTER_SITE_HOSTNAME}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
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
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  hero: {
    width: 200,
    height: 240,
    overflow: "hidden",
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    lineHeight: 28,
  },
  title: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 4,
  },
  bioWrap: {
    marginTop: 16,
    gap: 12,
  },
  para: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
  },
  linkBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  linkBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
