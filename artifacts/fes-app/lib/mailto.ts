import { Linking } from "react-native";

/** Opens the default mail app with optional subject and body (mailto). No native modules. */
export async function openMailtoDraft(params: {
  to: string;
  subject?: string;
  body?: string;
}): Promise<boolean> {
  const { to, subject = "", body = "" } = params;
  const q = encodeURIComponent;
  let href = `mailto:${q(to)}`;
  const qs: string[] = [];
  if (subject) qs.push(`subject=${q(subject)}`);
  if (body) qs.push(`body=${q(body)}`);
  if (qs.length > 0) href += `?${qs.join("&")}`;
  try {
    // canOpenURL is unreliable for mailto specifically (false positives/negatives
    // across iOS versions), so openURL itself — which rejects when nothing can
    // handle the link — is the real signal, not a redundant second call.
    await Linking.openURL(href);
    return true;
  } catch {
    return false;
  }
}
