import { useState } from 'react';
import { motion } from 'framer-motion';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopBar, BackButton } from '@/components/TopBar';
import { RoleCard } from '@/components/RoleCard';
import { useNav } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { ROLE_LIST, type RoleId } from '@/lib/roles';

const ease = [0.22, 1, 0.36, 1] as const;

export function RoleSelectScreen() {
  const { selectRole, goHome, back } = useNav();
  const { user } = useAuth();
  // Brief highlight so the chosen card animates before the screen transitions.
  const [picked, setPicked] = useState<RoleId | null>(null);

  const choose = (id: RoleId) => {
    setPicked(id);
    selectRole(id);
  };

  return (
    <div data-role={picked ?? 'farmer'} className="grain relative flex min-h-dvh flex-col overflow-hidden">
      <AuroraBackground />
      <TopBar
        left={<Logo onClick={goHome} />}
        right={
          <>
            <ThemeToggle />
            <BackButton label="Sign out" onClick={back} />
          </>
        }
      />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-10 sm:px-8">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent"
        >
          {user?.name ? `Hello, ${user.name}` : 'Welcome'}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease }}
          className="display max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[2.6rem]"
        >
          Choose your assistant
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease }}
          className="mt-3 max-w-xl text-[1.02rem] leading-relaxed text-ink-soft"
        >
          Each space is grounded in its own IB Group knowledge base — every answer drawn straight
          from the source, with citations.
        </motion.p>

        <div className="mt-8 grid items-stretch gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
          {ROLE_LIST.map((r, i) => (
            <RoleCard
              key={r.id}
              role={r}
              index={i}
              selected={picked === r.id}
              onSelect={() => choose(r.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
