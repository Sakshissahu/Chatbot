import express from 'express';
import cors from 'cors';
import { config, isAllowedOrigin } from './config';
import { initSchema, pool } from './db';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import voiceRoutes from './routes/voice';

const app = express();

// CORS. In local dev the browser reaches us same-origin via the Vite /bff
// proxy, so no CORS header is needed. In the deployed demo the frontend lives
// on Vercel and reaches us cross-origin through a Cloudflare tunnel, so we must
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
