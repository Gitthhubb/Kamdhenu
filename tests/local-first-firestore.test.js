import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getMonthDateRange } from '../src/ledger-query.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('returns the first day and exclusive next-month boundary for a regular month', () => {
  assert.deepEqual(getMonthDateRange('2026-04'), {
    startDate: '2026-04-01',
    endDateExclusive: '2026-05-01',
  });
});

test('rolls December into January of the following year', () => {
  assert.deepEqual(getMonthDateRange('2026-12'), {
    startDate: '2026-12-01',
    endDateExclusive: '2027-01-01',
  });
});

test('uses the correct exclusive boundary for leap-year February', () => {
  assert.deepEqual(getMonthDateRange('2028-02'), {
    startDate: '2028-02-01',
    endDateExclusive: '2028-03-01',
  });
});

test('rejects malformed and impossible month keys', () => {
  assert.throws(() => getMonthDateRange('2026-13'), /YYYY-MM/);
  assert.throws(() => getMonthDateRange('2026-2'), /YYYY-MM/);
  assert.throws(() => getMonthDateRange('not-a-month'), /YYYY-MM/);
});

test('configures Firestore with persistent multi-tab IndexedDB cache', async () => {
  const source = await read('../src/firebase.js');
  assert.match(source, /initializeFirestore/);
  assert.match(source, /persistentLocalCache/);
  assert.match(source, /persistentMultipleTabManager/);
});

test('renders the application shell without waiting for Firestore readiness', async () => {
  const source = await read('../src/main.jsx');
  assert.doesNotMatch(source, /if\s*\(!cloudReady\)\s*return/);
  assert.match(source, /fromCache/);
  assert.match(source, /sync-status/);
});

test('bounds live milk and transaction listeners to the selected month', async () => {
  const source = await read('../src/main.jsx');
  assert.match(source, /getMonthDateRange\(month\)/);
  assert.match(source, /where\('date','>=',startDate\)/);
  assert.match(source, /where\('date','<',endDateExclusive\)/);
  assert.match(source, /includeMetadataChanges:\s*true/);
});

test('JSON and Drive backups fetch complete history rather than the selected month', async () => {
  const source = await read('../src/main.jsx');
  assert.match(source, /async function loadCompleteLedgerData\(/);
  assert.match(source, /getDocsFromServer\(/);
  assert.match(source, /async function exportBackup\(/);
  assert.match(source, /const fullLedger = await loadCompleteLedgerData\(\)/);
  assert.match(source, /const payload=\{schema:5,exportedAt:new Date\(\)\.toISOString\(\),\.\.\.fullLedger\}/);
});

test('restore deduplication checks complete server-side collections', async () => {
  const source = await read('../src/main.jsx');
  const restore = source.slice(source.indexOf('async function restoreBackupData'), source.indexOf('function importBackup'));
  assert.match(restore, /getDocsFromServer\(/);
  assert.doesNotMatch(restore, /getDocs\(/);
});

test('does not allow profile-backed writes until cached or server-confirmed account settings are available', async () => {
  const source = await read('../src/main.jsx');
  assert.match(source, /setProfileReady\(!snap\.metadata\.fromCache\s*\|\|\s*snap\.exists\(\)\)/);
  assert.ok((source.match(/disabled=\{!profileReady\}/g) || []).length >= 3);
});
