# Implementation plan: local-first Sync Now and configurable catalogues

> Execute in order using test-driven development. Do not merge until the full suite and production build pass.

**Spec:** `docs/superpowers/specs/2026-11-23-local-first-sync-and-configurable-catalogues.md`

## Global constraints

- Preserve Firebase Auth, UID-scoped Firestore paths, PWA installation, backup/restore semantics and current security rules.
- Keep the existing Firestore persistent IndexedDB cache as the durable local data layer.
- Routine app launch and month navigation must not call server reads.
- Explicit Sync Now may refresh only the active UID's profile and selected-month records.
- All user writes must remain available offline through Firestore's persistent write queue.
- Do not remove or rewrite historical records when catalogue values are changed.

## Task 1: Add testable read-policy helpers

Files: `src/ledger-sync.js`, `tests/ledger-sync.test.js`.

1. Add failing tests for read policy: startup = cache, month change = cache, explicit sync = server.
2. Add pure helpers to map Firestore snapshots into the existing milk/transaction row shapes and to derive sync status.
3. Test profile/catalogue normalisation and default migration separately.
4. Run focused tests, then the full test suite.

## Task 2: Replace routine live listeners with cache-only reads

Files: `src/main.jsx`, `src/ledger-sync.js`.

1. Add regression tests asserting no `onSnapshot` routine listeners are installed.
2. Read profile, milk and transactions from Firestore cache for the selected month. Handle cache misses without blocking the app shell.
3. Reset visible state on UID change before reading the new UID's cache.
4. On month change, unsubscribe from nothing (no listeners) and render the requested month's cached records.
5. Keep add/update/delete operations on Firestore's offline-capable writes; update the UI optimistically and surface pending status.
6. Verify backup and restore still use full-history server reads only on explicit user action.

## Task 3: Implement explicit Sync Now

Files: `src/main.jsx`, `src/ledger-sync.js`, `src/style.css`, tests.

1. Add tests for active UID + selected month query construction and merge behavior.
2. Add a visible Sync Now control with busy, success, offline and error states.
3. Fetch the account profile and selected-month milk and transaction documents from the server only after the user presses Sync Now.
4. Replace the visible selected-month data with the authoritative server result while preserving pending local writes. Never clear queued writes.
5. Prevent concurrent sync actions and ignore stale responses after account/month changes.
6. Test offline rejection, retry, empty server results and account switching.

## Task 4: Add configurable catalogues

Files: `src/app-settings.js`, `src/main.jsx`, `tests/app-settings.test.js`, new catalogue tests.

1. Add stable-key catalogue defaults for transaction kinds, expense categories, milk types and shifts.
2. Add validation/normalisation for user-defined labels, keys, duplicate values, maximum lengths and catalogue size.
3. Add migration defaults for existing profiles and backups.
4. Replace hard-coded option arrays and labels in forms, summaries and record rendering with catalogue lookups.
5. Add configuration UI for adding, renaming, reordering, deactivating and restoring options.
6. Ensure amount and milk quantity remain ordinary numeric inputs, not configurable catalogue entries.
7. Preserve historical keys/labels when a catalogue option is renamed or deactivated.

## Task 5: Persist configuration safely

Files: `src/main.jsx`, `src/app-settings.js`, tests.

1. Save catalogue configuration under the authenticated user's existing profile document.
2. Update local state immediately and rely on Firestore's offline queue for remote persistence.
3. Handle concurrent profile writes without losing settings or catalogues.
4. Ensure backups include catalogues and restore merges them without overwriting existing user choices unexpectedly.
5. Test UID isolation and legacy backup compatibility.

## Task 6: Verify and document

Files: `README.md`, tests and CI.

1. Run all tests and production build.
2. Inspect service-worker caching and Android PWA startup behavior.
3. Verify fresh account, populated cache, offline launch, offline entry, Sync Now, month switch, account switch, backup and restore.
4. Document the explicit Sync Now model and its multi-device implications.
5. Review the complete diff before opening a PR.
