import colors from "@/constants/colors";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Design tokens for the active user-selected theme (light/dark), persisted
 * in AsyncStorage via ThemeProvider.
 */
export function useColors() {
  const { scheme } = useTheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return {
    ...palette,
    radius: colors.radius,
    scheme,
  };
}
