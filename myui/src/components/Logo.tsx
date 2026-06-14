import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  showWord?: boolean;
  /** When provided, the logo becomes a Home button. */
  onClick?: () => void;
}

/** IB Group wordmark with a growing-sprout mark; optionally a Home button. */
export function Logo({ className, showWord = true, onClick }: LogoProps) {
  const mark = (
    <>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-[hsl(var(--accent-ink))] shadow-soft">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M12 21c-4 0-6.4-2.6-6.4-6.7C5.6 9 9 6 18.4 6c0 9-2.9 11.5-6.4 11.5z"
            fill="hsl(var(--brand-soft))"
          />
          <path d="M12 21V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M12 13.5c1.2-1.4 2.6-2.3 4.2-3M12 16.5c.8-.9 1.7-1.5 2.8-2"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.8"
          />
        </svg>
      </span>
      {showWord && (
        <div className="leading-none text-left">
          <div className="display text-[1.05rem] font-semibold tracking-tight text-ink">
            IB Group
          </div>
          <div className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
            Knowledge Assistant
          </div>
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Home"
        aria-label="Home"
        className={cn(
          'focus-ring flex items-center gap-2.5 rounded-xl transition-opacity hover:opacity-80',
          className,
        )}
      >
        {mark}
      </button>
    );
  }

  return <div className={cn('flex items-center gap-2.5', className)}>{mark}</div>;
}
