import type { CSSProperties } from 'react';

type ProgressiveBlurProps = {
  className?: string;
  /** Defaults to the page background so it themes for light AND dark. */
  backgroundColor?: string;
  position?: 'top' | 'bottom';
  height?: string;
  blurAmount?: string;
};

/**
 * Progressive blur — content dissolves under a borderless, transparent fade.
 * Adapted from _ref/ProgressiveBlur.tsx. The default background tracks the
 * page color (`--bg`), so the fade is correct in both light and dark themes.
 * Used WEB-ONLY as a top fade over the message scroll area (the web shell has
 * no top bar). Always `pointer-events-none` so it never blocks scrolling.
 */
export function ProgressiveBlur({
  className = '',
  backgroundColor = 'hsl(var(--bg))',
  position = 'top',
  height = '6rem',
  blurAmount = '8px',
}: ProgressiveBlurProps) {
  const isTop = position === 'top';
  const mask = isTop
    ? `linear-gradient(to bottom, ${backgroundColor} 50%, transparent)`
    : `linear-gradient(to top, ${backgroundColor} 50%, transparent)`;

  const style: CSSProperties = {
    height,
    background: isTop
      ? `linear-gradient(to top, transparent, ${backgroundColor})`
      : `linear-gradient(to bottom, transparent, ${backgroundColor})`,
    maskImage: mask,
    WebkitMaskImage: mask,
    WebkitBackdropFilter: `blur(${blurAmount})`,
    backdropFilter: `blur(${blurAmount})`,
    ...(isTop ? { top: 0 } : { bottom: 0 }),
  };

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-0 w-full select-none ${className}`}
      style={style}
    />
  );
}
