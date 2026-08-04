import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { LoginScreen } from '@/screens/LoginScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { useAuth } from '@/lib/auth';
import { useChats } from '@/lib/chat-store';
import { useAppHeight } from '@/lib/use-app-height';
import { NavProvider, type NavCtx, type Screen } from '@/lib/nav';

const ease = [0.22, 1, 0.36, 1] as const;

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.32, ease },
};

// Single assistant: every user talks to the farmer knowledge base. The backend
// still routes by this role id, so it stays 'farmer' end-to-end.
const ROLE = 'farmer' as const;

export default function App() {
  const { user, login, logout } = useAuth();
  const { enterRole } = useChats();
  // Keep --app-height tracking the visible viewport across both screens so the
  // shell follows the mobile keyboard (see use-app-height).
  useAppHeight();
  // A remembered session is restored synchronously in AuthProvider, so a
  // returning user starts in the chat and skips login.
  const [screen, setScreen] = useState<Screen>(user ? 'chat' : 'login');

  // Auth gate: losing the user always returns to login.
  useEffect(() => {
    if (!user) setScreen('login');
  }, [user]);

  // Restored session: open the workspace once on mount, mirroring authenticate().
  // Fresh logins go through authenticate (which enters the role itself), so this
  // only fires for a session that was already present at load. The ref keeps it
  // idempotent under React StrictMode's double-invoked dev effects.
  const restored = useRef(false);
  useEffect(() => {
    if (user && !restored.current) {
      restored.current = true;
      enterRole(ROLE);
    }
  }, []); // mount-only — deliberately reads the load-time user

  const authenticate = useCallback(
    async (name: string, password: string, remember = false) => {
      if (!name.trim()) return;
      // Await the backend login so `user` is set before we leave the login
      // screen — otherwise the auth gate would bounce us straight back.
      await login(name, password, remember);
      // No role-select step: open the farmer workspace straight away.
      enterRole(ROLE);
      setScreen('chat');
    },
    [login, enterRole],
  );

  const nav = useMemo<NavCtx>(
    () => ({
      screen,
      authenticate,
      signOut: () => logout(),
    }),
    [screen, authenticate, logout],
  );

  return (
    <NavProvider value={nav}>
      {/* reducedMotion="user" makes every framer-motion transition honour the
          OS "reduce motion" setting (transforms collapse to instant/crossfade)
          without per-component guards. CSS motion is tamed in index.css. */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait">
          {screen === 'login' && (
            <motion.div key="login" {...fade}>
              <LoginScreen />
            </motion.div>
          )}
          {screen === 'chat' && (
            <motion.div key="chat" {...fade}>
              <ChatScreen roleId={ROLE} />
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </NavProvider>
  );
}
