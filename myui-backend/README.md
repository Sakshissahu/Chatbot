# IB Group chat backend (BFF)

Sits between the brand UI (`../myui`) and RAGFlow. It logs every question and
every reply to a dedicated Postgres database and serves persistent chat history.

```
Browser ──/bff──▶ Vite proxy ──▶ this backend ──▶ RAGFlow
                                      │
                                      └──▶ Postgres (logs Q&A + history)
```

The RAGFlow **beta token** and the **Postgres credentials** live only in this
service's gitignored `.env`. They are never sent to the browser.

## Stack
Node + TypeScript + Express + `pg`, run with `tsx` (no build step). Postgres 16
runs in its own Docker container (`ibchat_postgres`, host port `5442`).

## Run

```bash
# 1. secrets — copy and fill in (or run the probe script, see below)
cp .env.example .env

# 2. start the dedicated Postgres
docker compose up -d

# 3. install + run the backend (creates tables on first boot)
npm install
npm run dev          # http://localhost:8088
```

`python ../myui/scripts/setup_and_probe.py` mints a RAGFlow beta token and writes
it into this `.env` (it never touches the frontend env anymore).

## API (`/bff`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/bff/health` | – | liveness + db/ragflow reachability |
| POST | `/bff/auth/login` | – | dummy login `{username, role?}` → `{token, user}` |
| GET | `/bff/conversations[?role=]` | Bearer | list the user's conversations |
| POST | `/bff/conversations` | Bearer | create a thread `{role, title?}` (+ RAGFlow session) |
| GET | `/bff/conversations/:id/messages` | Bearer | full transcript |
| POST | `/bff/conversations/:id/messages` | Bearer | ask `{question}` → **SSE stream** |
| DELETE | `/bff/conversations/:id` | Bearer | delete a thread |

`token` is the user id (dummy auth). Send it as `Authorization: Bearer <token>`.

## Schema
`users` · `conversations` · `messages` — see `db/schema.sql`.
