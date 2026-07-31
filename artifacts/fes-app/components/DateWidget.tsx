import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { measureAnchor, type AnchorRect } from "@/components/ZoomTransition";
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

export interface DateWidgetProps {
  /**
   * When set, the pill is a button (e.g. opens the FES calendar screen).
   * Receives the pill's on-screen rect so the destination can be animated
   * as if it unfolds from this control (null if it could not be measured).
   */
  onPress?: (anchor: AnchorRect | null) => void;
}

/**
 * Compact date pill on the left of the home-screen header, mirroring the
 * hamburger button. Pass `onPress` to make it open the FES calendar.
 */
export function DateWidget({ onPress }: DateWidgetProps) {
  const colors = useColors();
  const [now, setNow] = useState(() => new Date());
  const pillRef = useRef<View>(null);

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

  const pillBg = `${colors.primary}12`;
  const inner = (
    <>
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
    </>
  );

  if (onPress) {
    return (
      <Pressable
        ref={pillRef}
        onPress={() => {
          measureAnchor(pillRef).then(onPress);
        }}
        style={({ pressed }) => [
          styles.box,
          { backgroundColor: pillBg, opacity: pressed ? 0.88 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open FES calendar. ${formatAccessibilityLabel(now)}`}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.box, { backgroundColor: pillBg }]}
      accessibilityRole="text"
      accessibilityLabel={formatAccessibilityLabel(now)}
    >
      {inner}
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
