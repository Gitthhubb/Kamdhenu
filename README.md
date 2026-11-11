# कामधेनु Point

A mobile-first milk-sales register for recording daily cow and buffalo milk transactions, maintaining a rate-aware ledger, and controlling access through Google accounts.

## Deployment
- Website: https://mymilk.onrender.com
- GitHub: https://github.com/Gitthhubb/Kamdhenu
- Supabase project: `kamdhenu-point` (Mumbai, `ap-south-1`)
- Supabase dashboard: https://supabase.com/dashboard/project/jcxdrtinbcegvupiisvz

The browser uses only the Supabase publishable key. Never commit a service-role key, Google Client Secret, or Supabase secret key.

## Google sign-in setup (required)
Google authentication is configured in the Supabase dashboard, not in the React source.

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add this **Authorised JavaScript origin**:
   `https://mymilk.onrender.com`
3. Add this **Authorised redirect URI**:
   `https://jcxdrtinbcegvupiisvz.supabase.co/auth/v1/callback`
4. In [Supabase → Authentication → Providers → Google](https://supabase.com/dashboard/project/jcxdrtinbcegvupiisvz/auth/providers), paste the Google Client ID and Client Secret and enable Google.
5. In [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/jcxdrtinbcegvupiisvz/auth/url-configuration), set Site URL to `https://mymilk.onrender.com` and add that same URL to the redirect allow list.

The OAuth Client Secret must be entered directly into Supabase. Do not send it in chat or commit it to GitHub. Until these steps are completed, the app will display a specific provider-configuration error.

## First administrator
The designated administrator email `upscpremcq@gmail.com` is already present in the active administrator allowlist in this Supabase project. The database trigger checks that allowlist when a Google user first signs in and automatically creates an active administrator profile for that exact email. No manual SQL bootstrap is required.

After Google sign-in has been enabled, sign in with that exact Google account. The administrator can then authorise or revoke ordinary user accounts through the Access tab. Administrator accounts are deliberately protected from changes in that user-facing screen; change administrator privileges directly in Supabase. Never automatically grant administrator privileges to the first person to visit a public URL.

## Features
- Record date, buyer, milk type, litres, rate, calculated amount and remarks.
- Separate cow and buffalo rates.
- Preserve the rate and amount snapshot on each historical entry.
- Daily dashboard, monthly ledger and CSV export.
- Administrator-only rate and buyer maintenance, sales edit/delete and access management.
- Active authenticated users can create entries and read the ledger; database Row Level Security remains the enforcement boundary.

## Local development
```bash
npm install
cp .env.example .env
# Set VITE_SUPABASE_PUBLISHABLE_KEY in .env
npm run dev
```

## Render
Static Site settings:
- Branch: `main` (or approved release branch)
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL=https://jcxdrtinbcegvupiisvz.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>`

Render's standard hostname is `https://mymilk.onrender.com`; it does not issue the requested `mymilk.web.onrender.com` hostname.
