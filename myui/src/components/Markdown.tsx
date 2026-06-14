import { useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Reference } from '@/lib/api';
import { cn } from '@/lib/cn';

/** Strip reasoning blocks and turn `[ID:n]` markers into <cite>n</cite>. */
function preprocess(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    // escape stray raw angle brackets so rehype-raw doesn't eat real text
    .replace(/\[ID:\s*(\d+)\]/g, '<cite>$1</cite>');
}

function CitationChip({ index, reference }: { index: number; reference?: Reference }) {
  const chunk = reference?.chunks?.[index];
  const name = chunk?.document_name ?? `Source ${index + 1}`;
  const snippet = (chunk?.content ?? '').replace(/\s+/g, ' ').trim();

  return (
    <span className="group/cite relative inline-flex align-baseline">
      <sup
        tabIndex={0}
        className="ml-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] cursor-default items-center justify-center rounded-full bg-accent/15 px-1 text-[0.62rem] font-semibold text-accent ring-1 ring-accent/30 transition-colors hover:bg-accent/25 focus:outline-none focus-visible:ring-2"
        aria-label={`Source: ${name}`}
      >
        {index + 1}
      </sup>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-72 -translate-x-1/2 rounded-2xl border border-border bg-surface p-3 text-left shadow-lift group-hover/cite:block group-focus-within/cite:block"
      >
        <span className="mb-1 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {name}
        </span>
        {snippet && (
          <span className="line-clamp-4 text-xs leading-relaxed text-ink-soft">
            {snippet}
          </span>
        )}
      </span>
    </span>
  );
}

export function Markdown({
  content,
  reference,
  className,
}: {
  content: string;
  reference?: Reference;
  className?: string;
}) {
  const processed = useMemo(() => preprocess(content), [content]);

  const components = useMemo<Components>(
    () => ({
      // our injected citation marker
      cite: ({ children }) => {
        const i = parseInt(String(Array.isArray(children) ? children[0] : children), 10);
        if (Number.isNaN(i)) return null;
        return <CitationChip index={i} reference={reference} />;
      },
      a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children as ReactNode}
        </a>
      ),
    }),
    [reference],
  );

  return (
    <div className={cn('answer-prose', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
