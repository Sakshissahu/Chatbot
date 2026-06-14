# IB Group Chat — Demo Deployment Guide

One place for everything: bringing the full stack up locally, exposing the
backend through a free Cloudflare tunnel, and deploying the frontend to Vercel
so teammates can use it over the internet.

```
 Teammates ──▶ Vercel frontend (myui)  ──▶  Cloudflare quick-tunnel
                  (https://*.vercel.app)        (https://*.trycloudflare.com)
                                                        │
                                                        ▼
                              THIS LAPTOP:  myui-backend (:8088)
                                                        │
                                        ┌───────────────┴───────────────┐
                                        ▼                               ▼
                                RAGFlow (:80, Docker)         ibchat_postgres (:5442, Docker)
```

- The **frontend** is a static Vite build on Vercel. At build time it bakes in
  `VITE_BACKEND_URL` = the current tunnel URL and calls `${VITE_BACKEND_URL}/bff/*`.
- The **backend** (BFF) holds the RAGFlow beta token + Postgres creds, proxies
  RAGFlow's SSE stream verbatim, and logs every Q&A. It stays on this laptop.
- The tunnel makes the laptop backend reachable from Vercel **without** opening
  ports or buying a domain. The tunnel URL **changes every restart** — that is
  why `start-demo.ps1` re-points Vercel and redeploys each time.

---

## 0. One-time setup (humans only — done once)

These need a browser / account login and are **not** automated.

1. **Vercel login** (opens a browser):
   ```powershell
   vercel login
   ```
2. **Link the frontend to a Vercel project** (run inside `myui`, creates `.vercel/`):
   ```powershell
   cd myui
   vercel link        # accept defaults; pick/create a project e.g. "ib-group-chat"
   cd ..
   ```
3. *(optional)* **GitHub** — see “Pushing to GitHub” at the bottom.

Tooling is already installed:
- **vercel** CLI — global npm install (`vercel --version`).
- **cloudflared** — standalone exe at `%LOCALAPPDATA%\cloudflared\cloudflared.exe`
  (no admin needed). `start-demo.ps1` finds it automatically.

---

## 1. Start the local stack (after a reboot)

1. Open **Docker Desktop**, then start the containers (RAGFlow + Postgres etc.):
   ```powershell
   cd docker
   docker compose -f docker-compose.yml up -d
   cd ..
   ```
   Wait 1–2 minutes for RAGFlow to boot (see `START_HERE.txt` for details / login).
2. The backend is started automatically by `start-demo.ps1`. To run it by hand:
   ```powershell
   cd myui-backend ; npm start          # http://localhost:8088
   ```

> Never run `docker compose down -v` — it wipes all data.

---

## 2. Bring the demo online — ONE command

```powershell
.\start-demo.ps1
```

It will:
1. ensure the backend (:8088) is up (start it if not),
2. open a fresh Cloudflare tunnel and capture its `https://*.trycloudflare.com` URL,
3. set the Vercel **production** `VITE_BACKEND_URL` to that tunnel URL,
4. run `vercel deploy --prod`,
5. print the **live link** to share.

Variants:
```powershell
.\start-demo.ps1 -TunnelOnly     # just open the tunnel (no Vercel step)
.\start-demo.ps1 -NoRedeploy     # set the env var but don't redeploy
```

### Stop the demo
```powershell
.\stop-demo.ps1                  # closes the tunnel; leaves backend + Docker up
```

---

## 3. Environment variables — what lives where

