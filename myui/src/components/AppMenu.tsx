import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleHelp, Flag, Info, MoreHorizontal, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const ease = [0.22, 1, 0.36, 1] as const;
const MENU_W = 184; // px — fixed width so portal positioning is exact

type AppMenuItem = 'help' | 'report' | 'about';

const ITEMS: { id: AppMenuItem; label: string; icon: LucideIcon }[] = [
  { id: 'help', label: 'Help', icon: CircleHelp },
  { id: 'report', label: 'Report', icon: Flag },
  { id: 'about', label: 'About', icon: Info },
];

// Placeholder copy for the minimal info modal — none of these are wired to a
// backend yet. See the TODO where an item is selected.
const DETAILS: Record<AppMenuItem, { title: string; body: string }> = {
  help: {
    title: 'Help',
    body: 'Guides and answers to common questions will live here.',
  },
  report: {
    title: 'Report',
    body: 'Found something off? A way to flag issues will go here.',
  },
  about: {
    title: 'About',
    body: 'IB Chicken Bot is an internal knowledge assistant from IB Group.',
  },
};

/**
 * App-level overflow menu (⋯) — Help / Report / About. These items are
 * placeholders: each opens a minimal info modal and nothing talks to the
 * backend. This is DISTINCT from the per-chat Rename/Delete menu in the
 * sidebar. The same component is reused in the phone top bar and floating at
 * the top-right of the chat on web; the dropdown is portal-positioned so it is
 * never clipped by an ancestor's overflow.
 */
export function AppMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [active, setActive] = useState<AppMenuItem | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside interaction, Escape, or scroll/resize (the menu is
  // portal-positioned and would otherwise float free of its trigger).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: Event) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const reposition = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      // Open below the trigger, right edge aligned, clamped to the viewport.
      const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
      setPos({ top: r.bottom + 8, left });
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink',
          open && 'bg-surface-2 text-ink',
          className,
        )}
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label="App menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.14, ease }}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_W }}
              className="z-[120] origin-top overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lift"
            >
              {ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    // TODO: wire Help / Report / About to real surfaces. For now
                    // each opens a minimal placeholder modal.
                    setActive(id);
                  }}
                  className="focus-ring flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <Icon className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <AppInfoModal item={active} onClose={() => setActive(null)} />
    </>
  );
}

/** Minimal placeholder dialog shown when an app-menu item is chosen. */
function AppInfoModal({ item, onClose }: { item: AppMenuItem | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!item) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  const detail = item ? DETAILS[item] : null;

  return (
    <AnimatePresence>
      {detail && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="appinfo-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.26, ease }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface shadow-lift"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 id="appinfo-title" className="display text-base font-semibold tracking-tight text-ink">
                {detail.title}
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
            <div className="p-5">
              <p className="text-sm leading-relaxed text-ink-soft">{detail.body}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
