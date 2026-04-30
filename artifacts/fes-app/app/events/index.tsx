import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { fetchEvents, type CalendarEvent } from "@/lib/api";
import { loadAllRsvps, setRsvp, type RsvpStatus } from "@/lib/rsvp";

const CALENDAR_HTML_URL =
  "https://calendar.google.com/calendar/u/0?cid=ZmVzY2FsZW5kYXJAZmVzY2VudGVyLm9yZw";

export default function EventsScreen() {
  const colors = useColors();
  const [rsvps, setRsvps] = useState<Record<string, RsvpStatus>>({});

  useEffect(() => {
    loadAllRsvps().then((s) => setRsvps(s));
  }, []);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    staleTime: 5 * 60 * 1000,
  });

  const onSetRsvp = async (eventId: string, status: RsvpStatus) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {
        /* noop */
      });
    }
    const newStatus = rsvps[eventId] === status ? null : status;
    setRsvps((prev) => {
      const next = { ...prev };
      if (newStatus === null) delete next[eventId];
      else next[eventId] = newStatus;
      return next;
    });
    await setRsvp(eventId, newStatus);
  };

  const openCalendar = async () => {
    try {
      await WebBrowser.openBrowserAsync(CALENDAR_HTML_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.primary,
        controlsColor: "#FFFFFF",
      });
    } catch {
      Linking.openURL(CALENDAR_HTML_URL).catch(() => undefined);
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
      data={data ?? []}
      keyExtractor={(e) => e.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
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
        <EventCard
          event={item}
          status={rsvps[item.id] ?? null}
          onSetStatus={(s) => onSetRsvp(item.id, s)}
        />
      )}
    />
  );
}

interface EventCardProps {
  event: CalendarEvent;
  status: RsvpStatus;
  onSetStatus: (s: RsvpStatus) => void;
}

function EventCard({ event, status, onSetStatus }: EventCardProps) {
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
      <Text style={[styles.eventDate, { color: colors.secondary }]}>
        {dateLine}
      </Text>
      <Text style={[styles.eventTitle, { color: colors.foreground }]}>
        {event.title}
      </Text>
      {event.location ? (
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {event.location}
          </Text>
        </View>
      ) : null}
      {event.description ? (
        <Text
          style={[styles.eventDesc, { color: colors.mutedForeground }]}
          numberOfLines={3}
        >
          {event.description}
        </Text>
      ) : null}

      <View style={styles.rsvpRow}>
        <RsvpBtn
          label="Going"
          icon="check"
          active={status === "going"}
          activeColor={colors.secondary}
          onPress={() => onSetStatus("going")}
        />
        <RsvpBtn
          label="Interested"
          icon="star"
          active={status === "interested"}
          activeColor={colors.primary}
          onPress={() => onSetStatus("interested")}
        />
        <RsvpBtn
          label="Not Going"
          icon="x"
          active={status === "not-going"}
          activeColor={colors.mutedForeground}
          onPress={() => onSetStatus("not-going")}
        />
      </View>
    </View>
  );
}

interface RsvpBtnProps {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  active: boolean;
  activeColor: string;
  onPress: () => void;
}

function RsvpBtn({ label, icon, active, activeColor, onPress }: RsvpBtnProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rsvpBtn,
        {
          backgroundColor: active ? activeColor : colors.background,
          borderColor: active ? activeColor : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={13}
        color={active ? "#FFFFFF" : colors.foreground}
      />
      <Text
        style={[
          styles.rsvpBtnText,
          { color: active ? "#FFFFFF" : colors.foreground },
        ]}
      >
        {label}
      </Text>
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
  calendarBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 4,
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
    padding: 14,
    gap: 6,
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
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  eventDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  rsvpRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  rsvpBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
