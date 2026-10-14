FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim-bookworm AS python-build
WORKDIR /build
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir 'pip>=26.2,<27'
COPY backend/pyproject.toml backend/requirements.lock ./
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements.lock
COPY backend/app ./app
RUN /opt/venv/bin/pip install --no-cache-dir --no-deps .

FROM python:3.13-slim-bookworm AS runtime
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    AFTERTONE_ENV=production AFTERTONE_DATABASE_URL=sqlite:////data/aftertone.sqlite3 \
    AFTERTONE_COVER_DIR=/data/covers AFTERTONE_FRONTEND_DIR=/app/frontend
RUN groupadd --gid 10001 aftertone && useradd --uid 10001 --gid 10001 --no-create-home aftertone \
    && mkdir -p /data/covers && chown -R 10001:10001 /data
COPY --from=python-build /opt/venv /opt/venv
WORKDIR /app/backend
COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY --from=frontend /build/dist /app/frontend
COPY scripts/backup.py /app/scripts/backup.py
COPY --chmod=755 deploy/entrypoint.sh /app/entrypoint.sh
USER 10001:10001
EXPOSE 8017
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8017')+'/health', timeout=3)"
ENTRYPOINT ["/app/entrypoint.sh"]
