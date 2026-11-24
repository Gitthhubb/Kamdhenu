import test from 'node:test';
import assert from 'node:assert/strict';
import { createCsv, escapeCsvCell } from '../src/csv-export.js';

test('quotes CSV cells and escapes embedded quote characters', () => {
  assert.equal(escapeCsvCell('राम "डेयरी"'), '"राम ""डेयरी"""');
});

test('prefixes formula-leading text, including whitespace and control characters', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-cmd', '@SUM(A1)', '\t=1+1', '\r@SUM(A1)']) {
    assert.equal(escapeCsvCell(value).startsWith('"\''), true, value);
  }
});

test('keeps ordinary numbers, names and Hindi text unchanged', () => {
  assert.equal(escapeCsvCell(72.5), '"72.5"');
  assert.equal(escapeCsvCell('राम डेयरी'), '"राम डेयरी"');
  assert.equal(escapeCsvCell(null), '""');
});

test('exports UTF-8 BOM and CRLF-delimited CSV rows', () => {
  const csv = createCsv([['दिनांक', 'नाम'], ['2026-11-24', '=1+1']]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csv, '\ufeff"दिनांक","नाम"\r\n"2026-11-24","\'=1+1"');
});
