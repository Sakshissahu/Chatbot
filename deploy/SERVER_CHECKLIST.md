# Server deploy checklist

This backup was set up and tested on a **laptop behind the IB Group corporate
network**. A few things were added that make the laptop work but must **NOT** be
carried to the server as-is. Use this list when deploying.

Target architecture on the server:

```
Users ─► chickenbot.abisexport.com ─► (Caddy) ─► app on :7071  (UI + /bff, one server)
Admin ─► botadmin.auditupload.com  ─► (Caddy) ─► RAGFlow on :7072
```
`:7071` = the BFF, which also serves the built frontend (single-port).
`:7072` = RAGFlow.  Postgres = :5442.  All on the same host.

---

## A. Laptop-only things — now ISOLATED and git-ignored (auto-safe)

All laptop-specific bits were moved into git-ignored files, so a **git-based deploy
carries none of them**. Nothing to strip if you deploy via git. If you deploy by
**copying the folder**, exclude these:

| Item (git-ignored) | What it is | On the server |
|---|---|---|
| `docker/docker-compose.laptop.yml` | The whole laptop overlay: ragflow-cpu **TLS relaxation** (trusts the office SSL-interception CA + relaxes verify) **and** the `ibchat-postgres` combine. | ❌ Don't copy. The TLS relax is insecure for a public server. Recreate the Postgres combine server-side (below). |
| `docker/certs/` , `docker/patches/` | Corporate CA bundle + the TLS-relax `sitecustomize.py`. | ❌ Don't copy. Not needed unless the server is *also* behind interception (then fix it properly — install the CA). |
| `docker/.env` → `COMPOSE_FILE` and `COMPOSE_PROJECT_NAME=ib_chatbot` | `COMPOSE_FILE` is what loads the laptop overlay; `COMPOSE_PROJECT_NAME` renames the project. | ⚠️ The server uses its **own** `docker/.env` (git-ignored). Without `COMPOSE_FILE`, `docker compose up` uses only the clean upstream `docker-compose.yml` — exactly what you want. Don't copy this `.env`. |

> **Result:** with none of the above present, `docker compose up` on the server runs
> the pristine upstream stack (no TLS-off, no laptop overlay, no rename). To keep the
> **DB-combine** on the server, add an `ibchat-postgres` service to the server's own
> compose/override with a server-appropriate volume (a fresh named volume, or point
> it at the server's existing app-DB volume so chat history isn't lost) — copy just
> that service, not the TLS block.

---

## B. Settings that are CORRECT for the server (keep as-is)

- `myui/.env` → **`VITE_BACKEND_URL=` (blank)** — correct. With the single-port /
  same-origin design the built UI calls the relative `/bff`, served by the same
  server. Do NOT set it back to a separate backend URL.
- `myui-backend/.env` → `RAGFLOW_BASE_URL=http://localhost:7072`,
  `FARMER_BOT_ID`, `DATABASE_URL=…localhost:5442`, `GOOGLE_SPEECH_API_KEY` —
  fine as long as RAGFlow + Postgres run on the same host.
- `myui-backend/.env` → `ALLOWED_ORIGIN` — with same-origin it isn't strictly
  needed; set it to the real domain `https://chickenbot.abisexport.com` (or drop it).
- `myui-backend/src/index.ts` single-port static serving — keep it; it's what
  makes the one-port setup work.

---

## C. Deploy steps (server)

1. **Confirm the server can reach the cloud LLM** without the TLS hack:
   ```bash
   docker exec <ragflow-container> python3 -c "import urllib.request as u; print(u.urlopen('https://generativelanguage.googleapis.com/',timeout=10).status)"
   ```
   If it errors with a certificate problem, the server IS behind interception too —
   solve it properly (install the CA), do NOT reuse the laptop TLS-off patch.
2. **Build the frontend** so the BFF can serve it:
   ```bash
   cd myui && npm install && npm run build     # produces myui/dist
   ```
   (Ensure `myui/.env` VITE_BACKEND_URL is blank before building.)
3. **Start the stack** (RAGFlow + Postgres) with the server's own compose/env
   (server-safe override only — no TLS block, no laptop project name).
4. **Start the BFF**: `cd myui-backend && npm install && npm run start`  (:7071).
5. **Reverse proxy** — install Caddy and use `deploy/Caddyfile`:
   - `chickenbot.abisexport.com` → `reverse_proxy localhost:7071` (UI + API; the
     single-port change means Caddy no longer needs to serve static separately —
     you can simplify the chickenbot block to just this one proxy line).
   - `botadmin.auditupload.com` → `reverse_proxy localhost:7072`.
   - Edit the email + reload Caddy. HTTPS is automatic.
6. **Secure `botadmin`** before real use (IP allow-list / Basic Auth / VPN).

---

## D. Domains needed
- **2 domains** if the RAGFlow admin dashboard must be reachable over the internet
  (`chickenbot` for users + `botadmin` for admin).
- **1 domain** (`chickenbot` only) if you access RAGFlow admin locally / over VPN —
  more secure.

---

## Quick "clean vs laptop-only" reference
- ✅ Safe/committed: `myui/**`, `myui-backend/src/**`, `deploy/**`, `startup1.txt`, `DEMO.md`
- ⚠️ Laptop-only (all git-ignored, don't deploy): `docker/docker-compose.laptop.yml`, `docker/certs/`, `docker/patches/`, `docker/.env` (COMPOSE_FILE + project name)
