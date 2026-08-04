import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as api from '@/lib/api';
import type { Reference } from '@/lib/api';
import { type RoleId } from '@/lib/roles';
import { useAuth } from '@/lib/auth';

/*
  Chat store — the single source of truth for conversations.

  Now backed by the chat backend (the BFF) instead of RAGFlow directly:

    • On login we hydrate every conversation the user owns (history persists
      across refresh — a fresh login reloads the same threads from Postgres).
    • A "New chat" is a local draft until its first message; on first send we
      create the conversation server-side (which also opens its RAGFlow
      session) and swap the draft id for the real one.
    • Selecting a persisted chat lazily fetches its transcript.
    • `send` streams the answer back through the backend (which logs the Q&A);
      the live typing effect is preserved because the backend re-emits RAGFlow
      frames verbatim.

  The provider's public shape (ChatCtx) is unchanged, so the screens, sidebar
  and composer don't know any of this changed.
*/

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reference?: Reference;
  status: 'streaming' | 'done' | 'error';
  error?: string;
}

export interface Chat {
  id: string;
  roleId: RoleId;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  /** false while this is a local draft not yet written to the backend. */
  persisted: boolean;
  /** true once the transcript has been fetched (or it's a fresh draft). */
  loaded: boolean;
}

interface ChatCtx {
  chats: Chat[];
  activeChatId: string | null;
  activeChat: Chat | null;
  /** Chats for a given role, newest first — what the sidebar renders. */
  chatsForRole: (roleId: RoleId) => Chat[];
  busy: boolean;
  connectionError: string | null;
  /** Enter a role workspace: resume its most recent chat, or open a fresh one. */
  enterRole: (roleId: RoleId) => string;
  /** "New chat" — open a fresh (or reuse the role's existing empty) chat. */
  newChat: (roleId: RoleId) => string;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  /** Rename a chat. Updates the title locally and persists it (if persisted). */
  renameChat: (id: string, title: string) => void;
  send: (text: string) => void;
  stop: () => void;
}

const Ctx = createContext<ChatCtx | null>(null);

