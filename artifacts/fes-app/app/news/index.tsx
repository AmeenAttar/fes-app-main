import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  fetchNewsPage,
  newsInfiniteQueryKey,
  type NewsItem,
  type NewsPage,
} from "@/lib/api";

const SKELETON_COUNT = 3;

export default function NewsScreen() {
  const colors = useColors();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    isRefetchError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery<NewsPage, Error>({
    queryKey: newsInfiniteQueryKey,
    queryFn: ({ pageParam }) => fetchNewsPage(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const items = useMemo<NewsItem[]>(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const endReachLock = useRef(false);

  const onEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (isFetchNextPageError) return;
    if (endReachLock.current) return;
    endReachLock.current = true;
    void fetchNextPage().finally(() => {
      endReachLock.current = false;
    });
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
  ]);

  const onPressItem = (item: NewsItem) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    router.push({ pathname: "/news/[id]", params: { id: String(item.id) } });
  };

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.listContent}>
          {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </View>
      </View>
    );
  }

  if (isError && items.length === 0) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingHorizontal: 32 },
        ]}
      >
        <Feather name="wifi-off" size={28} color={colors.mutedForeground} />
        <Text style={[styles.errTitle, { color: colors.foreground }]}>
          Couldn’t load news
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
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.listContent,
        items.length === 0 && !isRefetchError ? styles.listContentEmpty : null,
      ]}
      data={items}
      keyExtractor={(item) => String(item.id)}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.35}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={() => refetch()}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        isRefetchError && items.length > 0 ? (
          <View
            style={[
              styles.refetchBanner,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="alert-circle" size={18} color={colors.secondary} />
            <Text
              style={[styles.refetchBannerText, { color: colors.foreground }]}
            >
              Couldn’t refresh. Showing saved posts.
            </Text>
            <Pressable
              onPress={() => refetch()}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={[styles.refetchRetry, { color: colors.primary }]}>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather name="rss" size={28} color={colors.mutedForeground} />
          <Text style={[styles.dim, { color: colors.mutedForeground }]}>
            No news posts yet.
          </Text>
        </View>
      }
      ListFooterComponent={
        isFetchNextPageError ? (
          <View
            style={[
              styles.loadMoreErr,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text
              style={[styles.loadMoreErrText, { color: colors.mutedForeground }]}
            >
              Couldn’t load more posts.
            </Text>
            <Pressable
              onPress={() => fetchNextPage()}
              style={({ pressed }) => [
                styles.loadMoreRetry,
                {
                  borderColor: colors.primary,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[styles.loadMoreRetryText, { color: colors.primary }]}
              >
                Try again
              </Text>
            </Pressable>
          </View>
        ) : isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !hasNextPage && items.length > 0 ? (
          <Text
            style={[styles.footerText, { color: colors.mutedForeground }]}
          >
            You’re all caught up
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <NewsCard item={item} onPress={() => onPressItem(item)} />
      )}
    />
  );
}

interface NewsCardProps {
  item: NewsItem;
  onPress: () => void;
}

function NewsCard({ item, onPress }: NewsCardProps) {
  const colors = useColors();

  const dateLabel = useMemo(() => {
    const d = new Date(item.date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [item.date]);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      testID={`news-card-${item.id}`}
    >
      {item.featuredImageUrl ? (
        <Image
          source={{ uri: item.featuredImageUrl }}
          style={styles.hero}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.heroPlaceholder, { backgroundColor: colors.muted }]}>
          <Feather name="image" size={28} color={colors.mutedForeground} />
        </View>
      )}

      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <Text style={[styles.metaDate, { color: colors.secondary }]}>
            {dateLabel}
          </Text>
          {item.categories[0] ? (
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                {item.categories[0]}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={3}
        >
          {item.title}
        </Text>
        {item.excerpt ? (
          <Text
            style={[styles.excerpt, { color: colors.mutedForeground }]}
            numberOfLines={3}
          >
            {item.excerpt}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SkeletonCard() {
  const colors = useColors();
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
      <View style={[styles.heroPlaceholder, { backgroundColor: colors.muted }]} />
      <View style={styles.cardBody}>
        <View style={[styles.skelLine, { width: "30%", backgroundColor: colors.muted }]} />
        <View
          style={[
            styles.skelLine,
            { width: "85%", height: 18, marginTop: 10, backgroundColor: colors.muted },
          ]}
        />
        <View
          style={[
            styles.skelLine,
            { width: "60%", height: 18, marginTop: 6, backgroundColor: colors.muted },
          ]}
        />
        <View
          style={[
            styles.skelLine,
            { width: "100%", marginTop: 10, backgroundColor: colors.muted },
          ]}
        />
        <View
          style={[
            styles.skelLine,
            { width: "90%", marginTop: 4, backgroundColor: colors.muted },
          ]}
        />
      </View>
    </View>
  );
}

const HERO_HEIGHT = 180;

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  listContentEmpty: {
    justifyContent: "center",
  },
  refetchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  refetchBannerText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  refetchRetry: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  loadMoreErr: {
    marginTop: 4,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    alignItems: "center",
  },
  loadMoreErrText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  loadMoreRetry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  loadMoreRetryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    overflow: "hidden",
  },
  hero: {
    width: "100%",
    height: HERO_HEIGHT,
  },
  heroPlaceholder: {
    width: "100%",
    height: HERO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metaDate: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 2,
  },
  excerpt: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 20,
  },
  skelLine: {
    height: 12,
    borderRadius: 4,
  },
});
