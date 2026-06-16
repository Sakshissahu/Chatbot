import { Router } from 'express';
import { pool } from '../db';
import { requireUser } from '../middleware/auth';
import { botFor, isRole, type RoleId } from '../config';
import { askStream, createSession, parseFrames, type Reference } from '../ragflow';
import { titleFrom, wrap } from '../http';

const router = Router();
router.use(requireUser);

interface ConversationRow {
  id: string;
  role: RoleId;
  bot_id: string;
  ragflow_session_id: string | null;
  title: string;
}

/** Load a conversation only if it belongs to the requesting user. */
async function ownedConversation(id: string, userId: string): Promise<ConversationRow | null> {
  try {
    const { rows } = await pool.query<ConversationRow>(
      'select id, role, bot_id, ragflow_session_id, title from conversations where id = $1 and user_id = $2',
      [id, userId],
    );
    return rows[0] ?? null;
  } catch {
    return null; // malformed uuid
  }
}

// GET /bff/conversations[?role=farmer]  — list the user's conversations.
router.get(
  '/',
  wrap(async (req, res) => {
    const params: unknown[] = [req.user!.id];
    let where = 'user_id = $1';
    const role = req.query.role;
    if (typeof role === 'string' && isRole(role)) {
      params.push(role);
      where += ' and role = $2';
    }
    const { rows } = await pool.query(
      `select id, role, bot_id, title, created_at, updated_at
         from conversations
        where ${where}
        order by updated_at desc`,
      params,
    );
    res.json(rows);
  }),
);

// POST /bff/conversations  { role, title? }  — create a thread + RAGFlow session.
router.post(
  '/',
  wrap(async (req, res) => {
    const role = req.body?.role;
    if (!isRole(role)) {
      res.status(400).json({ error: 'A valid role (farmer|employee) is required.' });
      return;
    }
    let sessionId: string;
    try {
      sessionId = await createSession(role, req.user!.username);
    } catch (err) {
      res.status(502).json({ error: `Could not reach the assistant: ${(err as Error).message}` });
      return;
    }
    const title = String(req.body?.title ?? '').trim().slice(0, 120) || 'New chat';
    const { rows } = await pool.query(
      `insert into conversations (user_id, role, bot_id, ragflow_session_id, title)
       values ($1, $2, $3, $4, $5)
       returning id, role, bot_id, title, created_at, updated_at`,
      [req.user!.id, role, botFor(role), sessionId, title],
    );
    res.status(201).json(rows[0]);
  }),
);

// GET /bff/conversations/:id/messages  — full transcript, oldest first.
router.get(
  '/:id/messages',
  wrap(async (req, res) => {
    const conv = await ownedConversation(req.params.id, req.user!.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    const { rows } = await pool.query(
      `select id, sender, content, citations, bot_id, created_at
         from messages
        where conversation_id = $1
        order by created_at asc`,
      [conv.id],
    );
    res.json(rows);
  }),
);

// DELETE /bff/conversations/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    let result;
    try {
      result = await pool.query('delete from conversations where id = $1 and user_id = $2', [
        req.params.id,
        req.user!.id,
      ]);
    } catch {
      res.status(404).end();
      return;
    }
    res.status(result.rowCount ? 204 : 404).end();
  }),
);

// PATCH /bff/conversations/:id  { title }  — rename a thread (title only).
router.patch(
  '/:id',
  wrap(async (req, res) => {
    const title = String(req.body?.title ?? '').trim().slice(0, 120);
    if (!title) {
      res.status(400).json({ error: 'A title is required.' });
      return;
    }
    let result;
    try {
      result = await pool.query(
        `update conversations set title = $1
           where id = $2 and user_id = $3
         returning id, role, bot_id, title, created_at, updated_at`,
        [title, req.params.id, req.user!.id],
      );
    } catch {
      res.status(404).end(); // malformed uuid
      return;
    }
    if (!result.rowCount) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    res.json(result.rows[0]);
  }),
);

