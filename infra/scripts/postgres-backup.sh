#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:=./backups}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
backup_file="$BACKUP_DIR/amberkitchen-$timestamp.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$backup_file"
echo "Backup written to $backup_file"
