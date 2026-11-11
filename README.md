# कामधेनु

A small Hindi household ledger for milk collection and daily cash entries.

## Stack

- Firebase Authentication with Google sign-in.
- Cloud Firestore on the free Spark plan.
- Google Drive API for optional JSON backup/restore.
- Render static hosting and installable PWA.

No Supabase services or Firebase Cloud Storage are used.

## Firebase setup

1. Create a Firebase project on the **Spark (no-cost)** plan.
2. Register a Web app and copy its Firebase web configuration.
3. Enable **Authentication → Sign-in method → Google**.
4. Add `mymilk.onrender.com` under Authentication → Settings → Authorized domains.
5. Create the default Cloud Firestore database in **Native mode**.
6. Publish `firestore.rules` from this repository in the Firebase console.
7. Copy `.env.example` values into Render environment variables. Get a Web OAuth client ID from Google Cloud credentials for the same Firebase project.

The app needs: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_GOOGLE_CLIENT_ID`.

## Google Drive backup setup

Create an OAuth Web client in the same Google Cloud project. Add `https://mymilk.onrender.com` as an authorised JavaScript origin. The app uses Google Identity Services and the Drive `appDataFolder` scope to save one JSON backup file in the signed-in user's hidden application-data folder. It does not request access to the user's ordinary Drive files.

Set `VITE_GOOGLE_CLIENT_ID` to that Web client ID. If Drive OAuth is not configured, the ledger still works and the normal JSON download/upload controls remain available.

## Data model

Each Google account gets its own `users/{uid}` document with two collections:
- `milk`: date, shift, milkman, cow/buffalo, quantity, rate, amount, remarks.
- `transactions`: date, received/remained/advance/expense, amount, party, category and remarks.

Personal-mode settings are stored under the same user's profile. The app reads only the signed-in user's records.

## Entry behaviour

- New entries can be added.
- Existing entries cannot be edited.
- An entry can be deleted individually after confirmation.
- Deletions are permanent in the ledger. Download a backup before bulk cleanup.
- Three fixed monthly pages: days 1–10, 11–20 and 21–month-end.
- Mother mode fixes buffalo type, milkman and rate for future milk entries.

## Free-plan limits

Firestore Spark includes a daily free quota (currently 1 GiB stored data, 50,000 reads, 20,000 writes/deletes and 10 GiB/month outbound transfer). If a quota is exceeded on Spark, that service is capped until the quota resets; billing does not start automatically. Avoid enabling Blaze or paid Cloud Storage products.

## Local development

```bash
npm install
npm run dev
```
