import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Languages, LogOut, Moon, Sun, Volume2, X } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useVoicePrefs, type SttLanguage } from '@/lib/voice';
import { cn } from '@/lib/cn';

const ease = [0.22, 1, 0.36, 1] as const;

/** Voice-input language choices — the language the user speaks to the microphone. */
const VOICE_LANGUAGES: { value: SttLanguage; label: string }[] = [
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'gu-IN', label: 'Gujarati' },
  { value: 'bn-IN', label: 'Bengali' },
  { value: 'mr-IN', label: 'Marathi' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'kn-IN', label: 'Kannada' },
  { value: 'pa-IN', label: 'Punjabi' },
  { value: 'ml-IN', label: 'Malayalam' },
];

/**
 * Centered settings dialog — identical on phone and web, layered above the
 * sidebar / mobile overlay (z-[100]) so it never interferes with them. Hosts the
 * two controls relocated out of the app chrome: the existing theme toggle and
 * Sign out. Reachable only from the expanded sidebar footer gear, by design.
 */
export function SettingsModal({
  open,
  onClose,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const { theme, toggle } = useTheme();
  const { autoPlay, setAutoPlay, sttLanguage, setSttLanguage } = useVoicePrefs();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc to close, and move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease }}
        >
          {/* Backdrop — click to dismiss. */}
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.26, ease }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface shadow-lift"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2
                id="settings-title"
                className="display text-base font-semibold tracking-tight text-ink"
              >
                Settings
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 p-5">
              {/* Appearance — the whole row is the toggle (mirrors the Sign out
                  row): clicking anywhere flips light/dark. The right-side badge
                  is a visual indicator of the current mode, not a separate
                  control. */}
              <button
                type="button"
                onClick={(e) => toggle({ x: e.clientX, y: e.clientY })}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="focus-ring flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-bg-2/50 px-4 py-3 text-left transition-colors hover:bg-surface"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-soft">
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">Appearance</span>
                    <span className="block text-xs text-ink-faint">
                      {theme === 'dark' ? 'Dark' : 'Light'} mode
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface/70 text-ink-soft"
                >
                  <motion.span
                    key={theme}
                    initial={{ rotate: -40, opacity: 0, scale: 0.6 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, ease }}
                  >
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </motion.span>
                </span>
              </button>

              {/* Auto-play responses — read a new answer aloud once as it
                  finishes. Off by default; the per-message speaker button works
                  regardless of this toggle. */}
              <button
                type="button"
                role="switch"
                aria-checked={autoPlay}
                onClick={() => setAutoPlay(!autoPlay)}
                aria-label={autoPlay ? 'Turn off auto-play responses' : 'Turn on auto-play responses'}
                className="focus-ring flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-bg-2/50 px-4 py-3 text-left transition-colors hover:bg-surface"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-soft">
                    <Volume2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">Auto-play responses</span>
                    <span className="block text-xs text-ink-faint">Read new answers aloud</span>
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors',
                    autoPlay ? 'bg-primary' : 'bg-surface-2 ring-1 ring-inset ring-border',
                  )}
                >
                  <motion.span
                    initial={false}
                    animate={{ x: autoPlay ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    className="h-5 w-5 rounded-full bg-[hsl(var(--primary-ink))] shadow-soft"
                  />
                </span>
              </button>

              {/* Voice language — the language the user will speak to the
                  microphone (one language per session), passed to speech-to-text
                  as the primary language. Native <select> so its list escapes the
                  modal's overflow-hidden clip. */}
              <label className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-bg-2/50 px-4 py-3 text-left transition-colors hover:bg-surface">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-soft">
                    <Languages className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">I&apos;m speaking in:</span>
                    <span className="block text-xs text-ink-faint">
                      Language you&apos;ll speak to the microphone
                    </span>
                  </span>
                </span>
                <span className="relative shrink-0">
                  <select
                    value={sttLanguage}
                    onChange={(e) => setSttLanguage(e.target.value as SttLanguage)}
                    aria-label="Voice input language"
                    className="focus-ring cursor-pointer appearance-none rounded-xl border border-border bg-surface/70 py-2 pl-3 pr-8 text-sm font-medium text-ink transition-colors hover:bg-surface"
                  >
                    {VOICE_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  />
                </span>
              </label>

              {/* Sign out — uses the existing auth logout. */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="focus-ring flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left text-sm font-medium text-ink-soft transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-soft">
                  <LogOut className="h-4 w-4" />
                </span>
                Sign out
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
