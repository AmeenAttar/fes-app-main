import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WeatherWidget } from "@/components/WeatherWidget";
import { MENU_BLOCKS, type MenuBlock } from "@/constants/menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";

interface HamburgerButtonProps {
  /** Overrides resolved theme primary tint for the icon. */
  color?: string;
}

export function HamburgerButton({ color }: HamburgerButtonProps) {
  const colors = useColors();
  const iconColor = color ?? colors.primary;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityLabel="Open navigation menu"
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: `${colors.primary}12` },
          pressed && { opacity: 0.55 },
        ]}
      >
        <Feather name="menu" size={26} color={iconColor} />
      </Pressable>
      <NavMenuModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface NavMenuModalProps {
  open: boolean;
  onClose: () => void;
}

function NavMenuModal({ open, onClose }: NavMenuModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { scheme, setScheme } = useTheme();
  const isDark = scheme === "dark";

  const onPress = async (block: MenuBlock) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    onClose();
    setTimeout(() => {
      if (block.kind === "internal" && block.route) {
        router.push(block.route as never);
      } else if (block.kind === "external" && block.url) {
        WebBrowser.openBrowserAsync(block.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          toolbarColor: colors.primary,
          controlsColor: "#FFFFFF",
        }).catch(() => undefined);
      }
    }, 80);
  };

  const onPressHome = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    onClose();
    setTimeout(() => {
      router.replace("/menu");
    }, 80);
  };

  const fg = colors.menuDrawerForeground;
  const muted = colors.menuDrawerMutedForeground;
  const border = colors.menuDrawerBorder;

  return (
    <Modal
      visible={open}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent={false}
    >
      <View
        style={[styles.modalOuter, { backgroundColor: colors.menuDrawerBackground }]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 14,
              paddingBottom: insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topGroup}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: fg }]}>MENU</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityLabel="Close menu"
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.55 },
                ]}
              >
                <Feather name="x" size={28} color={fg} />
              </Pressable>
            </View>

            <WeatherWidget />
          </View>

          <View style={styles.bottomGroup}>
            <Pressable
              onPress={onPressHome}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => [
                styles.row,
                styles.homeRow,
                {
                  backgroundColor: colors.menuHomeHighlight,
                  borderBottomColor: "transparent",
                },
                pressed && { opacity: 0.92 },
              ]}
            >
              <Feather name="home" size={22} color="#FFFFFF" />
              <Text style={[styles.rowLabel, { color: "#FFFFFF" }]}>Home</Text>
              <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>

            {MENU_BLOCKS.map((block) => (
              <Pressable
                key={block.id}
                onPress={() => onPress(block)}
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: border },
                  pressed && { backgroundColor: "rgba(255,255,255,0.08)" },
                ]}
              >
                <Feather name={block.icon} size={22} color={fg} />
                <Text style={[styles.rowLabel, { color: fg }]}>{block.label}</Text>
                <Feather
                  name={block.kind === "external" ? "external-link" : "chevron-right"}
                  size={18}
                  color={muted}
                />
              </Pressable>
            ))}

            <View style={[styles.themeRow, { borderTopColor: border }]}>
              <View
                style={[
                  styles.themeCluster,
                  {
                    backgroundColor:
                      scheme === "dark"
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(0, 35, 58, 0.45)",
                  },
                ]}
              >
                <Feather name={isDark ? "moon" : "sun"} size={18} color={fg} />
                <Text style={[styles.themeLabel, { color: fg }]}>
                  Appearance
                </Text>
                <Switch
                  accessibilityRole="switch"
                  accessibilityLabel="Appearance"
                  accessibilityHint={
                    isDark
                      ? "Turn off to use light colors across the app"
                      : "Turn on to use dark colors across the app"
                  }
                  value={isDark}
                  onValueChange={(on) => setScheme(on ? "dark" : "light")}
                  trackColor={{
                    false:
                      scheme === "dark"
                        ? "rgba(255,255,255,0.35)"
                        : "rgba(0, 28, 48, 0.95)",
                    true: colors.menuHomeHighlight,
                  }}
                  thumbColor="#f8fafc"
                  ios_backgroundColor={
                    scheme === "dark"
                      ? "rgba(255,255,255,0.28)"
                      : "rgba(0, 28, 48, 0.92)"
                  }
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 2,
  },
  modalOuter: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  topGroup: {
    gap: 18,
  },
  bottomGroup: {
    marginTop: 18,
    gap: 0,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 4,
  },
  homeRow: {
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 4,
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 8,
    gap: 16,
    borderBottomWidth: 1,
  },
  rowLabel: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  themeRow: {
    alignItems: "center",
    paddingTop: 16,
    marginTop: 10,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  themeCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    maxWidth: "100%",
  },
  themeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
