import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authApi, getToken, setToken } from "../lib/api";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (active) setUser(me);
      } catch {
        setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string) {
    const { access_token } = await authApi.login({ email, password });
    setToken(access_token);
    try {
      setUser(await authApi.me());
    } catch (err) {
      setToken(null); // don't leave a token we couldn't validate
      throw err;
    }
  }

  async function register(email: string, password: string, fullName?: string) {
    const { access_token } = await authApi.register({
      email,
      password,
      full_name: fullName,
    });
    setToken(access_token);
    try {
      setUser(await authApi.me());
    } catch (err) {
      setToken(null);
      throw err;
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    window.location.assign("/login");
  }

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
