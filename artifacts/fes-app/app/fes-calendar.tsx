import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { ZoomInView, type ZoomInHandle } from "@/components/ZoomTransition";
import { FES_GOOGLE_CALENDAR_WEB_URL } from "@/constants/fes-google-calendar-web";
import { useColors } from "@/hooks/useColors";
import {
  buildDayEventCount,
  getEventsForLocalDay,
  getMonthGrid,
  localDateKey,
  type MonthGridCell,
  weekdayHeaderLabels,
} from "@/lib/calendar-utils";
import {
  calendarEventsListQueryKey,
  fetchEvents,
  type CalendarEvent,
} from "@/lib/api";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return localDateKey(a) === localDateKey(b);
}

function isTodayLocal(d: Date): boolean {
  return isSameLocalDay(d, new Date());
}

/** Two-digit day (01–31) in the month grid. */
function formatGridDayNumber(d: Date): string {
  return String(d.getDate()).padStart(2, "0");
}

function addCalendarMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

type Colors = ReturnType<typeof useColors>;

interface CalendarMonthPageProps {
  pageYear: number;
  pageMonth: number;
  pagerWidth: number;
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  setViewYear: React.Dispatch<React.SetStateAction<number>>;
  setViewMonth: React.Dispatch<React.SetStateAction<number>>;
  dayCounts: Map<string, number>;
  colors: Colors;
}

