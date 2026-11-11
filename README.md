# कामधेनु

A mobile-first Hindi milk and transaction ledger.

Live site: https://mymilk.onrender.com

## Modules
- **दूध:** Milkman, date, morning/evening, quantity, rate, cow/buffalo type, comments, edit/delete, and monthly CSV export.
- **लेन-देन:** Received, remained (outstanding), advance, and expenses. Expense categories: paddy stalk, cattle feed, khali, chokar, wheat straw, and others.
- Hero summary displays month-to-date milk quantity and net cash.

Net amount preserves the existing calculation: milk sales + received amounts − advances − expenses. Remained is tracked separately as an outstanding amount and is not added again to cash received.

## Storage model
The app is Supabase-free and stores records in this browser's Local Storage. Records stay in the same browser profile on the same device. They are not shared with other users, browsers, or devices. Clearing site data or losing the device can erase the ledger.

Use **बैकअप लें** regularly to save a JSON backup. Use **बैकअप पुनर्स्थापित करें** to replace the current browser ledger from a backup.

## Development
\`\`\`bash
npm install
npm run dev
\`\`\`
