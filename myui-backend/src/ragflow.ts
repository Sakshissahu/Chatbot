import { botFor, config, ROLE_LABELS, type RoleId } from './config';

/*
  Server-side RAGFlow client. The beta token lives only here (never in the
  browser). Mirrors the contract proven in myui/src/lib/ragflow.ts:

    POST {base}/api/v1/chatbots/{botId}/completions   (SSE, Bearer beta token)
      session create:  {question:"", user_name, role}          -> data.session_id
      ask:             {question, session_id, quote:true, ...}  -> cumulative answer
    frames:  data:{"code":0,"data":{answer, reference, session_id, id}}
    terminator:  data:{"code":0,"data":true}
*/

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

export interface Frame {
  code?: number;
  message?: string;
  data?: { answer?: string; reference?: Reference; session_id?: string; id?: string | null } | boolean;
}

function endpoint(botId: string): string {
  return `${config.ragflow.baseUrl}/api/v1/chatbots/${botId}/completions`;
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.ragflow.betaToken}`,
  };
}

/** Parse a RAGFlow SSE body into `data:` frames. */
export async function* parseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<Frame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
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
        try {
          yield JSON.parse(payload) as Frame;
        } catch {
          /* ignore malformed keep-alive lines */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Create a fresh RAGFlow session for a role and return its id. */
export async function createSession(role: RoleId, userName: string): Promise<string> {
  const res = await fetch(endpoint(botFor(role)), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ question: '', user_name: userName, role: ROLE_LABELS[role], stream: true }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`RAGFlow session create failed: ${res.status} ${res.statusText}`);
  }
  for await (const frame of parseFrames(res.body)) {
    if (frame.code && frame.code !== 0) throw new Error(frame.message || 'RAGFlow refused the session.');
    const data = frame.data;
    if (data && typeof data === 'object' && data.session_id) return data.session_id;
  }
  throw new Error('RAGFlow did not return a session id.');
}

/** Open the streamed answer for a question. Caller forwards/parses the body. */
export async function askStream(opts: {
  role: RoleId;
  sessionId: string;
  question: string;
  userName: string;
}): Promise<Response> {
  return fetch(endpoint(botFor(opts.role)), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      question: opts.question,
      session_id: opts.sessionId,
      quote: true,
      user_name: opts.userName,
      role: ROLE_LABELS[opts.role],
      stream: true,
    }),
  });
}
