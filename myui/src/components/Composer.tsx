import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Mic, Paperclip, Plus, Square, X } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Message composer. The send/stream contract is unchanged: auto-grow textarea,
 * Enter-to-send (Shift+Enter for newline), a Stop button while streaming, and
 * `onSend(text)` on submit.
 *
 * The "+" attach and mic buttons are intentionally UI-only — neither is wired
 * to the backend (the BFF `send` accepts a text question only). Attaching a
 * file just surfaces its name as a chip; nothing is uploaded. See the TODOs.
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
  const [value, setValue] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setAttachment(null); // attachment is decorative only; not sent
  };

  // TODO: file upload is not wired — the backend chat endpoint takes text only.
  // We only show the chosen filename so the affordance is real and testable.
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setAttachment(f.name);
    e.target.value = ''; // allow re-picking the same file
  };

  const iconBtn =
    'focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink';

  return (
    <div className="glass rounded-[1.75rem] border border-border p-2 shadow-lift transition-colors focus-within:border-primary/45">
      {/* Attachment chip — present-but-not-uploaded. */}
      <AnimatePresence initial={false}>
        {attachment && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <div className="mx-1 mb-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface-2/70 px-3 py-1.5 text-xs text-ink-soft">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1 truncate">{attachment}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
                className="focus-ring shrink-0 rounded-md p-0.5 text-ink-faint transition-colors hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-1">
        {/* Attach (UI-only) */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach a file"
          title="Attach a file"
          className={iconBtn}
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={onPickFile}
          tabIndex={-1}
          aria-hidden
        />

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

        {/* Mic (UI-only) — hidden while streaming. */}
        {/* TODO: could be wired to the Web Speech API client-side later. */}
        {!busy && (
          <button type="button" aria-label="Voice input" title="Voice input (coming soon)" className={iconBtn}>
            <Mic className="h-5 w-5" strokeWidth={2} />
          </button>
        )}

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
                className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[hsl(var(--primary-ink))] shadow-soft transition-[filter,transform] hover:brightness-110 active:scale-95"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2} />
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
