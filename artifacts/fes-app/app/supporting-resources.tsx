import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ResourceContactModal } from "@/components/ResourceContactModal";
import {
  SUPPORTING_RESOURCES,
  type ResourceContact,
} from "@/constants/supporting-resources";
import { useColors } from "@/hooks/useColors";
import { openMailtoDraft } from "@/lib/mailto";

export default function SupportingResourcesScreen() {
  const colors = useColors();
  const [selected, setSelected] = useState<ResourceContact | null>(null);

  const quickMailto = async (c: ResourceContact) => {
    const ok = await openMailtoDraft({ to: c.email });
    if (!ok) {
      Alert.alert(
        "Mail unavailable",
        "Couldn’t open your mail app. Add an email account or try the message form (tap the name).",
      );
    }
  };

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Reach out to the right person for the support you need.
        </Text>

        {SUPPORTING_RESOURCES.map((cat) => {
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
                      <Text
                        style={[styles.contactEmail, { color: colors.secondary }]}
                      >
                        {c.email}
                      </Text>
                    </Pressable>
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
