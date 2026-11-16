# Local-First Firestore Startup Implementation Plan

> **For agentic workers:** Execute task-by-task using test-driven development. Each task must have a failing test before production changes.

**Goal:** Open Kamdhenu immediately from its local Firestore cache, synchronise in the background, and limit routine reads to the selected month without truncating full backups.

**Architecture:** Enable Firestore's persistent multi-tab IndexedDB cache. Render the app shell without waiting for cloud listeners; expose cache/server/offline state. Scope live milk and transaction listeners to the selected calendar month. Fetch complete collections from the server only for backup and restore operations, where complete history is required.

**Tech Stack:** React 18, Firebase Web SDK 12.19.0, Cloud Firestore modular API, Node.js built-in test runner.

**Spec:** User-approved direction in conversation dated 2026-11-16: local-first cached UI with background synchronisation and bounded reads.

## Global Constraints

- Keep Firebase Web SDK pinned at 12.19.0 or later.
- Preserve Google authentication, Android PWA install flow, and service-worker cache v5.
- Do not change Firestore security rules or the document schema.
- Never create an incomplete JSON or Drive backup by serialising only the selected month.
- Preserve full-history restore deduplication by checking existing records against the server.
- Do not gate the application shell on successful Firestore connectivity.
- Persistent cache is shared across browser tabs; keep application data scoped by authenticated UID.

## Review Focus

- Offline launch with a populated cache must render cached records and not wait for a server response.
- First launch with no cache must still render the shell without presenting an indefinite spinner.
- Changing months must unsubscribe from the previous month and show only the newly selected month's records.
- Backup and restore must continue to include/check the entire history, not just the currently selected month.
- Multiple tabs and browsers without supported IndexedDB persistence must not make the app unusable.

## Files

- Modify `src/firebase.js`: initialise Firestore with persistent multi-tab local cache.
- Create `src/ledger-query.js`: pure helper returning inclusive month start and exclusive next-month boundary.
- Modify `src/main.jsx`: month-scoped listeners, metadata-based sync status, non-blocking shell, complete server-side backup/restore reads.
- Modify `src/style.css`: compact synchronisation status treatment.
- Create `tests/local-first-firestore.test.js`: unit and regression tests for query boundaries, cache configuration, UI startup, and complete-history backup/restore.
- Modify `README.md`: describe local cache behavior, privacy consideration, and backup connectivity.

## Tasks

### Task 1: Month query boundaries

- [x] Write failing tests for ordinary months, December rollover, leap-year February, and invalid month keys.
- [x] Run `npm test` and confirm the new tests fail because the helper is absent.
- [x] Implement `getMonthDateRange(monthKey)` in `src/ledger-query.js`.
- [x] Run the focused test and then the full suite.

### Task 2: Persistent cache and non-blocking startup

- [x] Add failing regression assertions for persistent multi-tab cache, metadata-aware listeners, and the absence of a Firestore-dependent render gate.
- [x] Implement persistent Firestore cache and the visible sync/offline state.
- [x] Keep the account shell rendered while initial snapshots arrive from cache or server.
- [x] Run the full suite and production build.

### Task 3: Bounded reads and complete backup semantics

- [x] Add failing regression assertions for month-bounded listener queries and server-fetched full-history backup/restore.
- [x] Apply the selected month range to milk and transaction listeners.
- [x] Change JSON and Drive backups to fetch complete histories from the server on demand.
- [x] Change restore deduplication to use complete server snapshots.
- [x] Run all tests, build, and dependency audit.