function CalendarMonthPage({
  pageYear,
  pageMonth,
  pagerWidth,
  selectedDate,
  setSelectedDate,
  setViewYear,
  setViewMonth,
  dayCounts,
  colors,
}: CalendarMonthPageProps) {
  const grid = useMemo(
    () => getMonthGrid(pageYear, pageMonth),
    [pageYear, pageMonth],
  );

  const gridRows = useMemo(() => {
    const rows: MonthGridCell[][] = [];
    for (let i = 0; i < grid.length; i += 7) {
      rows.push(grid.slice(i, i + 7));
    }
    return rows;
  }, [grid]);

  return (
    <View style={{ width: pagerWidth }}>
      <View style={styles.weekdayRow}>
        {weekdayHeaderLabels().map((label) => (
          <Text
            key={label}
            style={[styles.weekdayHead, { color: colors.mutedForeground }]}
          >
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {gridRows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((cell, ci) => {
              const key = localDateKey(cell.date);
              const count = dayCounts.get(key) ?? 0;
              const selected = isSameLocalDay(cell.date, selectedDate);
              const todayCell = isTodayLocal(cell.date);
              const hasEvents = count > 0;

              let borderW = 1;
              let borderC = colors.border;
              if (selected) {
                borderW = 2;
                borderC = colors.primary;
              } else if (todayCell) {
                borderW = 2;
                borderC = colors.secondary;
              } else if (cell.inCurrentMonth) {
                borderW = 1.5;
                borderC = colors.secondary;
              }

              let bg: string;
              if (selected) {
                bg = `${colors.primary}18`;
              } else if (!cell.inCurrentMonth) {
                bg = `${colors.muted}AA`;
              } else if (hasEvents) {
                bg = `${colors.secondary}24`;
              } else {
                bg = colors.card;
              }

              return (
                <Pressable
                  key={`${key}-${ri}-${ci}`}
                  onPress={() => {
                    setSelectedDate(startOfLocalDay(cell.date));
                    if (!cell.inCurrentMonth) {
                      setViewYear(cell.date.getFullYear());
                      setViewMonth(cell.date.getMonth());
                    }
                  }}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      borderWidth: borderW,
                      borderColor: borderC,
                      backgroundColor: bg,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${cell.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}${count > 0 ? `, ${count} events` : ", no events"}`}
                >
                  <Text
                    style={[
                      styles.cellDay,
                      {
                        color: cell.inCurrentMonth
                          ? colors.foreground
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {formatGridDayNumber(cell.date)}
                  </Text>
                  {hasEvents ? (
                    <View
                      style={[
                        styles.eventBadge,
                        { backgroundColor: colors.secondary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.eventBadgeText,
                          { color: colors.secondaryForeground },
                        ]}
                      >
                        {count > 99 ? "99+" : String(count)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.eventBadgePlaceholder} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function MonthNavChevron({
  direction,
  onPress,
}: {
  direction: "prev" | "next";
  onPress: () => void;
}) {
  const colors = useColors();
  const tint = colors.scheme === "dark" ? "dark" : "light";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        direction === "prev" ? "Previous month" : "Next month"
      }
      hitSlop={10}
      style={({ pressed }) => [
        styles.glassCircleBtn,
        {
          borderColor: colors.secondary,
          opacity: pressed ? 0.85 : 1,
          ...Platform.select({
            ios: {
              shadowColor: colors.secondary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.28,
              shadowRadius: 8,
            },
            android: { elevation: 4 },
          }),
        },
      ]}
    >
      {Platform.OS !== "web" ? (
        <BlurView
          tint={tint}
          intensity={colors.scheme === "dark" ? 38 : 30}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor:
                colors.scheme === "dark"
                  ? "rgba(20,57,82,0.58)"
                  : "rgba(245,248,249,0.78)",
            },
          ]}
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: `${colors.secondary}1F`,
            borderRadius: 26,
          },
        ]}
      />
      <View style={styles.glassIconLayer}>
        <Feather
          name={direction === "prev" ? "chevron-left" : "chevron-right"}
          size={30}
          color={colors.secondary}
        />
      </View>
    </Pressable>
  );
}

/**
 * Unfolds from the header date pill when opened from the home screen. Presented
 * as a transparent modal, so the home screen stays visible behind the scale —
 * the header lives inside {@link ZoomInView} so it grows with the content.
 */
export default function FesCalendarScreen() {
  const colors = useColors();
  const zoomRef = useRef<ZoomInHandle>(null);

  // Mirrors the nav drawer: collapse back into the date pill, then pop.
  const goBack = useCallback(() => {
    zoomRef.current?.collapse(() => router.back());
  }, []);

  return (
    <ZoomInView ref={zoomRef} style={{ backgroundColor: colors.background }}>
      <AppHeader
        options={{ title: "FES Calendar" }}
        back={{}}
        navigation={{ goBack }}
      />
      <View style={{ flex: 1 }}>
        <FesCalendarContent />
      </View>
    </ZoomInView>
  );
}

function FesCalendarContent() {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const pagerWidth = Math.max(0, windowWidth - 32);
  const monthPagerRef = useRef<ScrollView>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(today));

  const viewYMRef = useRef({ year: viewYear, month: viewMonth });
  viewYMRef.current = { year: viewYear, month: viewMonth };

  const arrowPagerSnapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: calendarEventsListQueryKey,
    queryFn: fetchEvents,
    staleTime: 5 * 60 * 1000,
  });

  const events = data?.events ?? [];
  const dayCounts = useMemo(() => buildDayEventCount(events), [events]);

  const dayEvents = useMemo(
    () => getEventsForLocalDay(events, selectedDate),
    [events, selectedDate],
  );

  const monthTitle = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth],
  );

  const openGoogleCalendar = async () => {
    try {
      await WebBrowser.openBrowserAsync(FES_GOOGLE_CALENDAR_WEB_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.primary,
        controlsColor: "#FFFFFF",
      });
    } catch {
      Linking.openURL(FES_GOOGLE_CALENDAR_WEB_URL).catch(() => undefined);
    }
  };

  const goMonth = useCallback((delta: number) => {
    const { year, month } = viewYMRef.current;
    const d = new Date(year, month + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, []);

  const scrollMonthPagerAnimated = useCallback(
    (delta: -1 | 1) => {
      if (pagerWidth <= 0) return;
      if (arrowPagerSnapRef.current !== null) {
        clearTimeout(arrowPagerSnapRef.current);
        arrowPagerSnapRef.current = null;
      }
      const pw = pagerWidth;
      const targetX = delta === -1 ? 0 : 2 * pw;
      monthPagerRef.current?.scrollTo({ x: targetX, animated: true });
      arrowPagerSnapRef.current = setTimeout(() => {
        arrowPagerSnapRef.current = null;
        goMonth(delta);
      }, 340);
    },
    [pagerWidth, goMonth],
  );

  const onMonthPagerMomentumEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (pagerWidth <= 0) return;
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / pagerWidth);
    if (idx === 0 || idx === 2) {
      if (arrowPagerSnapRef.current !== null) {
        clearTimeout(arrowPagerSnapRef.current);
        arrowPagerSnapRef.current = null;
      }
      if (idx === 0) goMonth(-1);
      else goMonth(1);
    }
  };

  useEffect(() => {
    return () => {
      if (arrowPagerSnapRef.current !== null) {
        clearTimeout(arrowPagerSnapRef.current);
        arrowPagerSnapRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (pagerWidth <= 0 || isLoading || isError) return;
    const id = requestAnimationFrame(() => {
      monthPagerRef.current?.scrollTo({
        x: pagerWidth,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [viewYear, viewMonth, pagerWidth, isLoading, isError]);

  const goToday = () => {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth());
    setSelectedDate(startOfLocalDay(n));
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.dim, { color: colors.mutedForeground }]}>
          Loading calendar…
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
          Couldn’t load events
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

  const prevYM = addCalendarMonth(viewYear, viewMonth, -1);
  const nextYM = addCalendarMonth(viewYear, viewMonth, 1);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.listContent}
      nestedScrollEnabled
      data={dayEvents}
      keyExtractor={(e) => e.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <View style={styles.monthRow}>
            <View style={styles.monthNavSide}>
              <MonthNavChevron
                direction="prev"
                onPress={() => scrollMonthPagerAnimated(-1)}
              />
            </View>
            <Text
              style={[styles.monthTitle, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {monthTitle}
            </Text>
            <View style={styles.monthNavSide}>
              <MonthNavChevron
                direction="next"
                onPress={() => scrollMonthPagerAnimated(1)}
              />
            </View>
          </View>

          <Pressable
            onPress={goToday}
            style={({ pressed }) => [
              styles.todayChip,
              {
                borderColor: colors.secondary,
                backgroundColor: `${colors.secondary}14`,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
          >
            <Text style={[styles.todayChipText, { color: colors.secondary }]}>
              Today
            </Text>
          </Pressable>

          <ScrollView
            ref={monthPagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            decelerationRate="fast"
            keyboardShouldPersistTaps="handled"
            onMomentumScrollEnd={onMonthPagerMomentumEnd}
            accessibilityLabel="Swipe left or right to change month"
            style={[styles.monthPagerScroll, { width: pagerWidth }]}
          >
            <CalendarMonthPage
              pageYear={prevYM.year}
              pageMonth={prevYM.month}
              pagerWidth={pagerWidth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              setViewYear={setViewYear}
              setViewMonth={setViewMonth}
              dayCounts={dayCounts}
              colors={colors}
            />
            <CalendarMonthPage
              pageYear={viewYear}
              pageMonth={viewMonth}
              pagerWidth={pagerWidth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              setViewYear={setViewYear}
              setViewMonth={setViewMonth}
              dayCounts={dayCounts}
              colors={colors}
            />
            <CalendarMonthPage
              pageYear={nextYM.year}
              pageMonth={nextYM.month}
              pagerWidth={pagerWidth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              setViewYear={setViewYear}
              setViewMonth={setViewMonth}
              dayCounts={dayCounts}
              colors={colors}
            />
          </ScrollView>

          <Pressable
            onPress={() => void openGoogleCalendar()}
            style={({ pressed }) => [
              styles.calendarBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Feather name="external-link" size={18} color={colors.primary} />
            <Text style={[styles.calendarBtnText, { color: colors.primary }]}>
              Open in Google Calendar
            </Text>
          </Pressable>

          <Text style={[styles.agendaHeading, { color: colors.mutedForeground }]}>
            {dayEvents.length === 0
              ? "No events this day"
              : `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather name="calendar" size={28} color={colors.mutedForeground} />
          <Text style={[styles.dim, { color: colors.mutedForeground }]}>
            Tap another date or open Google Calendar.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <AgendaRow
          event={item}
          onPress={() =>
            router.push({
              pathname: "/events/[id]",
              params: { id: item.id },
            })
          }
        />
      )}
    />
  );
}

function AgendaRow({
  event,
  onPress,
}: {
  event: CalendarEvent;
  onPress: () => void;
}) {
  const colors = useColors();
  const start = new Date(event.start);
  const timeLine = event.allDay
    ? "All day"
    : start.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${timeLine}`}
      style={({ pressed }) => [
        styles.agendaCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.agendaCardInner}>
        <View style={styles.agendaTimeCol}>
          <Text style={[styles.agendaTime, { color: colors.secondary }]}>
            {timeLine}
          </Text>
        </View>
        <View style={styles.agendaTextCol}>
          <Text
            style={[styles.agendaTitle, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {event.title}
          </Text>
          {event.location ? (
            <Text
              style={[styles.agendaMeta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {event.location}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </View>
    </Pressable>
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
  dim: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  errTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  headerBlock: {
    gap: 10,
    marginBottom: 8,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 2,
  },
  monthNavSide: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: 0.3,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  glassCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glassIconLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  todayChip: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  todayChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  monthPagerScroll: {
    alignSelf: "center",
  },
  weekdayRow: {
    flexDirection: "row",
    marginTop: 4,
    gap: 4,
  },
  weekdayHead: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  grid: {
    gap: 4,
    marginTop: 4,
  },
  gridRow: {
    flexDirection: "row",
    gap: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minHeight: 40,
    maxHeight: 56,
  },
  cellDay: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  eventBadge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  eventBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.2,
  },
  eventBadgePlaceholder: {
    height: 20,
    marginTop: 3,
  },
  calendarBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  calendarBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  agendaHeading: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
  },
  agendaCard: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  agendaCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  agendaTimeCol: {
    width: 72,
    flexShrink: 0,
  },
  agendaTime: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  agendaTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  agendaTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
  agendaMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});
