# Deploying the 2-domain setup (Caddy)

This replaces the old **3-piece** layout (frontend domain + separate
`auditupload` backend domain + local RAGFlow) with a **2-domain** layout:

| Domain | Serves | Port behind it |
|---|---|---|
| `chickenbot.abisexport.com` | Chat UI **and** backend (`/bff`) | frontend `dist` + `:7071` |
| `botadmin.auditupload.com` | RAGFlow admin dashboard | `:7072` |

The old `auditupload.abisexport.com` backend domain is **eliminated** — the
backend now lives under `chickenbot…/bff`, so the browser makes same-origin
calls (no CORS to configure).

---

## Why Caddy
- **Auto HTTPS** — it fetches and *auto-renews* the TLS certs for both domains
  itself. No certbot, no expiry surprises.
- **SSE-safe** — `flush_interval -1` makes answers stream word-by-word.
- **Tiny config** — one file (`Caddyfile`).

---

## One-time prerequisites (on the server)
1. **DNS**: point both records at the server's public IP:
   - `chickenbot.abisexport.com  → <server IP>`
   - `botadmin.auditupload.com   → <server IP>`
2. **Firewall**: open TCP **80** and **443** (Caddy needs both; 80 is for the
   cert challenge + HTTP→HTTPS redirect). RAGFlow keeps using 7072/7073, the
   backend 7071 — those stay internal and do NOT need to be public.
3. **Install Caddy** (Ubuntu/Debian):
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install caddy
   ```

## Build the frontend (on the server, whenever the UI changes)
```bash
cd /opt/IB_Chatbot_Server/myui      # wherever the repo lives on the server
npm install
npm run build                       # produces myui/dist
```
Make sure `myui/.env` has **`VITE_BACKEND_URL=`** (blank) so the built site
calls the relative `/bff` — this is already set in this repo.

---

## Deploy the proxy — the "just replace the file" step
1. Copy `deploy/Caddyfile` from this repo to the server's Caddy config location:
   ```bash
   sudo cp /opt/IB_Chatbot_Server/deploy/Caddyfile /etc/caddy/Caddyfile
   ```
2. **Edit the 2 lines marked `<<< EDIT`** in `/etc/caddy/Caddyfile`:
   - the `email` (any valid address), and
   - the `root *` path to wherever `myui/dist` actually is on the server.
3. Reload Caddy (zero-downtime):
   ```bash
   sudo systemctl reload caddy
   # first time / to see errors:  sudo caddy validate --config /etc/caddy/Caddyfile
   ```
Caddy will fetch HTTPS certs for both domains automatically on first request.

---

## Backend / RAGFlow (unchanged, must be running)
- Backend BFF on `:7071`  → `cd myui-backend && npm run start`
- RAGFlow on `:7072`      → `cd docker && docker compose -f docker-compose.yml up -d`
- App Postgres on `:5442` → `cd myui-backend && docker compose up -d`

`myui-backend/.env` keeps `RAGFLOW_BASE_URL=http://localhost:7072` — the backend
still talks to RAGFlow locally; only the two public domains change.

---

## What changed vs the old server (revert notes)
- `myui/.env`: `VITE_BACKEND_URL` is now **blank** (was
  `https://auditupload.abisexport.com`). Blank is correct for THIS design
  (same-origin `/bff`). Do **not** put the old value back unless you go back to a
  separate backend domain.
- `myui-backend/.env`: `ALLOWED_ORIGIN` still lists `chickenbot…` as a safety
  net; with same-origin it isn't strictly needed anymore.

## TODO (later) — secure `botadmin.auditupload.com`
It currently exposes RAGFlow (dashboard + API) to the internet. Before real use,
add ONE of these inside its block in the `Caddyfile`:
- IP allow-list (only your office/home IP), or
- Basic Auth (`basic_auth` directive), or
- put it behind a VPN and drop the public domain.
