import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, FileText } from 'lucide-react';
import type { Reference } from '@/lib/api';

interface DocSource {
  name: string;
  snippet: string;
  similarity?: number;
}

/** Collapse cited chunks into unique source documents (best snippet wins). */
function collapse(reference?: Reference): DocSource[] {
  const chunks = reference?.chunks ?? [];
  const byDoc = new Map<string, DocSource>();
  for (const c of chunks) {
    const name = c.document_name ?? 'Document';
    const snippet = (c.content ?? '').replace(/\s+/g, ' ').trim();
    const existing = byDoc.get(name);
    if (!existing || (c.similarity ?? 0) > (existing.similarity ?? 0)) {
      byDoc.set(name, { name, snippet, similarity: c.similarity });
    }
  }
  return [...byDoc.values()];
}

export function Sources({ reference }: { reference?: Reference }) {
  const [open, setOpen] = useState(false);
  const docs = collapse(reference);
  if (docs.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/70 pt-2.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="focus-ring group flex items-center gap-1.5 rounded-lg text-xs font-medium text-ink-soft transition-colors hover:text-accent"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/12 text-accent">
          <FileText className="h-3 w-3" />
        </span>
        {docs.length} source{docs.length > 1 ? 's' : ''} from the knowledge base
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {docs.map((d, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-border bg-bg-2/60 p-3 transition-colors hover:border-accent/40"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-ink" title={d.name}>
                      {d.name}
                    </span>
                    {typeof d.similarity === 'number' && (
                      <span className="shrink-0 rounded-full bg-accent/12 px-1.5 py-0.5 text-[0.6rem] font-semibold text-accent">
                        {Math.round(d.similarity * 100)}%
                      </span>
                    )}
                  </div>
                  {d.snippet && (
                    <p className="line-clamp-3 text-[0.72rem] leading-relaxed text-ink-faint">
                      {d.snippet}
                    </p>
                  )}
                </li>
              ))}
            </div>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
