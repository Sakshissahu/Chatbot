import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { RoleConfig } from '@/lib/roles';

export function RoleCard({
  role,
  selected,
  onSelect,
  index,
}: {
  role: RoleConfig;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const Icon = role.icon;

  // pointer-driven tilt + spotlight
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [6, -6]), { stiffness: 180, damping: 18 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-7, 7]), { stiffness: 180, damping: 18 });
  const spotX = useTransform(px, (v) => `${v * 100}%`);
  const spotY = useTransform(py, (v) => `${v * 100}%`);

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      data-role={role.id}
      onClick={onSelect}
      onMouseMove={onMove}
      onMouseLeave={reset}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className={`group relative flex w-full flex-col overflow-hidden rounded-[1.75rem] border bg-surface/80 p-6 text-left shadow-soft backdrop-blur-md transition-[box-shadow,border-color,transform] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-7 ${
        selected
          ? 'border-accent shadow-glow'
          : 'border-border hover:-translate-y-1 hover:shadow-lift'
      }`}
    >
      {/* spotlight */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useTransform(
            [spotX, spotY],
            ([x, y]) => `radial-gradient(340px circle at ${x} ${y}, hsl(var(--accent)/0.16), transparent 60%)`,
          ),
        }}
      />
      {/* accent corner glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-60 blur-2xl"
        style={{ background: 'radial-gradient(circle, hsl(var(--accent)/0.5), transparent 70%)' }}
      />

      <div className="relative flex items-start justify-between">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/14 text-accent ring-1 ring-accent/25 transition-transform duration-300 group-hover:scale-105">
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <span
          className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all duration-300 ${
            selected
              ? 'bg-accent text-[hsl(var(--accent-ink))]'
              : 'bg-bg-2 text-ink-faint group-hover:text-accent'
          }`}
        >
          {selected ? 'Selected' : 'Choose'}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <h3 className="display relative mt-5 text-2xl font-semibold text-ink">
        I’m {anWord(role.label)} <span className="text-accent">{role.label}</span>
      </h3>
      <p className="relative mt-0.5 text-sm font-medium text-accent/90">{role.tagline}</p>
      <p className="relative mt-3 text-[0.92rem] leading-relaxed text-ink-soft">{role.blurb}</p>

      <span className="relative mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-bg-2 px-3 py-1 text-[0.7rem] font-medium text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {role.corpus}
      </span>
    </motion.button>
  );
}

const anWord = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
