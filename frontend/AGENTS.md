# Frontend conventions

The UI is deliberately a small React/TypeScript client until the rating workflow is implemented. Keep feature code grouped by purpose under `src/` (for example, `features/ratings/`), with shared API code in `src/api/` and small reusable presentation components in `src/components/`.

Use strict TypeScript; define API response/request types instead of passing untyped JSON around. Keep server-derived data in the feature that consumes it until a concrete cross-screen need justifies shared state. The API remains authoritative for persisted rating values. `features/ratings/ratingPreviewCalculator.ts` is the sole, isolated exception: it provides labelled, ephemeral live feedback and must never feed calculated values into an API request; replace its result with the POST revision response after saving.

Avoid giant page components: extract a component when it has a distinct responsibility or becomes hard to read. For UI changes, run `npm run lint`; run `npm run build` when changing build config, dependencies, or broader TypeScript structure. Add focused tests once behavior beyond static rendering is introduced.

Changes to `features/ratings/ratingPreviewCalculator.ts` must run its focused parity tests with `npm test`.

Historical revisions are immutable. “Rate again” must copy snapshot data into a separate frontend draft; saving always creates a new revision.

Legacy extracted scores are not track ratings until explicitly reconciled: never map them by position or invent track identities. Legacy derived values are audit inputs recomputed by the backend calculator. `needs_revisit` is current album state and saving a revision must not clear it.
