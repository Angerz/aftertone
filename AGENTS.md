# Aftertone

Aftertone is a local, single-user music-rating journal. Its core concern is preserving albums, tracks, written notes, and historically reproducible rating revisions—not building a streaming or social product.

## Shape of the project

- `backend/`: FastAPI API, SQLAlchemy models, Alembic migrations, and domain logic.
- `frontend/`: small React/TypeScript client.
- `docs/decisions/`: concise ADRs. Add one when a decision changes a durable architectural boundary.

Keep this a simple modular monolith: no services, queues, generic repositories, auth, external music integrations, or Docker unless a concrete requirement warrants them. Coordinate API-contract changes across `backend/` and `frontend/` in the same change.

## Working rules

- Keep the rating formula exclusively in `backend/app/ratings/calculator.py`; never recalculate it in an endpoint, model, or UI.
- Rating revisions are historical snapshots. Do not update a completed revision to reflect changes to current album metadata or tracks.
- Use migrations for persistent-schema changes; do not use `create_all` at application startup.
- Use `Decimal` for rating-domain math and `NUMERIC` columns for persisted scores.
- Do not modify generated environments, SQLite database files, or migration history without a specific reason.

## Commands

See `README.md` for bootstrap commands. From `backend/`, run focused tests, for example `pytest tests/ratings/test_calculator.py`; run all tests only for cross-cutting changes or a release. From `frontend/`, use `npm run dev`, `npm run build`, and `npm run lint` when relevant.

