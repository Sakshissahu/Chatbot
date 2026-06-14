import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { login as apiLogin, setToken } from '@/lib/api';

/*
  Auth state — backed by the chat backend.

  Login is still "dummy" (any username proceeds, no password check), but it now
  POSTs to the backend, which find-or-creates the user and returns a session
  token. We capture the user id/username from that response; the token is held
  by the api client for subsequent calls. Logging out clears both.

  The surface — `user`, `login`, `logout` — is unchanged, so the screens and
  chat store don't care that a real backend now sits behind it.
*/

export interface AuthUser {
  /** Stable id from the backend (a uuid). */
  id: string;
  name: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (name: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Dummy auth: trust the username, ignore the password — but go through the
  // backend so the user is captured and a session token is issued. Rejects if
  // the backend is unreachable, which the login screen surfaces.
  const login = useCallback(async (name: string, _password: string) => {
    const clean = name.trim();
    if (!clean) return;
    const { token, user: u } = await apiLogin(clean);
    setToken(token);
    setUser({ id: u.id, name: u.username });
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(() => ({ user, login, logout }), [user, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
