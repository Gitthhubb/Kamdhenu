# कामधेनु Point

A mobile-first milk-sales register for cow and buffalo milk transactions.

## Deployment
- Website: https://mymilk.onrender.com
- GitHub: https://github.com/Gitthhubb/Kamdhenu
- Current ledger datastore: Supabase Postgres project `kamdhenu-point` (Mumbai)
- Render frontend: static site `mymilk`

## Authentication
- Google OAuth sign-in is supported when the Google provider is enabled in Supabase.
- Email/password registration and sign-in are supported. Email verification should remain enabled in Supabase Auth.
- Public registration is open. The database trigger provisions every new account as an active ordinary user unless the email is explicitly on the administrator allowlist.
- Administrator privilege is not self-service and must never be derived from public metadata.
- Password reset is available from the sign-in screen.

The Google OAuth Client Secret must be entered directly into Supabase. Never send it in chat or commit it to GitHub.

## Design and data
The browser currently uses the Supabase publishable key. The live ledger is still stored in Supabase Postgres, not in browser local storage. Render Postgres provisioning was blocked because Render requires billing information for this workspace. A later data migration must use a backend API and a dedicated Render Postgres instance; do not place database secrets in the browser bundle.

## First administrator
The designated administrator account `upscpremcq@gmail.com` is already present in the active administrator allowlist. Its role remains unchanged. New accounts receive `role=user`.

## Features
- Daily sales entry and cow/buffalo milk rates.
- Buyer list, monthly ledger and CSV export.
- Administrator-only rate, buyer, access and sales maintenance.
- Historical sale rows retain their applied rate and amount snapshots.

## Local development
```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the local environment.
