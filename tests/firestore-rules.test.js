import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('Firestore rules accept the descriptive fields emitted by current milk records', () => {
  assert.match(rules, /'shiftLabel'/);
  assert.match(rules, /'milkTypeLabel'/);
  assert.match(rules, /validOptionalLabel\(data, 'shiftLabel'\)/);
  assert.match(rules, /validOptionalLabel\(data, 'milkTypeLabel'\)/);
});

test('Firestore rules accept custom catalogue keys while validating their format', () => {
  assert.match(rules, /function validCatalogueKey\(value\)/);
  assert.match(rules, /validCatalogueKey\(data\.shift\)/);
  assert.match(rules, /validCatalogueKey\(data\.milkType\)/);
  assert.match(rules, /validCatalogueKey\(data\.kind\)/);
  assert.match(rules, /validCatalogueKey\(data\.category\)/);
  assert.doesNotMatch(rules, /data\.shift in \['morning', 'evening'\]/);
  assert.doesNotMatch(rules, /data\.milkType in \['cow', 'buffalo'\]/);
  assert.doesNotMatch(rules, /data\.kind in \['received', 'remained', 'advance', 'expense'\]/);
});

test('Firestore rules permit saved transaction labels and enumerated accounting effects', () => {
  assert.match(rules, /'kindLabel'/);
  assert.match(rules, /'kindEffect'/);
  assert.match(rules, /'categoryLabel'/);
  assert.match(rules, /data\.kindEffect in \['received', 'remained', 'advance', 'expense'\]/);
});

test('Firestore ledger writes remain account-owned and append-only', () => {
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /allow update: if false;/);
  assert.match(rules, /allow create: if signedIn\(\) && request\.auth\.uid == userId && validEntry/);
  assert.match(rules, /allow create: if signedIn\(\) && request\.auth\.uid == userId && validTransaction/);
});
