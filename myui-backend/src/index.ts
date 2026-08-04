import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { config, isAllowedOrigin } from './config';
import { initSchema, pool } from './db';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import voiceRoutes from './routes/voice';

const app = express();

// CORS. In local dev the browser reaches us same-origin via the Vite /bff
// proxy, so no CORS header is needed. In a deployed setup the frontend is
// served from another origin and reaches us cross-origin, so we must
// reflect the caller's Origin when it is allow-listed (config.allowedOrigins,
// from ALLOWED_ORIGIN). Requests with no Origin (curl, health probes,
// server-to-server) are always permitted. We use a function form so the exact
// Origin is reflected (not `*`) and `Vary: Origin` is set — and crucially this
// only sets response headers, so it never buffers or rewrites the SSE body:
// progressive token delivery is unaffected.
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || isAllowedOrigin(origin)) return cb(null, true);
      console.warn(`[cors] blocked disallowed origin: ${origin}`);
      cb(null, false);
    },
  }),
);
app.use(express.json({ limit: '1mb' }));

// Liveness + dependency reachability (used by the UI to pre-warn if down).
app.get('/bff/health', async (_req, res) => {
  const out = { ok: true, db: false, ragflow: false };
  try {
    await pool.query('select 1');
    out.db = true;
  } catch {
    /* db down */
  }
  try {
    const r = await fetch(config.ragflow.baseUrl, { signal: AbortSignal.timeout(4000) });
    out.ragflow = r.status > 0;
  } catch {
    /* ragflow unreachable */
  }
  res.json(out);
});

app.use('/bff/auth', authRoutes);
app.use('/bff/conversations', conversationRoutes);
app.use('/bff/voice', voiceRoutes);

// Single-port mode: if the frontend has been built (myui/dist exists), serve it
// from this same server so ONE port hosts both the UI and the /bff API
// (same-origin, no CORS). If dist is absent (pure dev), this is skipped and the
// Vite dev server on :5173 proxies /bff here instead. Build with:
//   cd myui && npm run build
const clientDist = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../myui/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-/bff GET returns index.html so client-side routing works.
  app.get(/^\/(?!bff\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`[static] serving frontend from ${clientDist}`);
} else {
  console.log('[static] no myui/dist build found — API-only (use the Vite dev server for the UI)');
}

// Central error handler so async route rejections become clean 500s.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error.' });
});

async function main(): Promise<void> {
  await initSchema();
  console.log('[db] schema ready');
  app.listen(config.port, () => {
    console.log(`[bff] listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('[bff] failed to start:', err);
  process.exit(1);
});
