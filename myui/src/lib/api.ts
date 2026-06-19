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

/** Thrown when the backend has no Google Speech key — voice is disabled. */
export class VoiceNotConfiguredError extends ApiError {
  constructor() {
    super('voice_not_configured');
  }
}

// --- session persistence (set on login, cleared on logout) ---
//
// A session = the opaque token + the minimal user it belongs to. "Remember me"
// decides WHERE it lives so the token survives the right amount of time:
//   • checked   → localStorage  (survives browser/tab close)
//   • unchecked → sessionStorage (cleared when the tab/browser closes)
// We always mirror-clear the other store so a session never lingers in both.
// `sessionToken` stays the in-memory value the request headers read.
const SESSION_KEY = 'ibg-session';

interface PersistedSession {
  token: string;
  user: { id: string; name: string };
}

let sessionToken: string | null = null;

const store = (remember: boolean): Storage => (remember ? localStorage : sessionStorage);

/** Persist the session and make its token the active (in-memory) one. */
export function saveSession(session: PersistedSession, remember: boolean): void {
  sessionToken = session.token;
  try {
    store(remember).setItem(SESSION_KEY, JSON.stringify(session));
    store(!remember).removeItem(SESSION_KEY);
  } catch {
    /* storage blocked (private mode / quota) — fall back to in-memory only */
  }
}

/**
 * Restore a persisted session on startup, checking localStorage first then
 * sessionStorage. Re-activates the in-memory token. Returns null if none/invalid.
 */
export function loadSession(): PersistedSession | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (typeof parsed.token !== 'string' || typeof parsed.user?.id !== 'string') return null;
    sessionToken = parsed.token;
    return { token: parsed.token, user: { id: parsed.user.id, name: parsed.user.name ?? '' } };
  } catch {
    return null;
  }
}

/** Clear the session from memory and BOTH stores (sign out). */
export function clearSession(): void {
  sessionToken = null;
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

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

/**
 * Log in with a username (free-form) and password. The password is only checked
 * by the backend when a shared demo password is configured there; otherwise any
 * username proceeds. Returns a session token + user.
 */
export async function login(
  username: string,
  password: string,
  role?: RoleId,
): Promise<{ token: string; user: ApiUser }> {
  return jsonFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
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

/** Rename a conversation. Purely a title update — nothing else changes. */
export async function renameConversation(conversationId: string, title: string): Promise<void> {
  await jsonFetch(`/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title }),
  });
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

// --- voice (Google Speech via the backend) ------------------------------------
//
// Both endpoints answer { error: "voice_not_configured" } when the backend has
// no Google Speech key; we surface that as VoiceNotConfiguredError so the UI can
// show a friendly notice instead of a raw failure.

/** Read an { error } string from a failed response, if present. */
async function errorField(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: string };
    return body?.error ?? null;
  } catch {
    return null;
  }
}

/**
 * Transcribe recorded speech to text (Google STT). `audioBase64` is the raw
 * base64 payload (no data: prefix); `mimeType` is the recorder's container so
 * the backend can match the audio encoding. `preferredLanguage` is the user's
 * chosen voice-input language; the backend uses it as a recognizer hint
 * alongside English and Hindi.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  preferredLanguage?: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/voice/stt`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ audio: audioBase64, mimeType, preferredLanguage }),
    });
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?');
  }
  if (!res.ok) {
    const err = await errorField(res);
    if (err === 'voice_not_configured') throw new VoiceNotConfiguredError();
    throw new ApiError(err ?? `Could not transcribe the recording (${res.status}).`);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}

/**
 * Synthesize speech for `text` (Google TTS) and return a playable object URL for
 * the MP3. The caller owns the URL and should revoke it when done.
 */
export async function synthesizeSpeech(text: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/voice/tts`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?');
  }
  if (!res.ok) {
    const err = await errorField(res);
    if (err === 'voice_not_configured') throw new VoiceNotConfiguredError();
    throw new ApiError(err ?? `Could not play this message (${res.status}).`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
