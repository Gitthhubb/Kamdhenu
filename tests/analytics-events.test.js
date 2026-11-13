import test from 'node:test';
import assert from 'node:assert/strict';
import { trackLedgerTabView } from '../src/analytics-events.js';

test('pushes a privacy-minimal ledger tab event into the GTM data layer', () => {
  const dataLayer = [];

  const tracked = trackLedgerTabView(dataLayer, 'Transactions');

  assert.equal(tracked, true);
  assert.deepEqual(dataLayer, [
    { event: 'ledger_tab_view', tab_name: 'transactions' },
  ]);
});

test('does not push an event when the data layer is unavailable', () => {
  assert.equal(trackLedgerTabView(null, 'Milk'), false);
  assert.equal(trackLedgerTabView(undefined, 'Milk'), false);
});

test('does not emit an event for unknown tab names', () => {
  const dataLayer = [];

  const tracked = trackLedgerTabView(dataLayer, 'Account Details');

  assert.equal(tracked, false);
  assert.deepEqual(dataLayer, []);
});
