import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db';

/*
  Dummy auth, shaped for the real thing later.

  Login mints a session token that today is simply the user's id (a uuid).
  Every protected request carries it as `Authorization: Bearer <token>` (or
  `X-Session-Id`). When real auth lands, login issues a signed token and this
  middleware verifies it — the request surface here does not change.
*/

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; username: string };
    }
  }
}

function tokenFrom(req: Request): string | null {
  const auth = req.header('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const sid = req.header('x-session-id');
  return sid ? sid.trim() : null;
}

export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = tokenFrom(req);
  if (!token) {
    res.status(401).json({ error: 'Missing session token.' });
    return;
  }
  try {
    const { rows } = await pool.query<{ id: string; username: string }>(
      'select id, username from users where id = $1',
      [token],
    );
    if (!rows.length) {
      res.status(401).json({ error: 'Invalid session.' });
      return;
    }
    req.user = rows[0];
    next();
  } catch {
    // Malformed token (e.g. not a uuid) lands here.
    res.status(401).json({ error: 'Invalid session.' });
  }
}
