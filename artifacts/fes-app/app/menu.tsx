import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateWidget } from "@/components/DateWidget";
import { HamburgerButton } from "@/components/HamburgerMenu";
import { StaleNotice } from "@/components/StaleNotice";
import { useZoomTransition } from "@/components/ZoomTransition";
import { PROJECT_REVIEW_CONTACT } from "@/constants/supporting-resources";
import { useColors } from "@/hooks/useColors";
import { openMailtoDraft } from "@/lib/mailto";
import { FESCENTER_SITE_HOSTNAME, FESCENTER_SITE_ORIGIN } from "@/lib/site";
import type { IconName } from "@/constants/menu";
import {
  calendarEventsListQueryKey,
  fetchEvents,
  fetchNewsPage,
  NEWS_FEED_QUERY_VERSION,
  type CalendarEvent,
  type NewsItem,
} from "@/lib/api";

const LOGO = require("../assets/images/logo.png");
/** Intrinsic size of logo.png is 275×55, so the wordmark is exactly 5:1. */
const LOGO_ASPECT = 275 / 55;
const LOGO_HEIGHT = 30;

const FES_TEAL_START = "#00bfb5";
const FES_TEAL_END = "#009f9a";
const FES_BLUE = "#0069a6";
const FES_BLUE_LIGHT = "#0081c8";

interface QuickAccessItem {
  id: string;
  label: string;
  icon: IconName;
  route: string;
}

/** The four menu destinations that are not promoted into feed sections. */
const QUICK_ACCESS: QuickAccessItem[] = [
  { id: "investigators", label: "Investigators", icon: "users", route: "/investigators" },
  { id: "supporting-resources", label: "Resources", icon: "life-buoy", route: "/supporting-resources" },
  { id: "equipment-inventory", label: "Inventory", icon: "package", route: "/equipment-inventory" },
  { id: "tuesdays", label: "Tuesdays", icon: "edit-3", route: "/tuesdays" },
];

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.selectionAsync().catch(() => undefined);
  }
}

function go(route: string) {
  haptic();
  router.push(route as never);
}

