import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TopBar } from '@/components/TopBar';
import { useNav } from '@/lib/nav';

const ease = [0.22, 1, 0.36, 1] as const;

export function LoginScreen() {
  const { authenticate } = useNav();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await authenticate(name.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const nameError = touched && !name.trim();

  return (
    <div className="grain relative flex min-h-dvh flex-col overflow-hidden">
      <AuroraBackground />
      <TopBar left={<Logo />} right={<ThemeToggle />} />

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="w-full max-w-md"
        >
          <div className="glass rounded-3xl border border-border p-7 shadow-lift sm:p-9">
            <div className="mb-7">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Knowledge Assistant
              </p>
              <h1 className="display text-3xl font-semibold tracking-tight text-ink">
                Welcome back
              </h1>
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-soft">
                Sign in to reach the IB Group knowledge base.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Username
                </label>
                <div
                  className={`flex items-center gap-2.5 rounded-2xl border bg-surface/70 px-3.5 transition-colors focus-within:border-accent/60 ${
                    nameError ? 'border-danger/60' : 'border-border'
                  }`}
                >
                  <User className="h-4 w-4 shrink-0 text-ink-faint" />
                  <input
                    id="username"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. asha"
                    autoComplete="username"
                    autoFocus
                    className="w-full bg-transparent py-3 text-[0.98rem] text-ink placeholder:text-ink-faint focus:outline-none"
                  />
                </div>
                {nameError && (
                  <p className="mt-1.5 text-xs text-danger">Please enter a username to continue.</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Password
                </label>
                <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface/70 px-3.5 transition-colors focus-within:border-accent/60">
                  <Lock className="h-4 w-4 shrink-0 text-ink-faint" />
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-transparent py-3 text-[0.98rem] text-ink placeholder:text-ink-faint focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="focus-ring shrink-0 rounded-lg p-1 text-ink-faint transition-colors hover:text-ink-soft"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="focus-ring group mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 font-display text-[0.98rem] font-semibold text-[hsl(var(--primary-ink))] shadow-soft transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Signing in…' : 'Sign in'}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </form>
          </div>

          <p className="mt-5 px-2 text-center text-xs leading-relaxed text-ink-faint">
            Demo sign-in — any details work. Your username personalises the chat.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
