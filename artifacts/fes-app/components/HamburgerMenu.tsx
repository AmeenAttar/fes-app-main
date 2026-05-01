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
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WeatherWidget } from "@/components/WeatherWidget";
import { MENU_BLOCKS, type MenuBlock } from "@/constants/menu";

const FES_BLUE = "#0069a6";
const FES_TEAL = "#00b2a9";

interface HamburgerButtonProps {
  /** Color of the menu icon. Defaults to FES blue. */
  color?: string;
}

export function HamburgerButton({ color = FES_BLUE }: HamburgerButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityLabel="Open navigation menu"
        style={({ pressed }) => [
          styles.btn,
          pressed && { opacity: 0.55 },
        ]}
      >
        <Feather name="menu" size={26} color={color} />
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

  const onPress = async (block: MenuBlock) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    onClose();
    // Tiny delay so the close animation begins before navigation.
    setTimeout(() => {
      if (block.kind === "internal" && block.route) {
        router.push(block.route as never);
      } else if (block.kind === "external" && block.url) {
        WebBrowser.openBrowserAsync(block.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          toolbarColor: FES_BLUE,
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

  return (
    <Modal
      visible={open}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent={false}
    >
      <View style={styles.modalOuter}>
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
              <Text style={styles.modalTitle}>MENU</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityLabel="Close menu"
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.55 },
                ]}
              >
                <Feather name="x" size={28} color="#FFFFFF" />
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
                pressed && { backgroundColor: "rgba(255,255,255,0.10)" },
              ]}
            >
              <Feather name="home" size={22} color="#FFFFFF" />
              <Text style={styles.rowLabel}>Home</Text>
              <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.55)" />
            </Pressable>

            <View style={styles.list}>
              {MENU_BLOCKS.map((block) => (
                <Pressable
                  key={block.id}
                  onPress={() => onPress(block)}
                  android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: "rgba(255,255,255,0.10)" },
                  ]}
                >
                  <Feather name={block.icon} size={22} color="#FFFFFF" />
                  <Text style={styles.rowLabel}>{block.label}</Text>
                  <Feather
                    name={block.kind === "external" ? "external-link" : "chevron-right"}
                    size={18}
                    color="rgba(255,255,255,0.55)"
                  />
                </Pressable>
              ))}
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
    backgroundColor: "rgba(0,105,166,0.07)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 2,
  },
  modalOuter: {
    flex: 1,
    backgroundColor: FES_BLUE,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  topGroup: {
    gap: 18,
  },
  bottomGroup: {
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
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    marginTop: 4,
  },
  homeRow: {
    backgroundColor: FES_TEAL,
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 8,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  rowLabel: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
