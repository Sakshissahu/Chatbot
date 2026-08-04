#!/usr/bin/env bash
# ============================================================================
#  ragflow-data-restore.sh   —   RUN THIS ON THE TARGET (laptop or new server)
#
#  Loads ragflow-export/{es,mysql,minio}.tgz into the RAGFlow Docker volumes so
#  the dashboard shows that data. Stops the stack, wipes + extracts each volume,
#  restarts.
#
#  Run it from the project root AFTER the stack has been started once (so the
#  volumes exist):
#        bash deploy/ragflow-data-restore.sh
#
#  Windows note: run this in Git Bash. It sets MSYS_NO_PATHCONV=1 so the Docker
#  volume mounts don't get mangled.
# ============================================================================
set -euo pipefail
export MSYS_NO_PATHCONV=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IN="$ROOT/ragflow-export"
cd "$ROOT/docker"

for f in es.tgz mysql.tgz minio.tgz; do
  [ -f "$IN/$f" ] || { echo "MISSING $IN/$f — copy the fresh dumps here first."; exit 1; }
done

echo "Stopping the stack (data is safe — no -v) ..."
docker compose stop

# Resolve the real (project-prefixed) volume names by suffix.
vol() { docker volume ls --format '{{.Name}}' | grep -E "(_|^)$1\$" | head -1; }

restore() {  # <volume-suffix> <tgz>
  local suffix="$1" f="$2"
  local real; real="$(vol "$suffix")"
  if [ -z "$real" ]; then echo "  volume *$suffix not found — skipping $f"; return; fi
  echo "  restoring $f  ->  $real"
  docker run --rm -v "$real":/data -v "$IN":/backup alpine \
    sh -c "cd /data && rm -rf ./* ./.[!.]* 2>/dev/null; tar xzpf /backup/$f"
}

restore esdata01   es.tgz
restore mysql_data mysql.tgz
restore minio_data minio.tgz

echo "Starting the stack ..."
docker compose up -d
echo "Done. Give RAGFlow ~1-2 min to boot, then hard-refresh the dashboard."
