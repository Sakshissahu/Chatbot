/*
  Client for the IB Group chat backend (the BFF), not RAGFlow directly.

  The backend logs every Q&A to Postgres and proxies RAGFlow's SSE stream
  through to us *verbatim* — so the frame shape below is identical to what
  RAGFlow emits, and the streaming parser is the same one that used to live in
  ragflow.ts. The RAGFlow beta token now lives backend-side; the browser only
  ever carries an opaque session token.

    Stream frames:  data:{"code":0,"data":{answer, reference, ...}}
    terminated by   data:{"code":0,"data":true}
*/

import type { RoleId } from '@/lib/roles';

// Where the backend (BFF) lives.
//
//  • Local dev: VITE_BACKEND_URL is unset, so BASE is the relative `/bff`
//    prefix and the Vite dev proxy forwards it to http://localhost:8088
//    (same-origin in the browser — no CORS).
//  • Vercel build: VITE_BACKEND_URL is set to the Cloudflare tunnel URL
//    (e.g. https://something.trycloudflare.com), so BASE becomes an absolute
//    cross-origin URL like https://something.trycloudflare.com/bff. Vite
//    inlines this at build time, so it must be set before `vite build`.
//
// VITE_BFF_BASE still overrides just the path prefix if ever needed.
const BACKEND = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').replace(/\/+$/, '');
const PREFIX = (import.meta.env.VITE_BFF_BASE as string | undefined) ?? '/bff';
const BASE = `${BACKEND}${PREFIX}`;

export interface Chunk {
  id?: string;
  content?: string;
  document_id?: string;
  document_name?: string;
  dataset_id?: string;
  image_id?: string;
  similarity?: number;
  url?: string;
}

export interface Reference {
  chunks?: Chunk[];
  doc_aggs?: { doc_id?: string; doc_name?: string; document_name?: string; count?: number }[];
  total?: number;
}

export interface ApiUser {
  id: string;
  username: string;
  role: string | null;
}

export interface ConversationDto {
  id: string;
  role: RoleId;
  bot_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageDto {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  citations: Reference | null;
  bot_id: string | null;
  created_at: string;
}

export interface AskUpdate {
  answer: string;
  reference?: Reference;
}

export class ApiError extends Error {}

// --- session token (set on login, cleared on logout) ---
let sessionToken: string | null = null;
export const setToken = (t: string | null) => {
  sessionToken = t;
};

function headers(extra: Record<string, string> = {}): HeadersInit {
  return sessionToken ? { Authorization: `Bearer ${sessionToken}`, ...extra } : extra;
}

async function jsonFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?');
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(msg);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Dummy login: any username proceeds. Returns a session token + user. */
export async function login(username: string, role?: RoleId): Promise<{ token: string; user: ApiUser }> {
  return jsonFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, role }),
  });
}

export async function listConversations(role?: RoleId): Promise<ConversationDto[]> {
  const qs = role ? `?role=${role}` : '';
  return jsonFetch(`/conversations${qs}`, { headers: headers() });
}

export async function createConversation(role: RoleId, title?: string): Promise<ConversationDto> {
  return jsonFetch('/conversations', {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role, title }),
  });
}

export async function getMessages(conversationId: string): Promise<MessageDto[]> {
  return jsonFetch(`/conversations/${conversationId}/messages`, { headers: headers() });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await jsonFetch(`/conversations/${conversationId}`, { method: 'DELETE', headers: headers() });
}

/**
 * Ask a question on a conversation. `onUpdate` fires on every streamed frame
 * with the cumulative answer so the UI renders it live. Resolves with the
 * final answer + reference once the stream completes.
 */
export async function sendMessage(
  conversationId: string,
  question: string,
  onUpdate: (u: AskUpdate) => void,
  signal?: AbortSignal,
): Promise<AskUpdate> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ question }),
      signal,
    });
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?');
  }
  if (!res.ok) {
    let msg = `The assistant ran into an error (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg);
  }
  if (!res.body) throw new ApiError('No response stream from the server.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let answer = '';
  let reference: Reference | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;

        let frame: { code?: number; message?: string; data?: AskUpdate | boolean };
        try {
          frame = JSON.parse(payload);
        } catch {
          continue; // malformed keep-alive
        }
        if (frame.code && frame.code !== 0) {
          throw new ApiError(frame.message || 'The assistant ran into an error.');
        }
        const data = frame.data;
        if (data === true) {
          reader.cancel();
          return { answer, reference };
        }
        if (data && typeof data === 'object') {
          if (typeof data.answer === 'string') answer = data.answer;
          if (data.reference && (data.reference.chunks?.length || data.reference.doc_aggs?.length)) {
            reference = data.reference;
          }
          onUpdate({ answer, reference });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { answer, reference };
}
