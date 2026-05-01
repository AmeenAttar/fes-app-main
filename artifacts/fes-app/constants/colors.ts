/**
 * Cleveland FES Center brand palette.
 *
 * Pulled directly from the official site CSS:
 *   --fes-blue: #0069a6
 *   --fes-teal: #00b2a9
 */

export type ThemePalette = {
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  /** Slide-over nav drawer background */
  menuDrawerBackground: string;
  menuDrawerForeground: string;
  menuDrawerMutedForeground: string;
  menuDrawerBorder: string;
  menuHomeHighlight: string;
};

const light: ThemePalette = {
  text: "#1f2937",
  tint: "#0069a6",

  background: "#FFFFFF",
  foreground: "#1f2937",

  card: "#F5F8F9",
  cardForeground: "#1f2937",

  primary: "#0069a6",
  primaryForeground: "#FFFFFF",

  secondary: "#00b2a9",
  secondaryForeground: "#FFFFFF",

  muted: "#EEF2F3",
  mutedForeground: "#4b5563",

  accent: "#00b2a9",
  accentForeground: "#FFFFFF",

  destructive: "#D14343",
  destructiveForeground: "#FFFFFF",

  border: "#E5EAEC",
  input: "#E5EAEC",

  menuDrawerBackground: "#0069a6",
  menuDrawerForeground: "#FFFFFF",
  menuDrawerMutedForeground: "rgba(255,255,255,0.55)",
  menuDrawerBorder: "rgba(255,255,255,0.15)",
  menuHomeHighlight: "#00b2a9",
};

const dark: ThemePalette = {
  text: "#e8f1f8",
  tint: "#5eb8e8",

  background: "#0a2538",
  foreground: "#f0f6fb",

  card: "#143952",
  cardForeground: "#f0f6fb",

  primary: "#0069a6",
  primaryForeground: "#FFFFFF",

  secondary: "#00b2a9",
  secondaryForeground: "#FFFFFF",

  muted: "#1a4763",
  mutedForeground: "#9fb8cc",

  accent: "#00b2a9",
  accentForeground: "#FFFFFF",

  destructive: "#f87171",
  destructiveForeground: "#1f2937",

  border: "rgba(255,255,255,0.14)",
  input: "rgba(255,255,255,0.18)",

  menuDrawerBackground: "#063654",
  menuDrawerForeground: "#f0f6fb",
  menuDrawerMutedForeground: "rgba(240,246,251,0.55)",
  menuDrawerBorder: "rgba(255,255,255,0.12)",
  menuHomeHighlight: "#00b2a9",
};

const colors = {
  light,
  dark,
  radius: 10,
};

export default colors;
