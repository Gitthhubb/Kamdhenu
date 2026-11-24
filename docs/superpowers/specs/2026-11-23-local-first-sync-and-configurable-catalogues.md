# Kamdhenu local-first synchronisation and configurable catalogues

**Date:** 2026-11-23

## Intent

Make routine application launches local-only and responsive, while retaining deliberate multi-device refresh through a visible **Sync Now** action. Make every predefined operational option configurable except expenditure values and milk quantities/amounts, which remain transaction inputs.

## Current findings

- Firestore persistent IndexedDB cache is enabled in `src/firebase.js`.
- `src/main.jsx` still attaches profile, milk and transaction `onSnapshot` listeners on launch and month changes.
- The UI's expense categories, transaction kinds, milk types and shifts are hard-coded.
- The settings panel only edits ledger identity, currency and quick-entry defaults.
- Firestore writes are already issued on entry; the SDK's persistent queue handles offline writes.

## Decisions

1. Keep Firebase Authentication and the existing `users/{uid}` ownership boundary.
2. Keep Firestore's persistent multi-tab cache. Do not introduce a second local database for ledger rows unless tests demonstrate a concrete gap; duplicating Firestore's durable cache creates competing sources of truth.
3. On launch, read the authenticated user's profile and selected-month ledger from Firestore cache only. Render the shell immediately when cache is empty.
4. Do not attach continuous server listeners for routine app use.
5. Add a **Sync Now** action that explicitly fetches the current account profile and selected-month records from the server, then updates the local Firestore cache/UI. Changing month reads that month's cache; it does not silently initiate a server refresh.
6. Continue writing new/edited/deleted records through Firestore's offline-capable write queue. Show pending/synced/offline/error status based on write metadata and operation outcomes.
7. Preserve full-history server reads for explicit backup/restore only.
8. Store configurable catalogues in the authenticated user's profile document. Include transaction classifications, expense categories, milk types, shifts, and other predefined selectable values. Each item has a stable key and display label; historical documents retain their stored key and display snapshot where necessary.
9. Expenditure amount and milk quantity/amount are not catalogue settings. Their numeric values remain editable transaction data.
10. Deleting a catalogue option must not delete or rewrite historical records. Prevent deletion of an option still referenced by a current default; permit archive/deactivate semantics for options already used in history.
11. Migrate existing hard-coded defaults into each account's effective configuration without altering existing records or requiring a destructive migration.

## Goals

- App shell and cached ledger appear without waiting for a network request.
- No server fetch occurs merely because the app opens or the month selector changes.
- Sync Now performs an explicit server refresh for the active UID and selected month.
- New entries are visible immediately and remain queued offline.
- Users can add, rename, reorder, deactivate and restore configurable fixed options.
- Configuration persists locally through Firestore cache and remotely in the user's own profile.
- Historical data, backups, authentication, guest-account linking and current security rules remain compatible.

## Non-goals

- Shared workspaces or cross-account data access.
- Automatic periodic background full-ledger downloads.
- Editing historical transaction amounts through catalogue configuration.
- Rewriting historical documents solely to rename a catalogue label.

## Acceptance criteria

- Tests prove startup and month changes use cache-only reads.
- Tests prove Sync Now is the only routine path that calls server reads.
- Tests prove Firestore writes remain offline-capable and are not blocked on a server read.
- Sync Now refreshes profile and the selected month's milk and transaction records for the active UID.
- Account switching cannot display another UID's cached records.
- Catalogues are configurable, validated, normalised, and backward-compatible.
- Historical entries remain intact when catalogue labels change or options are deactivated.
- Existing backup/restore remains full-history and deduplicating.
- Full test suite and production build pass.
