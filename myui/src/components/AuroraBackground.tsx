import { motion } from 'framer-motion';

/**
 * Soft, slow agricultural "aurora" — layered radial blooms in the brand green
 * and the current role accent, drifting behind a frosted foreground.
 * Pure CSS/transform animation (no WebGL) so it's light and never janky.
 */
export function AuroraBackground({ animate = true }: { animate?: boolean }) {
  const float = (delay: number) =>
    animate
      ? {
          animate: { x: ['-4%', '5%', '-4%'], y: ['2%', '-6%', '2%'], scale: [1, 1.18, 1] },
          transition: { duration: 22, repeat: Infinity, ease: 'easeInOut', delay },
        }
      : {};

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* base wash */}
      <div className="absolute inset-0 bg-bg" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />

      <motion.div
        {...float(0)}
        className="absolute -left-[12%] -top-[18%] h-[55vw] w-[55vw] rounded-full opacity-60 blur-[100px]"
        style={{ background: 'radial-gradient(circle at 30% 30%, hsl(var(--accent)/0.42), transparent 64%)' }}
      />
      <motion.div
        {...float(4)}
        className="absolute -right-[10%] top-[6%] h-[48vw] w-[48vw] rounded-full opacity-60 blur-[100px]"
        style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--brand)/0.50), transparent 64%)' }}
      />
      <motion.div
        {...float(8)}
        className="absolute bottom-[-22%] left-[24%] h-[52vw] w-[52vw] rounded-full opacity-50 blur-[110px]"
        style={{ background: 'radial-gradient(circle at 50% 50%, hsl(var(--accent)/0.40), transparent 66%)' }}
      />

      {/* subtle contour grid for an "ordnance / field map" texture */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--ink)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--ink)) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent 75%)',
        }}
      />
    </div>
  );
}
