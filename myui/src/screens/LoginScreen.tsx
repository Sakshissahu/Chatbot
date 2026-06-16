import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Eye, EyeOff, Lock, User } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useNav } from '@/lib/nav';

const ease = [0.22, 1, 0.36, 1] as const;

export function LoginScreen() {
  const { authenticate } = useNav();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false); // default: don't persist past close
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
      await authenticate(name.trim(), password, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const nameError = touched && !name.trim();

  // Shared with the new app fields (see Composer): green focus border, no gold.
  const fieldClass =
    'flex items-center gap-2.5 rounded-2xl border bg-bg-2/60 px-3.5 transition-colors focus-within:border-primary/45';

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-bg">
      <LoginGlow />

      {/* Floating header — matches the chat home's borderless controls: brand
          lockup top-left, theme toggle top-right (Settings isn't reachable
          pre-login, so the toggle stays here by design). */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-12 pt-2 sm:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="w-full max-w-md"
        >
          <div className="rounded-3xl border border-border bg-surface p-7 shadow-soft sm:p-8">
            <div className="mb-7">
              <h1 className="display text-3xl font-semibold tracking-tight text-ink">
                Welcome back
              </h1>
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-soft">
                Sign in to reach IB Chicken Bot.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Username
                </label>
                <div className={`${fieldClass} ${nameError ? 'border-danger/60' : 'border-border'}`}>
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
                <div className={`${fieldClass} border-border`}>
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

              {/* Remember me — neutral box, IB-green when checked (no gold), to
                  match the inputs above and the button below. Default off, so
                  the token lands in sessionStorage and clears on browser close;
                  checking it persists to localStorage. */}
              <label className="mt-0.5 flex w-fit cursor-pointer items-center gap-2.5 select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`flex h-[18px] w-[18px] items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
                    remember ? 'border-primary bg-primary' : 'border-border bg-bg-2/60'
                  }`}
                >
                  <Check
                    className={`h-3 w-3 text-[hsl(var(--primary-ink))] transition-opacity ${
                      remember ? 'opacity-100' : 'opacity-0'
                    }`}
                    strokeWidth={3}
                  />
                </span>
                <span className="text-sm text-ink-soft">Keep me signed in</span>
              </label>

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

/**
 * Soft brand glow behind the login card — the SAME green-core + warm-gold bloom
 * used on the chat home (HomeGlow), centered behind the form. CSS-only, so it
 * stays light and matches the home-state look (no aurora drift / grid texture).
 */
function LoginGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* green core, centered */}
      <div
        className="absolute left-1/2 top-1/2 h-[620px] w-[620px] max-w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-[90px]"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--brand) / 0.45) 0%, hsl(var(--brand) / 0.16) 40%, transparent 70%)',
        }}
      />
      {/* warm gold bloom, offset above */}
      <div
        className="absolute left-1/2 top-[34%] h-[460px] w-[560px] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[80px]"
        style={{
          background: 'radial-gradient(circle, hsl(var(--accent) / 0.30) 0%, transparent 65%)',
        }}
      />
    </div>
  );
}
