#!/bin/sh
set -eu
umask 077
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8017}" --workers 1 --limit-concurrency 32 --timeout-keep-alive 5 --no-access-log --forwarded-allow-ips "${AFTERTONE_PROXY_IPS:-127.0.0.1}"
