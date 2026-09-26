import { StyleSheet } from "react-native";

/**
 * The same two anchors as the web build: a near-black with a green cast, and one
 * mint accent. The app is dark only, because it is used outdoors at a scene and
 * a light theme on a phone screen in daylight is no easier to read.
 */
export const colours = {
  bg: "#070b0a",
  surface: "#0d1412",
  surface2: "#131c19",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.20)",
  text: "#f2f6f4",
  muted: "#8e9a96",
  faint: "#5f6b67",
  primary: "#5ed29c",
  primaryStrong: "#34b880",
  primarySoft: "rgba(94,210,156,0.14)",
  onPrimary: "#070b0a",
  success: "#5ed29c",
  successSoft: "rgba(94,210,156,0.14)",
  warning: "#f5c26b",
  warningSoft: "rgba(245,194,107,0.14)",
  danger: "#ff6b6b",
  dangerSoft: "rgba(255,107,107,0.14)",
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.bg },
  scroll: { padding: 18, paddingBottom: 48, gap: 14 },

  eyebrow: {
    color: colours.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  h1: { color: colours.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  h2: { color: colours.text, fontSize: 17, fontWeight: "600" },
  body: { color: colours.muted, fontSize: 13, lineHeight: 20 },
  small: { color: colours.faint, fontSize: 11, lineHeight: 17 },
  mono: { color: colours.text, fontSize: 11, fontFamily: "monospace" },

  card: {
    backgroundColor: colours.surface,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },

  label: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colours.surface2,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colours.text,
    fontSize: 15,
  },

  button: {
    backgroundColor: colours.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colours.onPrimary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonGhostText: { color: colours.text, fontSize: 13, fontWeight: "600" },
  buttonDisabled: { opacity: 0.4 },

  chip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },

  notice: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },

  tabBar: {
    flexDirection: "row",
    backgroundColor: colours.surface,
    borderTopColor: colours.border,
    borderTopWidth: 1,
    paddingBottom: 6,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: "600" },
});
