import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { StaleNotice } from "@/components/StaleNotice";
import { FES_GOOGLE_CALENDAR_WEB_URL } from "@/constants/fes-google-calendar-web";
import { useColors } from "@/hooks/useColors";
import {
  calendarEventsListQueryKey,
  fetchEvents,
  type CalendarEvent,
} from "@/lib/api";

export default function EventsScreen() {
  const colors = useColors();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: calendarEventsListQueryKey,
    queryFn: fetchEvents,
    staleTime: 5 * 60 * 1000,
  });

  const openCalendar = async () => {
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

  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
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
      contentContainerStyle={styles.listContent}
      data={data?.events ?? []}
      keyExtractor={(e) => e.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {data?.stale ? <StaleNotice /> : null}
          <Pressable
            onPress={openCalendar}
            style={({ pressed }) => [
              styles.calendarBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.calendarBtnText, { color: colors.primary }]}>
              Open in Google Calendar
            </Text>
          </Pressable>
          <Text style={[styles.subhead, { color: colors.mutedForeground }]}>
            Tap an event for full details, RSVP, or add to calendar.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather name="calendar" size={28} color={colors.mutedForeground} />
          <Text style={[styles.dim, { color: colors.mutedForeground }]}>
            No upcoming events.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <EventRow
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

interface EventRowProps {
  event: CalendarEvent;
  onPress: () => void;
}

function EventRow({ event, onPress }: EventRowProps) {
  const colors = useColors();
  const start = new Date(event.start);

  const dateLine = event.allDay
    ? start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : `${start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })} · ${start.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}. ${dateLine}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.cardInner}>
        <View style={styles.cardText}>
          <View style={styles.dateRow}>
            <Text style={[styles.eventDate, { color: colors.secondary }]}>
              {dateLine}
            </Text>
            {event.addEventUrl ||
            event.actionLinks?.some((l) => l.kind === "rsvp") ? (
              <View style={[styles.rsvpTag, { borderColor: colors.secondary }]}>
                <Text style={[styles.rsvpTagText, { color: colors.secondary }]}>
                  RSVP
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.eventTitle, { color: colors.foreground }]}>
            {event.title}
          </Text>
          {event.location ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text
                style={[styles.metaText, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {event.location}
              </Text>
            </View>
          ) : null}
          {event.description ? (
            <Text
              style={[styles.eventDesc, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              {event.description}
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
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  headerBlock: {
    gap: 8,
    marginBottom: 4,
  },
  subhead: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  calendarBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  calendarBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  card: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  rsvpTag: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rsvpTagText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  eventDate: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  eventTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  eventDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
