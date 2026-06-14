import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';

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
  const ref = useRef<HTMLTextAreaElement>(null);

  // auto-grow
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const submit = () => {
    const t = value.trim();
    if (!t || busy) return;
    onSend(t);
    setValue('');
  };

  return (
    <div className="glass flex items-end gap-2 rounded-3xl border border-border p-2 shadow-lift transition-colors focus-within:border-accent/50">
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
        className="max-h-44 flex-1 resize-none bg-transparent px-3 py-2 text-[0.95rem] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
      />
      {busy ? (
        <button
          onClick={onStop}
          aria-label="Stop generating"
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-ink-soft transition-colors hover:text-ink"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!value.trim()}
          aria-label="Send message"
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-[hsl(var(--accent-ink))] shadow-soft transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
