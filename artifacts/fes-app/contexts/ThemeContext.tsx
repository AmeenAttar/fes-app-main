import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
