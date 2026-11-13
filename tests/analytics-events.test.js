import test from 'node:test';
import assert from 'node:assert/strict';
import { trackLedgerTabView } from '../src/analytics-events.js';

test('records only the selected ledger tab as an analytics event', () => {
  const analytics = { instance: 'analytics' };
  const calls = [];

  const tracked = trackLedgerTabView(analytics, 'Transactions', (...args) => calls.push(args));

  assert.equal(tracked, true);
  assert.deepEqual(calls, [[analytics, 'ledger_tab_view', { tab_name: 'transactions' }]]);
});

test('does not send analytics events when analytics is unavailable', () => {
  let called = false;

  const tracked = trackLedgerTabView(null, 'Milk', () => { called = true; });

  assert.equal(tracked, false);
  assert.equal(called, false);
});

test('does not emit analytics events for unknown tab names', () => {
  const calls = [];
  const tracked = trackLedgerTabView({ instance: 'analytics' }, 'Account Details', (...args) => calls.push(args));

  assert.equal(tracked, false);
  assert.deepEqual(calls, []);
});
