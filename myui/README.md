# IB Group · Knowledge Assistant (brand UI)

A polished, custom-branded chatbot front end for IB Group. It is a **separate app**
from RAGFlow's own `web/` admin UI — it only *talks to* RAGFlow's HTTP API. RAGFlow's
own UI stays as the private admin panel; this is the user-facing storefront.

- **Stack:** Vite + React + TypeScript + Tailwind + framer-motion
- **Two screens:** (1) name + role select, (2) personalised, branded chat
- **Two bots, dataset-isolated by role:** Farmer → field docs, Employee → HR policy

## Quick start

```bash
# 1. RAGFlow must be running (see ../START_HERE.txt). Then, from this folder:
npm install
npm run setup     # mints a RAGFlow beta token + writes .env, runs a contract probe
npm run dev       # http://localhost:5173
```

`npm run setup` (`scripts/setup_and_probe.py`) logs in as admin, mints/reuses a RAGFlow
beta token, writes it to the **gitignored** `.env`, and verifies the live API contract
(both bots + the farmer/employee isolation). Requires `requests` + `pycryptodomex`
in the active Python env (already present from `load_keys.py`).

## The RAGFlow API contract this app uses

| Item | Value |
|---|---|
| Endpoint | `POST /api/v1/chatbots/{dialog_id}/completions` (SSE), the embed/iframe path |
| Auth | `Authorization: Bearer <beta>` — 32-char beta token from `POST /api/v1/system/tokens` |
| Farmer bot | `IB-assist` = `66824bb2675f11f1bb5ca9173f52da2e` → dataset "farmer docs" |
| Employee bot | `Employee Assistant` = `2150f758676111f1bb5ca9173f52da2e` → dataset "HR policy" |
| Create session | `{ "question": "" }` → first SSE frame carries `data.session_id` |
| Ask | `{ "question", "session_id", "quote": true, "user_name", "role" }` |
| Stream frames | `data:{"code":0,"data":{answer,reference,session_id}}` … terminated by `data:{"data":true}` |
| `answer` | **cumulative** full text on every frame (replace, don't append) |
| Citations | inline `[ID:n]` markers → `reference.chunks[n]` (`document_name`, `content`, `similarity`) |
| Refusal | `"The answer you are looking for is not found in the dataset!"` |
| Per-user vars | extra body keys fill `{placeholder}`s server-side; unused keys are ignored (safe) |

Notes:
- **CORS:** avoided entirely via a Vite dev proxy (`/api` → `localhost:80`); no RAGFlow
  change needed. The SSE stream passes through untouched.
- **Auth model:** `AUTH_BETA` derives the tenant from the token; the endpoint separately
  checks dialog ownership, so one beta token serves both bots.
- The live farmer bot is **`IB-assist`** — the older `IBDOCS Assistant` dialog is
  soft-deleted (`status=0`) and would be rejected by the endpoint.

## Where the key lives

`VITE_RAGFLOW_API_KEY` (the beta token) is stored only in `.env`, which is gitignored.
It is never hardcoded in source and never committed. `.env.example` documents the shape.

## Architecture

```
src/
  lib/ragflow.ts     typed SSE client (createSession / ask)
  lib/roles.ts       role → chatId + copy + suggestions
  lib/theme.tsx      light/dark provider (persisted)
  hooks/useChat.ts   session lifecycle, streaming, abort, errors
  components/        Aurora, RoleCard, Markdown (+ [ID:n] chips), Sources, Composer, …
  screens/          LoginScreen, ChatScreen
scripts/
  setup_and_probe.py mint token + write .env + verify contract
  shots.mjs          Playwright screenshot harness (npm i -D playwright)
```

## Design system — "Cultivated Intelligence"

- Constant IB **forest-green** brand; warm bone paper (light) / deep loam (dark).
- **Role-coded accent**: Farmer = harvest gold, Employee = teal — recolors the whole UI.
- Type: **Fraunces** (display) + **Hanken Grotesk** (body), self-hosted (offline-safe).
- Motion: eased framer-motion — staggered entrance, tilt/spotlight role cards, streaming.
