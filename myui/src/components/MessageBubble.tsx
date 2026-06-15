import { motion } from 'framer-motion';
import { AlertTriangle, Compass, Sprout, type LucideIcon } from 'lucide-react';
import type { ChatMessage } from '@/lib/chat-store';
import { Markdown } from './Markdown';
import { Sources } from './Sources';
import { TypingIndicator } from './TypingIndicator';

const isRefusal = (text: string) => /not found in the (dataset|knowledge base)/i.test(text);

export function MessageBubble({
  message,
  icon: Icon = Sprout,
}: {
  message: ChatMessage;
  icon?: LucideIcon;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-3xl rounded-br-lg border border-border bg-surface-2 px-4 py-2.5 text-[0.95rem] leading-relaxed text-ink shadow-soft">
          {message.content}
        </div>
      </motion.div>
    );
  }

  const empty = message.status === 'streaming' && !message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/20">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        {message.status === 'error' ? (
          <div className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/8 px-3.5 py-3 text-sm text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <span>{message.error}</span>
          </div>
        ) : empty ? (
          <TypingIndicator />
        ) : message.status === 'done' && isRefusal(message.content) ? (
          <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                <Compass className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[0.95rem] leading-relaxed text-ink">{message.content}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  That’s outside this assistant’s knowledge base. Try rewording, or switch space
                  from the menu above.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <Markdown content={message.content} reference={message.reference} />
            {message.status === 'streaming' && (
              <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-accent align-middle" />
            )}
            {message.status === 'done' && <Sources reference={message.reference} />}
          </>
        )}
      </div>
    </motion.div>
  );
}
