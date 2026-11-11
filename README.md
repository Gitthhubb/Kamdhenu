# कामधेनु

Installable, mobile-first Hindi milk and transaction ledger.

Live site: https://mymilk.onrender.com

## Current edition: testing release

- Email account registration and sign-in are mandatory before the ledger opens. Authentication is handled by Supabase Auth.
- This is a test release. Entries made now are trials, not the authoritative household ledger. Real accounting records should be entered only after the stable 2.0 release.
- Milk and transaction records remain in browser Local Storage. They are not yet synchronised to Supabase or shared across devices.
- The two modules remain **दूध** and **लेन-देन**.
- Three date-based pages per month: days 1–10, 11–20, and 21–month-end.
- Records are append-only in the app: individual entries cannot be edited or deleted.
- JSON backup/restore and monthly milk CSV export remain available.

## माँ का व्यक्तिगत मोड

The toggle labelled **माँ का व्यक्तिगत मोड** applies a simplified milk-entry profile:

- Milk type is fixed to **भैंस**.
- The selected milkman is fixed for new entries.
- The buffalo milk rate is fixed for new entries.
- Date, morning/evening, quantity, and remarks remain editable.
- Configure the milkman and fixed rate under **सेटिंग** before switching the mode on. Changing these settings affects future entries only; existing test records remain unchanged.

## Authentication configuration

The static Vite build requires these Render environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

For local development, copy `.env.example` to `.env.local` and populate the same values. Only the publishable key belongs in the browser; never place a Supabase secret or service-role key in the frontend.

In Supabase Authentication URL Configuration, set the Site URL to `https://mymilk.onrender.com` and allow that origin as a redirect URL. Email/password registration uses the current app origin as its confirmation redirect. If confirmation mail does not reach a non-organisation email address, configure a supported custom SMTP provider for Supabase Auth before inviting other users.

The database has an authentication/profile foundation, but this edition deliberately does not write milk or transaction entries to the cloud. The data-storage and account-ownership model for real records must be reviewed and tested before 2.0.

## Accounting

Net amount = milk sales + received amounts − advances − expenses. Remained is shown separately as outstanding and is not added to cash received.

## Storage and backup

Test entries and personal-mode preferences are stored in the current browser profile on this device. Clearing site data or losing the device can erase them. Download a JSON backup before clearing browser storage. Authentication does not synchronise the ledger.

## Development

```
npm install
npm run dev
```