let _seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${_seq++}`;
const titleFrom = (q: string) => {
  const t = q.trim().replace(/\s+/g, ' ');
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
};
// Calm, classified copy for connection / server failures (see api.describeError).
const errMsg = (e: unknown) => api.describeError(e);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Runtime-only handles — never rendered, so kept in refs.
  const abortsRef = useRef<Map<string, AbortController>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set()); // transcripts being fetched
  const sendingRef = useRef(false); // guards against double-send while creating a thread

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId],
  );

  const busy = useMemo(
    () => (activeChat?.messages ?? []).some((m) => m.status === 'streaming'),
    [activeChat],
  );

  // Login → hydrate the user's conversations from Postgres. Logout → tear down.
  useEffect(() => {
    abortsRef.current.forEach((c) => c.abort());
    abortsRef.current.clear();
    loadingRef.current.clear();

    if (!user) {
      setChats([]);
      setActiveChatId(null);
      setConnectionError(null);
      return;
    }

    let alive = true;
    setConnectionError(null);
    api
      .listConversations()
      .then((list) => {
        if (!alive) return;
        setChats((prev) => {
          // Preserve any in-memory unsent drafts — notably the fresh chat that
          // login opens before history finishes loading — so the active draft
          // isn't wiped (which would leave `activeChatId` dangling and block
          // the first send).
          const drafts = prev.filter((c) => !c.persisted);
          const loaded = list.map((c) => ({
            id: c.id,
            roleId: c.role,
            title: c.title,
            messages: [],
            createdAt: Date.parse(c.created_at) || Date.now(),
            persisted: true,
            loaded: false,
          }));
          return [...drafts, ...loaded];
        });
      })
      .catch((e) => alive && setConnectionError(errMsg(e)));

    return () => {
      alive = false;
    };
  }, [user]);

  // When a persisted chat becomes active and we don't have its messages yet,
  // fetch the transcript once.
  useEffect(() => {
    if (!activeChatId) return;
    const chat = chats.find((c) => c.id === activeChatId);
    if (!chat || !chat.persisted || chat.loaded || loadingRef.current.has(chat.id)) return;

    loadingRef.current.add(chat.id);
    let alive = true;
    api
      .getMessages(chat.id)
      .then((msgs) => {
        if (!alive) return;
        setChats((prev) =>
          prev.map((c) =>
            c.id === chat.id
              ? {
                  ...c,
                  loaded: true,
                  messages: msgs.map((m) => ({
                    id: m.id,
                    role: m.sender,
                    content: m.content,
                    reference: m.citations ?? undefined,
                    status: 'done' as const,
                  })),
                }
              : c,
          ),
        );
      })
      .catch((e) => alive && setConnectionError(errMsg(e)))
      .finally(() => loadingRef.current.delete(chat.id));

    return () => {
      alive = false;
    };
  }, [activeChatId, chats]);

  const patchMessage = useCallback(
    (chatId: string, msgId: string, p: Partial<ChatMessage>) =>
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...p } : m)) }
            : c,
        ),
      ),
    [],
  );

  const chatsForRole = useCallback(
    (roleId: RoleId) =>
      chats.filter((c) => c.roleId === roleId).sort((a, b) => b.createdAt - a.createdAt),
    [chats],
  );

  const newChat = useCallback(
    (roleId: RoleId) => {
      // Reuse an unsent draft for this role instead of stacking blanks.
      const empty = chats.find((c) => c.roleId === roleId && !c.persisted && c.messages.length === 0);
      if (empty) {
        setActiveChatId(empty.id);
        return empty.id;
      }
      const id = uid('draft');
      const chat: Chat = {
        id,
        roleId,
        title: 'New chat',
        messages: [],
        createdAt: Date.now(),
        persisted: false,
        loaded: true,
      };
      setChats((prev) => [chat, ...prev]);
      setActiveChatId(id);
      return id;
    },
    [chats],
  );

  // Entering a role resumes recent context rather than always opening a blank.
  const enterRole = useCallback(
    (roleId: RoleId) => {
      const recent = chats
        .filter((c) => c.roleId === roleId)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (recent) {
        setActiveChatId(recent.id);
        return recent.id;
      }
      return newChat(roleId);
    },
    [chats, newChat],
  );

  const selectChat = useCallback((id: string) => setActiveChatId(id), []);

  const deleteChat = useCallback(
    (id: string) => {
      abortsRef.current.get(id)?.abort();
      abortsRef.current.delete(id);
      const target = chats.find((c) => c.id === id);
      if (target?.persisted) api.deleteConversation(id).catch(() => {});
      setChats((prev) => {
        const next = prev.filter((c) => c.id !== id);
        setActiveChatId((cur) => {
          if (cur !== id) return cur;
          const gone = prev.find((c) => c.id === id);
          const sameRole = next
            .filter((c) => c.roleId === gone?.roleId)
            .sort((a, b) => b.createdAt - a.createdAt);
          return sameRole[0]?.id ?? next[0]?.id ?? null;
        });
        return next;
      });
    },
    [chats],
  );

  const renameChat = useCallback(
    (id: string, title: string) => {
      const clean = title.trim().replace(/\s+/g, ' ').slice(0, 120);
      if (!clean) return;
      const target = chats.find((c) => c.id === id);
      if (!target || target.title === clean) return;
      // Optimistic local update; persist only if the chat exists server-side
      // (drafts get their title on first send). Mirrors deleteChat's pattern.
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean } : c)));
      if (target.persisted) api.renameConversation(id, clean).catch(() => {});
    },
    [chats],
  );

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      const chat = chats.find((c) => c.id === activeChatId);
      if (!question || !chat || busy || sendingRef.current) return;
      sendingRef.current = true;

      try {
        const roleId = chat.roleId;
        const firstMessage = chat.messages.length === 0;
        let chatId = chat.id;

        // Persist a draft on its first send: creates the conversation row and
        // its RAGFlow session server-side, then swap the draft id for the real.
        if (!chat.persisted) {
          try {
            const dto = await api.createConversation(roleId, titleFrom(question));
            chatId = dto.id;
            setChats((prev) =>
              prev.map((c) =>
                c.id === chat.id
                  ? { ...c, id: dto.id, persisted: true, loaded: true, title: dto.title }
                  : c,
              ),
            );
            setActiveChatId(dto.id);
          } catch (e) {
            setConnectionError(errMsg(e));
            return;
          }
        }

        const userMsg: ChatMessage = {
          id: uid('u'),
          role: 'user',
          content: question,
          status: 'done',
        };
        const assistantId = uid('a');

        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  title: firstMessage ? titleFrom(question) : c.title,
                  messages: [
                    ...c.messages,
                    userMsg,
                    { id: assistantId, role: 'assistant', content: '', status: 'streaming' },
                  ],
                }
              : c,
          ),
        );

        const controller = new AbortController();
        abortsRef.current.set(chatId, controller);

        try {
          setConnectionError(null);
          const final = await api.sendMessage(
            chatId,
            question,
            (u) => patchMessage(chatId, assistantId, { content: u.answer, reference: u.reference }),
            controller.signal,
          );
          patchMessage(chatId, assistantId, {
            content: final.answer,
            reference: final.reference,
            status: 'done',
          });
        } catch (e) {
          if (controller.signal.aborted) {
            patchMessage(chatId, assistantId, { status: 'done' });
          } else {
            patchMessage(chatId, assistantId, { status: 'error', error: errMsg(e) });
          }
        } finally {
          abortsRef.current.delete(chatId);
        }
      } finally {
        sendingRef.current = false;
      }
    },
    [chats, activeChatId, busy, patchMessage],
  );

  const stop = useCallback(() => {
    if (activeChatId) abortsRef.current.get(activeChatId)?.abort();
  }, [activeChatId]);

  const value = useMemo<ChatCtx>(
    () => ({
      chats,
      activeChatId,
      activeChat,
      chatsForRole,
      busy,
      connectionError,
      enterRole,
      newChat,
      selectChat,
      deleteChat,
      renameChat,
      send,
      stop,
    }),
    [
      chats,
      activeChatId,
      activeChat,
      chatsForRole,
      busy,
      connectionError,
      enterRole,
      newChat,
      selectChat,
      deleteChat,
      renameChat,
      send,
      stop,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChats() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChats must be used within ChatProvider');
  return ctx;
}
