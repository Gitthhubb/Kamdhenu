import test from 'node:test';
import assert from 'node:assert/strict';
import { getGuestSignInError, getGuestLinkError } from '../src/guest-auth-errors.js';

test('explains that Anonymous Authentication must be enabled when guest sign-in is disabled', () => {
  assert.match(
    getGuestSignInError({ code: 'auth/operation-not-allowed', message: 'Operation not allowed.' }),
    /Authentication.*Anonymous.*Enable/i,
  );
});

test('explains how to authorise the app domain for guest sign-in', () => {
  assert.match(
    getGuestSignInError({ code: 'auth/unauthorized-domain', message: 'Domain not authorised.' }),
    /mymilk\.onrender\.com/,
  );
});

test('warns that an existing Google account cannot be silently merged into a guest UID', () => {
  const message = getGuestLinkError({ code: 'auth/credential-already-in-use', message: 'Credential already in use.' });
  assert.match(message, /पहले से/);
  assert.match(message, /बैकअप/);
});

test('preserves useful details for unclassified guest authentication errors', () => {
  assert.match(
    getGuestSignInError({ code: 'auth/network-request-failed', message: 'Network request failed.' }),
    /Network request failed\./,
  );
});
