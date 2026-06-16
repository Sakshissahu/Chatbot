import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Search,
  Settings,
  SquarePen,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/Logo';
import { ROLES, type RoleId } from '@/lib/roles';
import type { Chat } from '@/lib/chat-store';

const ease = [0.22, 1, 0.36, 1] as const;
const RAIL_W = 68; // px — thin icon rail
const FULL_W = 280; // px — full labelled sidebar

// Shared motion. One critically-damped spring drives the panel geometry (the
// desktop rail↔full width and the mobile overlay slide) so both share the same
// premium cadence; it's tuned to settle with no overshoot, so the width never
// flashes past its target. A short tween cross-fades the rail/full contents.
const panelSpring = { type: 'spring', stiffness: 420, damping: 44, mass: 1 } as const;
const contentFade = { duration: 0.16, ease } as const;
const overlayFade = { duration: 0.2, ease } as const;

interface SidebarProps {
  /** Desktop only: render the thin icon rail instead of the full sidebar. */
  collapsed: boolean;
  /** Mobile only: the full-screen overlay is shown. */
  mobileOpen: boolean;
  roleId: RoleId;
  chats: Chat[];
  activeChatId: string | null;
  userName: string;
  /** Toggle desktop expanded ↔ icon rail. */
  onToggleCollapse: () => void;
  /** Close the mobile overlay. */
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** Rename a chat (persists via the chat store). */
  onRename: (id: string, title: string) => void;
  /** Open the centered Settings modal (theme + sign out live there now). */
  onOpenSettings: () => void;
}

/**
 * Chat-history sidebar with three responsive states, all animated:
 *   • desktop expanded  — full labelled column (FULL_W)
 *   • desktop collapsed — thin icon rail (RAIL_W), never hidden
 *   • mobile            — full-screen overlay (covers the viewport)
 * The full panel is shared between the desktop-expanded and mobile states.
 */
