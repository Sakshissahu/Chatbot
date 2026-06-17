import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';

type Theme = 'light' | 'dark';
const KEY = 'ibg-theme';

/** Where the light/dark reveal animation expands from (the clicked control). */
type Origin = { x: number; y: number };

interface ThemeCtx {
  theme: Theme;
  /** Flip the theme. Pass the click origin to expand the reveal from that point. */
  toggle: (origin?: Origin) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(KEY) as Theme | null;
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = useCallback((origin?: Origin) => {
    const flip = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // No View Transitions support (e.g. Firefox) or reduced-motion: flip plainly.
    if (!doc.startViewTransition || reduce) {
      flip();
      return;
    }

    // Expand the circular reveal from the clicked control (falls back to the
    // top-right, where the toggle usually sits). Radius reaches the farthest
    // viewport corner so the new theme always fills the screen.
    const x = origin?.x ?? window.innerWidth - 40;
    const y = origin?.y ?? 40;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement;
    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${r}px`);

    // flushSync forces the class-applying effect to run before the API captures
    // the "after" snapshot, so the reveal animates between the two themes.
    doc.startViewTransition(() => {
      flushSync(flip);
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
