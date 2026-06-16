# src/store

Redux Toolkit store wiring. Global app state lives here; feature reducers live with their feature.

## Files

- `index.ts` — `configureStore` with the root reducer map (currently `{ workflow }`). Exports `store`, `RootState`, and `AppDispatch`. Register new feature reducers here.
- `hooks.ts` — typed `useAppDispatch` / `useAppSelector` (via `withTypes`). **Always use these instead of the raw react-redux hooks** so selectors and dispatch stay typed.

## Conventions

- Reducers are defined in their feature folder (e.g. `@/features/workflow/workflowSlice.ts`) and only _registered_ here.
- Don't import feature components into the store. Import only reducers.
- Keep `RootState`/`AppDispatch` derived from `store` — never hand-write them.
