import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMilkRecord,
  normalizeTransactionRecord,
  planRestoreMerge,
} from '../src/restore-merge.js';

const milk = (overrides = {}) => ({
  date: '2026-11-11',
  shift: 'morning',
  milkman: 'राम',
  milkType: 'buffalo',
  quantity: 2,
  rate: 70,
  amount: 140,
  remarks: '',
  ...overrides,
});

const transaction = (overrides = {}) => ({
  date: '2026-11-11',
  kind: 'expense',
  amount: 250,
  party: 'पशु आहार दुकान',
  category: 'cattle_feed',
  remarks: '',
  ...overrides,
});

test('skips existing source IDs and preserves IDs for missing milk entries', () => {
  const existing = [{ id: 'milk-old', ...milk() }];
  const incoming = [
    { id: 'milk-old', ...milk() },
    { id: 'milk-new', ...milk({ quantity: 3, amount: 210 }) },
  ];

  assert.deepEqual(
    planRestoreMerge(incoming, existing, normalizeMilkRecord),
    [{ id: 'milk-new', record: milk({ quantity: 3, amount: 210 }) }],
  );
});

test('does not add an ID-less legacy row that exactly matches an existing record', () => {
  const existing = [{ id: 'milk-existing', ...milk() }];
  const incoming = [milk(), milk()];

  assert.deepEqual(
    planRestoreMerge(incoming, existing, normalizeMilkRecord),
    [],
  );
});

test('retains identical visible entries when they have distinct source IDs', () => {
  const incoming = [
    { id: 'milk-first', ...milk() },
    { id: 'milk-second', ...milk() },
  ];

  assert.deepEqual(
    planRestoreMerge(incoming, [], normalizeMilkRecord),
    [
      { id: 'milk-first', record: milk() },
      { id: 'milk-second', record: milk() },
    ],
  );
});

test('skips a repeated source ID within one backup', () => {
  const incoming = [
    { id: 'tx-same', ...transaction() },
    { id: 'tx-same', ...transaction({ amount: 300 }) },
  ];

  assert.deepEqual(
    planRestoreMerge(incoming, [], normalizeTransactionRecord),
    [{ id: 'tx-same', record: transaction() }],
  );
});

test('uses exact-field matching when an incoming document ID is unsafe', () => {
  const existing = [{ id: 'tx-existing', ...transaction() }];
  const incoming = [
    { id: 'unsafe/id', ...transaction() },
    { id: 'unsafe/id-2', ...transaction({ amount: 325 }) },
  ];

  assert.deepEqual(
    planRestoreMerge(incoming, existing, normalizeTransactionRecord),
    [{ id: null, record: transaction({ amount: 325 }) }],
  );
});

test('normalizes older milk backup field names into Firestore fields', () => {
  assert.deepEqual(
    normalizeMilkRecord({
      sale_date: '2026-11-10',
      shift: 'evening',
      buyer: 'सीता',
      milk_type: 'cow',
      quantity: '1.5',
      rate: '60',
      amount: '90',
      remarks: null,
    }),
    {
      date: '2026-11-10',
      shift: 'evening',
      milkman: 'सीता',
      milkType: 'cow',
      quantity: 1.5,
      rate: 60,
      amount: 90,
      remarks: '',
    },
  );
});

test('normalizes transaction records while excluding backup-only fields', () => {
  assert.deepEqual(
    normalizeTransactionRecord({
      id: 'ignored-backup-id',
      date: '2026-11-10',
      kind: 'received',
      amount: '500',
      party: 'ग्राहक',
      category: '',
      remarks: 'नकद',
      created_at: '2026-11-10T10:00:00.000Z',
    }),
    {
      date: '2026-11-10',
      kind: 'received',
      amount: 500,
      party: 'ग्राहक',
      category: '',
      remarks: 'नकद',
    },
  );
});

test('deduplicates mixed ID-bearing and legacy copies regardless of backup order', () => {
  const idless = milk();
  const identified = { id: 'milk-stable-id', ...milk() };
  const expected = [{ id: 'milk-stable-id', record: milk() }];

  assert.deepEqual(
    planRestoreMerge([idless, identified], [], normalizeMilkRecord),
    expected,
  );
  assert.deepEqual(
    planRestoreMerge([identified, idless], [], normalizeMilkRecord),
    expected,
  );
});

test('does not reuse Firestore-reserved document IDs', () => {
  const existing = [{ id: 'tx-existing', ...transaction() }];
  const incoming = [
    { id: '__system__', ...transaction() },
    { id: '__legacy__', ...transaction({ amount: 325 }) },
  ];

  assert.deepEqual(
    planRestoreMerge(incoming, existing, normalizeTransactionRecord),
    [{ id: null, record: transaction({ amount: 325 }) }],
  );
});
