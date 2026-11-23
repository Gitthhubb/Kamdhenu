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
  assert.match(source, /getDocFromCache/);
  assert.match(source, /sync-status/);
});

test('routine startup and month changes use cache-only reads, not live server listeners', async () => {
  const source = await read('../src/main.jsx');
  assert.match(source, /getMonthDateRange\(month\)/);
  assert.match(source, /getDocFromCache\(/);
  assert.match(source, /getDocsFromCache\(/);
  assert.doesNotMatch(source, /onSnapshot\(/);
  const startup = source.slice(source.indexOf('useEffect(()=>{\n  if(!user?.uid)return;'), source.indexOf('async function syncNow'));
  assert.doesNotMatch(startup, /getDocFromServer|getDocsFromServer|waitForPendingWrites/);
});

test('explicit Sync Now refreshes the profile and selected-month records from server', async () => {
  const source = await read('../src/main.jsx');
  const sync = source.slice(source.indexOf('async function syncNow'), source.indexOf('async function saveAccountSettings'));
  assert.match(source, /अभी सिंक करें/);
  assert.match(sync, /getDocFromServer\(/);
  assert.equal((sync.match(/getDocsFromServer\(/g) || []).length, 2);
  assert.match(sync, /hasPendingWrites/);
  assert.match(sync, /waitForPendingWrites/);
  assert.match(sync, /monthRef\.current!==syncMonth/);
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

test('cache miss does not gate account UI indefinitely', async () => {
  const source = await read('../src/main.jsx');
  assert.match(source, /setProfileReady\(true\)/);
  assert.match(source, /setSettingsReady\(Boolean\(profileSnap\)\)/);
  assert.match(source, /if\(includeSettings\)profilePatch\.settings=next\.settings/);
  assert.ok((source.match(/disabled=\{!profileReady\}/g) || []).length >= 2);
  assert.match(source, /disabled=\{!settingsReady\}/);
});

test('entry writes and deletions update local UI without awaiting server acknowledgement', async () => {
  const source = await read('../src/main.jsx');
  const milkSave = source.slice(source.indexOf('async function saveMilk'), source.indexOf('async function saveTransaction'));
  const txSave = source.slice(source.indexOf('async function saveTransaction'), source.indexOf('function exportCsv'));
  const deleteMilk = source.slice(source.indexOf('async function deleteMilk'), source.indexOf('async function deleteTransaction'));
  const deleteTx = source.slice(source.indexOf('async function deleteTransaction'), source.indexOf('function selectPeriodPage'));
  assert.match(milkSave, /const ref=doc\(collection/);
  assert.match(milkSave, /persist\(next\)/);
  assert.doesNotMatch(milkSave, /await addDoc|await setDoc/);
  assert.match(txSave, /const ref=doc\(collection/);
  assert.match(txSave, /setStore\(current=>/);
  assert.doesNotMatch(txSave, /await addDoc|await setDoc/);
  assert.doesNotMatch(deleteMilk+deleteTx, /await deleteDoc/);
});
