import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HamburgerButton } from "@/components/HamburgerMenu";
import { useColors } from "@/hooks/useColors";

/**
 * Minimal shape we need from the react-navigation Stack header props. Avoids a
 * direct dependency on `@react-navigation/native-stack`'s types.
 */
interface AppHeaderProps {
  options: {
    title?: string;
    headerTitle?:
      | string
      | ((props: { children: string; tintColor?: string }) => React.ReactNode);
  };
  back?: { title?: string } | undefined;
  navigation: { goBack: () => void };
}

/**
 * Replacement for the default react-navigation Stack header. Uses the same
 * safe-area math as the menu page so titles always sit just below the camera
 * cutout / dynamic island, with a hamburger button on the right.
 */
export function AppHeader({ options, back, navigation }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isWeb = Platform.OS === "web";
  const title =
    typeof options.headerTitle === "string"
      ? options.headerTitle
      : (options.title ?? "");

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: (isWeb ? 36 : insets.top) + 8,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.leftSide}>
          {back ? (
            <Pressable
              onPress={navigation.goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.headerIconBtn,
                { backgroundColor: `${colors.primary}12` },
                pressed && { opacity: 0.55 },
              ]}
            >
              <Feather name="chevron-left" size={26} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        <Text
          style={[styles.title, { color: colors.primary }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <View style={styles.rightSide}>
          <HamburgerButton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  leftSide: {
    width: 46,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  rightSide: {
    width: 46,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  /** Matches {@link HamburgerButton} `styles.btn` (no border); margin mirrors its `marginRight`. */
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginLeft: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "left",
    paddingLeft: 6,
  },
});
