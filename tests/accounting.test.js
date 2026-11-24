import test from 'node:test';
import assert from 'node:assert/strict';
import { getTransactionEffect, summarizeTransactions } from '../src/accounting.js';

const kinds = [
  { value: 'received', effect: 'received' },
  { value: 'remained', effect: 'remained' },
  { value: 'advance', effect: 'advance' },
  { value: 'expense', effect: 'expense' },
  { value: 'feed_credit', effect: 'expense' },
  { value: 'milk_credit', effect: 'received' },
];

test('uses configured accounting effects for custom transaction kinds', () => {
  assert.equal(getTransactionEffect({ kind: 'feed_credit' }, kinds), 'expense');
  assert.equal(getTransactionEffect({ kind: 'milk_credit' }, kinds), 'received');
});

test('prefers the stored accounting effect for historical custom transactions', () => {
  assert.equal(getTransactionEffect({ kind: 'old_kind', kindEffect: 'advance' }, kinds), 'advance');
});

test('summarizes built-in and custom transaction types by accounting effect', () => {
  const totals = summarizeTransactions([
    { kind: 'received', amount: 100 },
    { kind: 'milk_credit', amount: 25 },
    { kind: 'remained', amount: 40 },
    { kind: 'advance', amount: 10 },
    { kind: 'expense', amount: 15 },
    { kind: 'feed_credit', amount: 5 },
    { kind: 'unknown', amount: 900 },
  ], kinds);
  assert.deepEqual(totals, { received: 125, remained: 40, advance: 10, expense: 20 });
});

test('ignores malformed transaction amounts and unsupported effects', () => {
  const totals = summarizeTransactions([
    { kind: 'received', amount: 'not-a-number' },
    { kind: 'bad', kindEffect: 'refund', amount: 500 },
  ], kinds);
  assert.deepEqual(totals, { received: 0, remained: 0, advance: 0, expense: 0 });
});

test('falls back to the configured effect when a historical effect is invalid', () => {
  assert.equal(getTransactionEffect({ kind: 'feed_credit', kindEffect: 'unknown' }, kinds), 'expense');
});
