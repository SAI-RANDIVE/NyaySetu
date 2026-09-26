import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, type User } from "../lib/api";
import { useTheme } from "./ThemeContext";

interface AuthValue {
  user: User | null;
  /** True until the first /me call settles, so routes do not redirect early. */
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { adopt } = useTheme();

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ user: User }>("/api/auth/me");
      setUser(result.user);
      // The profile preference wins over the local one, so a theme follows the
      // user between the station terminal and their phone.
      if (result.user.theme) adopt(result.user.theme);
      setError(null);
    } catch (caught) {
      // A 401 here is the normal "not signed in" case, not a failure.
      if (!(caught instanceof ApiError && caught.isAuth)) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not reach the NyaySetu API. Is the backend running?"
        );
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [adopt]);

  useEffect(() => {
    void load();
  }, [load]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<{ user: User }>("/api/auth/login", { email, password });
      setUser(result.user);
      if (result.user.theme) adopt(result.user.theme);
      setError(null);
      // Fetch the full profile, which also picks up hasAadhaarToken.
      void load();
      return result.user;
    },
    [adopt, load]
  );

  const signOut = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      // Clear locally whatever the server said: a failed sign-out must still end
      // the session in this tab.
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, signIn, signOut, refresh: load }),
    [user, loading, error, signIn, signOut, load]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
