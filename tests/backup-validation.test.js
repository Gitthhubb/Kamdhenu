import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBackupPayload } from '../src/backup-validation.js';

const validBackup = (overrides = {}) => ({
  schema: 4,
  rows: [{
    id: 'milk-1',
    sale_date: '2026-11-11',
    shift: 'morning',
    buyer: 'राम',
    milk_type: 'buffalo',
    quantity: '2',
    rate: '70',
    amount: '140',
    remarks: '',
  }],
  transactions: [{
    id: 'tx-1',
    date: '2026-11-11',
    kind: 'expense',
    amount: '250',
    party: 'पशु आहार दुकान',
    category: 'cattle_feed',
    remarks: '',
  }],
  rates: { cow_rate: 60, buffalo_rate: 70 },
  buyers: ['राम'],
  settings: { personalMode: false, milkman: '', buffaloRate: '' },
  ...overrides,
});

test('normalises a valid backup while preserving source document IDs', () => {
  assert.deepEqual(validateBackupPayload(validBackup()), {
    rows: [{
      id: 'milk-1',
      date: '2026-11-11',
      shift: 'morning',
      milkman: 'राम',
      milkType: 'buffalo',
      quantity: 2,
      rate: 70,
      amount: 140,
      remarks: '',
    }],
    transactions: [{
      id: 'tx-1',
      date: '2026-11-11',
      kind: 'expense',
      amount: 250,
      party: 'पशु आहार दुकान',
      category: 'cattle_feed',
      remarks: '',
    }],
    rates: { cow_rate: 60, buffalo_rate: 70 },
    buyers: ['राम'],
    settings: { personalMode: false, milkman: '', buffaloRate: '' },
  });
});

test('rejects the entire backup when a milk date is impossible', () => {
  const backup = validBackup();
  backup.rows[0].sale_date = '2026-02-30';
  assert.throws(() => validateBackupPayload(backup), /दूध प्रविष्टि 1.*दिनांक/);
});

test('rejects non-finite or non-positive milk quantities before restoring', () => {
  const backup = validBackup();
  backup.rows[0].quantity = 'NaN';
  assert.throws(() => validateBackupPayload(backup), /दूध प्रविष्टि 1.*मात्रा/);
});

test('rejects invalid transaction kinds and amounts before restoring', () => {
  const badKind = validBackup();
  badKind.transactions[0].kind = 'transfer';
  assert.throws(() => validateBackupPayload(badKind), /लेन-देन 1.*प्रकार/);

  const badAmount = validBackup();
  badAmount.transactions[0].amount = '-20';
  assert.throws(() => validateBackupPayload(badAmount), /लेन-देन 1.*राशि/);
});

test('rejects malformed top-level backup fields instead of spreading arbitrary values', () => {
  assert.throws(() => validateBackupPayload(null), /वैध कामधेनु JSON बैकअप/);
  assert.throws(() => validateBackupPayload(validBackup({ rates: [] })), /दरें/);
  assert.throws(() => validateBackupPayload(validBackup({ buyers: 'राम' })), /दूधवालों की सूची/);
  assert.throws(() => validateBackupPayload(validBackup({ settings: 'personal' })), /सेटिंग्स/);
});

test('supports legacy backups with omitted optional profile collections and settings', () => {
  const backup = validBackup();
  delete backup.buyers;
  delete backup.settings;
  const result = validateBackupPayload(backup);
  assert.deepEqual(result.buyers, []);
  assert.deepEqual(result.settings, { personalMode: false, milkman: '', buffaloRate: '' });
});
