import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Full-width application top bar — spans edge-to-edge on every screen so the
 * shell never looks like a floating panel. Screens compose their own controls
 * into the left / right slots; the bar guarantees consistent height, padding
 * and the hairline divider across all three screens.
 */
export function TopBar({
  left,
  right,
  className,
}: {
  left: ReactNode;
  right: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'relative z-30 flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/80 px-3 backdrop-blur-xl sm:px-5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">{left}</div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{right}</div>
    </header>
  );
}

/** A consistent, understated back control used on screens 2 and 3. */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex h-9 items-center gap-1 rounded-xl border border-border bg-surface/70 pl-1.5 pr-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
