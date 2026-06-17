import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Animated hamburger ↔ close icon. `open` morphs the three bars into an X and
 * back. Colour is inherited via `currentColor`, and the footprint matches the
 * lucide icons it sits beside (h-5 w-5 button glyphs). Adapted from a Skiper UI
 * micro-interaction to fit the app's icon language.
 */
export function MenuIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <div className={cn('relative grid h-4 w-5 place-items-center', className)} aria-hidden>
      <motion.span
        animate={{ y: open ? 0 : -5, rotate: open ? 45 : 0 }}
        transition={{ duration: 0.3, ease }}
        className="absolute h-0.5 w-full rounded-full bg-current"
      />
      <motion.span
        animate={{ opacity: open ? 0 : 1 }}
        transition={{ duration: 0.1 }}
        className="absolute h-0.5 w-full rounded-full bg-current"
      />
      <motion.span
        animate={{ y: open ? 0 : 5, rotate: open ? -45 : 0 }}
        transition={{ duration: 0.3, ease }}
        className="absolute h-0.5 w-full rounded-full bg-current"
      />
    </div>
  );
}
