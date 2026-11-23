import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CATALOGUES, normalizeCatalogues } from '../src/catalogues.js';

test('provides reusable defaults for every fixed-entry catalogue', () => {
  const result = normalizeCatalogues();
  assert.deepEqual(Object.keys(result), Object.keys(DEFAULT_CATALOGUES));
  assert.deepEqual(result, Object.fromEntries(Object.entries(DEFAULT_CATALOGUES).map(([key, items]) => [key, items.map(item => ({ ...item }))])));
});

test('preserves stable keys when labels are renamed and options are deactivated', () => {
  const result = normalizeCatalogues({
    milkTypes: [
      { value: 'cow', label: 'गौ-दुग्ध', historicalLabel: 'गाय', active: false },
      { value: 'buffalo', label: 'भैंस', active: true },
    ],
  });
  assert.deepEqual(result.milkTypes, [
    { value: 'cow', label: 'गौ-दुग्ध', historicalLabel: 'गाय', active: false },
    { value: 'buffalo', label: 'भैंस', active: true },
  ]);
});

test('rejects duplicate or malformed keys and falls back when no active option remains', () => {
  const result = normalizeCatalogues({
    shifts: [
      { value: 'night shift', label: 'रात' },
      { value: 'morning', label: 'प्रातः', active: false },
      { value: 'morning', label: 'दूसरा नाम' },
    ],
  });
  assert.deepEqual(result.shifts, [{ value: 'morning', label: 'सुबह', active: true }, { value: 'evening', label: 'शाम', active: true }]);
});

test('limits catalogue size and sanitises labels', () => {
  const items = Array.from({ length: 50 }, (_, index) => ({ value: 'custom_' + index, label: '  विकल्प ' + index + '  ' }));
  const result = normalizeCatalogues({ expenseCategories: items });
  assert.equal(result.expenseCategories.length, 40);
  assert.equal(result.expenseCategories[0].label, 'विकल्प 0');
});

test('assigns accounting effects to transaction kinds and preserves custom effects', () => {
  const result = normalizeCatalogues({
    transactionKinds: [
      { value: 'received', label: 'जमा', effect: 'received' },
      { value: 'rent', label: 'किराया', effect: 'expense' },
      { value: 'bad_effect', label: 'अमान्य प्रभाव', effect: 'unknown' },
    ],
  });
  assert.equal(result.transactionKinds.find(item => item.value === 'rent').effect, 'expense');
  assert.equal(result.transactionKinds.find(item => item.value === 'bad_effect').effect, 'received');
});
