# कामधेनु Point

A mobile-first milk-sales ledger for cow and buffalo milk transactions.

Live site: https://mymilk.onrender.com

## Storage model
This edition is Supabase-free and stores records in the browser's Local Storage. Data remains in the same browser profile on the same device. It is not shared with other users, browsers, or devices. Clearing browser/site data, uninstalling the browser, or losing the device can erase the ledger.

Use **Download backup** regularly to save a JSON backup outside the browser. Use **Restore backup** to replace the current browser ledger from a backup. Monthly CSV export is also available.

## Features
- Daily cow and buffalo milk sale entries.
- Buyer list and per-litre rates.
- Monthly ledger, totals, and CSV export.
- Edit and delete records.
- JSON backup and restore.

## Access and security
There is no account authentication or multi-user access in this local-only edition. Anyone with access to this browser profile can view or change the ledger. Do not use it for confidential multi-user records.

## Development
```bash
npm install
npm run dev
```
