import {
  normalizeMilkRecord,
  normalizeTransactionRecord,
} from './restore-merge.js';
import { normalizeSettings, SUPPORTED_CURRENCIES } from './app-settings.js';

const VALID_SHIFTS = new Set(['morning', 'evening']);
const VALID_MILK_TYPES = new Set(['cow', 'buffalo']);
const VALID_TRANSACTION_KINDS = new Set(['received', 'remained', 'advance', 'expense']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function optionalRecordId(row) {
  return typeof row.id === 'string' ? row.id : undefined;
}

function fail(message) {
  throw new Error(message);
}

function validateMilkRows(rows, catalogues) {
  return rows.map((row, index) => {
    const label = `दूध प्रविष्टि ${index + 1}`;
    if (!isObject(row)) fail(`${label}: रिकॉर्ड का प्रारूप गलत है।`);

    const record = normalizeMilkRecord(row);
    if (!validDate(record.date)) fail(`${label}: वैध YYYY-MM-DD दिनांक दर्ज नहीं है।`);
    if (!catalogues.shifts.some(item => item.value === record.shift)) fail(`${label}: समय की प्रविष्टि खाता कॉन्फ़िगरेशन में मान्य नहीं है।`);
    if (!record.milkman.trim()) fail(`${label}: दूधवाले का नाम रिक्त है।`);
    if (!catalogues.milkTypes.some(item => item.value === record.milkType)) fail(`${label}: दूध का प्रकार खाता कॉन्फ़िगरेशन में मान्य नहीं है।`);

    const quantity = finiteNumber(row.quantity);
    const rate = finiteNumber(row.rate);
    const amount = finiteNumber(row.amount);
    if (!Number.isFinite(quantity) || quantity <= 0) fail(`${label}: मात्रा शून्य से अधिक और वैध संख्या होनी चाहिए।`);
    if (!Number.isFinite(rate) || rate < 0) fail(`${label}: दर शून्य या उससे अधिक वैध संख्या होनी चाहिए।`);
    if (!Number.isFinite(amount) || amount < 0) fail(`${label}: राशि शून्य या उससे अधिक वैध संख्या होनी चाहिए।`);

    return {
      ...(optionalRecordId(row) ? { id: optionalRecordId(row) } : {}),
      ...record,
      quantity,
      rate,
      amount,
    };
  });
}

function validateTransactions(rows, catalogues) {
  return rows.map((row, index) => {
    const label = `लेन-देन ${index + 1}`;
    if (!isObject(row)) fail(`${label}: रिकॉर्ड का प्रारूप गलत है।`);

    const record = normalizeTransactionRecord(row);
    if (!validDate(record.date)) fail(`${label}: वैध YYYY-MM-DD दिनांक दर्ज नहीं है।`);
    if (!catalogues.transactionKinds.some(item => item.value === record.kind)) fail(`${label}: प्रकार खाता कॉन्फ़िगरेशन में मान्य नहीं है।`);

    const amount = finiteNumber(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) fail(`${label}: राशि शून्य से अधिक वैध संख्या होनी चाहिए।`);

    return {
      ...(optionalRecordId(row) ? { id: optionalRecordId(row) } : {}),
      ...record,
      amount,
    };
  });
}

function validateRates(value) {
  if (!isObject(value)) fail('बैकअप की दरें सही प्रारूप में नहीं हैं।');
  const rates = {};
  for (const key of ['cow_rate', 'buffalo_rate']) {
    const rate = finiteNumber(value[key] ?? 0);
    if (!Number.isFinite(rate) || rate < 0) {
      fail(`बैकअप की दरें: ${key} शून्य या उससे अधिक वैध संख्या होनी चाहिए।`);
    }
    rates[key] = rate;
  }
  return rates;
}

function validateBuyers(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    fail('बैकअप की दूधवालों की सूची सही प्रारूप में नहीं है।');
  }
  return [...new Set(value.map(item => item.trim()).filter(Boolean))];
}

function validateSettings(value) {
  if (value === undefined) return normalizeSettings();
  if (!isObject(value)) fail('बैकअप की सेटिंग्स सही प्रारूप में नहीं हैं।');

  for (const field of ['quickEntryEnabled', 'lockDefaultRate', 'personalMode']) {
    if (value[field] !== undefined && typeof value[field] !== 'boolean') {
      fail(`बैकअप की सेटिंग्स: ${field} का मान सही नहीं है।`);
    }
  }

  const textFields = [
    ['ledgerName', 60], ['tagline', 100], ['footerNote', 120],
    ['quickEntryLabel', 50], ['defaultMilkman', 80], ['milkman', 80],
  ];
  for (const [field, maxLength] of textFields) {
    if (value[field] !== undefined
      && (typeof value[field] !== 'string' || value[field].trim().length > maxLength)) {
      fail(`बैकअप की सेटिंग्स: ${field} सही प्रारूप में नहीं है।`);
    }
  }

  if (value.currency !== undefined && !SUPPORTED_CURRENCIES.includes(value.currency)) {
    fail('बैकअप की सेटिंग्स: मुद्रा समर्थित नहीं है।');
  }
  if (value.defaultMilkType !== undefined && typeof value.defaultMilkType !== 'string') {
    fail('बैकअप की सेटिंग्स: डिफ़ॉल्ट दूध का प्रकार मान्य नहीं है।');
  }

  const rawRate = value.defaultRate ?? value.buffaloRate ?? '';
  if (typeof rawRate !== 'string' && typeof rawRate !== 'number') {
    fail('बैकअप की सेटिंग्स: डिफ़ॉल्ट दर सही नहीं है।');
  }
  const defaultRate = rawRate === '' ? '' : String(rawRate);
  if (defaultRate !== '') {
    const parsedRate = finiteNumber(defaultRate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      fail('बैकअप की सेटिंग्स: डिफ़ॉल्ट दर वैध संख्या होनी चाहिए।');
    }
  }

  const settings = normalizeSettings(value);
  if (settings.quickEntryEnabled
    && (!settings.defaultMilkman.trim() || !defaultRate || finiteNumber(defaultRate) <= 0)) {
    fail('बैकअप की सेटिंग्स: त्वरित प्रविष्टि प्रोफ़ाइल चालू करने के लिए दूधवाले का नाम और शून्य से अधिक डिफ़ॉल्ट दर आवश्यक है।');
  }
  if (!settings.catalogues.milkTypes.some(item => item.value === settings.defaultMilkType)) {
    fail('बैकअप की सेटिंग्स: डिफ़ॉल्ट दूध का प्रकार कैटलॉग में उपलब्ध नहीं है।');
  }

  return { ...settings, defaultRate };
}

/**
 * Validate and normalise the complete backup before the caller performs any
 * Firestore reads or writes. This makes malformed imports fail atomically
 * from the application's point of view.
 */
export function validateBackupPayload(payload) {
  if (!isObject(payload)
    || !Array.isArray(payload.rows)
    || !Array.isArray(payload.transactions)) {
    fail('यह वैध कामधेनु JSON बैकअप नहीं है।');
  }
  if (!isObject(payload.rates)) {
    fail('बैकअप की दरें सही प्रारूप में नहीं हैं।');
  }

  const settings = validateSettings(payload.settings);
  return {
    rows: validateMilkRows(payload.rows, settings.catalogues),
    transactions: validateTransactions(payload.transactions, settings.catalogues),
    rates: validateRates(payload.rates),
    buyers: validateBuyers(payload.buyers),
    settings,
  };
}
