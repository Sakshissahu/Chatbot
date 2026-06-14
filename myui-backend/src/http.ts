import type { NextFunction, Request, Response } from 'express';

/** Wrap an async route so rejected promises reach Express's error handler. */
export function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

/** First line of a question, trimmed, used as a conversation title. */
export function titleFrom(question: string): string {
  const t = question.trim().replace(/\s+/g, ' ');
  if (!t) return 'New chat';
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}