| Variable | Where it lives | Purpose | Secret? |
|---|---|---|---|
| `VITE_BACKEND_URL` | **Vercel** project env (production). Set by `start-demo.ps1`. | Tunnel URL the built frontend calls. Inlined at build time. | No |
| `VITE_BFF_BASE` | (optional) Vercel env / `myui/.env` | Override the `/bff` path prefix. Rarely needed. | No |
| `ALLOWED_ORIGIN` | `myui-backend/.env` (gitignored) | CORS allow-list. Default `http://localhost:5173,https://*.vercel.app`. | No |
| `RAGFLOW_BETA_TOKEN` | `myui-backend/.env` (gitignored) | Auth to RAGFlow. **Never** sent to the browser. | **Yes** |
| `DATABASE_URL` / `POSTGRES_*` | `myui-backend/.env` (gitignored) | ibchat Postgres creds. | **Yes** |
| `FARMER_BOT_ID` / `EMPLOYEE_BOT_ID` | `myui-backend/.env` | RAGFlow dialog ids per role. | No |
| `RAGFLOW_ADMIN_PASSWORD` | shell env, only when running `myui/scripts/setup_and_probe.py` | Mint a fresh beta token. Not hardcoded anymore. | **Yes** |

- **Local dev** sets no `VITE_BACKEND_URL`: the frontend uses the relative
  `/bff` prefix and the Vite dev proxy forwards it to `localhost:8088`
  (same-origin, no CORS). Run `cd myui ; npm run dev`.
- **Vercel build** sets `VITE_BACKEND_URL` to the tunnel, so the frontend makes
  absolute cross-origin calls to the tunnel; the backend's CORS handles it.

---

## 4. CORS & SSE (how cross-origin streaming stays intact)

- `myui-backend/src/index.ts` uses the `cors` package with a function origin
  check (`isAllowedOrigin` in `config.ts`). It **reflects** an allow-listed
  Origin (never `*`), sets `Vary: Origin`, and answers OPTIONS preflights with
  204 + `Access-Control-Allow-Headers: authorization, content-type`.
- `ALLOWED_ORIGIN` accepts a comma list with one `*` wildcard per host label,
  so `https://*.vercel.app` covers every Vercel production/preview URL. The
  **tunnel** URL is never in the allow-list — CORS checks the *browser's* origin
  (the Vercel domain), not the backend's address. So a new tunnel needs **no**
  backend change.
- The SSE proxy in `routes/conversations.ts` sets
  `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`,
  and re-emits RAGFlow frames verbatim. CORS only sets response headers, so it
  does not buffer the stream. **Verified through the tunnel**: 37 frames over
  ~1.1s (progressive, not buffered), cross-origin headers present on the stream.

---

## 5. Troubleshooting

- **Tunnel hostname won't resolve on THIS laptop** right after starting:
  local DNS lags on brand-new `*.trycloudflare.com` names (~5–60s). It resolves
  globally already, so **teammates and Vercel are unaffected**. To test from
  this laptop sooner, set its DNS to `1.1.1.1` or wait a minute.
- **CORS error in the browser console**: the Vercel origin isn't allow-listed.
  Check `ALLOWED_ORIGIN` in `myui-backend/.env` includes `https://*.vercel.app`
  (or your exact domain), then restart the backend.
- **Answer doesn't stream / arrives all at once**: confirm the backend response
  is `text/event-stream` and nothing in front compresses it. Cloudflare quick
  tunnels pass SSE through untouched (tested).
- **502 “Could not reach the assistant”**: RAGFlow (:80) is down or still
  booting — see `START_HERE.txt`.
- **Vercel build uses the wrong backend URL**: the env var is read at *build*
  time. Re-run `start-demo.ps1` (it sets the var *then* deploys).

---

## 6. Pushing to GitHub (optional — the demo does NOT need it)

The Vercel deploy works from your local `myui` via the CLI, so GitHub is only
for source control. There is no `git remote` yet.

> ⚠️ **Secrets**: `myui/.env`, `myui-backend/.env`, `conf/*.pem`, `docker/.env`,
> `load_keys.py` are all gitignored and safe. **`START_HERE.txt` is NOT tracked
> and contains the admin password in plaintext** — do **not** `git add -A` or add
> it. Commit only `myui/`, `myui-backend/`, and the demo scripts (as already
> committed). Consider removing the password line from `START_HERE.txt`.

One-time, after creating an (ideally **private**) empty repo on github.com:
```powershell
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
If `git push` prompts for auth and fails, install GitHub CLI and run `gh auth login` once.
