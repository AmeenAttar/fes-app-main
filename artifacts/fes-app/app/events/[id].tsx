import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FES_GOOGLE_CALENDAR_WEB_URL } from "@/constants/fes-google-calendar-web";
import { useColors } from "@/hooks/useColors";
import { addEventToCalendar } from "@/lib/add-to-calendar";
import {
  calendarEventDetailQueryKey,
  calendarEventsListQueryKey,
  fetchEventById,
  type CalendarEvent,
  type EventActionLinkKind,
  type EventsResult,
} from "@/lib/api";

function hasRsvpLink(event: CalendarEvent): boolean {
  return (
    !!event.addEventUrl ||
    (event.actionLinks?.some((l) => l.kind === "rsvp") ?? false)
  );
}

function actionLinkFeatherIcon(
  kind: EventActionLinkKind,
): React.ComponentProps<typeof Feather>["name"] {
  switch (kind) {
    case "rsvp":
      return "calendar";
    case "meet":
    case "zoom":
    case "livestream":
      return "video";
    default:
      return "external-link";
  }
}

function actionLinkLabel(kind: EventActionLinkKind): string {
  switch (kind) {
    case "rsvp":
      return "RSVP & add to calendar";
    case "meet":
      return "Join Google Meet";
    case "zoom":
      return "Join Zoom";
    case "livestream":
      return "Watch livestream";
    default:
      return "Open link";
  }
}

function formatEventWhen(event: CalendarEvent): string {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;

  if (event.allDay) {
    const day = start.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (end && !Number.isNaN(end.getTime())) {
      const endDay = end.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      return `${day} → ${endDay}`;
    }
    return day;
  }

  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startT = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (end && !Number.isNaN(end.getTime())) {
    const endT = end.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateStr}\n${startT} – ${endT}`;
  }
  return `${dateStr}\n${startT}`;
}

export default function EventDetailScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = params.id;
  const eventId = Array.isArray(rawId) ? rawId[0] : rawId;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: calendarEventDetailQueryKey(eventId ?? ""),
    queryFn: async () => {
      if (!eventId) throw new Error("Missing event id");
      const listResult = queryClient.getQueryData<EventsResult>(
        calendarEventsListQueryKey,
      );
      const fromList = listResult?.events.find((e) => e.id === eventId);
      try {
        return await fetchEventById(eventId);
      } catch (e) {
        if (fromList) return fromList;
        throw e;
      }
    },
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });

  const [addState, setAddState] = useState<"idle" | "working" | "saved">(
    "idle",
  );

  const onAddToCalendar = async () => {
    if (!data || addState === "working") return;
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => undefined);
    setAddState("working");
    const result = await addEventToCalendar(data);
    setAddState(result.status === "saved" ? "saved" : "idle");

    if (result.status === "unsupported" || result.status === "error") {
      Alert.alert("Couldn’t add to calendar", result.message);
    }
  };

  const openInBrowser = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: colors.primary,
        controlsColor: "#FFFFFF",
      });
    } catch {
      Linking.openURL(url).catch(() => undefined);
    }
  };

  if (!eventId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.dim, { color: colors.mutedForeground }]}>
          Missing event.
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
          Couldn’t load this event
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

  const actionLinks = data.actionLinks ?? [];
  const showActionLinks = actionLinks.length > 0;
  const rsvpPresent = hasRsvpLink(data);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.when, { color: colors.secondary }]}>
        {formatEventWhen(data)}
      </Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {data.title}
      </Text>

      {data.location ? (
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={16} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {data.location}
          </Text>
        </View>
      ) : null}

      {data.description ? (
        <Text style={[styles.body, { color: colors.foreground }]}>
          {data.description}
        </Text>
      ) : null}

      <Pressable
        onPress={onAddToCalendar}
        disabled={addState === "working"}
        accessibilityRole="button"
        accessibilityLabel={
          addState === "saved"
            ? "Added to your calendar. Tap to add again."
            : `Add ${data.title} to your calendar`
        }
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: colors.primary,
            borderRadius: colors.radius,
            opacity: pressed || addState === "working" ? 0.85 : 1,
          },
        ]}
      >
        {addState === "working" ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Feather
              name={addState === "saved" ? "check" : "calendar"}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.ctaText}>
              {addState === "saved" ? "Added to calendar" : "Add to my calendar"}
            </Text>
          </>
        )}
      </Pressable>

      {showActionLinks ? (
        <>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {rsvpPresent
              ? "An AddEvent RSVP page was detected in this event’s description — tap below to open links in your browser."
              : "These links appeared in this event’s description — tap below to open in your browser."}
          </Text>
          <View style={styles.actionLinksStack}>
            {actionLinks.map((link) =>
              link.kind === "rsvp" ? (
                <Pressable
                  key={`${link.kind}-${link.url}`}
                  onPress={() => openInBrowser(link.url)}
                  style={({ pressed }) => [
                    styles.cta,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: colors.radius,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={actionLinkFeatherIcon(link.kind)}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.ctaText}>
                    {actionLinkLabel(link.kind)}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  key={`${link.kind}-${link.url}`}
                  onPress={() => openInBrowser(link.url)}
                  style={({ pressed }) => [
                    styles.secondaryCta,
                    {
                      borderColor: colors.primary,
                      borderRadius: colors.radius,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={actionLinkFeatherIcon(link.kind)}
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.secondaryCtaText, { color: colors.primary }]}
                  >
                    {actionLinkLabel(link.kind)}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        </>
      ) : (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          No RSVP or other links appear in this event’s calendar description.
          You can still open the shared FES calendar below.
        </Text>
      )}

      <Pressable
        onPress={() => openInBrowser(FES_GOOGLE_CALENDAR_WEB_URL)}
        style={({ pressed }) => [
          styles.secondaryCta,
          {
            borderColor: colors.primary,
            borderRadius: colors.radius,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <Feather name="calendar" size={18} color={colors.primary} />
        <Text style={[styles.secondaryCtaText, { color: colors.primary }]}>
          Open shared Google Calendar
        </Text>
      </Pressable>

      {Platform.OS === "ios" && rsvpPresent ? (
        <Text style={[styles.iosNote, { color: colors.mutedForeground }]}>
          In Safari, use the Share button if AddEvent offers “Add to Calendar”.
        </Text>
      ) : null}
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
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  when: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    lineHeight: 18,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  metaText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 21,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  actionLinksStack: {
    gap: 10,
    marginTop: 4,
  },
  cta: {
    marginTop: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  ctaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 0,
    borderWidth: 1,
  },
  secondaryCtaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  iosNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
