import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useViewMode, ViewModeToggle } from "@/components/ViewModeToggle";
import { useColors } from "@/hooks/useColors";
import { fetchInvestigators, type InvestigatorSummary } from "@/lib/api";

const GRID_COLUMNS = 2;
const GRID_GAP = 12;
const VIEW_MODE_KEY = "@fes/investigators-view-mode-v1";

export default function InvestigatorsScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  // Defaults to list: this is a directory people scan by name, where the
  // compact row fits more of it on screen.
  const [viewMode, onChangeViewMode] = useViewMode(VIEW_MODE_KEY, "list");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["investigators"],
    queryFn: fetchInvestigators,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!data) return [] as InvestigatorSummary[];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) => p.name.toLowerCase().includes(q));
  }, [data, query]);

  const onPressItem = (item: InvestigatorSummary) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {
        /* noop */
      });
    }
    router.push(`/investigators/${item.slug}` as never);
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.dim, { color: colors.mutedForeground }]}>
          Loading investigators…
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingHorizontal: 32 },
        ]}
      >
        <Feather name="wifi-off" size={28} color={colors.mutedForeground} />
        <Text style={[styles.errTitle, { color: colors.foreground }]}>
          Couldn’t load investigators
        </Text>
        <Text style={[styles.dim, { color: colors.mutedForeground, textAlign: "center" }]}>
          {error instanceof Error ? error.message : "Please try again."}
        </Text>
        <Pressable
          onPress={() => refetch()}
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

  const isGrid = viewMode === "grid";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search investigators"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        <ViewModeToggle mode={viewMode} onChange={onChangeViewMode} />
      </View>

      <FlatList
        data={filtered}
        // numColumns can't change on a mounted FlatList, so the key forces a
        // remount when switching modes.
        key={viewMode}
        numColumns={isGrid ? GRID_COLUMNS : 1}
        keyExtractor={(item) => item.slug}
        {...(isGrid ? { columnWrapperStyle: styles.gridRow } : {})}
        contentContainerStyle={
          isGrid ? styles.gridContent : styles.listContent
        }
        ItemSeparatorComponent={
          isGrid
            ? undefined
            : () => (
                <View
                  style={[styles.separator, { backgroundColor: colors.border }]}
                />
              )
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Feather name="users" size={28} color={colors.mutedForeground} />
            <Text style={[styles.dim, { color: colors.mutedForeground }]}>
              No matches.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) =>
          isGrid ? (
            <InvestigatorGridCard
              item={item}
              onPress={() => onPressItem(item)}
            />
          ) : (
            <InvestigatorListRow item={item} onPress={() => onPressItem(item)} />
          )
        }
      />
    </View>
  );
}

function InvestigatorListRow({
  item,
  onPress,
}: {
  item: InvestigatorSummary;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityHint="Opens this investigator's profile"
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: colors.muted } : null,
      ]}
      testID={`investigator-${item.slug}`}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: colors.muted, borderRadius: 28 },
        ]}
      >
        {item.photoUrl ? (
          <Image
            source={{ uri: item.photoUrl }}
            style={styles.avatarImg}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <Feather name="user" size={22} color={colors.mutedForeground} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text
          style={[styles.name, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function InvestigatorGridCard({
  item,
  onPress,
}: {
  item: InvestigatorSummary;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityHint="Opens this investigator's profile"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      testID={`investigator-${item.slug}`}
    >
      {item.photoUrl ? (
        <Image
          source={{ uri: item.photoUrl }}
          style={[styles.cardPhoto, { backgroundColor: colors.muted }]}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={[
            styles.cardPhoto,
            styles.cardPhotoPlaceholder,
            { backgroundColor: `${colors.secondary}18` },
          ]}
        >
          <Feather name="user" size={30} color={colors.secondary} />
        </View>
      )}
      <Text
        style={[styles.cardName, { color: colors.foreground }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  searchWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    padding: 0,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    flexGrow: 1,
  },
  separator: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  rowText: { flex: 1 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 15 },

  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    flexGrow: 1,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    padding: 12,
    marginBottom: GRID_GAP,
    gap: 10,
  },
  cardPhoto: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
  },
  cardPhotoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    lineHeight: 18,
  },
});
