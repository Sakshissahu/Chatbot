# IB Group Chat — Local Run Guide

How to bring the full stack up locally to review or develop the project. The
frontend (`myui`) is a static Vite build; the backend (`myui-backend`) is a BFF
that holds the RAGFlow beta token + Postgres creds, proxies RAGFlow's SSE stream
verbatim, and logs every Q&A.

```
 Browser ──▶ frontend (myui, Vite)  ──▶  backend / BFF (myui-backend :8088)
                                                        │
                                        ┌───────────────┴───────────────┐
                                        ▼                               ▼
                                RAGFlow (:80, Docker)         ibchat_postgres (:5442, Docker)
```

- In **local dev** the frontend uses the relative `/bff` prefix and the Vite dev
  proxy forwards it to `localhost:8088` (same-origin, no CORS).
- For a **deployed build** set `VITE_BACKEND_URL` to the backend's public URL at
  build time; the frontend then makes absolute cross-origin calls and the
  backend's CORS allow-list (`ALLOWED_ORIGIN`) must include the frontend origin.

---

## 1. Start the local stack

1. Open **Docker Desktop**, then start the containers (RAGFlow + Postgres etc.):
   ```powershell
   cd docker
   docker compose -f docker-compose.yml up -d
   cd ..
   ```
   Wait 1–2 minutes for RAGFlow to boot (see `startup1.txt` for details / login).
2. Start the app's Postgres (logging/history DB):
   ```powershell
   cd myui-backend
   docker compose up -d
   ```
3. Start the backend (BFF):
   ```powershell
   cd myui-backend
   npm run dev          # http://localhost:8088
   ```
4. Start the frontend (dev server):
   ```powershell
   cd myui
   npm run dev          # http://localhost:5173
   ```

> Never run `docker compose down -v` — the `-v` wipes all data (docs, chats, logins).
> Use `docker compose stop` to shut down while keeping data.

---

## 2. Environment variables — what lives where

| Variable | Where it lives | Purpose | Secret? |
|---|---|---|---|
| `VITE_BACKEND_URL` | build-time env (deployed builds only) | Absolute backend URL the built frontend calls. Inlined at build time. Leave unset for local dev. | No |
| `VITE_BFF_BASE` | (optional) `myui/.env` | Override the `/bff` path prefix. Rarely needed. | No |
| `ALLOWED_ORIGIN` | `myui-backend/.env` (gitignored) | CORS allow-list. Default `http://localhost:5173,...`. | No |
| `RAGFLOW_BETA_TOKEN` | `myui-backend/.env` (gitignored) | Auth to RAGFlow. **Never** sent to the browser. | **Yes** |
| `DATABASE_URL` / `POSTGRES_*` | `myui-backend/.env` (gitignored) | ibchat Postgres creds. | **Yes** |
| `FARMER_BOT_ID` / `EMPLOYEE_BOT_ID` | `myui-backend/.env` | RAGFlow dialog ids per role. | No |
| `GOOGLE_SPEECH_API_KEY` | `myui-backend/.env` (gitignored) | Google STT/TTS key. Blank = voice disabled. | **Yes** |

---

## 3. CORS & SSE (how cross-origin streaming stays intact)

- `myui-backend/src/index.ts` uses the `cors` package with a function origin
  check (`isAllowedOrigin` in `config.ts`). It **reflects** an allow-listed
  Origin (never `*`), sets `Vary: Origin`, and answers OPTIONS preflights with
  204 + `Access-Control-Allow-Headers: authorization, content-type`.
- `ALLOWED_ORIGIN` accepts a comma list where one `*` wildcard covers a single
  host label. CORS checks the *browser's* origin, not the backend's address.
- The SSE proxy in `routes/conversations.ts` sets
  `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`,
  and re-emits RAGFlow frames verbatim. CORS only sets response headers, so it
  does not buffer the stream — progressive token delivery is preserved.

---

## 4. Troubleshooting

- **CORS error in the browser console**: the frontend origin isn't allow-listed.
  Check `ALLOWED_ORIGIN` in `myui-backend/.env`, then restart the backend.
- **Answer doesn't stream / arrives all at once**: confirm the backend response
  is `text/event-stream` and nothing in front compresses it.
- **502 "Could not reach the assistant"**: RAGFlow (:80) is down or still
  booting — see `startup1.txt`.
