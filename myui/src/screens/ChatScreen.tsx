import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Menu } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { SettingsModal } from '@/components/SettingsModal';
import { AppMenu } from '@/components/AppMenu';
import { MessageBubble } from '@/components/MessageBubble';
import { Composer } from '@/components/Composer';
import { useChats } from '@/lib/chat-store';
import { useNav } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { type RoleId } from '@/lib/roles';
import logoUrl from '@/assets/ibg-logo.png';

const ease = [0.22, 1, 0.36, 1] as const;

/** Product/bot name — shown in the phone top bar (and matches the sidebar header). */
const BOT_NAME = 'IB Chicken Bot';
const COMPOSER_PLACEHOLDER = 'Ask IB chicken bot…';

export function ChatScreen({ roleId }: { roleId: RoleId }) {
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
    renameChat,
    send,
    stop,
  } = useChats();

  const [collapsed, setCollapsed] = useState(false); // desktop: full ↔ icon rail
  const [mobileOpen, setMobileOpen] = useState(false); // mobile overlay
  const [settingsOpen, setSettingsOpen] = useState(false); // centered settings modal
  const endRef = useRef<HTMLDivElement>(null);

  const messages = activeChat?.messages ?? [];
  const empty = messages.length === 0;
  const chats = chatsForRole(roleId);

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
      {/* Phone top bar — compact & borderless: hamburger + the BOT name +
          app-level ⋯ menu. Rename now lives in the per-chat menu, not here.
          WEB has no top bar; its ⋯ floats at the top-right of the chat. */}
      <header className="relative z-30 flex h-12 shrink-0 items-center gap-1.5 bg-bg px-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold text-ink">
          {BOT_NAME}
        </span>
        <AppMenu />
      </header>

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
          onRename={renameChat}
          onOpenSettings={() => {
            setMobileOpen(false);
            setSettingsOpen(true);
          }}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* WEB: the app-level ⋯ menu floats at the top-right of the chat area
              (the phone shows it in the top bar instead). Present in both the
              home and chat states; sits above the top fade. */}
          <div className="absolute right-3 top-3 z-30 hidden lg:flex">
            <AppMenu />
          </div>

          {empty ? (
            <HomeView
              greeting={greeting}
              placeholder={COMPOSER_PLACEHOLDER}
              busy={busy}
              connectionError={connectionError}
              onSend={send}
              onStop={stop}
            />
          ) : (
            <>
              {/* Top fade — mirrors the composer's bottom fade (same gradient,
                  flipped) so messages dissolve into the page at the top too.
                  Both platforms. */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-bg to-bg/0" />

              {/* Messages — fills the column. The trailing spacer (and scroll
                  target) is the height of the floating composer so the last
                  message always scrolls clear of it. Top padding keeps resting
                  content clear of the top fade. */}
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-3xl px-4 pt-16 sm:px-6 lg:pt-20">
                  {connectionError && <ErrorBanner message={connectionError} />}
                  <div className="space-y-6">
                    <AnimatePresence initial={false}>
                      {messages.map((m) => (
                        <MessageBubble key={m.id} message={m} />
                      ))}
                    </AnimatePresence>
                  </div>
                  <div ref={endRef} className="h-36" />
                </div>
              </div>

              {/* Floating composer — pinned to the bottom of the column while
                  scrolling. The soft gradient fade above it (transparent → page
                  bg) is unchanged; the bottom padding now respects the device
                  safe-area so the pill clears the system nav bar on phones. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
                <div className="h-16 bg-gradient-to-t from-bg to-bg/0" />
                <div className="bg-bg pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="pointer-events-auto mx-auto w-full max-w-3xl px-4 sm:px-6">
                    <Composer
                      busy={busy}
                      onSend={send}
                      onStop={stop}
                      placeholder={COMPOSER_PLACEHOLDER}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSignOut={signOut}
      />
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

/**
 * Home / empty state — greeting over a soft IB-brand glow.
 *
 * Desktop: the composer sits centered directly under the greeting (unchanged).
 * Mobile (<lg): the greeting stays centered up top while the composer is pinned
 * to the bottom of the screen, matching the in-chat layout. The two composer
 * placements are mutually exclusive (`lg:block` / `lg:hidden`), so only one is
 * ever interactive at a given breakpoint.
 */
function HomeView({
  greeting,
  placeholder,
  busy,
  connectionError,
  onSend,
  onStop,
}: {
  greeting: string;
  placeholder: string;
  busy: boolean;
  connectionError: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const composer = (
    <Composer busy={busy} onSend={onSend} onStop={onStop} placeholder={placeholder} />
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <HomeGlow />

      {/* Greeting (+ the desktop composer) — vertically centered as a group,
          with the IB Group mark sitting just above it (home/empty state only). */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-2xl flex-col items-center">
          <motion.img
            src={logoUrl}
            alt="IB Group"
            draggable={false}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease }}
            className="mb-5 h-14 w-14 select-none object-contain sm:h-16 sm:w-16"
          />
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease }}
            className="display text-balance text-center text-3xl font-semibold tracking-tight text-ink sm:text-[2.6rem] sm:leading-[1.1]"
          >
            {greeting}
          </motion.h1>

          {connectionError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 w-full">
              <ErrorBanner message={connectionError} />
            </motion.div>
          )}

          {/* Desktop: composer centered under the greeting. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease }}
            className="mt-8 hidden w-full lg:block"
          >
            {composer}
          </motion.div>
        </div>
      </div>

      {/* Mobile: composer pinned to the bottom (same as the in-chat layout).
          Safe-area bottom padding lifts it clear of the device nav bar. */}
      <div className="relative z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto w-full max-w-2xl">{composer}</div>
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
