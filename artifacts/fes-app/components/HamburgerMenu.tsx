import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WeatherWidget } from "@/components/WeatherWidget";
import {
  measureAnchor,
  zoomTransform,
  ZOOM_CLOSE_EASING,
  ZOOM_CLOSE_MS,
  ZOOM_OPEN_EASING,
  ZOOM_OPEN_MS,
  ZOOM_RADIUS,
  type AnchorRect,
} from "@/components/ZoomTransition";
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
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const btnRef = useRef<View>(null);

  return (
    <>
      <Pressable
        ref={btnRef}
        onPress={() => {
          // Measured before opening so the drawer can unfold from this button.
          measureAnchor(btnRef).then((rect) => {
            setAnchor(rect);
            setOpen(true);
          });
        }}
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
      <NavMenuModal
        open={open}
        anchor={anchor}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

interface NavMenuModalProps {
  open: boolean;
  /** Rect of the button that opened the drawer; it scales in and out of this. */
  anchor: AnchorRect | null;
  onClose: () => void;
}

function NavMenuModal({ open, anchor, onClose }: NavMenuModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { scheme, setScheme } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isDark = scheme === "dark";

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: ZOOM_OPEN_MS,
      easing: ZOOM_OPEN_EASING,
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  /** Collapses the drawer back into the button, then unmounts and continues. */
  const closeThen = (after?: () => void) => {
    Animated.timing(progress, {
      toValue: 0,
      duration: ZOOM_CLOSE_MS,
      easing: ZOOM_CLOSE_EASING,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      after?.();
    });
  };

  const requestClose = () => closeThen();

  const onPress = (block: MenuBlock) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    closeThen(() => {
      if (block.kind === "internal" && block.route) {
        router.push(block.route as never);
      } else if (block.kind === "external" && block.url) {
        WebBrowser.openBrowserAsync(block.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          toolbarColor: colors.primary,
          controlsColor: "#FFFFFF",
        }).catch(() => undefined);
      }
    });
  };

  const onPressHome = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    closeThen(() => router.replace("/menu"));
  };

  const fg = colors.menuDrawerForeground;
  const muted = colors.menuDrawerMutedForeground;
  const border = colors.menuDrawerBorder;

  // Falls back to the hamburger's usual top-right seat if measuring failed.
  const originRect: AnchorRect = anchor ?? {
    x: Math.max(screenW - 64, 0),
    y: 60,
    width: 44,
    height: 44,
  };

  return (
    <Modal
      visible={open}
      animationType="none"
      onRequestClose={requestClose}
      transparent
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.modalOuter,
          {
            backgroundColor: colors.menuDrawerBackground,
            borderRadius: ZOOM_RADIUS,
            opacity: progress,
            transform: zoomTransform(progress, originRect, {
              x: 0,
              y: 0,
              width: screenW,
              height: screenH,
            }),
          },
        ]}
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
                onPress={requestClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                style={({ pressed }) => [
                  styles.glassCloseBtn,
                  {
                    borderColor: "rgba(255,255,255,0.38)",
                    opacity: pressed ? 0.88 : 1,
                    ...Platform.select({
                      ios: {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                      },
                      android: { elevation: 4 },
                    }),
                  },
                ]}
              >
                {Platform.OS !== "web" ? (
                  <BlurView
                    tint={scheme === "dark" ? "dark" : "light"}
                    intensity={scheme === "dark" ? 38 : 28}
                    style={StyleSheet.absoluteFillObject}
                  />
                ) : (
                  <View
                    style={[
                      StyleSheet.absoluteFillObject,
                      {
                        backgroundColor: isDark
                          ? "rgba(6,54,84,0.65)"
                          : "rgba(0,105,166,0.45)",
                      },
                    ]}
                  />
                )}
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: "rgba(255,255,255,0.14)",
                      borderRadius: 12,
                    },
                  ]}
                />
                <View style={styles.glassCloseIconLayer}>
                  <Feather name="x" size={24} color={fg} />
                </View>
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
      </Animated.View>
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
    // Keeps content inside the rounded corners while the drawer is scaled down.
    overflow: "hidden",
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
  glassCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glassCloseIconLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
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