export default function MenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { zoomFrom } = useZoomTransition();

  const newsQuery = useQuery({
    queryKey: ["news", "home-featured", NEWS_FEED_QUERY_VERSION],
    queryFn: () => fetchNewsPage(1),
    staleTime: 5 * 60 * 1000,
  });
  const newsItems = (newsQuery.data?.items ?? []).slice(0, 6);

  const eventsQuery = useQuery({
    queryKey: calendarEventsListQueryKey,
    queryFn: fetchEvents,
    staleTime: 5 * 60 * 1000,
  });
  const upcoming = (eventsQuery.data?.events ?? []).slice(0, 6);
  const eventsStale = eventsQuery.data?.stale === true;

  const onPressContact = async () => {
    haptic();
    const ok = await openMailtoDraft({ to: PROJECT_REVIEW_CONTACT.email });
    if (!ok) {
      Alert.alert(
        "Mail unavailable",
        `Couldn't open your mail app. Add an email account, or email ${PROJECT_REVIEW_CONTACT.name} directly at ${PROJECT_REVIEW_CONTACT.email}.`,
      );
    }
  };

  const openWebsite = async () => {
    try {
      await WebBrowser.openBrowserAsync(FESCENTER_SITE_ORIGIN, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.primary,
        controlsColor: "#FFFFFF",
      });
    } catch {
      Linking.openURL(FESCENTER_SITE_ORIGIN).catch(() => undefined);
    }
  };

  /** Confirms before leaving the app for the public website. */
  const onPressLogo = () => {
    haptic();
    const title = `Visit ${FESCENTER_SITE_HOSTNAME}?`;
    const body = "Opens the Cleveland FES Center website inside the app.";

    if (isWeb) {
      // Alert.alert is a no-op on react-native-web.
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${body}`)) {
        void openWebsite();
      }
      return;
    }

    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Visit", onPress: () => void openWebsite() },
    ]);
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: (isWeb ? 36 : insets.top) + 8,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <DateWidget
            onPress={(anchor) => {
              haptic();
              zoomFrom(anchor, () => router.push("/fes-calendar" as never));
            }}
          />
        </View>
        <View style={styles.logoSlot}>
          <Pressable
            onPress={onPressLogo}
            // Vertical only — widening this would put the blank space beside
            // the wordmark back inside the tap target.
            hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
            accessibilityRole="button"
            accessibilityLabel={`Visit the Cleveland FES Center website at ${FESCENTER_SITE_HOSTNAME}`}
            style={({ pressed }) => [styles.logoBtn, pressed && { opacity: 0.6 }]}
          >
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          </Pressable>
        </View>
        <View style={styles.headerSide}>
          <HamburgerButton />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (isWeb ? 24 : insets.bottom) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Latest News ---------- */}
        <SectionHeader
          icon="rss"
          title="Latest News"
          onSeeAll={() => go("/news")}
        />
        <NewsCarousel
          items={newsItems}
          loading={newsQuery.isLoading}
          error={newsQuery.isError}
        />

        {/* ---------- Upcoming Events ---------- */}
        <SectionHeader
          icon="calendar"
          title="Upcoming Events"
          onSeeAll={() => go("/events")}
          spaced
        />

        {eventsStale ? <StaleNotice /> : null}

        {eventsQuery.isLoading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : upcoming.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {eventsQuery.isError
              ? "Events are unavailable right now."
              : "No upcoming events."}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.eventsScroll}
            contentContainerStyle={styles.eventsScrollContent}
          >
            {upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() =>
                  router.push({
                    pathname: "/events/[id]",
                    params: { id: event.id },
                  })
                }
              />
            ))}
          </ScrollView>
        )}

        {/* ---------- Quick Access ---------- */}
        <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>
          Quick Access
        </Text>
        <View style={styles.quickGrid}>
          {QUICK_ACCESS.map((item) => (
            <QuickAccessButton
              key={item.id}
              item={item}
              onPress={() => go(item.route)}
            />
          ))}
        </View>

        {/* ---------- Contact CTA ---------- */}
        <Pressable
          onPress={onPressContact}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={({ pressed }) => [
            styles.ctaBar,
            { shadowColor: colors.primary },
            pressed ? styles.pressed : null,
          ]}
          testID="menu-cta-bar"
        >
          <LinearGradient
            colors={[FES_BLUE, FES_BLUE_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaBlurb}>{PROJECT_REVIEW_CONTACT.blurb}</Text>
            <Text style={styles.ctaCta}>{PROJECT_REVIEW_CONTACT.cta}</Text>
          </View>
          <View style={styles.ctaIconCircle}>
            <Feather name="mail" size={20} color="#FFFFFF" />
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Section pieces                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon,
  title,
  onSeeAll,
  spaced,
}: {
  icon: IconName;
  title: string;
  onSeeAll: () => void;
  /** Adds top spacing when the section follows earlier content. */
  spaced?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.sectionHeader, spaced ? styles.sectionHeaderSpaced : null]}>
      <View style={styles.sectionHeaderLeft}>
        <Feather name={icon} size={15} color={colors.secondary} />
        <Text style={[styles.sectionLabelText, { color: colors.secondary }]}>
          {title}
        </Text>
      </View>
      <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAll}>
        <Text style={[styles.seeAllText, { color: colors.primary }]}>
          See all
        </Text>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

/**
 * Instagram-style swipeable carousel of the latest news items, with page dots.
 * Falls back to a single card (no paging/dots) when only one item exists.
 */
function NewsCarousel({
  items,
  loading,
  error,
}: {
  items: NewsItem[];
  loading: boolean;
  error: boolean;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  // scrollContent has 20px horizontal padding on each side.
  const cardWidth = width - 40;
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const activeRef = useRef(0);
  // Suppress auto-advance while the user is touching the carousel.
  const interactingRef = useRef(false);

  const paged = items.length > 1;

  const setActiveIndex = (i: number) => {
    activeRef.current = i;
    setActive(i);
  };

  // Auto-advance one card every few seconds; loops back to the first.
  useEffect(() => {
    if (!paged || cardWidth <= 0) return;
    const id = setInterval(() => {
      if (interactingRef.current) return;
      const next = (activeRef.current + 1) % items.length;
      scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
      setActiveIndex(next);
    }, 4500);
    return () => clearInterval(id);
  }, [paged, cardWidth, items.length]);

  if (loading) {
    return (
      <View
        style={[
          styles.newsCard,
          styles.newsCardPlaceholder,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || items.length === 0) {
    return (
      <View
        style={[
          styles.newsCard,
          styles.newsCardPlaceholder,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="wifi-off" size={22} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Couldn’t load news.
        </Text>
      </View>
    );
  }

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    interactingRef.current = false;
    if (idx !== activeRef.current) setActiveIndex(idx);
  };

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={paged}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          interactingRef.current = true;
        }}
        onMomentumScrollEnd={onMomentumEnd}
        style={{ width: cardWidth }}
        decelerationRate="fast"
      >
        {items.map((item) => (
          <NewsCard key={item.id} item={item} width={cardWidth} />
        ))}
      </ScrollView>

      {paged ? (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                i === active
                  ? { backgroundColor: colors.primary, width: 18 }
                  : { backgroundColor: colors.border },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NewsCard({ item, width }: { item: NewsItem; width: number }) {
  const colors = useColors();

  const category = item.categories?.[0];
  const dateLine = new Date(item.date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const excerpt = item.excerpt.replace(/\s*\[…\]\s*$/, "…").trim();

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/news/[id]", params: { id: String(item.id) } })
      }
      style={({ pressed }) => [
        styles.newsCard,
        { width },
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.primary,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.newsHero}>
        {item.featuredImageUrl ? (
          <Image
            source={item.featuredImageUrl}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient
            colors={["#E4EEF1", "#D3E2E7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          >
            <View style={styles.newsHeroIcon}>
              <Feather name="rss" size={44} color="rgba(0,105,166,0.28)" />
            </View>
          </LinearGradient>
        )}
        {category ? (
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Text style={styles.badgeText}>{category.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.newsBody}>
        <Text style={[styles.newsDate, { color: colors.mutedForeground }]}>
          {dateLine}
        </Text>
        <Text style={[styles.newsTitle, { color: colors.foreground }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text
          style={[styles.newsExcerpt, { color: colors.mutedForeground }]}
          numberOfLines={3}
        >
          {excerpt}
        </Text>
        <View style={styles.readRow}>
          <Text style={[styles.readText, { color: colors.primary }]}>
            Read article
          </Text>
          <Feather name="chevron-right" size={16} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function EventCard({
  event,
  onPress,
}: {
  event: CalendarEvent;
  onPress: () => void;
}) {
  const colors = useColors();
  const d = new Date(event.start);
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  const time = event.allDay
    ? "All day"
    : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.eventCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <LinearGradient
        colors={[FES_BLUE, FES_BLUE_LIGHT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.eventDateBadge}
      >
        <Text style={styles.eventBadgeWeekday}>{weekday}</Text>
        <Text style={styles.eventBadgeDay}>{day}</Text>
        <Text style={styles.eventBadgeMonth}>{month}</Text>
      </LinearGradient>
      <View style={styles.eventCardBody}>
        <Text
          style={[styles.eventCardTitle, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {event.title}
        </Text>
        <Text style={[styles.eventCardTime, { color: colors.mutedForeground }]}>
          {time}
        </Text>
        <View style={styles.readRow}>
          <Text style={[styles.eventDetails, { color: colors.primary }]}>
            Details
          </Text>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function QuickAccessButton({
  item,
  onPress,
}: {
  item: QuickAccessItem;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.18)" }}
      style={({ pressed }) => [
        styles.quickBtn,
        { shadowColor: colors.primary },
        pressed ? styles.pressed : null,
      ]}
      testID={`quick-${item.id}`}
    >
      <LinearGradient
        colors={[FES_TEAL_START, FES_TEAL_END]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.quickHighlight} />
      <View style={styles.quickIconCircle}>
        <Feather name={item.icon} size={20} color="#FFFFFF" />
      </View>
      <Text
        style={styles.quickBtnLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */

const HEADER_SIDE = 44;
const EVENT_CARD_WIDTH = 264;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
    minHeight: 50,
  },
  headerSide: {
    width: HEADER_SIDE,
    alignItems: "flex-end",
  },
  /** Centres the logo in the header without making the whole gap tappable. */
  logoSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBtn: {
    height: LOGO_HEIGHT,
    // Sized to the artwork's own 5:1 ratio, so the button is the wordmark and
    // nothing more — `contain` would otherwise letterbox it inside a wider box.
    aspectRatio: LOGO_ASPECT,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Section header (LATEST NEWS / UPCOMING EVENTS + See all)
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeaderSpaced: {
    marginTop: 26,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionLabelText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Featured news card
  newsCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  newsCardPlaceholder: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  newsHero: {
    height: 150,
    justifyContent: "flex-end",
  },
  newsHeroIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    color: "#FFFFFF",
  },
  newsBody: {
    padding: 16,
    gap: 6,
  },
  newsDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  newsTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    lineHeight: 24,
  },
  newsExcerpt: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  readRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 6,
  },
  readText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },

  // News carousel page dots
  dots: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Events section
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  seeAllText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  inlineLoading: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  eventsScroll: {
    marginHorizontal: -20,
  },
  eventsScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  eventCard: {
    width: EVENT_CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  eventDateBadge: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  eventBadgeWeekday: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.85)",
  },
  eventBadgeDay: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    lineHeight: 30,
    color: "#FFFFFF",
  },
  eventBadgeMonth: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.85)",
  },
  eventCardBody: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    gap: 3,
  },
  eventCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    lineHeight: 20,
  },
  eventCardTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  eventDetails: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },

  // Quick access
  quickLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 26,
    marginBottom: 12,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickBtn: {
    width: "47%",
    flexGrow: 1,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  quickHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnLabel: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },

  // Contact CTA
  ctaBar: {
    marginTop: 26,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ctaBlurb: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.88)",
    marginBottom: 3,
  },
  ctaCta: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
