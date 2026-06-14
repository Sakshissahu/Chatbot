import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoginScreen } from '@/screens/LoginScreen';
import { RoleSelectScreen } from '@/screens/RoleSelectScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { useAuth } from '@/lib/auth';
import { useChats } from '@/lib/chat-store';
import { NavProvider, type NavCtx, type Screen } from '@/lib/nav';
import type { RoleId } from '@/lib/roles';

const ease = [0.22, 1, 0.36, 1] as const;

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.32, ease },
};

export default function App() {
  const { user, login, logout } = useAuth();
  const { enterRole } = useChats();
  const [screen, setScreen] = useState<Screen>('login');
  const [activeRole, setActiveRole] = useState<RoleId | null>(null);

  // Auth gate: losing the user always returns to login.
  useEffect(() => {
    if (!user) {
      setScreen('login');
      setActiveRole(null);
    }
  }, [user]);

  const authenticate = useCallback(
    async (name: string, password: string) => {
      if (!name.trim()) return;
      // Await the backend login so `user` is set before we leave the login
      // screen — otherwise the auth gate would bounce us straight back.
      await login(name, password);
      setScreen('role');
    },
    [login],
  );

  const selectRole = useCallback(
    (role: RoleId) => {
      setActiveRole(role);
      enterRole(role);
      setScreen('chat');
    },
    [enterRole],
  );

  const nav = useMemo<NavCtx>(
    () => ({
      screen,
      activeRole,
      authenticate,
      goHome: () => setScreen('role'),
      back: () => {
        if (screen === 'chat') setScreen('role');
        else if (screen === 'role') logout(); // gate effect returns to login
      },
      selectRole,
      signOut: () => logout(),
    }),
    [screen, activeRole, authenticate, selectRole, logout],
  );

  return (
    <NavProvider value={nav}>
      <AnimatePresence mode="wait">
        {screen === 'login' && (
          <motion.div key="login" {...fade}>
            <LoginScreen />
          </motion.div>
        )}
        {screen === 'role' && (
          <motion.div key="role" {...fade}>
            <RoleSelectScreen />
          </motion.div>
        )}
        {screen === 'chat' && activeRole && (
          <motion.div key="chat" {...fade}>
            <ChatScreen roleId={activeRole} />
          </motion.div>
        )}
      </AnimatePresence>
    </NavProvider>
  );
}
