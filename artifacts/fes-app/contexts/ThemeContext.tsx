import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";

const STORAGE_KEY = "fes-app-color-scheme";

export type ColorSchemeName = "light" | "dark";

type ThemeContextValue = {
  scheme: ColorSchemeName;
  setScheme: (next: ColorSchemeName) => void;
  toggleScheme: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorSchemeName>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw === "dark" || raw === "light") {
          setSchemeState(raw);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: ColorSchemeName) => {
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const setScheme = useCallback(
    (next: ColorSchemeName) => {
      setSchemeState(next);
      persist(next);
    },
    [persist],
  );

  const toggleScheme = useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      persist(next);
      return next;
    });
  }, [persist]);

  /**
   * Keeps iOS/Android's own chrome — system alerts, the keyboard, the in-app
   * browser — on the same scheme the app is using.
   *
   * This preference is the app's own, not the device's, so `userInterfaceStyle:
   * "automatic"` alone isn't enough: that follows the *system* setting, which
   * can disagree with the toggle in Settings. Setting the app-level override
   * explicitly is what actually makes the two agree.
   */
  useEffect(() => {
    if (!ready) return;
    Appearance.setColorScheme(scheme);
  }, [scheme, ready]);

  const value = useMemo(
    () => ({
      scheme,
      setScheme,
      toggleScheme,
      ready,
    }),
    [scheme, setScheme, toggleScheme, ready],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
