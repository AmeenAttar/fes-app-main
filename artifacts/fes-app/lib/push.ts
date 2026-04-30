import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { API_BASE_URL } from "./api";

const TOKEN_STORAGE_KEY = "@fes/push-token-v1";

/**
 * iOS/Android only: configure how notifications appear when the app is
 * foregrounded. Must be called once at app startup. Skipped on web.
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === "web") return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "FES reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0069a6",
  });
}

interface RegistrationResult {
  token: string | null;
  status: "granted" | "denied" | "unsupported" | "no-project-id" | "error";
  message?: string;
}

/**
 * Asks the OS for notification permission, fetches an Expo push token, and
 * sends it to the backend. Caches the token locally so we only re-register
 * when it changes. Safe to call multiple times.
 */
export async function registerForPushNotifications(): Promise<RegistrationResult> {
  if (Platform.OS === "web") {
    return { token: null, status: "unsupported", message: "Push not supported on web" };
  }

  // Push notifications require a real device and a development build (not Expo Go).
  if (!Device.isDevice) {
    return { token: null, status: "unsupported", message: "Push requires a real device" };
  }

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (existing.status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return { token: null, status: "denied" };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

  if (
    !projectId ||
    typeof projectId !== "string" ||
    projectId.startsWith("REPLACE_WITH")
  ) {
    return {
      token: null,
      status: "no-project-id",
      message:
        "EAS projectId not set. Run `eas init` and update app.json before push tokens can be issued.",
    };
  }

  let tokenResp;
  try {
    tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (err) {
    return {
      token: null,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to get push token",
    };
  }

  const token = tokenResp.data;
  if (!token) {
    return { token: null, status: "error", message: "Empty push token" };
  }

  // Send to backend (skip if the same token is already registered).
  const cached = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (cached !== token) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/push-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          platform: Platform.OS === "ios" ? "ios" : "android",
        }),
      });
      if (!res.ok) {
        return {
          token,
          status: "error",
          message: `Backend rejected token (${res.status})`,
        };
      }
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (err) {
      return {
        token,
        status: "error",
        message: err instanceof Error ? err.message : "Network error registering token",
      };
    }
  }

  return { token, status: "granted" };
}
