import { Router } from 'express';
import { pool } from '../db';
import { config, isRole } from '../config';
import { wrap } from '../http';

const router = Router();

/*
  POST /bff/auth/login  { username, password?, role? }
  Username-only login, optionally gated by a shared demo password
  (config.demoPassword / DEMO_PASSWORD). When that is set the request must carry
  the matching password; when blank, any username proceeds as before.
  Find-or-create the user by (case-insensitive) username, optionally record the
  chosen role, and return a session token the frontend uses for subsequent
  calls. The token is the user id for now.
*/
router.post(
  '/login',
  wrap(async (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    if (!username) {
      res.status(400).json({ error: 'A username is required.' });
      return;
    }
    // Shared demo password gate: only enforced when DEMO_PASSWORD is set.
    // Blank (the default) leaves login username-only, as before.
    if (config.demoPassword && req.body?.password !== config.demoPassword) {
      res.status(401).json({ error: 'Incorrect password.' });
      return;
    }
    const role = isRole(req.body?.role) ? req.body.role : null;

    const found = await pool.query<{ id: string; username: string; role: string | null }>(
      'select id, username, role from users where lower(username) = lower($1)',
      [username],
    );

    let user: { id: string; username: string; role: string | null };
    if (found.rows.length) {
      user = found.rows[0];
      if (role && role !== user.role) {
        await pool.query('update users set role = $1 where id = $2', [role, user.id]);
        user.role = role;
      }
    } else {
      const inserted = await pool.query<{ id: string; username: string; role: string | null }>(
        'insert into users (username, role) values ($1, $2) returning id, username, role',
        [username, role],
      );
      user = inserted.rows[0];
    }

    res.json({ token: user.id, user });
  }),
);

export default router;
