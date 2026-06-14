import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ROLES, type RoleId } from '@/lib/roles';
import type { Chat } from '@/lib/chat-store';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  roleId: RoleId;
  chats: Chat[];
  activeChatId: string | null;
  userName: string;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Chat-history sidebar. One inner panel, rendered two ways:
 *   • desktop (lg+): an inline flex column whose width collapses to 0
 *   • mobile: an off-canvas drawer with a dimmed backdrop
 * Both are driven by the same `open` flag.
 */
export function Sidebar(props: SidebarProps) {
  const { open, onClose } = props;
  return (
    <>
      {/* Desktop: collapsible inline column */}
      <aside
        className={cn(
          'hidden shrink-0 overflow-hidden border-r border-border bg-bg-2/70 transition-[width] duration-300 ease-spring lg:block',
          open ? 'lg:w-[17.5rem]' : 'lg:w-0 lg:border-r-0',
        )}
      >
        <div className="flex h-full w-[17.5rem] flex-col">
          <SidebarPanel {...props} />
        </div>
      </aside>

      {/* Mobile: backdrop + drawer */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-[hsl(var(--shadow))]/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[84vw] flex-col border-r border-border bg-surface shadow-lift transition-transform duration-300 ease-spring lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
      >
        <SidebarPanel {...props} />
      </aside>
    </>
  );
}

function SidebarPanel({
  onClose,
  roleId,
  chats,
  activeChatId,
  userName,
  onNewChat,
  onSelect,
  onDelete,
}: SidebarProps) {
  const role = ROLES[roleId];
  const initial = userName.trim().charAt(0).toUpperCase() || '·';

  return (
    <div className="flex h-full flex-col">
      {/* New chat + mobile close */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/12 px-3 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          New chat
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-ink-soft transition-colors hover:text-ink lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <p className="px-2 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {role.label} chats
        </p>
        {chats.length === 0 ? (
          <p className="px-2 py-2 text-sm leading-relaxed text-ink-faint">
            No conversations yet. Start one below.
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
                        ? 'bg-accent/14 font-medium text-ink ring-1 ring-accent/25'
                        : 'text-ink-soft hover:bg-surface-2/80 hover:text-ink',
                    )}
                  >
                    <MessageSquare
                      className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'opacity-60')}
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

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand ring-1 ring-brand/25">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{userName}</div>
            <div className="truncate text-xs text-ink-faint">{role.label} workspace</div>
          </div>
        </div>
      </div>
    </div>
  );
}