export function Sidebar(props: SidebarProps) {
  const { collapsed, mobileOpen } = props;

  return (
    <>
      {/* Desktop: persistent column that animates between rail and full width. */}
      <motion.nav
        aria-label="Chat history"
        initial={false}
        animate={{ width: collapsed ? RAIL_W : FULL_W }}
        transition={panelSpring}
        className="relative hidden shrink-0 overflow-hidden border-r border-border bg-bg-2 lg:block"
      >
        <AnimatePresence initial={false}>
          {collapsed ? (
            <motion.div
              key="rail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={contentFade}
              className="absolute inset-0"
              style={{ width: RAIL_W }}
            >
              <SidebarRail {...props} />
            </motion.div>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={contentFade}
              className="absolute inset-0"
              style={{ width: FULL_W }}
            >
              <SidebarFull {...props} variant="desktop" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Mobile: full-screen overlay. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            key="mobile"
            aria-label="Chat history"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ x: panelSpring, opacity: overlayFade }}
            className="fixed inset-0 z-50 flex flex-col bg-bg lg:hidden"
          >
            <SidebarFull {...props} variant="mobile" />
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}

/** Full labelled panel — used by the desktop-expanded column and the mobile overlay. */
function SidebarFull({
  variant,
  roleId,
  chats,
  activeChatId,
  userName,
  onToggleCollapse,
  onCloseMobile,
  onNewChat,
  onSelect,
  onDelete,
  onRename,
  onOpenSettings,
}: SidebarProps & { variant: 'desktop' | 'mobile' }) {
  const role = ROLES[roleId];
  const initial = userName.trim().charAt(0).toUpperCase() || '·';

  return (
    <div className="flex h-full flex-col" style={{ width: variant === 'desktop' ? FULL_W : '100%' }}>
      {/* Header — IB Group brand lockup; the rail shows the same mark, so the
          logo stays put as the sidebar expands/collapses. */}
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex items-center gap-2.5 pl-1">
          <Logo showWord={false} />
          <span className="display text-[1.05rem] font-semibold tracking-tight text-ink">
            IB Group
          </span>
        </div>
        <button
          type="button"
          onClick={variant === 'mobile' ? onCloseMobile : onToggleCollapse}
          aria-label={variant === 'mobile' ? 'Close menu' : 'Collapse sidebar'}
          title={variant === 'mobile' ? 'Close' : 'Collapse sidebar'}
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {variant === 'mobile' ? (
            <X className="h-5 w-5" />
          ) : (
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          )}
        </button>
      </div>

      {/* New chat + search */}
      <div className="space-y-1 px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="focus-ring flex w-full items-center gap-2.5 rounded-2xl border border-border bg-surface-2/60 px-3.5 py-2.5 font-display text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          <SquarePen className="h-[18px] w-[18px] text-ink-soft" strokeWidth={2} />
          New chat
        </button>
        {/* Styled placeholder — chat search is not wired to the backend yet.
            TODO: hook up once the backend exposes conversation search. */}
        <div
          role="presentation"
          title="Search isn’t available yet"
          className="flex w-full cursor-default items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm text-ink-faint"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={2} />
          <span className="flex-1 text-left">Search chats</span>
        </div>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <p className="px-2 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Recent chats
        </p>
        {chats.length === 0 ? (
          <p className="px-2 py-2 text-sm leading-relaxed text-ink-faint">
            No conversations yet. Start one above.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((c) => (
              <ChatRow
                key={c.id}
                chat={c}
                active={c.id === activeChatId}
                variant={variant}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </ul>
        )}
      </div>

      {/* User footer — flush with the sidebar (no divider), pinned to the
          bottom. Extra bottom padding via the safe-area inset lifts it clear of
          the device system navigation bar on phones. */}
      <div className="px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand ring-1 ring-brand/25">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{userName}</div>
            <div className="truncate text-xs text-ink-faint">{role.label} workspace</div>
          </div>
          {/* Settings — opens the centered modal (theme + sign out). */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

const LONG_PRESS_MS = 500; // intentional hold before the mobile delete appears
const MOVE_TOLERANCE = 10; // px of finger travel that reclassifies a press as a scroll

/**
 * A single chat-history row. Selection (`onSelect`) is unchanged. The per-chat
 * context menu — Rename + Delete — is the SAME on both surfaces, only its
 * trigger differs:
 *   • mobile (overlay): long-press (~500ms) opens the menu anchored to the row.
 *   • desktop: a ⋯ button on hover/focus opens the menu below the button.
 * The menu is rendered in a portal so the sidebar's overflow never clips it.
 * Rename swaps the row for an inline input (Enter/blur commits, Esc cancels);
 * Delete and Rename both call the existing store actions.
 */
function ChatRow({
  chat,
  active,
  variant,
  onSelect,
  onDelete,
  onRename,
}: {
  chat: Chat;
  active: boolean;
  variant: 'desktop' | 'mobile';
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const isMobile = variant === 'mobile';
  const [open, setOpen] = useState(false); // per-chat menu open
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [editing, setEditing] = useState(false); // inline rename
  const [value, setValue] = useState(chat.title);

  const liRef = useRef<HTMLLIElement>(null);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Long-press bookkeeping (mobile only).
  const timer = useRef<number | null>(null);
  const pressFired = useRef(false);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Keep the rename field in sync when the title changes while not editing.
  useEffect(() => {
    if (!editing) setValue(chat.title);
  }, [chat.title, editing]);

  // Dismiss the menu on outside interaction, Escape, or scroll/resize (it is
  // portal-positioned and would otherwise float free of its anchor).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: Event) => {
      const t = e.target as Node;
      if (liRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        dotsRef.current?.focus();
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

  // Move focus onto the first item (Rename) when the menu opens (keyboard).
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  // Select the text when the inline rename input mounts.
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Open the menu anchored to a rect (the ⋯ button on desktop, the row on
  // mobile long-press), flipping above when there isn't room below.
  const openMenuAt = (r: DOMRect) => {
    const W = 160;
    const H = 92; // ~two items
    const top = r.bottom + 6 + H > window.innerHeight ? r.top - H - 6 : r.bottom + 6;
    setMenuPos({ top: Math.max(8, top), left: Math.max(8, r.right - W) });
    setOpen(true);
  };

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = dotsRef.current?.getBoundingClientRect();
    if (r) openMenuAt(r);
  };

  const startRename = () => {
    setOpen(false);
    setValue(chat.title);
    setEditing(true);
  };
  const commitRename = () => {
    const next = value.trim();
    if (next && next !== chat.title) onRename(chat.id, next);
    setEditing(false);
  };
  const cancelRename = () => {
    setValue(chat.title);
    setEditing(false);
  };

  const beginPress = (x: number, y: number) => {
    if (!isMobile) return;
    pressFired.current = false;
    startPt.current = { x, y };
    clearTimer();
    timer.current = window.setTimeout(() => {
      pressFired.current = true;
      const r = liRef.current?.getBoundingClientRect();
      if (r) openMenuAt(r);
      navigator.vibrate?.(12);
    }, LONG_PRESS_MS);
  };
  const maybeCancelPress = (x: number, y: number) => {
    if (!startPt.current) return;
    if (Math.hypot(x - startPt.current.x, y - startPt.current.y) > MOVE_TOLERANCE) clearTimer();
  };

  const handleClick = () => {
    if (pressFired.current) {
      // Swallow the click synthesized at the end of a long-press.
      pressFired.current = false;
      return;
    }
    if (open) {
      setOpen(false); // a plain tap dismisses an open menu
      return;
    }
    onSelect(chat.id);
  };

  // Inline rename — replaces the row while active.
  if (editing) {
    return (
      <li ref={liRef} className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelRename();
            }
          }}
          onBlur={commitRename}
          aria-label="Chat name"
          maxLength={120}
          className="focus-ring w-full rounded-full bg-surface-2 py-2 pl-3.5 pr-3 text-sm font-medium text-ink outline-none"
        />
      </li>
    );
  }

  return (
    <li ref={liRef} className="group relative">
      <button
        type="button"
        onClick={handleClick}
        onTouchStart={(e) => beginPress(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => maybeCancelPress(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={clearTimer}
        onTouchCancel={clearTimer}
        onContextMenu={(e) => {
          if (isMobile) e.preventDefault();
        }}
        className={cn(
          'focus-ring flex w-full items-center rounded-full py-2 pl-3.5 text-left text-sm transition-colors',
          isMobile ? 'pr-3.5 select-none [-webkit-touch-callout:none]' : 'pr-9',
          active
            ? 'bg-ink/[0.08] font-medium text-ink'
            : 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
        )}
      >
        <span className="truncate">{chat.title}</span>
      </button>

      {/* Desktop: ⋯ on hover/focus opens the menu. Mobile uses long-press. */}
      {!isMobile && (
        <button
          ref={dotsRef}
          type="button"
          onClick={toggleMenu}
          aria-label={`Options for chat: ${chat.title}`}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'focus-ring absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-ink/[0.10] hover:text-ink focus-visible:opacity-100 group-hover:opacity-100',
            open ? 'bg-ink/[0.10] text-ink opacity-100' : 'text-ink-faint opacity-0',
          )}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      )}

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label={`Options for chat: ${chat.title}`}
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.14, ease }}
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 160 }}
              className="z-[120] origin-top overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lift"
            >
              <button
                ref={firstItemRef}
                type="button"
                role="menuitem"
                onClick={startRename}
                className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Pencil className="h-4 w-4" strokeWidth={2} />
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onDelete(chat.id);
                }}
                className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/10"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </li>
  );
}

/** Thin icon rail (desktop collapsed). Most controls simply expand the sidebar. */
function SidebarRail({ userName, onToggleCollapse, onNewChat }: SidebarProps) {
  const initial = userName.trim().charAt(0).toUpperCase() || '·';

  return (
    <div className="flex h-full flex-col items-center justify-between py-4" style={{ width: RAIL_W }}>
      <div className="flex flex-col items-center gap-1.5">
        {/* Brand doubles as the expand control. */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="focus-ring mb-2 flex items-center justify-center rounded-xl transition-transform hover:scale-105"
        >
          <Logo showWord={false} />
        </button>
        <RailButton icon={SquarePen} label="New chat" onClick={onNewChat} />
        <RailButton icon={Search} label="Search chats" onClick={onToggleCollapse} />
      </div>

      {/* Settings is intentionally absent from the rail — it lives in the
          expanded sidebar footer (open the rail first). */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Account — expand sidebar"
          title={userName}
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand ring-1 ring-brand/25 transition-transform hover:scale-105"
        >
          {initial}
        </button>
      </div>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
    </button>
  );
}
