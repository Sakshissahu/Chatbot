import { createContext, useContext } from 'react';
import type { RoleId } from '@/lib/roles';

/*
  App-level screen navigation. Three screens, in order:
    login  →  role   →  chat
  Kept tiny and decoupled so any deep component (the logo, a back button)
  can drive navigation without prop-drilling. App owns the actual state and
  provides the value; this module is just the context + typed hook.
*/

export type Screen = 'login' | 'role' | 'chat';

export interface NavCtx {
  screen: Screen;
  activeRole: RoleId | null;
  /** Log in (dummy auth, via the backend) and advance to role selection. */
  authenticate: (name: string, password: string) => Promise<void>;
  /** Logo / Home → the role-select hub. */
  goHome: () => void;
  /** Step back one screen (chat → role, role → sign out to login). */
  back: () => void;
  /** Pick a workspace and open its chat. */
  selectRole: (role: RoleId) => void;
  /** Clear the session and return to login. */
  signOut: () => void;
}

const Ctx = createContext<NavCtx | null>(null);

export const NavProvider = Ctx.Provider;

export function useNav() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
