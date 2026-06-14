import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const hsl = (v: string) => `hsl(var(${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: hsl('--bg'),
        'bg-2': hsl('--bg-2'),
        surface: hsl('--surface'),
        'surface-2': hsl('--surface-2'),
        ink: hsl('--ink'),
        'ink-soft': hsl('--ink-soft'),
        'ink-faint': hsl('--ink-faint'),
        border: hsl('--border'),
        brand: hsl('--brand'),
        'brand-soft': hsl('--brand-soft'),
        accent: hsl('--accent'),
        'accent-soft': hsl('--accent-soft'),
        'accent-ink': hsl('--accent-ink'),
        danger: hsl('--danger'),
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk Variable"', '"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--shadow) / 0.04), 0 8px 24px -8px hsl(var(--shadow) / 0.12)',
        lift: '0 2px 4px hsl(var(--shadow) / 0.06), 0 24px 48px -16px hsl(var(--shadow) / 0.22)',
        glow: '0 0 0 1px hsl(var(--accent) / 0.30), 0 16px 40px -12px hsl(var(--accent) / 0.35)',
      },
      keyframes: {
        'aurora-drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
          '50%': { transform: 'translate3d(3%, -4%, 0) rotate(8deg) scale(1.15)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'aurora-drift': 'aurora-drift 18s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        breathe: 'breathe 1.4s ease-in-out infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [typography],
} satisfies Config;
