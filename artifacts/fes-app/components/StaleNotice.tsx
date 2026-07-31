import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Shown when the API served cached calendar data because the upstream feed
 * was unreachable (e.g. Google rate-limiting). The events are still valid —
 * just not freshly fetched — so this is an advisory, not an error.
 */
export function StaleNotice({ style }: { style?: object }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.muted, borderColor: colors.border },
        style,
      ]}
      accessibilityRole="alert"
    >
      <Feather name="clock" size={14} color={colors.mutedForeground} />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        Showing saved events — couldn’t reach the calendar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  text: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    lineHeight: 17,
  },
});
