# कामधेनु

A small Hindi household ledger for milk collection and daily cash entries.

## Stack
- Firebase Authentication with Google sign-in and optional anonymous guest sessions.
- Cloud Firestore on Firebase Spark (free tier).
- Google Drive API for optional backup in the hidden `appDataFolder`.
- Render static hosting and installable PWA.

No Supabase services or Firebase Cloud Storage are used.

## Firebase setup
1. Create a Firebase project on the **Spark (no-cost)** plan.
2. Register a Web app and copy its Firebase web configuration.
3. Enable **Authentication → Sign-in method → Google**.
4. Enable **Authentication → Sign-in method → Anonymous** for guest sessions.
5. Add `mymilk.onrender.com` to Authentication → Settings → Authorized domains.
6. Create the default Cloud Firestore database in Native mode.
7. Publish `firestore.rules` from this repository in Firebase console.
8. Add the environment variables from `.env.example` to Render.

Required Render variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. `VITE_GOOGLE_CLIENT_ID` is optional and is needed only for Google Drive backup/restore.

## Google Analytics 4 via Google Tag Manager

The web app loads the Google Tag Manager web container `GTM-KWC3P697` from the document head. No GA4 Measurement ID is hard-coded in the app. In the GTM workspace, configure a **Google tag** with the Measurement ID of the Kamdhenu web data stream and fire it on **Initialization - All Initialization Events**. Publish the container version after testing.

To capture tab usage, create a GTM **Custom Event** trigger named `ledger_tab_view`. Create a Data Layer Variable named `tab_name` (Data Layer Version 2), then create a GA4 Event tag with event name `ledger_tab_view`, parameter `tab_name` mapped to that variable, and the custom-event trigger. Preview the container with Tag Assistant before publishing.

The app pushes only `{ event: 'ledger_tab_view', tab_name: 'milk' | 'transactions' }` to `window.dataLayer`. It does not send Firebase UIDs, email addresses, names, milk quantities, rates, transaction amounts, counterparties or remarks to Analytics.

Once the Google tag is published in GTM, GA4 can report page views, engagement, device categories and acquisition sources. Keep GA4 Enhanced Measurement enabled for the web stream. Earlier visits cannot be reconstructed; reporting starts when the configured container is published and receives traffic.

## Google Drive backup
Enable the Google Drive API in the same Google Cloud project. Create an OAuth Web client, add `https://mymilk.onrender.com` as an authorised JavaScript origin, and set its client ID as `VITE_GOOGLE_CLIENT_ID`. The app asks for the Drive `appDataFolder` scope only when the user presses the Drive backup or restore button. It does not request access to ordinary Drive files.

## Household data
Each Google account and each anonymous guest session gets its own `users/{uid}` document and two collections. Existing Firestore rules scope data to the authenticated UID, so anonymous users do not gain access to another user's data:

- Guest sessions are tied to the browser/app's locally persisted Firebase Auth session. Clearing browser data or signing out can make an unlinked guest account unrecoverable.
- In guest mode, use **Google खाते से जोड़ें** to link a Google identity to the current anonymous Firebase user. This keeps the same UID and preserves its ledger.
- If the chosen Google identity already belongs to another Firebase user, linking is rejected. Export the guest JSON backup, sign in to the existing Google account, and restore the backup there; no records are merged automatically.

Each Google account and guest session has these collections:
- `milk`: date, morning/evening, milkman, cow/buffalo, quantity, rate and amount.
- `transactions`: date, received/remained/advance/expense, amount, party, category and remarks.

The personal-mode settings live in the same user document.

## Record behaviour
Entries cannot be edited. Each entry can be deleted individually after confirmation. Deletions are permanent; export a JSON or Drive backup before removing anything. Restoring a backup first validates every row, date, type, amount, rate and profile setting before any Firestore write. It then merges only missing records. Reusing the same backup does not create duplicates; older records without IDs are matched by their normalized fields. Distinct records with different IDs are preserved even when their visible values match. If the profile settings write fails after records have been added, re-import the same JSON backup; existing records are skipped and profile settings can be retried.

The existing three date pages, cow/buffalo milk choices, expense categories and mother's personal mode remain.

## Free tier
Firestore Spark provides a daily free quota: 1 GiB stored data, 50,000 reads, 20,000 writes and 20,000 deletes per day, plus 10 GiB/month outbound transfer. When Spark quotas are exceeded, the relevant service is capped until the quota resets; usage does not automatically switch to paid billing. Do not attach a billing account or enable Cloud Storage.

## Development
```bash
npm install
npm run dev
```
