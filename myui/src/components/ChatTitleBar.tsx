import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

/**
 * The current chat's name + a pencil to rename it inline — used in the phone
 * top bar. Editing is a plain accessible text input: Enter commits, Escape
 * cancels, blur commits. `onRename` persists the title (see the chat store).
 */
export function ChatTitleBar({
  title,
  canRename,
  onRename,
}: {
  title: string;
  canRename: boolean;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the field in sync when the active chat changes (while not editing).
  useEffect(() => {
    if (!editing) setValue(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = value.trim();
    if (next && next !== title) onRename(next);
    setEditing(false);
  };

  const cancel = () => {
    setValue(title);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={commit}
        aria-label="Chat name"
        maxLength={120}
        className="focus-ring min-w-0 flex-1 rounded-lg bg-surface-2 px-2 py-1 text-sm font-medium text-ink outline-none"
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</span>
      {canRename && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Rename chat"
          title="Rename chat"
          className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
