# कामधेनु

Installable, mobile-first Hindi milk and transaction ledger.

Live site: https://mymilk.onrender.com

## App features
- Install as a Progressive Web App (PWA) on supported browsers.
- Standalone app display, service-worker caching, and offline access after the first successful load.
- Exactly two modules: **दूध** and **लेन-देन**.
- Three date-based pages per month: days 1–10, 11–20, and 21–month-end. Each page covers about ten days, or roughly twenty morning/evening entries.
- Records are append-only in the app: individual entries cannot be edited or deleted.
- Milk entries include Milkman, date, morning/evening, quantity, rate, milk type, and comment.
- Transactions include received, remained, advance, and expenses.
- Expense categories: paddy stalk, cattle feed, khali, chokar, wheat straw, and others.
- Monthly milk total and net amount in the hero summary.
- JSON backup/restore and monthly milk CSV export.

## Accounting
Net amount = milk sales + received amounts − advances − expenses. Remained is shown separately as outstanding and is not added to cash received.

## Storage model
This edition is Supabase-free and stores records in the browser's Local Storage. Data belongs to the same browser profile on the same device; it is not synchronised between users or devices. Clearing site data or losing the device can erase records. Download a JSON backup regularly.

## Development
\`\`\`
npm install
npm run dev
\`\`\`
