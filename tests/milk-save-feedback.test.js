import test from 'node:test';
import assert from 'node:assert/strict';
import { getMilkSaveFeedback } from '../src/milk-save-feedback.js';

test('reports normal success only when the record and profile metadata are saved', () => {
  assert.deepEqual(getMilkSaveFeedback(true), {
    kind: 'success',
    message: 'नई दूध प्रविष्टि सुरक्षित हो गई।',
  });
});

test('does not claim complete success when buyer or rate metadata failed to persist', () => {
  const feedback = getMilkSaveFeedback(false);
  assert.equal(feedback.kind, 'warning');
  assert.match(feedback.message, /दूध प्रविष्टि सुरक्षित हो गई/);
  assert.match(feedback.message, /दर.*जाँचें/);
});
