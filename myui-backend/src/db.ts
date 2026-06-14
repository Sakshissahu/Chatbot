import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config';

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(here, '..', 'db', 'schema.sql');

/** Apply the (idempotent) schema, retrying while Postgres finishes booting. */
export async function initSchema(): Promise<void> {
  const sql = readFileSync(SCHEMA_PATH, 'utf8');
  let attempt = 0;
  // ~30s of retries: the container's healthcheck usually clears well before this.
  while (true) {
    try {
      await pool.query(sql);
      return;
    } catch (err) {
      if (++attempt > 15) throw err;
      console.log(`[db] Postgres not ready yet (attempt ${attempt}); retrying in 2s…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
