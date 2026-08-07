import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { StaleNotice } from "@/components/StaleNotice";
import { FIRST_TUESDAY_CONTACT } from "@/constants/supporting-resources";
import { useColors } from "@/hooks/useColors";
import {
  calendarEventsListQueryKey,
  fetchEvents,
  type CalendarEvent,
} from "@/lib/api";
import { openMailtoDraft } from "@/lib/mailto";

/**
 * Signing up is what the calendar entry itself specifies — nominating a speaker
 * or claiming a date goes through Cheryl Dudek. Rather than invent a form with
 * nowhere to submit, this surfaces the real dates and opens a drafted email.
 */
const SIGN_UP_SUBJECT = "First Tuesday — speaker sign-up";

function signUpBody(): string {
  return [
    `Hi ${FIRST_TUESDAY_CONTACT.name.split(" ")[0]},`,
    "",
    "I'd like to sign up for an upcoming FES Center First Tuesday.",
    "",
    "Preferred date:",
    "Talk title / topic:",
    "Name and affiliation:",
    "",
    "Thanks!",
  ].join("\n");
}

function isFirstTuesday(event: CalendarEvent): boolean {
  return /first\s+tuesday/i.test(event.title);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const d = new Date(event.start);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TuesdaysScreen() {
  const colors = useColors();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: calendarEventsListQueryKey,
    queryFn: fetchEvents,
    staleTime: 5 * 60 * 1000,
  });

  const sessions = (data?.events ?? []).filter(isFirstTuesday).slice(0, 6);
  const stale = data?.stale === true;
  const next = sessions[0];

  const openSignUp = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => undefined);
    const ok = await openMailtoDraft({
      to: FIRST_TUESDAY_CONTACT.email,
      subject: SIGN_UP_SUBJECT,
      body: signUpBody(),
    });
    if (!ok) {
      Alert.alert(
        "Mail unavailable",
        `Couldn't open your mail app. Add an email account, or email ${FIRST_TUESDAY_CONTACT.name} directly at ${FIRST_TUESDAY_CONTACT.email}.`,
      );
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.lede, { color: colors.foreground }]}>
        The FES Center meets on the first Tuesday of each month at The Fairmount
        and on Zoom, with a talk from someone in the consortium.
      </Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        To present at an upcoming session, or to nominate a speaker, email{" "}
        {FIRST_TUESDAY_CONTACT.name} with the date you have in mind.
      </Text>

      <Pressable
        onPress={openSignUp}
        accessibilityRole="button"
        accessibilityLabel={`Email ${FIRST_TUESDAY_CONTACT.name} to sign up for a First Tuesday`}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Feather name="mail" size={18} color="#FFFFFF" />
        <Text style={styles.ctaText}>Email {FIRST_TUESDAY_CONTACT.name}</Text>
      </Pressable>

      <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
        Upcoming sessions
      </Text>

      {stale ? <StaleNotice /> : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError && sessions.length === 0 ? (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="wifi-off" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Couldn’t load the schedule.
          </Text>
          <Pressable
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading the schedule"
            style={({ pressed }) => [
              styles.retry,
              { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : sessions.length === 0 ? (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="calendar" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No sessions are on the calendar yet. Email{" "}
            {FIRST_TUESDAY_CONTACT.name} and she can tell you what’s planned.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {sessions.map((event) => (
            <Pressable
              key={event.id}
              onPress={() =>
                router.push({
                  pathname: "/events/[id]",
                  params: { id: event.id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(event.start)}${
                formatTime(event) ? `, ${formatTime(event)}` : ""
              }`}
              accessibilityHint="Opens the session details, including the Zoom link"
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor:
                    event.id === next?.id ? colors.secondary : colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={styles.rowText}>
                {event.id === next?.id ? (
                  <Text style={[styles.nextTag, { color: colors.secondary }]}>
                    NEXT SESSION
                  </Text>
                ) : null}
                <Text style={[styles.rowDate, { color: colors.foreground }]}>
                  {formatDate(event.start)}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                  {formatTime(event)}
                  {event.location ? ` · ${event.location.split(",")[0]}` : ""}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
          ))}
        </View>
      )}

      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
        Tap a session for the full details, including the Zoom link and dial-in.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  lede: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    lineHeight: 25,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  cta: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 30,
    marginBottom: 12,
  },
  center: { paddingVertical: 32, alignItems: "center" },
  list: { gap: 10 },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowText: { flex: 1, gap: 3 },
  nextTag: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  rowDate: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  rowMeta: { fontFamily: "Inter_400Regular", fontSize: 13.5 },
  empty: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retry: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 20,
    marginTop: 2,
  },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  footnote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 16,
  },
});
