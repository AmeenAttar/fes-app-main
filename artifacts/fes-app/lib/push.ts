import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import { API_BASE_URL, apiAuthHeaders } from "./api";

const TOKEN_STORAGE_KEY = "@fes/push-token-v1";
/** User's own choice, independent of the OS-level permission. */
const PUSH_ENABLED_KEY = "@fes/push-enabled-v1";

/** Defaults to on — opting out is an explicit action. */
export async function isPushEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
  return raw !== "false";
}

/**
 * Records the preference and syncs the server: turning it off deletes the token
 * so this device drops out of the fan-out entirely, rather than the app quietly
 * discarding notifications it still receives.
 */
export async function setPushEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_ENABLED_KEY, enabled ? "true" : "false");
  if (enabled) {
    await registerForPushNotifications();
    return;
  }
  await unregisterPushNotifications();
}

/** Removes this device's token from the server and clears the local cache. */
export async function unregisterPushNotifications(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return;
  try {
    await fetch(
      `${API_BASE_URL}/api/push-tokens/${encodeURIComponent(token)}`,
      { method: "DELETE", headers: { ...apiAuthHeaders() } },
    );
  } catch {
    // Best effort — the local flag still stops re-registration on next launch.
  }
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}

/** Ensures {@link Notifications.getLastNotificationResponseAsync} is applied at most once per app JS session. */
let didReplayLaunchNotificationResponse = false;

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

  // Respect an explicit opt-out so app launch doesn't silently re-register.
  if (!(await isPushEnabled())) {
    return { token: null, status: "denied", message: "Notifications turned off in Settings" };
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
        headers: { "Content-Type": "application/json", ...apiAuthHeaders() },
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

function navigateFromPushData(data: Record<string, unknown> | undefined): void {
  if (!data) return;
  const raw = data["newsPostId"];
  if (raw == null) return;
  const id =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(Math.trunc(raw))
      : typeof raw === "string"
        ? raw.trim()
        : "";
  if (!/^\d+$/u.test(id)) return;
  router.push({ pathname: "/news/[id]", params: { id } });
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const data = response.notification.request.content
    .data as Record<string, unknown> | undefined;
  navigateFromPushData(data);
}

/**
 * Opens the in-app news article when the user taps a push whose `data` includes
 * `newsPostId` (see api-server news push). Subscribes for taps while running
 * and replays the launch notification after a cold start. No-op on web.
 * Returns an unsubscribe/cleanup for use in `useEffect`.
 */
export function subscribePushNotificationDeepLinks(): () => void {
  if (Platform.OS === "web") {
    return () => undefined;
  }

  const sub = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse,
  );

  void Notifications.getLastNotificationResponseAsync().then((last) => {
    if (!last || didReplayLaunchNotificationResponse) return;
    didReplayLaunchNotificationResponse = true;
    handleNotificationResponse(last);
  });

  return () => sub.remove();
}
