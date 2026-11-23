import { normalizeCatalogues } from '../src/catalogues.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/app-settings.js';

test('new accounts receive neutral, reusable defaults', () => {
  assert.deepEqual(normalizeSettings(), { ...DEFAULT_SETTINGS });
});

test('migrates the former personal-mode settings into a generic quick-entry profile', () => {
  assert.deepEqual(normalizeSettings({
    personalMode: true,
    milkman: 'राम डेयरी',
    buffaloRate: '72',
  }), {
    ...DEFAULT_SETTINGS,
    quickEntryEnabled: true,
    defaultMilkman: 'राम डेयरी',
    defaultMilkType: 'buffalo',
    defaultRate: '72',
    lockDefaultRate: true,
  });
});

test('normalises configurable profile identity, currency and editable rate preferences', () => {
  assert.deepEqual(normalizeSettings({
    ledgerName: 'शिव डेयरी',
    tagline: 'दैनिक दूध लेखा',
    footerNote: 'मुख्य शाखा',
    currency: 'USD',
    quickEntryEnabled: true,
    quickEntryLabel: 'सुबह की सप्लाई',
    defaultMilkman: 'मोहन',
    defaultMilkType: 'cow',
    defaultRate: 64.5,
    lockDefaultRate: false,
  }), {
    ledgerName: 'शिव डेयरी',
    tagline: 'दैनिक दूध लेखा',
    footerNote: 'मुख्य शाखा',
    currency: 'USD',
    quickEntryEnabled: true,
    quickEntryLabel: 'सुबह की सप्लाई',
    defaultMilkman: 'मोहन',
    defaultMilkType: 'cow',
    defaultRate: '64.5',
    lockDefaultRate: false,
    catalogues: normalizeCatalogues(),
  });
});

test('falls back safely for unsupported currency and invalid text values', () => {
  const result = normalizeSettings({ ledgerName: 42, currency: 'XYZ' });
  assert.equal(result.ledgerName, DEFAULT_SETTINGS.ledgerName);
  assert.equal(result.currency, 'INR');
});
