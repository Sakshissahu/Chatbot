import { MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  showWord?: boolean;
  /** When provided, the logo becomes a Home button. */
  onClick?: () => void;
}

/** Chatbot badge mark, optionally paired with the wordmark; optionally a Home button. */
export function Logo({ className, showWord = true, onClick }: LogoProps) {
  const mark = (
    <>
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-xl bg-primary text-primary-ink shadow-soft"
      >
        <MessagesSquare className="h-5 w-5" strokeWidth={2.25} />
      </span>
      {showWord && (
        <span className="display text-[1.05rem] font-semibold tracking-tight text-ink">
          Chatbot
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
