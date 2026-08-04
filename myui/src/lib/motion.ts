/*
  Shared motion vocabulary. Centralises the easing curve the whole app already
  used inline (`[0.22, 1, 0.36, 1]` — ease-out-quart-ish, no overshoot) and lets
  the `motionScale` knob in lib/ui-config.ts scale framer-motion durations the
  same way it scales CSS-driven motion. Import `EASE`, `dur()` and the spring
  presets instead of re-declaring them per file.
*/
import { UI_CONFIG } from '@/lib/ui-config';

/** App-wide easing — gentle ease-out, no bounce/elastic (matches index.css). */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Scale a duration (in seconds) by the global motionScale knob. */
export const dur = (seconds: number): number => seconds * UI_CONFIG.motionScale;

/**
 * Critically-damped panel spring — drives sidebar geometry so it settles with no
 * overshoot. Springs are physical (frame-rate based), so they're intentionally
 * NOT scaled by motionScale; tweens via `dur()` are the speed-tunable path.
 */
export const panelSpring = { type: 'spring', stiffness: 420, damping: 44, mass: 1 } as const;

/** Short content cross-fade used between swapped panels. */
export const contentFade = { duration: dur(0.16), ease: EASE } as const;
