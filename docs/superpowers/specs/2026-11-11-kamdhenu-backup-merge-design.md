# Kamdhenu Backup Merge Design

**Date:** 2026-11-11

## Intent
Restoring a Kamdhenu JSON or Google Drive backup must add missing milk and transaction records without replacing or duplicating records already in the signed-in user's Firestore ledger.

## Scope
- Preserve the source record ID as the Firestore document ID when it is safe to use.
- Skip a source ID already present in the target collection. This makes repeat restores of the same backup idempotent.
- For legacy backup records without a safe ID, compare normalized record fields and skip exact matches already present or already accepted during the same restore.
- Preserve distinct records with different valid source IDs, even where their field values happen to be identical.
- Continue merging profile settings, rates and buyer names as before.
- Apply the same behavior to file-based and Google Drive restores because both use the shared restore function.

## Non-goals
No replace-all restore, bulk delete, ledger editing, schema migration, payment integration, or unrelated interface changes.

## Approaches
1. Replace the ledger with the backup: rejected because an ordinary restore could erase newer household records.
2. Fingerprint every record and discard any matching values: rejected because two legitimate entries can have identical values.
3. Merge by stable source ID, with exact-field matching only for ID-less legacy records: selected because it is repeatable and preserves distinct entries.

## Verification
Use Node's built-in test runner to verify repeat imports, legacy ID-less duplicates, repeated IDs within a backup, and preservation of distinct same-valued records. Then run the full test suite and Vite production build.
