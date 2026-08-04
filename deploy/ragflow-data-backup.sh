#!/usr/bin/env bash
# ============================================================================
#  ragflow-data-backup.sh   —   export the LIVE RAGFlow dashboard data
#
#  Dumps RAGFlow's data (documents, prompts, datasets, model settings, chat
#  assistants) from its Docker VOLUMES into  ragflow-export/{es,mysql,minio}.tgz
#
#  SAFE BY DESIGN:
#   * Reads the volumes READ-ONLY (:ro) — cannot modify or delete anything.
#   * Finds RAGFlow's volumes by the ES volume's prefix and only touches the
#     three that share it, so other projects' databases (attendance, supabase,
#     the app postgres, etc.) are never read.
#   * Works whether or not RAGFlow's containers are running.
#   * Only creates 3 files in the output dir.
#
#  Usage:   bash ragflow-data-backup.sh [output-dir]
#           (default output dir: ./ragflow-export, relative to where you run it)
#
#  Good for automation: safe to run from cron on the server (see deploy/DATA-SYNC.md).
# ============================================================================
set -euo pipefail
OUT="${1:-./ragflow-export}"

# Find RAGFlow's Elasticsearch volume (the *esdata01 name is unique to RAGFlow),
# then derive the mysql/minio volumes from the SAME prefix so we can't grab a
# different project's mysql volume.
ESV=$(docker volume ls --format '{{.Name}}' | grep -E '(_|^)esdata01$' | head -1 || true)
if [ -z "${ESV:-}" ]; then
  echo "ABORT: no RAGFlow *esdata01 volume found. Nothing done."
  exit 1
fi
PREFIX="${ESV%esdata01}"          # e.g. "docker_"  or  "ib_chatbot_"
MYV="${PREFIX}mysql_data"
MIV="${PREFIX}minio_data"

# sanity: the mysql/minio volumes must actually exist
for v in "$MYV" "$MIV"; do
  docker volume inspect "$v" >/dev/null 2>&1 || { echo "ABORT: expected volume '$v' not found. Nothing done."; exit 1; }
done

echo "RAGFlow volumes:"
echo "  es    : $ESV"
echo "  mysql : $MYV"
echo "  minio : $MIV"
echo "Output : $OUT"
echo

mkdir -p "$OUT"
# Resolve OUT to an absolute path for the -v mount.
OUT_ABS="$(cd "$OUT" && pwd)"

dump() {  # <volume> <output-file>
  echo "  exporting $1 -> $OUT/$2"
  docker run --rm -v "$1":/data:ro -v "$OUT_ABS":/backup alpine \
    sh -c "cd /data && tar czf /backup/$2 ."
}
dump "$ESV" es.tgz
dump "$MYV" mysql.tgz
dump "$MIV" minio.tgz

echo
echo "Done. Fresh dumps (timestamps = now):"
ls -la "$OUT_ABS"/*.tgz
