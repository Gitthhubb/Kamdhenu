# कामधेनु Point

A private, mobile-first milk sales register for daily transactions with milkmen. Supports cow and buffalo rates, buyer records, monthly summaries, CSV export, and Google-account access control.

## Stack
- React + Vite
- Supabase Auth (Google OAuth)
- Supabase Postgres with Row Level Security
- Render Static Site

## Supabase project
- Project: `kamdhenu-point`
- Region: `ap-south-1` (Mumbai)
- Project reference: `jcxdrtinbcegvupiisvz`
- API URL: `https://jcxdrtinbcegvupiisvz.supabase.co`

The initial schema and RLS policies are deployed as migrations. The browser uses only the publishable API key. Never place a Supabase service-role key in this repository or in browser environment variables.

## Google sign-in configuration
1. Open Supabase Dashboard > Authentication > Providers > Google:
   `https://supabase.com/dashboard/project/jcxdrtinbcegvupiisvz/auth/providers`
2. Create a Web OAuth client in Google Cloud Console and add the Supabase callback URI shown on that provider page to its authorised redirect URIs.
3. Add the Google Client ID and Client Secret to the Supabase Google provider settings and enable the provider.
4. In Supabase Authentication > URL Configuration, set the Site URL to the deployed Render URL and add the same URL to the redirect allow list.

Google OAuth requires a Client ID and Client Secret belonging to the account owner. They are deliberately not embedded in source code.

## Bootstrap the mother's administrator account
1. Enable Google sign-in as above and deploy the site.
2. Have the mother sign in once with her Google account. A profile is created inactive by default.
3. In Supabase SQL Editor, run the following after replacing the email with her exact Google account email:

```sql
update public.profiles
set role = 'admin', active = true
where lower(email) = lower('MOTHERS_GOOGLE_EMAIL');

insert into public.allowed_emails (email, role, active)
values ('MOTHERS_GOOGLE_EMAIL', 'admin', true)
on conflict (email) do update
set role = 'admin', active = true;
```

4. Sign out and sign in again. The mother's account is now the administrator.
5. The administrator can authorise or revoke additional Google accounts in the Access tab by email. Those accounts must sign in with the exact same Google email address.

The first account is never automatically made administrator. That avoids the usual public-URL account-takeover trick.

## Features
- Record date, buyer, milk type, litres, rate, amount and optional remarks.
- Separate cow and buffalo rates.
- Store the applied rate and amount on each transaction; changing current rates does not alter historical records.
- Daily dashboard and monthly ledger.
- Monthly CSV export.
- Admin-only rate and buyer management, editing/deleting sales, and access control.
- Authenticated users can add sales and view the ledger; database RLS enforces these permissions independently of the UI.

## Local development
```bash
npm install
cp .env.example .env
# Set VITE_SUPABASE_PUBLISHABLE_KEY in .env
npm run dev
```

## Render deployment
- Service type: Static Site
- Name: `mymilk`
- Branch: `main`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Region: Singapore (static sites are globally served)
- Environment variables:
  - `VITE_SUPABASE_URL=https://jcxdrtinbcegvupiisvz.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>`

The standard Render hostname is `https://mymilk.onrender.com`. Render does not issue the `mymilk.web.onrender.com` hostname format.
