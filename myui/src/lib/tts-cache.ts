/*
  In-memory TTS audio cache.

  Each assistant answer is synthesized at most once per session: the speaker
  button stores the resulting object URL here keyed by message id, and every
  later play (manual replay or the auto-play path) reuses it instead of
  re-hitting — and re-billing — the Google TTS endpoint.

  Lifecycle: the cache OWNS the object URLs it holds. Nothing revokes them
  per-play (that would break replay); they are revoked together by clear(),
  which logout calls so the audio is freed and a new user never inherits the
  previous user's cached answers. In-memory only — blob URLs aren't persistable
  and the requirement is clear-on-logout, so there is deliberately no
  localStorage.
*/

// message id -> playable object URL for that answer's synthesized MP3.
const cache = new Map<string, string>();

/** The cached object URL for a message, or undefined if not synthesized yet. */
export function get(id: string): string | undefined {
  return cache.get(id);
}

/** Remember the object URL synthesized for a message. */
export function set(id: string, url: string): void {
  cache.set(id, url);
}

/** Revoke every cached object URL and empty the cache (called on logout). */
export function clear(): void {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
}
