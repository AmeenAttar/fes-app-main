import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
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

import {
  useViewMode,
  ViewModeToggle,
} from "@/components/ViewModeToggle";
import { useColors } from "@/hooks/useColors";
import {
  equipmentListQueryKey,
  fetchEquipmentList,
  type EquipmentSummary,
} from "@/lib/api";

const GRID_COLUMNS = 2;
const GRID_GAP = 12;
const VIEW_MODE_KEY = "@fes/equipment-view-mode-v1";

/**
 * The catalog is entirely driven by whatever pages currently exist under
 * fescenter.org/equipmentrepo/ — there is no local list to keep in sync.
 * Adding, removing, or renaming an item on the website is reflected here on
 * the next fetch, with no app change.
 */
export default function EquipmentInventoryScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [viewMode, onChangeViewMode] = useViewMode(VIEW_MODE_KEY);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: equipmentListQueryKey,
    queryFn: fetchEquipmentList,
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!data) return [] as EquipmentSummary[];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((item) => item.name.toLowerCase().includes(q));
  }, [data, query]);

  const onPressItem = (item: EquipmentSummary) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    router.push(`/equipment-inventory/${item.slug}` as never);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.dim, { color: colors.mutedForeground }]}>
          Loading equipment…
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
          Couldn't load equipment
        </Text>
        <Text
          style={[
            styles.dim,
            { color: colors.mutedForeground, textAlign: "center" },
          ]}
        >
          {error instanceof Error ? error.message : "Please try again."}
        </Text>
        <Pressable
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading equipment"
          style={({ pressed }) => [
            styles.retryBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.9 : 1,
            },
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
            placeholder="Search equipment"
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
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.center}>
            <Feather name="package" size={28} color={colors.mutedForeground} />
            <Text style={[styles.dim, { color: colors.mutedForeground }]}>
              {query
                ? `No equipment matches "${query.trim()}".`
                : "No equipment listed."}
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
            <EquipmentGridCard item={item} onPress={() => onPressItem(item)} />
          ) : (
            <EquipmentListRow item={item} onPress={() => onPressItem(item)} />
          )
        }
      />
    </View>
  );
}

/**
 * The scraped image URL is often a dead link on the Center's own site (its
 * media library has drifted out of sync with the page content) — a plain
 * `imageUrl ? <Image> : placeholder` check doesn't catch that, since the URL
 * is present, it just 404s. Falling back on load failure does.
 */
function useEquipmentImage(item: EquipmentSummary) {
  const [failed, setFailed] = useState(false);
  return { show: !!item.imageUrl && !failed, onError: () => setFailed(true) };
}

function EquipmentGridCard({
  item,
  onPress,
}: {
  item: EquipmentSummary;
  onPress: () => void;
}) {
  const colors = useColors();
  const image = useEquipmentImage(item);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityHint="Opens this equipment's details"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {image.show ? (
        <Image
          source={{ uri: item.imageUrl! }}
          style={[styles.thumb, { backgroundColor: colors.muted }]}
          contentFit="contain"
          transition={150}
          onError={image.onError}
        />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.thumbPlaceholder,
            { backgroundColor: `${colors.secondary}18` },
          ]}
        >
          <Feather name="package" size={30} color={colors.secondary} />
        </View>
      )}
      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
        {item.name}
      </Text>
    </Pressable>
  );
}

function EquipmentListRow({
  item,
  onPress,
}: {
  item: EquipmentSummary;
  onPress: () => void;
}) {
  const colors = useColors();
  const image = useEquipmentImage(item);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityHint="Opens this equipment's details"
      style={({ pressed }) => [
        styles.listRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {image.show ? (
        <Image
          source={{ uri: item.imageUrl! }}
          style={[styles.listThumb, { backgroundColor: colors.muted }]}
          contentFit="contain"
          transition={150}
          onError={image.onError}
        />
      ) : (
        <View
          style={[
            styles.listThumb,
            styles.thumbPlaceholder,
            { backgroundColor: `${colors.secondary}18` },
          ]}
        >
          <Feather name="package" size={22} color={colors.secondary} />
        </View>
      )}
      <Text
        style={[styles.listName, { color: colors.foreground }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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
  dim: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
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
  thumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    lineHeight: 18,
  },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  listThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  listName: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
});
