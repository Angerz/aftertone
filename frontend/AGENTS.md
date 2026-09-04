# Frontend conventions

The UI is deliberately a small React/TypeScript client until the rating workflow is implemented. Keep feature code grouped by purpose under `src/` (for example, `features/ratings/`), with shared API code in `src/api/` and small reusable presentation components in `src/components/`.

Use strict TypeScript; define API response/request types instead of passing untyped JSON around. Keep server-derived data in the feature that consumes it until a concrete cross-screen need justifies shared state. Do not duplicate the rating formula: display values returned by the API.

Avoid giant page components: extract a component when it has a distinct responsibility or becomes hard to read. For UI changes, run `npm run lint`; run `npm run build` when changing build config, dependencies, or broader TypeScript structure. Add focused tests once behavior beyond static rendering is introduced.

