# Backend conventions

`app/main.py` owns application wiring and the small HTTP surface. `app/models/` declares SQLAlchemy persistence models; `app/schemas/` is reserved for Pydantic request/response contracts; `app/ratings/` owns pure domain calculations. Add services only for orchestration that cannot live cleanly in an endpoint or calculator.

The sole rating implementation is `app/ratings/calculator.py`. Keep it side-effect-free and cover formula changes with direct unit tests in `tests/ratings/`. Inputs and outputs are `Decimal`; database score fields are `NUMERIC`, avoiding surprising binary-float results.

An `Album` owns mutable catalogue tracks. A `RatingRevision` and its `TrackRatingRevision` rows are a snapshot: score, inclusion flag, and notes belong to that revision. Persist calculated `pre_rating`, `bad_experience`, and `final_rating` with the source subjective values so an old evaluation remains reconstructible. New ratings create a revision; they do not overwrite one.

Use Alembic for every schema change. Generate/review a migration, then run the narrowest relevant test command. Do not run the whole suite merely for a calculator or endpoint-only change.

A complete rating-revision request must contain exactly one entry for every current track of its album. This keeps each persisted revision a reconstructible snapshot.
