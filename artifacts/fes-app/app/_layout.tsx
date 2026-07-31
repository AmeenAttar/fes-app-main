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
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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
        name="equipment-inventory"
        options={{ title: "Equipment Inventory" }}
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

  // Fire-and-forget push registration after first render. Errors are intentionally
  // swallowed here; the user-facing toggle in Settings (future) can show details.
  useEffect(() => {
    registerForPushNotifications().catch(() => undefined);
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
