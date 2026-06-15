import { AnimatePresence, motion } from 'framer-motion';
import {
  LogOut,
  MessageSquare,
  PanelLeft,
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
  onSignOut: () => void;
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
        transition={{ duration: 0.34, ease }}
        className="relative hidden shrink-0 overflow-hidden border-r border-border bg-bg-2 lg:block"
      >
        <AnimatePresence initial={false}>
          {collapsed ? (
            <motion.div
              key="rail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease }}
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
              transition={{ duration: 0.18, ease }}
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
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.26, ease }}
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
  onSignOut,
}: SidebarProps & { variant: 'desktop' | 'mobile' }) {
  const role = ROLES[roleId];
  const initial = userName.trim().charAt(0).toUpperCase() || '·';

  return (
    <div className="flex h-full flex-col" style={{ width: variant === 'desktop' ? FULL_W : '100%' }}>
      {/* Header — brand only on mobile (desktop already shows it in the top bar). */}
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        {variant === 'mobile' ? (
          <div className="flex items-center gap-2.5 pl-1">
            <Logo showWord={false} />
            <span className="display text-[1.05rem] font-semibold tracking-tight text-ink">
              IB Group
            </span>
          </div>
        ) : (
          <span className="pl-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            Chats
          </span>
        )}
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
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.9} />
          )}
        </button>
      </div>

      {/* New chat + search */}
      <div className="space-y-1 px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="focus-ring flex w-full items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/12 px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          <SquarePen className="h-[18px] w-[18px]" strokeWidth={2} />
          New chat
        </button>
        {/* Styled placeholder — chat search is not wired to the backend yet.
            TODO: hook up once the backend exposes conversation search. */}
        <div
          role="presentation"
          title="Search isn’t available yet"
          className="flex w-full cursor-default items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm text-ink-faint"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={1.9} />
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
            {chats.map((c) => {
              const active = c.id === activeChatId;
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      'focus-ring flex w-full items-center gap-2 rounded-xl py-2 pl-2.5 pr-9 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary/14 font-medium text-ink ring-1 ring-primary/25'
                        : 'text-ink-soft hover:bg-surface-2/80 hover:text-ink',
                    )}
                  >
                    <MessageSquare
                      className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'opacity-60')}
                    />
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    aria-label="Delete chat"
                    className="focus-ring absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint opacity-100 transition-colors hover:bg-danger/15 hover:text-danger lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* User footer — settings + sign out pinned at the bottom. */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand ring-1 ring-brand/25">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{userName}</div>
            <div className="truncate text-xs text-ink-faint">{role.label} workspace</div>
          </div>
          {/* Placeholder — no settings screen yet. TODO: wire when one exists. */}
          <button
            type="button"
            aria-label="Settings"
            title="Settings"
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-soft"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.85} />
          </button>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-danger/15 hover:text-danger"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.85} />
          </button>
        </div>
      </div>
    </div>
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

      <div className="flex flex-col items-center gap-2">
        <RailButton icon={Settings} label="Settings" onClick={onToggleCollapse} />
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
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.85} />
    </button>
  );
}
