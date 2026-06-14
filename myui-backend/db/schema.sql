-- Schema for the IB Group chat backend. Idempotent: safe to run on every boot.
create extension if not exists pgcrypto;

-- One row per (dummy-)logged-in user. No password stored today; the table is
-- shaped so real auth can be added later without a migration of identities.
create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  username   text not null,
  role       text,                 -- most recently chosen workspace (informational)
  created_at timestamptz not null default now()
);
-- Case-insensitive uniqueness so "Asha" and "asha" are the same person.
create unique index if not exists idx_users_username_lower on users (lower(username));

-- A conversation == one chat thread == one RAGFlow session, scoped to a role/bot.
create table if not exists conversations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  role               text not null,            -- 'farmer' | 'employee'
  bot_id             text not null,            -- RAGFlow dialog/chatbot id
  ragflow_session_id text,                     -- lazily created on first send
  title              text not null default 'New chat',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- Fetch a user's conversations for a role, newest first.
create index if not exists idx_conversations_user_role
  on conversations (user_id, role, updated_at desc);

-- Every user question and every assistant reply (including refusals) is one row.
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender          text not null check (sender in ('user', 'assistant')),
  content         text not null,
  citations       jsonb,                       -- RAGFlow `reference` for assistant rows
  bot_id          text,
  created_at      timestamptz not null default now()
);
-- Fetch a conversation's messages in order.
create index if not exists idx_messages_conversation
  on messages (conversation_id, created_at);
