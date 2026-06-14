import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Menu, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopBar, BackButton } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { MessageBubble } from '@/components/MessageBubble';
import { Composer } from '@/components/Composer';
import { useChats } from '@/lib/chat-store';
import { useNav } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { ROLES, type RoleConfig, type RoleId } from '@/lib/roles';
import { cn } from '@/lib/cn';

const ease = [0.22, 1, 0.36, 1] as const;
const isMobile = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;

export function ChatScreen({ roleId }: { roleId: RoleId }) {
  const role = ROLES[roleId];
  const { user } = useAuth();
  const { goHome, back } = useNav();
  const {
    activeChat,
    chatsForRole,
    busy,
    connectionError,
    newChat,
    selectChat,
    deleteChat,
    send,
    stop,
  } = useChats();

  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile());
  const endRef = useRef<HTMLDivElement>(null);

  const messages = activeChat?.messages ?? [];
  const empty = messages.length === 0;
  const chats = chatsForRole(roleId);
  const Icon = role.icon;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const closeOnMobile = () => {
    if (isMobile()) setSidebarOpen(false);
  };

  const handleNewChat = useCallback(() => {
    newChat(roleId);
    closeOnMobile();
  }, [newChat, roleId]);

  const handleSelect = useCallback(
    (id: string) => {
      selectChat(id);
      closeOnMobile();
    },
    [selectChat],
  );

  return (
    <div data-role={roleId} className="flex h-dvh flex-col overflow-hidden bg-bg">
      <TopBar
        left={
          <>
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle sidebar"
              className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface/70 text-ink-soft transition-colors hover:text-ink"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Logo onClick={goHome} />
          </>
        }
        right={
          <>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent/14 px-2.5 py-1 text-[0.72rem] font-semibold text-accent ring-1 ring-accent/25">
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{role.label}</span>
            </span>
            <ThemeToggle />
            <BackButton label="Assistants" onClick={back} />
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          roleId={roleId}
          chats={chats}
          activeChatId={activeChat?.id ?? null}
          userName={user?.name ?? ''}
          onNewChat={handleNewChat}
          onSelect={handleSelect}
          onDelete={deleteChat}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div
              className={cn(
                'mx-auto w-full max-w-3xl px-4 py-6 sm:px-6',
                empty && 'flex min-h-full flex-col justify-center',
              )}
            >
              {connectionError && (
                <div className="mb-5 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-ink">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <span>
                    Couldn’t reach the assistant: {connectionError}. Check that RAGFlow is running,
                    then send your message again.
                  </span>
                </div>
              )}

              {empty ? (
                <EmptyState
                  role={role}
                  name={user?.name ?? ''}
                  onPick={send}
                  disabled={busy || !!connectionError}
                />
              ) : (
                <div className="space-y-6">
                  <AnimatePresence initial={false}>
                    {messages.map((m) => (
                      <MessageBubble key={m.id} message={m} icon={Icon} />
                    ))}
                  </AnimatePresence>
                  <div ref={endRef} />
                </div>
              )}
            </div>
          </div>

          {/* Composer pinned to the message column */}
          <div className="border-t border-border bg-bg/80 backdrop-blur-xl">
            <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3 sm:px-6">
              <Composer
                busy={busy}
                onSend={send}
                onStop={stop}
                placeholder={`Ask the ${role.label.toLowerCase()} assistant…`}
              />
              <p className="mt-2 text-center text-[0.7rem] text-ink-faint">
                Answers come only from the {role.corpus.toLowerCase()} — if it’s not in there, the
                assistant will say so.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function EmptyState({
  role,
  name,
  onPick,
  disabled,
}: {
  role: RoleConfig;
  name: string;
  onPick: (q: string) => void;
  disabled: boolean;
}) {
  const Icon = role.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease }}
      className="flex flex-col items-center text-center"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/14 text-accent ring-1 ring-accent/25">
        <Icon className="h-8 w-8" strokeWidth={1.7} />
      </span>
      <h2 className="display mt-5 text-3xl font-semibold tracking-tight text-ink">
        {name ? `Hello, ${name}.` : 'Hello.'}
      </h2>
      <p className="mt-2 max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
        {role.blurb} Ask anything below, or start with one of these.
      </p>

      <div className="mt-7 grid w-full max-w-xl gap-2.5 text-left">
        {role.suggestions.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 + i * 0.08, ease }}
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-surface/70 px-4 py-3 text-[0.92rem] text-ink-soft shadow-soft backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:text-ink hover:shadow-lift disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-accent" />
            <span className="flex-1">{s}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
