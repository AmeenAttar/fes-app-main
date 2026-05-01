import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HamburgerButton } from "@/components/HamburgerMenu";
import { MENU_BLOCKS, type MenuBlock } from "@/constants/menu";
import { PROJECT_REVIEW_CONTACT } from "@/constants/supporting-resources";
import { useColors } from "@/hooks/useColors";

const LOGO = require("../assets/images/logo.png");

const FES_TEAL_START = "#00bfb5";
const FES_TEAL_END = "#009f9a";
const FES_BLUE = "#0069a6";
const FES_BLUE_LIGHT = "#0081c8";

export default function MenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const onPressBlock = async (block: MenuBlock) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    if (block.kind === "internal" && block.route) {
      router.push(block.route as never);
      return;
    }
    if (block.kind === "external" && block.url) {
      try {
        await WebBrowser.openBrowserAsync(block.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          toolbarColor: FES_BLUE,
          controlsColor: "#FFFFFF",
        });
      } catch {
        /* noop */
      }
    }
  };

  const onPressContact = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    Linking.openURL(`mailto:${PROJECT_REVIEW_CONTACT.email}`).catch(
      () => undefined,
    );
  };

  const rows: MenuBlock[][] = [
    [MENU_BLOCKS[0]!, MENU_BLOCKS[1]!],
    [MENU_BLOCKS[2]!, MENU_BLOCKS[3]!],
    [MENU_BLOCKS[4]!, MENU_BLOCKS[5]!],
  ];

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: (isWeb ? 36 : insets.top) + 8,
          paddingBottom: (isWeb ? 18 : insets.bottom) + 12,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <View style={styles.headerSide}>
          <HamburgerButton />
        </View>
      </View>

      <View style={styles.grid}>
        {rows.map((row, idx) => (
          <View key={idx} style={styles.gridRow}>
            {row.map((block) => (
              <MenuTile
                key={block.id}
                block={block}
                onPress={() => onPressBlock(block)}
              />
            ))}
          </View>
        ))}
      </View>

      <Pressable
        onPress={onPressContact}
        android_ripple={{ color: "rgba(255,255,255,0.18)" }}
        style={({ pressed }) => [
          styles.ctaBar,
          pressed ? styles.tilePressed : null,
        ]}
        testID="menu-cta-bar"
      >
        <LinearGradient
          colors={[FES_BLUE, FES_BLUE_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaBlurb}>{PROJECT_REVIEW_CONTACT.blurb}</Text>
          <Text style={styles.ctaCta}>{PROJECT_REVIEW_CONTACT.cta}</Text>
        </View>
        <View style={styles.ctaIconCircle}>
          <Feather name="mail" size={20} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

interface MenuTileProps {
  block: MenuBlock;
  onPress: () => void;
}

function MenuTile({ block, onPress }: MenuTileProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.18)" }}
      style={({ pressed }) => [
        styles.tile,
        pressed ? styles.tilePressed : null,
      ]}
      testID={`menu-tile-${block.id}`}
    >
      {/* Gradient background */}
      <LinearGradient
        colors={[FES_TEAL_START, FES_TEAL_END]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Specular highlight at top edge */}
      <View style={styles.tileHighlight} />
      {/* Icon backdrop circle */}
      <View style={styles.iconCircle}>
        <Feather name={block.icon} size={28} color="#FFFFFF" />
      </View>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {block.label}
      </Text>
    </Pressable>
  );
}

const TILE_GAP = 14;
const HEADER_SIDE = 44;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    minHeight: 50,
  },
  headerSide: {
    width: HEADER_SIDE,
    alignItems: "flex-end",
  },
  logo: {
    flex: 1,
    height: 30,
  },
  grid: {
    flex: 1,
    gap: TILE_GAP,
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
    gap: TILE_GAP,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    // iOS shadow
    shadowColor: FES_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    // Android elevation
    elevation: 6,
  },
  tileHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  tilePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  tileLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#FFFFFF",
    textAlign: "center",
  },
  ctaBar: {
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
    // iOS shadow
    shadowColor: FES_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  ctaBlurb: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.88)",
    marginBottom: 3,
  },
  ctaCta: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
