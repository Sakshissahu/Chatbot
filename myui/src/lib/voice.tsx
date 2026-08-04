import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/*
  Voice preferences — small persisted client prefs, mirroring theme.tsx.

  `autoPlay` controls whether a freshly completed assistant answer is read aloud
  once via the backend's text-to-speech. Default OFF: the per-message speaker
  button is always available; auto-play just adds hands-free playback on top.

  `sttLanguage` is the language the user will speak to the microphone — one
  language per session. The value is passed through to the recognizer as the
  primary language. Default English (en-IN), which the backend pairs with
  Hindi/Gujarati as recognizer alternates.
*/

const AUTOPLAY_KEY = 'ibg-voice-autoplay';
const STT_LANG_KEY = 'ibg-voice-stt-lang';

/** Voice-input (speech-to-text) languages the user can choose to speak in. */
export type SttLanguage = 'en-IN' | 'hi-IN' | 'gu-IN' | 'bn-IN' | 'ta-IN' | 'te-IN' | 'mr-IN' | 'kn-IN' | 'pa-IN' | 'ml-IN';

const STT_LANGUAGES: readonly SttLanguage[] = [
  'en-IN',
  'hi-IN',
  'gu-IN',
  'bn-IN',
  'ta-IN',
  'te-IN',
  'mr-IN',
  'kn-IN',
  'pa-IN',
  'ml-IN',
];
const STT_LANG_DEFAULT: SttLanguage = 'en-IN';

interface VoiceCtx {
  /** When true, a new assistant answer is read aloud once as it completes. */
  autoPlay: boolean;
  setAutoPlay: (on: boolean) => void;
  /** The language the user will speak to the microphone. */
  sttLanguage: SttLanguage;
  setSttLanguage: (lang: SttLanguage) => void;
}

const Ctx = createContext<VoiceCtx | null>(null);

function getInitial(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUTOPLAY_KEY) === '1';
  } catch {
    return false;
  }
}

function getInitialLang(): SttLanguage {
  if (typeof window === 'undefined') return STT_LANG_DEFAULT;
  try {
    const v = localStorage.getItem(STT_LANG_KEY);
    return STT_LANGUAGES.includes(v as SttLanguage) ? (v as SttLanguage) : STT_LANG_DEFAULT;
  } catch {
    return STT_LANG_DEFAULT;
  }
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [autoPlay, setAutoPlayState] = useState<boolean>(getInitial);
  const [sttLanguage, setSttLanguageState] = useState<SttLanguage>(getInitialLang);

  useEffect(() => {
    try {
      localStorage.setItem(AUTOPLAY_KEY, autoPlay ? '1' : '0');
    } catch {
      /* storage blocked (private mode / quota) — keep in-memory only */
    }
  }, [autoPlay]);

  useEffect(() => {
    try {
      localStorage.setItem(STT_LANG_KEY, sttLanguage);
    } catch {
      /* storage blocked (private mode / quota) — keep in-memory only */
    }
  }, [sttLanguage]);

  const setAutoPlay = useCallback((on: boolean) => setAutoPlayState(on), []);
  const setSttLanguage = useCallback((lang: SttLanguage) => setSttLanguageState(lang), []);

  return (
    <Ctx.Provider value={{ autoPlay, setAutoPlay, sttLanguage, setSttLanguage }}>{children}</Ctx.Provider>
  );
}

export function useVoicePrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useVoicePrefs must be used within VoiceProvider');
  return ctx;
}