/*
  POST /bff/conversations/:id/messages  { question }   ->  SSE

  The heart of the proxy. We:
    1. log the user's question,
    2. open RAGFlow's SSE stream,
    3. re-emit each frame verbatim to the browser (preserving the live typing
       effect and the exact frame shape myui already parses),
    4. accumulate the final cumulative answer + citations,
    5. log one assistant row once the stream ends (refusal/partial included).
*/
router.post(
  '/:id/messages',
  wrap(async (req, res) => {
    const conv = await ownedConversation(req.params.id, req.user!.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    const question = String(req.body?.question ?? '').trim();
    if (!question) {
      res.status(400).json({ error: 'An empty question cannot be sent.' });
      return;
    }
    const role = conv.role;

    // Ensure a RAGFlow session exists for this thread.
    let sessionId = conv.ragflow_session_id;
    if (!sessionId) {
      try {
        sessionId = await createSession(role, req.user!.username);
      } catch (err) {
        res.status(502).json({ error: `Could not reach the assistant: ${(err as Error).message}` });
        return;
      }
      await pool.query('update conversations set ragflow_session_id = $1 where id = $2', [
        sessionId,
        conv.id,
      ]);
    }

    // Title the thread from its first question (safety net; usually set at create).
    const { rows: countRows } = await pool.query<{ n: string }>(
      'select count(*)::int as n from messages where conversation_id = $1',
      [conv.id],
    );
    const isFirst = Number(countRows[0]?.n ?? 0) === 0;

    // 1) Log the user's question up front.
    await pool.query(
      `insert into messages (conversation_id, sender, content, bot_id) values ($1, 'user', $2, $3)`,
      [conv.id, question, conv.bot_id],
    );
    if (isFirst) {
      await pool.query(
        `update conversations set title = $1 where id = $2 and title = 'New chat'`,
        [titleFrom(question), conv.id],
      );
    }

    // 2) Open the upstream stream.
    let upstream: Response;
    try {
      upstream = await askStream({ role, sessionId, question, userName: req.user!.username });
    } catch (err) {
      res.status(502).json({ error: `Could not reach the assistant: ${(err as Error).message}` });
      return;
    }
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: `Assistant responded ${upstream.status}.` });
      return;
    }

    // Stream as SSE; X-Accel-Buffering:no keeps proxies from buffering tokens.
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let answer = '';
    let reference: Reference | null = null;
    let clientGone = false;
    res.on('close', () => {
      clientGone = true;
    });

    try {
      for await (const frame of parseFrames(upstream.body)) {
        // 3) Re-emit verbatim — myui's parser consumes this unchanged.
        res.write(`data:${JSON.stringify(frame)}\n\n`);

        const data = frame.data;
        if (data === true) break; // terminal frame
        if (data && typeof data === 'object') {
          if (typeof data.answer === 'string') answer = data.answer;
          if (data.reference && (data.reference.chunks?.length || data.reference.doc_aggs?.length)) {
            reference = data.reference;
          }
        }
        if (clientGone) break;
      }
    } catch {
      // Surface a RAGFlow-shaped error frame so the browser shows it.
      if (!clientGone) res.write(`data:${JSON.stringify({ code: 500, message: 'The stream was interrupted.' })}\n\n`);
    } finally {
      // 5) Log the assistant reply regardless of how the stream ended.
      try {
        await pool.query(
          `insert into messages (conversation_id, sender, content, citations, bot_id)
           values ($1, 'assistant', $2, $3, $4)`,
          [conv.id, answer, reference ? JSON.stringify(reference) : null, conv.bot_id],
        );
        await pool.query('update conversations set updated_at = now() where id = $1', [conv.id]);
      } catch (err) {
        console.error('[messages] failed to log assistant reply:', err);
      }
      res.end();
    }
  }),
);

export default router;
