import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { EASE, dur } from '@/lib/motion';

/**
 * Lightweight, theme-matching tooltip. Shows on hover (after a short delay) and
 * on keyboard focus, with a gentle fade/slide. Rendered in a portal with fixed
 * positioning so it escapes the collapsed sidebar's `overflow-hidden` clip
 * (the same escape pattern the menus use). Honours reduced motion via the
 * app-wide MotionConfig.
 */
const OPEN_DELAY_MS = 140;

export function Tooltip({
  label,
  side = 'right',
  children,
}: {
  label: string;
  side?: 'right' | 'top';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);

  const place = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    if (side === 'right') setPos({ top: r.top + r.height / 2, left: r.right + 10 });
    else setPos({ top: r.top - 10, left: r.left + r.width / 2 });
  };

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const show = (immediate = false) => {
    place();
    clearTimer();
    if (immediate) {
      setOpen(true);
    } else {
      timer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    }
  };
  const hide = () => {
    clearTimer();
    setOpen(false);
  };

  // Close (rather than float free) if the page scrolls or resizes while open.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => clearTimer, []);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => show()}
      onMouseLeave={hide}
      onFocusCapture={() => show(true)}
      onBlurCapture={hide}
      className="inline-flex"
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {open && (
            <div
              style={{ position: 'fixed', top: pos.top, left: pos.left }}
              className={cn(
                'pointer-events-none z-[140]',
                side === 'right' ? '-translate-y-1/2' : '-translate-x-1/2 -translate-y-full',
              )}
            >
              <motion.span
                role="tooltip"
                initial={{ opacity: 0, x: side === 'right' ? -4 : 0, y: side === 'top' ? 4 : 0 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: side === 'right' ? -4 : 0, y: side === 'top' ? 4 : 0 }}
                transition={{ duration: dur(0.14), ease: EASE }}
                className="block whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-lift"
              >
                {label}
              </motion.span>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}
