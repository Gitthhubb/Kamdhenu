import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CATALOGUES, normalizeCatalogues, mergeMilkSuppliers, ensureMilkSupplier, getMilkSupplierDefaultRate } from '../src/catalogues.js';

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

test('preserves configurable transaction-party names and their active state', () => {
  const result = normalizeCatalogues({
    transactionParties: [
      { value: 'feed_shop', label: 'चारा दुकान', active: true },
      { value: 'dairy_customer', label: 'दूध ग्राहक', active: false },
    ],
  });
  assert.deepEqual(result.transactionParties, [
    { value: 'feed_shop', label: 'चारा दुकान', active: true },
    { value: 'dairy_customer', label: 'दूध ग्राहक', active: false },
  ]);
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

test('normalises supplier-specific default rates and preserves inactive suppliers', () => {
  const result = normalizeCatalogues({
    milkSuppliers: [
      { value: 'supplier_ram', label: 'राम डेयरी', defaultRate: '72.50', active: true },
      { value: 'supplier_shyam', label: 'श्याम डेयरी', defaultRate: '', active: false },
    ],
  });
  assert.deepEqual(result.milkSuppliers, [
    { value: 'supplier_ram', label: 'राम डेयरी', defaultRate: '72.5', active: true },
    { value: 'supplier_shyam', label: 'श्याम डेयरी', defaultRate: '', active: false },
  ]);
});

test('migrates legacy milkman names into supplier options without inventing rates', () => {
  const settings = { catalogues: normalizeCatalogues() };
  const result = mergeMilkSuppliers(settings, [' राम डेयरी ', 'राम डेयरी', 'श्याम डेयरी']);
  assert.equal(result.catalogues.milkSuppliers.length, 2);
  assert.deepEqual(result.catalogues.milkSuppliers.map(item => item.label), ['राम डेयरी', 'श्याम डेयरी']);
  assert.deepEqual(result.catalogues.milkSuppliers.map(item => item.defaultRate), ['', '']);
});

test('assigns the first recorded rate to a new supplier and does not overwrite a configured rate', () => {
  const settings = { catalogues: normalizeCatalogues() };
  const first = ensureMilkSupplier(settings, 'राम डेयरी', 72.5);
  assert.equal(getMilkSupplierDefaultRate(first, 'राम डेयरी'), '72.5');
  const second = ensureMilkSupplier(first, 'राम डेयरी', 80);
  assert.equal(getMilkSupplierDefaultRate(second, 'राम डेयरी'), '72.5');
  const inactive = {
    ...second,
    catalogues: {
      ...second.catalogues,
      milkSuppliers: second.catalogues.milkSuppliers.map(item => ({ ...item, active: false })),
    },
  };
  assert.equal(getMilkSupplierDefaultRate(inactive, 'राम डेयरी'), '');
});
