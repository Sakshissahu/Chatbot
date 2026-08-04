/*
  ───────────────────────────────────────────────────────────────────────────
  UI config — a few SAFE knobs you can tune without hunting through components.
  ───────────────────────────────────────────────────────────────────────────

  This is intentionally tiny (not an open-ended theming system). Edit the values
  below and reload; `applyUiConfig()` (called once in main.tsx) writes them to CSS
  custom properties on <html>, and `dur()` in lib/motion.ts reads `motionScale`
  for framer-motion timings. Colours, spacing and component structure are NOT
  knobs here — those live in index.css / tailwind.config.ts by design.

  Knobs:
    • motionScale  — global animation-speed multiplier. 1 = stock. Lower = snappier
                     (0.5 ≈ twice as fast), higher = slower/calmer (1.5). Scales both
                     CSS-driven motion (via --ui-motion-scale) and framer-motion
                     durations routed through lib/motion.ts. prefers-reduced-motion
                     still wins regardless of this value.
    • fontSans     — base UI / body typeface (the `font-sans` family).
    • fontDisplay  — headings / brand typeface (the `.display` family).

  Both font knobs accept a full CSS font-family list so a fallback stack survives.
  Keep the bundled @fontsource imports in index.css in sync if you swap families.
*/

export interface UiConfig {
  /** Global animation-speed multiplier. 1 = stock; <1 faster, >1 slower. */
  motionScale: number;
  /** Base UI/body font family stack. */
  fontSans: string;
  /** Display/heading font family stack. */
  fontDisplay: string;
}

export const UI_CONFIG: UiConfig = {
  motionScale: 1,
  fontSans: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontDisplay:
    '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
};

/**
 * Push the config into CSS custom properties on the document root. index.css
 * ships matching defaults, so this only needs to run to apply overrides — call
 * it once at startup (see main.tsx). No-op outside the browser.
 */
export function applyUiConfig(config: UiConfig = UI_CONFIG): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--ui-motion-scale', String(config.motionScale));
  root.style.setProperty('--font-sans', config.fontSans);
  root.style.setProperty('--font-display', config.fontDisplay);
}
