import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Square, Volume2 } from 'lucide-react';
import { synthesizeSpeech, VoiceNotConfiguredError } from '@/lib/api';
import { useVoicePrefs } from '@/lib/voice';
import * as ttsCache from '@/lib/tts-cache';
import type { ChatMessage } from '@/lib/chat-store';

type Status = 'idle' | 'loading' | 'playing' | 'unconfigured' | 'error';

// Only one message ever plays at a time across the whole app.
let currentAudio: HTMLAudioElement | null = null;

// Answers auto-played already this session, keyed by message id, so switching
// chats (which remounts bubbles) never replays an answer.
const autoPlayed = new Set<string>();

/**
 * Reduce answer markdown to clean spoken text: drop reasoning blocks, citation
 * markers, code, images and formatting so the voice reads words, not syntax.
 */
function stripForSpeech(md: string): string {
  return md
    .replace(/<think>[\s\S]*?<\/think>/g, ' ')
    .replace(/<think>[\s\S]*$/g, ' ')
    .replace(/\[ID:\s*\d+\]/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>+\s?/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$2')
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/^[\s|:-]{3,}$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Speaker control on an assistant answer. Tap to play the synthesized audio, tap
 * again to stop. When the "Auto-play responses" setting is on, a freshly
 * completed answer plays once automatically (best-effort — manual always works).
 */
export function SpeakerButton({ message }: { message: ChatMessage }) {
  const { autoPlay } = useVoicePrefs();
  const [status, setStatus] = useState<Status>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speech = useMemo(() => stripForSpeech(message.content), [message.content]);

  // Stop audio on unmount. The synthesized object URL is owned by the TTS cache
  // (keyed by message id, revoked only on logout via clear()), so we never
  // revoke it here — doing so would break replay when this bubble remounts
  // (e.g. switching chats) while the URL is still cached.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        if (currentAudio === a) currentAudio = null;
      }
    };
  }, []);

  const stop = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
      if (currentAudio === a) currentAudio = null;
    }
    setStatus('idle');
  };

  // `auto` keeps auto-play silent on failure (e.g. browser autoplay block or no
  // key); a manual tap shows the friendly notice instead.
  const play = async (auto = false) => {
    if (!speech) return;
    if (status === 'playing') {
      stop();
      return;
    }
    if (status === 'loading') return;

    setStatus('loading');
    try {
      // Synthesize at most once per message per session: reuse the cached object
      // URL on replay (and when the auto-play path already populated it) instead
      // of re-hitting — and re-billing — the TTS API. Auto-play and manual taps
      // share this one cache because both flow through here.
      let url = ttsCache.get(message.id);
      if (!url) {
        url = await synthesizeSpeech(speech);
        ttsCache.set(message.id, url);
      }

      if (currentAudio && currentAudio !== audioRef.current) currentAudio.pause();

      let a = audioRef.current;
      if (!a) {
        a = new Audio(url);
        audioRef.current = a;
        a.onended = () => {
          if (currentAudio === a) currentAudio = null;
          setStatus('idle');
        };
        a.onerror = () => setStatus('error');
      }
      a.currentTime = 0;
      currentAudio = a;
      await a.play();
      setStatus('playing');
    } catch (err) {
      if (auto) setStatus('idle');
      else if (err instanceof VoiceNotConfiguredError) setStatus('unconfigured');
      else setStatus('error');
    }
  };

  // Auto-play a freshly completed answer once. `a_`-prefixed ids are only the
  // messages streamed this session; history reloaded from the backend carries
  // uuids, so previously-seen answers never auto-replay.
  useEffect(() => {
    if (
      !autoPlay ||
      message.status !== 'done' ||
      !speech ||
      !message.id.startsWith('a_') ||
      autoPlayed.has(message.id)
    ) {
      return;
    }
    autoPlayed.add(message.id);
    void play(true);
  }, [autoPlay, message.status, message.id, speech]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!speech) return null;

  const label =
    status === 'playing' ? 'Stop playback' : status === 'loading' ? 'Loading audio' : 'Play aloud';

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={() => void play()}
        disabled={status === 'loading'}
        aria-label={label}
        title={label}
        className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-60"
      >
        {status === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : status === 'playing' ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Volume2 className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
      {status === 'unconfigured' && (
        <span className="text-xs text-ink-faint">Voice isn’t set up yet.</span>
      )}
      {status === 'error' && (
        <span className="text-xs text-ink-faint">Couldn’t play this message.</span>
      )}
    </div>
  );
}
