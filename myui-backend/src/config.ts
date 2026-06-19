import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}. Copy .env.example to .env.`);
  return v;
}

export type RoleId = 'farmer' | 'employee';

export const ROLE_LABELS: Record<RoleId, string> = {
  farmer: 'Farmer',
  employee: 'Employee',
};

// Comma-separated list of allowed browser origins for CORS. Entries may use a
// single `*` wildcard for one label, e.g. `https://*.vercel.app` matches any
// Vercel deploy URL. ALLOWED_ORIGIN is the canonical name; CORS_ORIGIN is kept
// as a backwards-compatible fallback. The default covers Vite dev + Vercel so
// the per-demo helper never has to touch backend config when the tunnel
// (frontend → backend URL) rotates.
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'https://*.vercel.app'];

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 8088),
  databaseUrl: required('DATABASE_URL'),
  // Optional shared demo password gate. When set, login requires this exact
  // value; left blank (the default), no password check runs and any username
  // proceeds — preserving local-dev behavior.
  demoPassword: (process.env.DEMO_PASSWORD ?? '').trim(),
  allowedOrigins: (() => {
    const fromEnv = parseOrigins(process.env.ALLOWED_ORIGIN ?? process.env.CORS_ORIGIN);
    return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
  })(),
  ragflow: {
    baseUrl: (process.env.RAGFLOW_BASE_URL ?? 'http://localhost:80').replace(/\/+$/, ''),
    betaToken: required('RAGFLOW_BETA_TOKEN'),
  },
  bots: {
    farmer: required('FARMER_BOT_ID'),
    employee: required('EMPLOYEE_BOT_ID'),
  } as Record<RoleId, string>,
  // Google Cloud Speech (STT + TTS) over the REST API, authenticated with a
  // plain API key (?key=...). Optional: left blank, voice is disabled and the
  // /bff/voice routes return a graceful "voice_not_configured" response.
  googleSpeech: {
    apiKey: (process.env.GOOGLE_SPEECH_API_KEY ?? '').trim(),
  },
};

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True if `origin` matches one of the configured allowed origins. A `*` in a
 * pattern matches a single host label (no dots), so `https://*.vercel.app`
 * matches `https://myui-abc.vercel.app` but not a deeper subdomain.
 */
export function isAllowedOrigin(origin: string): boolean {
  const o = origin.replace(/\/+$/, '');
  return config.allowedOrigins.some((pattern) => {
    if (pattern === '*') return true;
    if (!pattern.includes('*')) return pattern === o;
    const re = new RegExp('^' + pattern.split('*').map(escapeRegex).join('[^.]*') + '$');
    return re.test(o);
  });
}

export const isRole = (r: unknown): r is RoleId => r === 'farmer' || r === 'employee';
export const botFor = (role: RoleId): string => config.bots[role];
