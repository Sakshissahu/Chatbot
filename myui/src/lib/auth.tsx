import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { login as apiLogin, saveSession, loadSession, clearSession } from '@/lib/api';

/*
  Auth state — backed by the chat backend.

  Login is still "dummy" (any username proceeds, no password check), but it now
  POSTs to the backend, which find-or-creates the user and returns a session
  token. We capture the user id/username from that response.

  The session (token + user) is persisted so it survives a reload, and the
  `remember` flag decides where: localStorage when the user opts to stay signed
  in, sessionStorage otherwise (see api.ts). It's restored synchronously on
  first render so a returning user skips the login screen; logout clears both
  stores.

  The surface — `user`, `login`, `logout` — is otherwise unchanged, so the
  screens and chat store don't care that a real backend now sits behind it.
*/

export interface AuthUser {
  /** Stable id from the backend (a uuid). */
  id: string;
  name: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (name: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore a remembered session synchronously so a returning user never sees
  // the login screen flash. loadSession also re-activates the in-memory token.
  const [user, setUser] = useState<AuthUser | null>(() => loadSession()?.user ?? null);

  // Dummy auth: trust the username, ignore the password — but go through the
  // backend so the user is captured and a session token is issued. Rejects if
  // the backend is unreachable, which the login screen surfaces. `remember`
  // chooses local vs session storage for the issued token (default: off).
  const login = useCallback(async (name: string, _password: string, remember = false) => {
    const clean = name.trim();
    if (!clean) return;
    const { token, user: u } = await apiLogin(clean);
    const authUser: AuthUser = { id: u.id, name: u.username };
    saveSession({ token, user: authUser }, remember);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    clearSession();
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
