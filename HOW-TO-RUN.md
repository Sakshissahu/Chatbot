# How to run the Chatbot on this PC

## Start (one command)

```powershell
cd E:\Work\chatbot\IB_Chatbot_Server
.\start.ps1
```

This starts Docker, all containers (with the SSL fix), the backend (:7071), the
frontend (:5173), and opens **http://localhost:5173** automatically.
First boot takes ~1–2 minutes for RAGFlow; then ask your question.

## Stop (keeps all data)

```powershell
.\stop.ps1
```

The two small windows that pop up (backend + frontend) must stay open while you
use the app — `.\stop.ps1` closes them.

## One-time only

If PowerShell blocks the script ("running scripts is disabled"), run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Good to know

- **Model:** answers come from the **OpenAI API** (`gpt-4.1-mini`).
- **SSL fix:** this laptop's Trend Micro Web Security agent MITM-inspects the
  container's HTTPS with certs that modern OpenSSL rejects. `start.ps1` applies
  `docker/docker-compose.laptop.yml` + `docker/certs/sitecustomize.py`, which
  keep certificate verification ON but tolerate the one non-compliant extension.
  This is why you must start via `start.ps1` (or include both compose files),
  not plain `docker compose up`.
- **Offline backup:** Ollama (`qwen2.5:7b`) is installed and running as a
  fallback model, configurable in RAGFlow admin at http://localhost:7072.
- **URLs:** app http://localhost:5173 · backend http://localhost:7071 ·
  RAGFlow admin http://localhost:7072 (`admin@ibgroup.co.in`).
- **Never** run `docker compose down -v` — the `-v` wipes all docs/chats/logins.
  Always stop with `.\stop.ps1` (or `docker compose stop`).
