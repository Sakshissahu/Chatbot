import { createContext, useContext } from 'react';

/*
  App-level screen navigation. Two screens, in order:
    login  →  chat
  There is a single (farmer) assistant, so login lands straight in the chat —
  no role-select hub. Kept tiny and decoupled so any deep component can drive
  navigation without prop-drilling. App owns the state and provides the value;
  this module is just the context + typed hook.
*/

export type Screen = 'login' | 'chat';

export interface NavCtx {
  screen: Screen;
  /**
   * Log in (dummy auth, via the backend) and go straight to the chat.
   * `remember` keeps the session past browser close (localStorage vs session).
   */
  authenticate: (name: string, password: string, remember?: boolean) => Promise<void>;
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
