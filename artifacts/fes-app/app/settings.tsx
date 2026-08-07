import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { FESCENTER_SITE_HOSTNAME } from "@/lib/site";
import { isPushEnabled, setPushEnabled } from "@/lib/push";

export default function SettingsScreen() {
  const colors = useColors();
  const { scheme, setScheme } = useTheme();
  const isDark = scheme === "dark";

  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isPushEnabled().then(setPushOn);
  }, []);

  const onTogglePush = async (next: boolean) => {
    setBusy(true);
    setPushOn(next); // Optimistic — the switch should not lag the tap.
    try {
      await setPushEnabled(next);
    } catch {
      setPushOn(!next);
    } finally {
      setBusy(false);
    }
  };

  const version = Constants.expoConfig?.version ?? "—";
  const build =
    Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
        Notifications
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.row}>
          <Feather name="bell" size={20} color={colors.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>
              Event reminders
            </Text>
            <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>
              A reminder the day before and an hour before each FES Center event.
            </Text>
          </View>
          {pushOn === null || busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Switch
              value={pushOn}
              onValueChange={onTogglePush}
              accessibilityRole="switch"
              accessibilityLabel="Event reminders"
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor="#f8fafc"
            />
          )}
        </View>
      </View>
      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
        Turning this off removes this device from the reminder list. You can also
        manage notifications for the whole app in iOS Settings.
      </Text>

      <Text
        style={[styles.sectionLabel, { color: colors.secondary, marginTop: 28 }]}
      >
        Appearance
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.row}>
          <Feather
            name={isDark ? "moon" : "sun"}
            size={20}
            color={colors.primary}
          />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>
              Dark mode
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(on) => setScheme(on ? "dark" : "light")}
            accessibilityRole="switch"
            accessibilityLabel="Dark mode"
            trackColor={{ false: colors.border, true: colors.secondary }}
            thumbColor="#f8fafc"
          />
        </View>
      </View>

      <Text
        style={[styles.sectionLabel, { color: colors.secondary, marginTop: 28 }]}
      >
        About
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.metaRow}>
          <Text style={[styles.metaKey, { color: colors.mutedForeground }]}>
            Version
          </Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>
            {version}
            {build ? ` (${build})` : ""}
          </Text>
        </View>
        <View style={[styles.metaRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[styles.metaKey, { color: colors.mutedForeground }]}>
            Content from
          </Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>
            {FESCENTER_SITE_HOSTNAME}
          </Text>
        </View>
      </View>
      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
        Include the version number when reporting a problem.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  card: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  rowHint: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  metaKey: { fontFamily: "Inter_400Regular", fontSize: 14 },
  metaValue: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  footnote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 2,
  },
});
