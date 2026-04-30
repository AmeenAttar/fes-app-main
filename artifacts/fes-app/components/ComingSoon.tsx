import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface ComingSoonProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  message: string;
}

export function ComingSoon({ icon, title, message }: ComingSoonProps) {
  const colors = useColors();
  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.muted },
        ]}
      >
        <Feather name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
