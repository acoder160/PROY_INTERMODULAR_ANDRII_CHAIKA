#!/usr/bin/env bash
# Daily database dump, keeps the last 14 days. Run from cron on the VM:
#   15 3 * * * /home/ubuntu/spotcheck/deploy/backup.sh >> /home/ubuntu/spotcheck-backup.log 2>&1
# Restore: docker compose exec -T db pg_restore -U skatemap -d skatemap --clean --if-exists < FILE
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-$HOME/spotcheck-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

file="$BACKUP_DIR/spotcheck-$(date +%F-%H%M).dump"
# Write to a temp name first so a failed dump never looks like a good backup
docker compose exec -T db pg_dump -U skatemap -d skatemap -Fc > "$file.part"
mv "$file.part" "$file"

find "$BACKUP_DIR" -name 'spotcheck-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $file ($(du -h "$file" | cut -f1))"
