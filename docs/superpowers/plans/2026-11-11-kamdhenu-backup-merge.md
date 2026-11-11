# Kamdhenu Backup Merge Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make JSON and Google Drive restore merge missing ledger entries without duplicating already-imported records.

**Architecture:** A small pure module normalizes milk and transaction records and plans additions by stable document ID. ID-less legacy rows use normalized content matching. The existing shared restore function performs Firestore reads and writes using that plan.

**Tech Stack:** JavaScript ES modules, Node.js 22 built-in test runner, Firebase Firestore.

**Spec:** `docs/superpowers/specs/2026-11-11-kamdhenu-backup-merge-design.md`

## Global Constraints
- Keep the existing React/Vite application and Firebase client SDK.
- Use Node.js 22 in CI.
- Keep records immutable: restore may create missing documents but must not update or delete existing entries.
- Apply the same restore behavior to JSON-file and Google Drive backups.
- Do not add dependencies.

## Review Focus
- Repeated restore of the same backup: existing source IDs must be skipped.
- Legacy rows without IDs: exact normalized matches must be skipped.
- Legitimate identical entries with distinct IDs: both must be retained.
- Unsafe document IDs: must not be used as Firestore paths; use the legacy matching path instead.
- Repeated IDs within one backup: only one document may be planned.

---

### Task 1: Specify restore merge behavior with unit tests

**Files:**
- Create: `tests/restore-merge.test.js`
- Modify: `package.json` to add `npm test`
- Modify: `.github/workflows/ci.yml` to run tests before the production build

**Interfaces:**
- Tests import `planRestoreMerge`, `normalizeMilkRecord`, and `normalizeTransactionRecord` from `../src/restore-merge.js`.
- `planRestoreMerge(incoming, existing, normalize)` returns records shaped as `{ id: string|null, record: object }`.

- [ ] **Step 1: Write the failing tests** for repeat imports, ID-less exact duplicates, same-valued records with distinct IDs, duplicate IDs within one backup, unsafe IDs, and milk/transaction field normalization.
- [ ] **Step 2: Run `npm test`**. Expected: fail because `src/restore-merge.js` does not yet exist.
- [ ] **Step 3: Commit the tests and test-runner wiring** with message `test: specify idempotent backup restore`.

### Task 2: Implement and integrate merge restore

**Files:**
- Create: `src/restore-merge.js`
- Modify: `src/main.jsx` in `restoreBackupData`

**Interfaces:**
- Implement the three exports named in Task 1.
- Normalize milk fields to `date, shift, milkman, milkType, quantity, rate, amount, remarks`.
- Normalize transaction fields to `date, kind, amount, party, category, remarks`.
- Existing Firestore snapshots are supplied to the planner with their document IDs.
- Use `setDoc` only for new records with safe source IDs; use `addDoc` for ID-less legacy records. Existing documents are never written.

- [ ] **Step 1: Implement the pure normalization and planning functions** to satisfy the tests.
- [ ] **Step 2: Update `restoreBackupData`** to read the two existing collections, plan additions independently, write only planned additions, then retain the existing profile-settings merge.
- [ ] **Step 3: Run `npm test`**. Expected: all restore-merge tests pass.
- [ ] **Step 4: Run `npm run check`**. Expected: Vite production build succeeds.
- [ ] **Step 5: Verify the GitHub Actions run** for the final commit is successful; inspect the PR diff and combined status before reporting completion.

## Completion Criteria
A second restore of the same backup adds zero entries; legacy ID-less duplicates are not re-added; distinct source IDs remain distinct even if their visible values match; existing entries are neither updated nor deleted; JSON and Drive restore use the same merge path.
