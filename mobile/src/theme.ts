import { StyleSheet } from "react-native";

/**
 * The palette from the logo, which uses exactly two colours: #009245 green and
 * #ff751f orange. Dark only, because the app is used outdoors at a scene and a
 * light theme on a phone screen in daylight is no easier to read.
 *
 * Two greens, as on the web: `primary` is a lifted green that reads as text on
 * the dark canvas, `primaryFill` is deepened so white text on a button clears
 * AA. The raw brand value is kept for chrome that must not drift.
 */
export const colours = {
  bg: "#05120c",
  surface: "#0a1d13",
  surface2: "#0e2418",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.20)",
  text: "#eef5f0",
  muted: "#93a69b",
  faint: "#647469",
  brandGreen: "#009245",
  brandOrange: "#ff751f",
  primary: "#10b45f",
  primaryFill: "#00803c",
  primaryStrong: "#00c063",
  primarySoft: "rgba(16,180,95,0.13)",
  onPrimary: "#ffffff",
  success: "#10b45f",
  successSoft: "rgba(16,180,95,0.14)",
  warning: "#ff751f",
  warningSoft: "rgba(255,117,31,0.14)",
  danger: "#f4545f",
  dangerSoft: "rgba(244,84,95,0.14)",
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
    backgroundColor: colours.primaryFill,
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
