import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export type ViewMode = "grid" | "list";

function isViewMode(value: unknown): value is ViewMode {
  return value === "grid" || value === "list";
}

/**
 * A grid/list preference that survives relaunches, matching how the theme
 * setting already behaves. Each screen passes its own `storageKey` so the
 * catalog and the directory can be set independently.
 */
export function useViewMode(
  storageKey: string,
  initial: ViewMode = "grid",
): [ViewMode, (next: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(initial);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((saved) => {
        if (isViewMode(saved)) setMode(saved);
      })
      .catch(() => undefined);
  }, [storageKey]);

  const change = useCallback(
    (next: ViewMode) => {
      setMode((current) => {
        if (current === next) return current;
        if (Platform.OS !== "web") {
          Haptics.selectionAsync().catch(() => undefined);
        }
        AsyncStorage.setItem(storageKey, next).catch(() => undefined);
        return next;
      });
    },
    [storageKey],
  );

  return [mode, change];
}

/** Compact two-segment control, sized to sit beside a search field. */
export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const colors = useColors();

  const segment = (target: ViewMode, icon: "grid" | "list", label: string) => {
    const active = mode === target;
    return (
      <Pressable
        onPress={() => onChange(target)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        style={[
          styles.segment,
          active ? { backgroundColor: colors.primary } : null,
        ]}
      >
        <Feather
          name={icon}
          size={16}
          color={active ? colors.primaryForeground : colors.mutedForeground}
        />
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.toggle,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      {segment("grid", "grid", "Grid view")}
      {segment("list", "list", "List view")}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  segment: {
    width: 36,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
});
