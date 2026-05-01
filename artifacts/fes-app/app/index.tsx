import { Image } from "expo-image";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

const LOGO = require("../assets/images/logo.png");

const HOLD_MS = 900;
const FADE_MS = 700;

export default function SplashRoute() {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // Hide the native splash as soon as we mount so our animated splash
    // takes over without a visible flash.
    SplashScreen.hideAsync().catch(() => {
      /* noop - already hidden */
    });

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        delay: HOLD_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          router.replace("/menu");
        }
      });
    });
  }, [opacity, scale]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity, transform: [{ scale }] },
        ]}
      >
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 168,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
});
