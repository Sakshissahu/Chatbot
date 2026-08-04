import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowDown } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { SettingsModal } from '@/components/SettingsModal';
import { AppMenu } from '@/components/AppMenu';
import { MenuIcon } from '@/components/MenuIcon';
import { MessageBubble } from '@/components/MessageBubble';
import { Composer } from '@/components/Composer';
import { useChats } from '@/lib/chat-store';
import { useNav } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { useBackButton } from '@/lib/use-back-button';
import { type RoleId } from '@/lib/roles';
import logoUrl from '@/assets/ibg-logo.png';

const ease = [0.22, 1, 0.36, 1] as const;

/** Distance (px) from the bottom past which the scroll-to-bottom button appears. */
const NEAR_BOTTOM_PX = 160;

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
  const [showJump, setShowJump] = useState(false); // scroll-to-bottom affordance
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null); // the messages scroll container
  const reduce = useReducedMotion();

  const messages = activeChat?.messages ?? [];
  const empty = messages.length === 0;
  const chats = chatsForRole(roleId);

  // A fresh, time-aware greeting on every mount (refresh) and every new chat.
  const greeting = useMemo(() => {
    const first = (user?.name ?? '').trim().split(/\s+/)[0] ?? '';
    const pool = buildGreetings(first, new Date().getHours());
    return pool[Math.floor(Math.random() * pool.length)];
  }, [activeChat?.id, user?.name]);

  const updateJump = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJump(dist > NEAR_BOTTOM_PX);
  }, []);

  const scrollToBottom = useCallback(
    (smooth = true) =>
      endRef.current?.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'end' }),
    [reduce],
  );

  // New / changed messages keep the latest in view (smooth), as before.
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  // Keyboard open/close (mobile) resizes the visible viewport without changing
  // `messages`, so re-pin the latest message instantly so it stays above the
  // keyboard instead of being clipped.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (messages.length > 0) scrollToBottom(false);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [messages.length, scrollToBottom]);

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

  // Device/browser Back, in order: close the settings modal → close the mobile
  // sidebar → leave an active chat for the empty new-chat state → allow a normal
  // exit. Pure view/nav state; never touches auth. (See useBackButton.)
  const handleBack = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
    } else if (mobileOpen) {
      setMobileOpen(false);
    } else if (!empty) {
      newChat(roleId);
    }
  }, [settingsOpen, mobileOpen, empty, newChat, roleId]);
  useBackButton(settingsOpen || mobileOpen || !empty, handleBack);

  return (
    <div data-role={roleId} className="flex h-app flex-col overflow-hidden bg-bg">
      {/* Phone top bar — compact & borderless: hamburger + the BOT name +
          app-level ⋯ menu. Rename now lives in the per-chat menu, not here.
          WEB has no top bar; its ⋯ floats at the top-right of the chat. */}
      <header className="relative z-50 flex h-12 shrink-0 items-center gap-1.5 bg-bg px-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-[color,background-color,transform] hover:bg-surface-2 hover:text-ink active:scale-90"
        >
          <MenuIcon open={mobileOpen} />
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
              <div ref={scrollRef} onScroll={updateJump} className="flex-1 overflow-y-auto">
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
                  <div className="pointer-events-auto relative mx-auto w-full max-w-3xl px-4 sm:px-6">
                    {/* Scroll-to-bottom — floats just above the composer, only
                        while scrolled away from the latest message. */}
                    <ScrollToBottom show={showJump} onClick={() => scrollToBottom(true)} />
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

/**
 * Calm inline notice for connection / server problems. The message is already a
 * friendly, classified sentence from api.describeError (offline / unreachable /
 * timeout / a specific server message), so it's shown as-is.
 */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-ink">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Scroll-to-bottom affordance — a small, theme-matching circular button that
 * fades/scales in only when the user has scrolled away from the latest message,
 * sitting just above the composer without obstructing content.
 */
function ScrollToBottom({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={onClick}
          aria-label="Scroll to latest message"
          initial={{ opacity: 0, y: 8, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.85 }}
          transition={{ duration: 0.2, ease }}
          // Positioned with non-transform CSS only: framer-motion drives `transform`
          // (the y/scale entrance), so any Tailwind `translate-*` here would be
          // overridden and the button would drop onto the composer. `bottom-full`
          // pins it just above the composer (which grows upward), `mb-2.5` is the
          // small gap, `left-0 right-0 mx-auto` centers it, and `z-10` keeps it
          // above the composer's glass stacking context.
          className="focus-ring glass absolute bottom-full left-0 right-0 z-10 mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-soft shadow-lift transition-colors hover:text-ink"
        >
          <ArrowDown className="h-[18px] w-[18px]" strokeWidth={2} />
        </motion.button>
      )}
    </AnimatePresence>
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
          with the IB Group mark sitting just above it (home/empty state only).
          `overflow-y-auto` + `my-auto` keep it centered when there's room but let
          it scroll instead of clipping when the mobile keyboard squeezes the
          visible viewport. */}
      <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-4 py-6 sm:py-10">
        <div className="my-auto flex w-full max-w-2xl flex-col items-center">
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
