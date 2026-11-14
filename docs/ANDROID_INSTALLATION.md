# Install Kamdhenu on Android

Kamdhenu is distributed as an installable Progressive Web App (PWA). It uses the same React application, Firebase sign-in and account-specific Firestore ledger as the website.

## Install with Chrome on Android

1. Open **https://mymilk.onrender.com/** in Google Chrome on Android.
2. Wait for the page to load. You can install before signing in.
3. Tap **Android पर इंस्टॉल करें** when the install action is offered. Alternatively, open Chrome's **⋮** menu and select **Install app** or **Add to Home screen**.
4. Confirm the installation.
5. Launch **कामधेनु** from the Android app drawer or home screen.

The installed app opens in a standalone window rather than a normal browser tab. Its launcher icon supports Android's adaptive masking. The launcher shortcuts provide direct entry points for the milk ledger and daily transactions.

## Data and connectivity

- Sign in with the same Google account to access the same account-specific ledger.
- Guest sessions remain tied to the local browser/app session. Link a guest session to Google before changing devices or clearing app data.
- The service worker caches the application shell for faster repeat launch. Firebase sign-in, Firestore reads/writes and Google Drive backup still require a working internet connection; this is not an offline-first local ledger.
- Installing the PWA does not copy or reset existing account data.

## Distribution distinction

This release is an Android-installable PWA, not a separately signed APK/AAB and not a Google Play Store listing. A Play Store/TWA release requires Android package signing, a verified Digital Asset Links file on the production domain and a separate Android release build.
