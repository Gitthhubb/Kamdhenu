# Kamdhenu configurable account profiles

**Date:** 2026-11-15

## Objective

Generalise Kamdhenu so different households, dairies and small operators can configure their own ledger identity and data-entry defaults. The application must not encode a named individual or a single household workflow in its operational interface.

## Account scope

- Continue using Firebase Authentication and the existing users/{uid} Firestore boundary.
- Persist configuration in the authenticated user's existing profile document.
- Do not combine users' ledgers or introduce shared-workspace access in this change.
- Do not migrate or rewrite historical milk and transaction documents.

## Configurable settings

Each account may configure:
- Ledger/business name, subtitle and optional footer note.
- Display currency from INR, USD, GBP and EUR.
- Optional quick-entry preset label.
- Default supplier/milkman, default milk type and default rate.
- Whether the default rate is locked in the entry form or editable per entry.

The quick-entry preset pre-fills and constrains supplier and milk type. The default rate is locked only when the account enables the lock option.

## Backward compatibility

Older releases stored the one-person preset as settings.personalMode, settings.milkman and settings.buffaloRate. Normalisation maps those properties to the generic quick-entry fields:
- personalMode -> quickEntryEnabled
- milkman -> defaultMilkman
- buffaloRate -> defaultRate
- Legacy active mode defaults to buffalo milk and a locked rate.

Legacy JSON/Drive backups follow the same normalisation and validation path. The legacy fields are not required in the new application UI. Existing data entries remain untouched.

## Out of scope

- Shared team workspaces and role-based collaboration.
- User-created milk types and transaction categories.
- Full interface localisation.
- Subscription, billing or paid cloud services.

## Acceptance criteria

1. No personal-name or family-specific labels remain in the operational UI.
2. A user can configure the ledger's name, subtitle, currency and optional quick-entry profile.
3. The preset's supplier and milk type prefill new milk entries; the rate lock is independently configurable.
4. Settings are saved to the currently authenticated UID only.
5. Existing accounts and old backups are migrated without changing their ledger records.
6. Export/restore validation and automated tests cover both legacy and configurable settings.
