import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

function formatWeekday(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" })
    .format(d)
    .toUpperCase();
}

function formatDayMonth(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatAccessibilityLabel(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/**
 * Compact date pill displayed on the left of the home-screen header,
 * mirroring the hamburger button. Non-interactive — purely informational.
 */
export function DateWidget() {
  const colors = useColors();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      const next = new Date();
      setNow((prev) =>
        prev.getDate() === next.getDate() &&
        prev.getMonth() === next.getMonth() &&
        prev.getFullYear() === next.getFullYear()
          ? prev
          : next,
      );
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: `${colors.primary}12` },
      ]}
      accessibilityRole="text"
      accessibilityLabel={formatAccessibilityLabel(now)}
    >
      <Text
        style={[styles.weekday, { color: colors.primary }]}
        numberOfLines={1}
      >
        {formatWeekday(now)}
      </Text>
      <Text
        style={[styles.dayMonth, { color: colors.primary }]}
        numberOfLines={1}
      >
        {formatDayMonth(now)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  weekday: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1,
    opacity: 0.75,
    lineHeight: 11,
  },
  dayMonth: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    lineHeight: 16,
    marginTop: 1,
  },
});
