import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ZoomTransitionProvider } from "@/components/ZoomTransition";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import {
  configureNotificationHandler,
  registerForPushNotifications,
  subscribePushNotificationDeepLinks,
} from "@/lib/push";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* Expo Go dev client mismatches native splash APIs; dev build is unaffected. */
});
configureNotificationHandler();

/** Cached responses older than this are dropped rather than restored on launch. */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Persisted below, so a cold start renders last-known data immediately
      // and refetches behind it instead of showing an error on a bad connection.
      gcTime: CACHE_MAX_AGE_MS,
      staleTime: 5 * 60 * 1000,
      /**
       * Tuned for a free-tier API that sleeps, not for a flaky network.
       *
       * Render suspends the service after ~15 idle minutes and takes 30–60
       * seconds to wake — a measured cold start here was 76s. The previous
       * 1s/2s backoff burned all three attempts inside about three seconds, so
       * a first-open against a sleeping server showed "Couldn't load news"
       * while the server was still starting up perfectly normally.
       *
       * Spreading four attempts across ~30s covers a typical wake. An external
       * cron is supposed to keep the service warm so this never triggers, but
       * that depends on a third party staying up, and the failure it prevents
       * is the app looking broken on the very first launch.
       */
      retry: 3,
      retryDelay: (attempt) => Math.min(3000 * 2 ** attempt, 15000),
      refetchOnReconnect: true,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "@fes/query-cache-v1",
});

function ThemedGestureShell({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardProvider>{children}</KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const colors = useColors();
  const { scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          header: AppHeader,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="menu" options={{ headerShown: false }} />
      <Stack.Screen name="news/index" options={{ title: "News" }} />
      <Stack.Screen name="news/[id]" options={{ title: "Article" }} />
      <Stack.Screen
        name="investigators/index"
        options={{ title: "Investigators" }}
      />
      <Stack.Screen
        name="investigators/[slug]"
        options={{ title: "" }}
      />
      <Stack.Screen name="events/index" options={{ title: "Events" }} />
      <Stack.Screen
        name="events/[id]"
        options={{ title: "Event" }}
      />
      {/*
        Presented over the home screen (not in place of it) so the calendar can
        scale up as an overlay, the way the nav drawer does. The screen renders
        its own AppHeader inside the animated container so the header scales
        with the content instead of popping in at full size.
      */}
      <Stack.Screen
        name="fes-calendar"
        options={{
          title: "FES Calendar",
          headerShown: false,
          presentation: "transparentModal",
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="supporting-resources"
        options={{ title: "Supporting Resources" }}
      />
      <Stack.Screen
        name="equipment-inventory/index"
        options={{ title: "Equipment Inventory" }}
      />
      <Stack.Screen
        name="equipment-inventory/[slug]"
        options={{ title: "" }}
      />
      <Stack.Screen name="tuesdays" options={{ title: "Tuesdays" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {
        /* noop: prevents "No native splash screen registered" in Expo Go */
      });
    }
  }, [fontsLoaded, fontError]);

  /**
   * Fire-and-forget push registration after first render. Nothing is shown to
   * the user — Settings owns that — but the outcome is logged, because
   * `registerForPushNotifications` reports failure by *returning* a status
   * rather than throwing. Discarding it made a rejected token
   * indistinguishable from a working one: no error, no UI, and `push_tokens`
   * simply stays empty.
   */
  useEffect(() => {
    registerForPushNotifications()
      .then((result) => {
        if (result.status === "granted") return;
        console.warn(
          `[push] registration incomplete: ${result.status}`,
          result.message ?? "",
        );
      })
      .catch((err: unknown) => {
        console.warn("[push] registration threw", err);
      });
  }, []);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    return subscribePushNotificationDeepLinks();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS }}
          >
            <ThemedGestureShell>
              <ZoomTransitionProvider>
                <RootLayoutNav />
              </ZoomTransitionProvider>
            </ThemedGestureShell>
          </PersistQueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
