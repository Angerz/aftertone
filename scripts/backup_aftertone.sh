#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
if [[ -f "$project_dir/.env" ]]; then
  set -a
  source "$project_dir/.env"
  set +a
fi

database_url=${AFTERTONE_DATABASE_URL:-sqlite:///./aftertone.sqlite3}
case "$database_url" in
  sqlite:///*) database_path=${database_url#sqlite:///} ;;
  *) echo "AFTERTONE_DATABASE_URL must use SQLite." >&2; exit 1 ;;
esac
if [[ "$database_path" != /* ]]; then
  database_path="$project_dir/backend/$database_path"
fi
media_path=${AFTERTONE_COVER_DIR:-./data/covers}
if [[ "$media_path" != /* ]]; then
  media_path="$project_dir/backend/$media_path"
fi
backup_dir=${AFTERTONE_BACKUP_DIR:-$project_dir/backend/data/backups}
backup_path="$backup_dir/aftertone-$(date -u +%Y-%m-%dT%H%M%SZ).tar.gz"
python3 "$project_dir/scripts/backup.py" create --database "$database_path" --media "$media_path" --destination "$backup_path"
echo "Backup created: $backup_path"
