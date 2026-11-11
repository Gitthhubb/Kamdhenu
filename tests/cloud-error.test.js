import test from 'node:test';
import assert from 'node:assert/strict';
import { getCloudLoadingError } from '../src/cloud-error.js';

test('explains permission-denied as a Firestore rules issue', () => {
  assert.match(getCloudLoadingError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }), /सुरक्षा नियम प्रकाशित करें/);
});

test('explains not-found as a missing Firestore database', () => {
  assert.match(getCloudLoadingError({ code: 'not-found', message: 'Database not found.' }), /Firestore database बनाया नहीं गया है/);
});

test('preserves the underlying message for other Firebase errors', () => {
  assert.match(getCloudLoadingError({ code: 'unavailable', message: 'Network request failed.' }), /Network request failed\./);
});

test('does not fabricate an error when none exists', () => {
  assert.equal(getCloudLoadingError(''), '');
});
