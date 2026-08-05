import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ResourceContactModal } from "@/components/ResourceContactModal";
import { type ResourceContact } from "@/constants/supporting-resources";
import { useColors } from "@/hooks/useColors";
import {
  fetchSupportingResources,
  supportingResourcesQueryKey,
} from "@/lib/api";
import { openMailtoDraft } from "@/lib/mailto";

export default function SupportingResourcesScreen() {
  const colors = useColors();
  const [selected, setSelected] = useState<ResourceContact | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: supportingResourcesQueryKey,
    queryFn: fetchSupportingResources,
    staleTime: 10 * 60 * 1000,
  });

  const categories = data ?? [];

  const quickMailto = async (c: ResourceContact) => {
    const ok = await openMailtoDraft({ to: c.email });
    if (!ok) {
      Alert.alert(
        "Mail unavailable",
        "Couldn’t open your mail app. Add an email account or try the message form (tap the name).",
      );
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, flex: 1 },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.centerHint, { color: colors.mutedForeground }]}>
          Loading contacts…
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: colors.background,
            flex: 1,
            paddingHorizontal: 32,
          },
        ]}
      >
        <Feather name="wifi-off" size={28} color={colors.mutedForeground} />
        <Text style={[styles.errTitle, { color: colors.foreground }]}>
          Couldn’t load supporting resources
        </Text>
        <Text
          style={[
            styles.centerHint,
            { color: colors.mutedForeground, textAlign: "center" },
          ]}
        >
          {error instanceof Error ? error.message : "Please try again."}
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

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Reach out to the right person for the support you need.
        </Text>

        {categories.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="inbox" size={28} color={colors.mutedForeground} />
            <Text style={[styles.errTitle, { color: colors.foreground }]}>
              No contacts listed
            </Text>
            <Text
              style={[styles.centerHint, { color: colors.mutedForeground }]}
            >
              Nothing is published on the Supporting Resources page yet.
            </Text>
          </View>
        ) : null}

        {categories.map((cat) => {
          const multi = cat.contacts.length > 1;
          return (
            <View
              key={cat.id}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[styles.catTitle, { color: colors.primary }]}>
                {cat.title}
              </Text>
              {multi ? (
                <Text
                  style={[styles.multiHint, { color: colors.mutedForeground }]}
                >
                  Tap the name to write a message, or the mail icon for a blank
                  email in your mail app.
                </Text>
              ) : null}
              <View style={styles.contactsWrap}>
                {cat.contacts.map((c, i) => (
                  <View
                    key={`${c.email}-${i}`}
                    style={[
                      styles.contactRow,
                      multi && i > 0
                        ? [
                            styles.contactRowDivider,
                            { borderTopColor: colors.border },
                          ]
                        : null,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Message ${c.name}`}
                      accessibilityHint="Opens a form, then your mail app with a draft"
                      onPress={() => setSelected(c)}
                      // Nothing to send to when the page lists a name only.
                      disabled={!c.email}
                      android_ripple={
                        Platform.OS === "android"
                          ? { color: `${colors.primary}22` }
                          : undefined
                      }
                      style={({ pressed }) => [
                        styles.contactMain,
                        pressed && Platform.OS === "ios" ? { opacity: 0.82 } : null,
                      ]}
                    >
                      <Text
                        style={[styles.contactName, { color: colors.foreground }]}
                      >
                        {c.name}
                      </Text>
                      {c.role ? (
                        <Text
                          style={[
                            styles.contactRole,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {c.role}
                        </Text>
                      ) : null}
                      {c.email ? (
                        <Text
                          style={[styles.contactEmail, { color: colors.secondary }]}
                        >
                          {c.email}
                        </Text>
                      ) : null}
                    </Pressable>
                    {c.email ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Quick email ${c.name}`}
                        accessibilityHint="Opens your mail app with only the address filled in"
                        onPress={() => void quickMailto(c)}
                        hitSlop={8}
                        android_ripple={
                          Platform.OS === "android"
                            ? { color: `${colors.secondary}33`, foreground: true }
                            : undefined
                        }
                        style={({ pressed }) => [
                          styles.quickMailBtn,
                          { backgroundColor: `${colors.secondary}1A` },
                          pressed && Platform.OS === "ios" ? { opacity: 0.85 } : null,
                        ]}
                      >
                        <Feather name="mail" size={20} color={colors.secondary} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <ResourceContactModal
        visible={selected !== null}
        contact={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  centerHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
  },
  errTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    marginTop: 8,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  emptyWrap: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  lead: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    padding: 16,
    paddingBottom: 14,
  },
  catTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  multiHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  contactsWrap: {
    gap: 0,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  contactRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    paddingTop: 14,
  },
  contactMain: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingRight: 4,
  },
  contactName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
  contactRole: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  contactEmail: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  quickMailBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
});
