import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoginScreen } from '@/screens/LoginScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { useAuth } from '@/lib/auth';
import { useChats } from '@/lib/chat-store';
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
  const [screen, setScreen] = useState<Screen>('login');

  // Auth gate: losing the user always returns to login.
  useEffect(() => {
    if (!user) setScreen('login');
  }, [user]);

  const authenticate = useCallback(
    async (name: string, password: string) => {
      if (!name.trim()) return;
      // Await the backend login so `user` is set before we leave the login
      // screen — otherwise the auth gate would bounce us straight back.
      await login(name, password);
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
    </NavProvider>
  );
}
