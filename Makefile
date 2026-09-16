SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:

ENV_FILE ?= .env

.PHONY: help setup dev migrate backup test lint build

help:
	@echo "make setup   Prepare local dependencies and create .env if needed"
	@echo "make dev     Migrate and run the API and web client together"
	@echo "make backup  Create a consistent SQLite backup now"
	@echo "make test    Run backend and frontend tests"
	@echo "make lint    Type-check the frontend"
	@echo "make build   Build the frontend"

setup:
	@test -f "$(ENV_FILE)" || cp .env.example "$(ENV_FILE)"
	@test -x backend/.venv/bin/python || python3 -m venv backend/.venv
	backend/.venv/bin/pip install -e 'backend[dev]'
	npm --prefix frontend install

migrate:
	@test -f "$(ENV_FILE)" || { echo "Missing $(ENV_FILE). Run 'make setup' first." >&2; exit 1; }
	set -a
	source "$(ENV_FILE)"
	set +a
	cd backend
	.venv/bin/alembic upgrade head

dev: migrate
	set -a
	source "$(ENV_FILE)"
	set +a
	(cd backend && .venv/bin/uvicorn app.main:app --host "$$AFTERTONE_API_HOST" --port "$$AFTERTONE_API_PORT" --reload) &
	api_pid=$$!
	npm --prefix frontend run dev -- --host "$$AFTERTONE_WEB_HOST" --port "$$AFTERTONE_WEB_PORT" &
	web_pid=$$!
	trap 'kill $$api_pid $$web_pid 2>/dev/null || true; wait $$api_pid $$web_pid 2>/dev/null || true' EXIT INT TERM
	wait $$api_pid $$web_pid

backup:
	./scripts/backup_aftertone.sh

test:
	cd backend
	.venv/bin/pytest
	cd ../frontend
	npm test -- --run

lint:
	npm --prefix frontend run lint

build:
	npm --prefix frontend run build
