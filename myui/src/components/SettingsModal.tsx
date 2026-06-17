import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '@/lib/theme';

const ease = [0.22, 1, 0.36, 1] as const;

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
