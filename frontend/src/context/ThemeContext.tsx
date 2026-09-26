import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Theme = "dark" | "light";

interface ThemeValue {
  theme: Theme;
  toggle: () => void;
  /** Changes the theme and persists it to the user's profile. */
  set: (theme: Theme) => void;
  /** Applies a theme without writing it back. Used when a session restores. */
  adopt: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const STORAGE_KEY = "nyaysetu.theme";

/**
 * Theme resolution order:
 *   1. the signed-in user's saved preference, which follows them across devices
 *   2. localStorage, so a reload before the session loads does not flash
 *   3. the operating system preference
 *
 * The attribute goes on <html> rather than <body> so tokens.css applies before
 * first paint and there is no flash of the wrong theme.
 */
function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage can throw in private browsing; the OS preference is a fine default.
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#05120c" : "#f4f8f5");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Not fatal: the server-side preference is the durable one.
    }
  }, [theme]);

  const set = useCallback((next: Theme) => {
    setTheme(next);
    // Persist to the profile, but never block the UI on it. An unauthenticated
    // visitor gets a 401 here, which is fine: their choice lives in
    // localStorage until they sign in.
    void api.patch("/api/auth/me/theme", { theme: next }).catch(() => undefined);
  }, []);

  // Adopting the server's value must not write it straight back, or restoring a
  // session would fire a pointless PATCH on every page load.
  const adopt = useCallback((next: Theme) => setTheme(next), []);

  const toggle = useCallback(() => set(theme === "dark" ? "light" : "dark"), [set, theme]);

  const value = useMemo(() => ({ theme, toggle, set, adopt }), [theme, toggle, set, adopt]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
