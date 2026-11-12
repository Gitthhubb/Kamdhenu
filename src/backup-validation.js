import {
  normalizeMilkRecord,
  normalizeTransactionRecord,
} from './restore-merge.js';

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

function validateMilkRows(rows) {
  return rows.map((row, index) => {
    const label = `दूध प्रविष्टि ${index + 1}`;
    if (!isObject(row)) fail(`${label}: रिकॉर्ड का प्रारूप गलत है।`);

    const record = normalizeMilkRecord(row);
    if (!validDate(record.date)) fail(`${label}: वैध YYYY-MM-DD दिनांक दर्ज नहीं है।`);
    if (!VALID_SHIFTS.has(record.shift)) fail(`${label}: समय सुबह या शाम होना चाहिए।`);
    if (!record.milkman.trim()) fail(`${label}: दूधवाले का नाम रिक्त है।`);
    if (!VALID_MILK_TYPES.has(record.milkType)) fail(`${label}: दूध का प्रकार गाय या भैंस होना चाहिए।`);

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

function validateTransactions(rows) {
  return rows.map((row, index) => {
    const label = `लेन-देन ${index + 1}`;
    if (!isObject(row)) fail(`${label}: रिकॉर्ड का प्रारूप गलत है।`);

    const record = normalizeTransactionRecord(row);
    if (!validDate(record.date)) fail(`${label}: वैध YYYY-MM-DD दिनांक दर्ज नहीं है।`);
    if (!VALID_TRANSACTION_KINDS.has(record.kind)) fail(`${label}: प्रकार मान्य नहीं है।`);

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
  if (value === undefined) return { personalMode: false, milkman: '', buffaloRate: '' };
  if (!isObject(value)) fail('बैकअप की सेटिंग्स सही प्रारूप में नहीं हैं।');

  const personalMode = value.personalMode ?? false;
  const milkman = value.milkman ?? '';
  const rawRate = value.buffaloRate ?? '';

  if (typeof personalMode !== 'boolean') fail('बैकअप की सेटिंग्स: व्यक्तिगत मोड का मान सही नहीं है।');
  if (typeof milkman !== 'string') fail('बैकअप की सेटिंग्स: दूधवाले का नाम सही नहीं है।');
  if (typeof rawRate !== 'string' && typeof rawRate !== 'number') {
    fail('बैकअप की सेटिंग्स: भैंस की दर सही नहीं है।');
  }

  const buffaloRate = rawRate === '' ? '' : String(rawRate);
  if (buffaloRate !== '') {
    const parsedRate = finiteNumber(buffaloRate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      fail('बैकअप की सेटिंग्स: भैंस की दर वैध संख्या होनी चाहिए।');
    }
  }
  if (personalMode && (!milkman.trim() || !buffaloRate || finiteNumber(buffaloRate) <= 0)) {
    fail('बैकअप की सेटिंग्स: चालू व्यक्तिगत मोड के लिए दूधवाले का नाम और शून्य से अधिक भैंस-दर आवश्यक है।');
  }

  return { personalMode, milkman: milkman.trim(), buffaloRate };
}

/**
 * Validate and normalise the complete backup before the caller performs any
 * Firestore reads or writes. This makes malformed imports fail atomically
 * from the application's point of view.
 */
export function validateBackupPayload(payload) {
  if (!isObject(payload)
    || !Array.isArray(payload.rows)
    || !Array.isArray(payload.transactions)
    || !isObject(payload.rates)) {
    fail('यह वैध कामधेनु JSON बैकअप नहीं है।');
  }

  return {
    rows: validateMilkRows(payload.rows),
    transactions: validateTransactions(payload.transactions),
    rates: validateRates(payload.rates),
    buyers: validateBuyers(payload.buyers),
    settings: validateSettings(payload.settings),
  };
}
