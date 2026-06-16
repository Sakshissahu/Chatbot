import { cn } from '@/lib/cn';
import logoUrl from '@/assets/ibg-logo.png';

interface LogoProps {
  className?: string;
  showWord?: boolean;
  /** When provided, the logo becomes a Home button. */
  onClick?: () => void;
}

/** IB Chicken Bot badge mark, optionally paired with the wordmark; optionally a Home button. */
export function Logo({ className, showWord = true, onClick }: LogoProps) {
  const mark = (
    <>
      <img
        src={logoUrl}
        alt="IB Chicken Bot"
        draggable={false}
        className="h-10 w-10 shrink-0 select-none object-contain"
      />
      {showWord && (
        <span className="display text-[1.05rem] font-semibold tracking-tight text-ink">
          IB Chicken Bot
        </span>
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
