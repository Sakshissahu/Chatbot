import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/*
  Voice preferences — a small persisted client pref, mirroring theme.tsx.

  `autoPlay` controls whether a freshly completed assistant answer is read aloud
  once via the backend's text-to-speech. Default OFF: the per-message speaker
  button is always available; auto-play just adds hands-free playback on top.
*/

const KEY = 'ibg-voice-autoplay';

interface VoiceCtx {
  /** When true, a new assistant answer is read aloud once as it completes. */
  autoPlay: boolean;
  setAutoPlay: (on: boolean) => void;
}

const Ctx = createContext<VoiceCtx | null>(null);

function getInitial(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [autoPlay, setAutoPlayState] = useState<boolean>(getInitial);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, autoPlay ? '1' : '0');
    } catch {
      /* storage blocked (private mode / quota) — keep in-memory only */
    }
  }, [autoPlay]);

  const setAutoPlay = useCallback((on: boolean) => setAutoPlayState(on), []);

  return <Ctx.Provider value={{ autoPlay, setAutoPlay }}>{children}</Ctx.Provider>;
}

export function useVoicePrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useVoicePrefs must be used within VoiceProvider');
  return ctx;
}
