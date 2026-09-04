# Central rating calculator and numeric policy

## Context

The formula will evolve and must not diverge across API, persistence, and UI. Individual scores need decimal increments, while derived results can have more precision.

## Options considered

- Repeat the formula in models/endpoints/frontend with `float`.
- Use one pure Python calculator using `Decimal` and persist its results.

## Decision

`backend/app/ratings/calculator.py` is the only formula implementation. It accepts `Decimal` inputs and returns a `RatingResult`; unit tests exercise thresholds, emotion behavior, empty inputs, and known formulas. SQLAlchemy maps scores/results to `NUMERIC(4,2)` and `NUMERIC(12,8)` respectively.

## Consequences

No caller independently recomputes a rating. `Decimal` avoids binary floating-point artifacts; API schemas added later should parse decimal strings/numbers directly into Decimal. A revision with no included tracks has no pre-rating, bad-experience, emotion component, or final rating rather than inventing a zero score.

