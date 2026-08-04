# Syncing the RAGFlow dashboard data (server ⇄ laptop)

Your dashboard content — **documents, prompts, datasets, model settings, chat
assistants** — is NOT in the code. It lives in RAGFlow's **Docker volumes**. So a
code backup (git/zip) never contains it. To move the *current* dashboard you must
**re-package it from the live volumes each time** (that's what makes it "updated"
and not a frozen snapshot).

Two scripts do this:
- `deploy/ragflow-data-backup.sh`  — run on the **server** → makes fresh dumps.
- `deploy/ragflow-data-restore.sh` — run on the **laptop/target** → loads them.

---

## Pull the CURRENT data from the server to the laptop

### 1. On the SERVER (PuTTY)
Go to wherever the project lives on the server and run the backup:
```bash
cd /path/to/project           # the folder that has the docker/ directory
bash deploy/ragflow-data-backup.sh
```
If the script isn't on the server yet, either WinSCP it up first, or paste the
one-liner in the README/section below. It writes fresh files to
`./ragflow-export/es.tgz`, `mysql.tgz`, `minio.tgz` (check the timestamps — they
should say *now*).

### 2. WinSCP → laptop
Copy those 3 files from the server's `ragflow-export/` into the laptop at:
```
E:\Work\IB_Chatbot_Server\ragflow-export\
```
(overwrite the old ones).

### 3. On the LAPTOP (Git Bash)
```bash
cd /e/Work/IB_Chatbot_Server
bash deploy/ragflow-data-restore.sh
```
Wait ~1–2 min, hard-refresh the dashboard → it now shows the server's current data.

---

## Moving the project ELSEWHERE (always gets the updated version)
1. On the current host: `bash deploy/ragflow-data-backup.sh` (captures live data).
2. Copy the project **including `ragflow-export/`** to the new host.
3. On the new host: start the stack once, then `bash deploy/ragflow-data-restore.sh`.

Because step 1 re-dumps the live volumes every time, you always carry the
**current** dashboard, never a frozen one.

> ⚠️ The backup tars the live data dirs. For a perfectly consistent MySQL dump you
> can stop the stack first (`cd docker && docker compose stop`) then run the
> backup then `docker compose up -d`, but the live tar has worked fine so far.
