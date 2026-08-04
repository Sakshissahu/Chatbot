import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Info, Loader2, Mic, Square, X } from 'lucide-react';
import { transcribeAudio, VoiceNotConfiguredError } from '@/lib/api';
import { UnsupportedRecordingError, VoiceRecorder, type Recording } from '@/lib/recorder';
import { useVoicePrefs } from '@/lib/voice';

const ease = [0.22, 1, 0.36, 1] as const;

/** Auto-stop a forgotten recording so the upload can't grow unbounded. */
const MAX_RECORDING_MS = 60_000;

/**
 * Message composer. The text send/stream contract is unchanged: auto-grow
 * textarea, Enter-to-send (Shift+Enter for newline), a Stop button while
 * streaming, and `onSend(text)` on submit.
 *
 * The mic is push-to-talk: press and HOLD the mic to record, RELEASE to stop and
 * transcribe into the input for review (we never auto-send — the send/stream path
 * above is untouched).
 */
export function Composer({
  busy,
  onSend,
  onStop,
  placeholder,
}: {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  placeholder: string;
}) {
  const { sttLanguage } = useVoicePrefs();
  const [value, setValue] = useState('');
  const [recState, setRecState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const autoStopRef = useRef<number | null>(null);
  // True while the mic button is physically held down (push-to-talk). Used to
  // handle the case where the button is released before the async mic start
  // finishes — we then stop immediately instead of getting stuck "recording".
  const heldRef = useRef(false);

  // auto-grow
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const hasText = value.trim().length > 0;

  const submit = () => {
    const t = value.trim();
    if (!t || busy) return;
    onSend(t);
    setValue('');
  };

  // --- voice input (speech-to-text) ---
  const clearAutoStop = () => {
    if (autoStopRef.current !== null) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    clearAutoStop();
    setRecState('transcribing');

    let recording: Recording;
    try {
      recording = await recorder.stop();
    } catch {
      setRecState('idle');
      setVoiceNote('Couldn’t capture the recording. Please try again.');
      return;
    }

    try {
      const text = await transcribeAudio(recording.base64, recording.mimeType, sttLanguage);
      if (text) {
        // Drop the transcript into the input for review — never auto-send.
        setValue((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
        requestAnimationFrame(() => ref.current?.focus());
      } else {
        setVoiceNote('Didn’t catch that — please try again.');
      }
    } catch (err) {
      if (err instanceof VoiceNotConfiguredError) {
        setVoiceNote('Voice isn’t set up yet.');
      } else {
        setVoiceNote(err instanceof Error ? err.message : 'Couldn’t transcribe the recording.');
      }
    } finally {
      setRecState('idle');
    }
  };

  const startRecording = async () => {
    if (busy || recState !== 'idle') return;
    setVoiceNote(null);
    const recorder = new VoiceRecorder();
    try {
      await recorder.start();
    } catch (err) {
      if (err instanceof UnsupportedRecordingError) {
        setVoiceNote('Voice input isn’t supported in this browser.');
      } else {
        setVoiceNote('Microphone access was blocked. Allow it in your browser settings to use voice.');
      }
      return;
    }
    recorderRef.current = recorder;
    setRecState('recording');
    autoStopRef.current = window.setTimeout(() => void stopRecording(), MAX_RECORDING_MS);
    // If the button was already released while the mic was starting up, stop now.
    if (!heldRef.current) void stopRecording();
  };

  // Push-to-talk: begin on press, end on release.
  const beginHold = () => {
    if (busy || recState !== 'idle') return;
    heldRef.current = true;
    void startRecording();
  };
  const endHold = () => {
    if (!heldRef.current) return;
    heldRef.current = false;
    void stopRecording();
  };

  // Abort any in-flight recording if the composer unmounts.
  useEffect(() => {
    return () => {
      clearAutoStop();
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

  const iconBtn =
    'focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-[color,background-color,transform] hover:bg-surface-2 hover:text-ink active:scale-90';

  return (
    <div className="glass rounded-[1.75rem] border border-border p-2 shadow-lift transition-colors focus-within:border-primary/45">
      {/* Voice status — recording / transcribing / inline notice. */}
      <AnimatePresence initial={false}>
        {(recState !== 'idle' || voiceNote) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <div className="mx-1 mb-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface-2/70 px-3 py-1.5 text-xs text-ink-soft">
              {recState === 'recording' ? (
                <>
                  <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-danger/60 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
                  </span>
                  <span className="min-w-0 flex-1">Listening… release the mic to stop.</span>
                </>
              ) : recState === 'transcribing' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-faint" />
                  <span className="min-w-0 flex-1">Transcribing…</span>
                </>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  <span className="min-w-0 flex-1">{voiceNote}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceNote(null)}
                    aria-label="Dismiss"
                    className="focus-ring shrink-0 rounded-md p-0.5 text-ink-faint transition-colors hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-1">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="max-h-44 flex-1 resize-none self-center bg-transparent px-2 py-2.5 text-[0.95rem] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
        />

        {/* Mic — PUSH TO TALK: hold to record, release to transcribe into the
            input. Hidden while an answer is streaming. */}
        {!busy &&
          (recState === 'transcribing' ? (
            <div className={`${iconBtn} pointer-events-none`} role="status" aria-label="Transcribing">
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
            </div>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                beginHold();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                endHold();
              }}
              onPointerCancel={endHold}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Hold to talk"
              aria-pressed={recState === 'recording'}
              title="Hold to talk"
              className={
                recState === 'recording'
                  ? 'focus-ring relative flex h-10 w-10 shrink-0 select-none touch-none items-center justify-center rounded-full bg-danger/15 text-danger transition-colors'
                  : `${iconBtn} select-none touch-none`
              }
            >
              {recState === 'recording' && (
                <span aria-hidden className="absolute inset-0 rounded-full bg-danger/25 motion-safe:animate-ping" />
              )}
              <Mic className="relative h-5 w-5" strokeWidth={2} />
            </button>
          ))}

        {/* Send / Stop */}
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-soft transition-colors hover:text-ink"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <AnimatePresence initial={false}>
            {hasText && (
              <motion.button
                key="send"
                type="button"
                onClick={submit}
                aria-label="Send message"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18, ease }}
                className="group focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[hsl(var(--primary-ink))] shadow-soft transition-[filter,transform] hover:brightness-110 active:scale-95"
              >
                <ArrowUp
                  className="h-5 w-5 transition-transform duration-300 ease-spring group-hover:-translate-y-0.5"
                  strokeWidth={2}
                />
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
