import { motion } from 'framer-motion';
import { AlertTriangle, Clock } from 'lucide-react';
import type { ChatMessage } from '@/lib/chat-store';
import { Markdown } from './Markdown';
import { Sources } from './Sources';
import { SpeakerButton } from './SpeakerButton';
import { TypingIndicator } from './TypingIndicator';

/**
 * Detects when an assistant result is really an upstream LLM error (rate limit /
 * quota / provider outage) surfaced verbatim into the chat, so we can show a
 * calm notice instead of raw "litellm.RateLimitError … GroqException …" text.
 *
 * Unambiguous signatures (litellm, RateLimitError, QUOTA_EXCEEDED, GroqException,
 * insufficient_quota) always match — they never appear in a real answer. Generic
 * wording ("rate limit", "quota", "429") only matches when the text also reads
 * like an error payload, so a legitimate answer that mentions a quota isn't hidden.
 */
const isProviderBusy = (text: string): boolean => {
  const t = text.trim();
  if (!t) return false;
  if (
    /quota[_\s]?exceeded|rate[\s_-]?limit[\s_-]?(error|exceeded)|groqexception|litellm|insufficient[_\s]quota|too many requests|http[\s/]?429|error code[:\s]*429/i.test(
      t,
    )
  ) {
    return true;
  }
  const errorish = /^error\b|error:|exception|service unavailable|overloaded[_\s]?error/i.test(t);
  const rateish = /rate[\s_-]?limit|overloaded|\bquota\b/i.test(t);
  return errorish && rateish;
};

export function MessageBubble({ message }: { message: ChatMessage }) {
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
  // A rate-limit / quota / provider error can surface either as a thrown error
  // (status 'error', text in `error`) or as the "answer" itself when the backend
  // streams the upstream error verbatim (text in `content`). Catch both here, at
  // the display layer, and show a calm notice in place of the raw error.
  const providerBusy =
    isProviderBusy(message.content) ||
    (message.status === 'error' && isProviderBusy(message.error ?? ''));

  // Assistant messages are ALWAYS flush-left with no bubble, border or
  // background — only user messages get a bubble. Status notices (busy / error)
  // render as inline icon+text rows, never boxed, and answer content (including
  // any "not found in the knowledge base" refusal) always goes through Markdown
  // so formatting and citations are preserved.
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="min-w-0"
    >
      {providerBusy ? (
        <div className="flex items-start gap-2.5 text-sm text-ink-soft">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
          <span>The assistant is busy right now — please wait a moment and try again.</span>
        </div>
      ) : message.status === 'error' ? (
        <div className="flex items-start gap-2 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <span>{message.error}</span>
        </div>
      ) : empty ? (
        <TypingIndicator />
      ) : (
        <>
          <Markdown content={message.content} reference={message.reference} />
          {message.status === 'streaming' && (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-accent align-middle" />
          )}
          {message.status === 'done' && (
            <>
              <Sources reference={message.reference} />
              <SpeakerButton message={message} />
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
