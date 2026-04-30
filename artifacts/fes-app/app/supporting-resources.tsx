import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SUPPORTING_RESOURCES } from "@/constants/supporting-resources";
import { useColors } from "@/hooks/useColors";

export default function SupportingResourcesScreen() {
  const colors = useColors();

  const openEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      /* noop */
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.lead, { color: colors.mutedForeground }]}>
        Reach out to the right person for the support you need.
      </Text>

      {SUPPORTING_RESOURCES.map((cat) => (
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
          {cat.contacts.map((c, i) => (
            <Pressable
              key={`${c.email}-${i}`}
              onPress={() => openEmail(c.email)}
              style={({ pressed }) => [
                styles.contactRow,
                pressed && { opacity: 0.6 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: colors.foreground }]}>
                  {c.name}
                </Text>
                <Text style={[styles.contactEmail, { color: colors.secondary }]}>
                  {c.email}
                </Text>
              </View>
              <Feather name="mail" size={18} color={colors.secondary} />
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
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
    gap: 6,
  },
  catTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
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
    marginTop: 2,
  },
});
