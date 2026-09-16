#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
set -a
source "$project_dir/.env"
set +a

database_url=${AFTERTONE_DATABASE_URL:-sqlite:///./aftertone.sqlite3}
case "$database_url" in
  sqlite:///*) database_path=${database_url#sqlite:///} ;;
  *) echo "AFTERTONE_DATABASE_URL must use SQLite: $database_url" >&2; exit 1 ;;
esac

if [[ "$database_path" != /* ]]; then
  database_path="$project_dir/backend/$database_path"
fi
if [[ ! -f "$database_path" ]]; then
  echo "Database not found: $database_path" >&2
  exit 1
fi

backup_dir="$project_dir/backend/data/backups"
mkdir -p "$backup_dir"
backup_path="$backup_dir/aftertone-$(date -u +%Y-%m-%dT%H%M%SZ).sqlite3"

"$project_dir/backend/.venv/bin/python" - "$database_path" "$backup_path" <<'PY'
import sqlite3
import sys

source, destination = sys.argv[1:]
with sqlite3.connect(source) as source_connection, sqlite3.connect(destination) as destination_connection:
    source_connection.backup(destination_connection)
PY

echo "Backup created: $backup_path"
