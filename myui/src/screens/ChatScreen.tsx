import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Menu } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { MessageBubble } from '@/components/MessageBubble';
import { Composer } from '@/components/Composer';
import { useChats } from '@/lib/chat-store';
import { useNav } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { ROLES, type RoleId } from '@/lib/roles';

const ease = [0.22, 1, 0.36, 1] as const;

export function ChatScreen({ roleId }: { roleId: RoleId }) {
  const role = ROLES[roleId];
  const { user } = useAuth();
  const { signOut } = useNav();
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

  const [collapsed, setCollapsed] = useState(false); // desktop: full ↔ icon rail
  const [mobileOpen, setMobileOpen] = useState(false); // mobile overlay
  const endRef = useRef<HTMLDivElement>(null);

  const messages = activeChat?.messages ?? [];
  const empty = messages.length === 0;
  const chats = chatsForRole(roleId);
  const Icon = role.icon;

  // A fresh, time-aware greeting on every mount (refresh) and every new chat.
  const greeting = useMemo(() => {
    const first = (user?.name ?? '').trim().split(/\s+/)[0] ?? '';
    const pool = buildGreetings(first, new Date().getHours());
    return pool[Math.floor(Math.random() * pool.length)];
  }, [activeChat?.id, user?.name]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const closeOnMobile = () => setMobileOpen(false);

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
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface/70 text-ink-soft transition-colors hover:text-ink lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Logo />
          </>
        }
        right={
          <>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent/14 px-2.5 py-1 text-[0.72rem] font-semibold text-accent ring-1 ring-accent/25">
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{role.label}</span>
            </span>
            <ThemeToggle />
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          roleId={roleId}
          chats={chats}
          activeChatId={activeChat?.id ?? null}
          userName={user?.name ?? ''}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onCloseMobile={() => setMobileOpen(false)}
          onNewChat={handleNewChat}
          onSelect={handleSelect}
          onDelete={deleteChat}
          onSignOut={signOut}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          {empty ? (
            <HomeView
              greeting={greeting}
              corpus={role.corpus}
              placeholder={`Ask the ${role.label.toLowerCase()} assistant…`}
              busy={busy}
              connectionError={connectionError}
              onSend={send}
              onStop={stop}
            />
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
                  {connectionError && <ErrorBanner message={connectionError} />}
                  <div className="space-y-6">
                    <AnimatePresence initial={false}>
                      {messages.map((m) => (
                        <MessageBubble key={m.id} message={m} icon={Icon} />
                      ))}
                    </AnimatePresence>
                    <div ref={endRef} />
                  </div>
                </div>
              </div>

              {/* Composer pinned to the bottom of the message column */}
              <div className="border-t border-border bg-bg/80 backdrop-blur-xl">
                <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3 sm:px-6">
                  <Composer
                    busy={busy}
                    onSend={send}
                    onStop={stop}
                    placeholder={`Ask the ${role.label.toLowerCase()} assistant…`}
                  />
                  <p className="mt-2 text-center text-[0.7rem] text-ink-faint">
                    Answers come only from the {role.corpus.toLowerCase()} — if it’s not in there,
                    the assistant will say so.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/** ~8 short, understated greetings — a static set plus a time-of-day one. */
function buildGreetings(firstName: string, hour: number): string[] {
  const fn = firstName || 'there';
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return [
    `Welcome back, ${fn}`,
    `Good to see you, ${fn}`,
    `Where shall we start, ${fn}?`,
    `Ready when you are, ${fn}`,
    `What can I help with, ${fn}?`,
    `How can I help today, ${fn}?`,
    `Let’s get started, ${fn}`,
    `Good ${tod}, ${fn}`,
  ];
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-ink">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <span>
        Couldn’t reach the assistant: {message}. Check that RAGFlow is running, then send your
        message again.
      </span>
    </div>
  );
}

/** Home / empty state — centered greeting + composer over a soft IB-brand glow. */
function HomeView({
  greeting,
  corpus,
  placeholder,
  busy,
  connectionError,
  onSend,
  onStop,
}: {
  greeting: string;
  corpus: string;
  placeholder: string;
  busy: boolean;
  connectionError: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10">
      <HomeGlow />
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="display text-balance text-center text-3xl font-semibold tracking-tight text-ink sm:text-[2.6rem] sm:leading-[1.1]"
        >
          {greeting}
        </motion.h1>

        {connectionError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 w-full">
            <ErrorBanner message={connectionError} />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease }}
          className="mt-8 w-full"
        >
          <Composer busy={busy} onSend={onSend} onStop={onStop} placeholder={placeholder} />
          <p className="mt-3 text-center text-[0.72rem] text-ink-faint">
            Answers come only from the {corpus.toLowerCase()} — if it’s not in there, the assistant
            will say so.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Soft radial glow behind the home composer — IB forest-green + warm gold
 * bleeding into the page. CSS-only (reliable on low-end devices); rendered only
 * in the home state, so it disappears the moment a conversation starts.
 */
function HomeGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* green core, centered behind the composer */}
      <div
        className="absolute left-1/2 top-[56%] h-[620px] w-[620px] max-w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-[90px]"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--brand) / 0.45) 0%, hsl(var(--brand) / 0.16) 40%, transparent 70%)',
        }}
      />
      {/* warm gold bloom, offset above */}
      <div
        className="absolute left-1/2 top-[38%] h-[460px] w-[560px] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[80px]"
        style={{
          background: 'radial-gradient(circle, hsl(var(--accent) / 0.30) 0%, transparent 65%)',
        }}
      />
    </div>
  );
}
