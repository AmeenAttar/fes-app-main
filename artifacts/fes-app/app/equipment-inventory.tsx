import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  fetchInventory,
  inventoryQueryKey,
  type InventoryPayload,
} from "@/lib/api";

function findImageHeader(headers: string[]): string | null {
  const match = headers.find((h) => /image|photo|thumbnail/i.test(h.trim()));
  return match ?? null;
}

function itemMatchesQuery(
  item: Record<string, string>,
  headers: string[],
  q: string,
): boolean {
  if (!q) return true;
  for (const h of headers) {
    const v = item[h];
    if (v && v.toLowerCase().includes(q)) return true;
  }
  return false;
}

function isLikelyImageUrl(s: string): boolean {
  return /^https?:\/\//iu.test(s.trim());
}

export default function EquipmentInventoryScreen() {
  const colors = useColors();
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: inventoryQueryKey,
    queryFn: fetchInventory,
    staleTime: 2 * 60 * 1000,
  });

  const imageHeader = data ? findImageHeader(data.headers) : null;

  const filteredItems = useMemo(() => {
    if (!data) return [] as Record<string, string>[];
    const q = query.trim().toLowerCase();
    return data.items.filter((row) =>
      itemMatchesQuery(row, data.headers, q),
    );
  }, [data, query]);

  const renderCard = ({
    item,
  }: {
    item: Record<string, string>;
  }) => {
    if (!data) return null;
    const headers = data.headers;
    const imgKey = imageHeader;
    const imgRaw = imgKey ? (item[imgKey] ?? "").trim() : "";
    const showImage = imgRaw.length > 0 && isLikelyImageUrl(imgRaw);

    const textHeaders = headers.filter((h) => h !== imgKey);

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.cardTop}>
          {showImage ? (
            <Image
              source={{ uri: imgRaw }}
              style={[
                styles.thumb,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View
              style={[
                styles.thumbPlaceholder,
                {
                  backgroundColor: `${colors.secondary}18`,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="package" size={28} color={colors.secondary} />
            </View>
          )}
          <View style={styles.cardMain}>
            {textHeaders.map((h) => {
              const val = (item[h] ?? "").trim();
              if (!val) return null;
              return (
                <View key={h} style={styles.field}>
                  <Text
                    style={[styles.fieldLabel, { color: colors.mutedForeground }]}
                  >
                    {h}
                  </Text>
                  <Text style={[styles.fieldValue, { color: colors.foreground }]}>
                    {val}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
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
          Could not load inventory
        </Text>
        <Text
          style={[
            styles.dim,
            { color: colors.mutedForeground, textAlign: "center" },
          ]}
        >
          {error instanceof Error ? error.message : "Please try again."}
        </Text>
        <Text
          style={[
            styles.hint,
            { color: colors.mutedForeground, textAlign: "center" },
          ]}
        >
          The list is read from your Google Sheet. Ensure the API server has
          GOOGLE_SHEETS_API_KEY set and the sheet is shared for viewing.
        </Text>
        <Pressable
          onPress={() => refetch()}
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

  const payload = data as InventoryPayload;
  const emptySheet =
    payload.items.length === 0 ||
    payload.headers.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
        />
      </View>

      {emptySheet ? (
        <View style={[styles.center, { flex: 1 }]}>
          <Feather name="inbox" size={32} color={colors.mutedForeground} />
          <Text style={[styles.errTitle, { color: colors.foreground }]}>
            No inventory items
          </Text>
          <Text
            style={[
              styles.dim,
              { color: colors.mutedForeground, textAlign: "center" },
            ]}
          >
            Add rows under the Equipment tab in the Google Sheet (first row =
            column headers).
          </Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={[styles.dim, { color: colors.mutedForeground }]}>
            No items match “{query.trim()}”.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, index) =>
            (item["Equipment_ID"] || item["Serial_Number"] || `row-${index}`) +
            `-${index}`
          }
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 24,
  },
  dim: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  errTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    padding: 0,
  },
  listContent: {
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  field: {
    gap: 2,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fieldValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
});
