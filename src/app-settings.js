export const SUPPORTED_CURRENCIES = Object.freeze(['INR', 'USD', 'GBP', 'EUR']);

export const DEFAULT_SETTINGS = Object.freeze({
  ledgerName: 'कामधेनु',
  tagline: 'दूध एवं दैनिक हिसाब',
  footerNote: '',
  currency: 'INR',
  quickEntryEnabled: false,
  quickEntryLabel: 'त्वरित प्रविष्टि',
  defaultMilkman: '',
  defaultMilkType: 'buffalo',
  defaultRate: '',
  lockDefaultRate: true,
});

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function textValue(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

/**
 * Normalise current and legacy account settings.
 *
 * Older releases stored a one-person workflow as:
 * { personalMode, milkman, buffaloRate }. It is migrated in memory to the
 * generic quick-entry profile without changing historical ledger records.
 */
export function normalizeSettings(value, rates = {}) {
  const source = isObject(value) ? value : {};
  const legacyPersonalMode = source.personalMode === true;
  const defaultMilkType = source.defaultMilkType === 'cow' || source.defaultMilkType === 'buffalo'
    ? source.defaultMilkType
    : 'buffalo';
  const hasRate = Object.prototype.hasOwnProperty.call(source, 'defaultRate');
  const legacyRate = Object.prototype.hasOwnProperty.call(source, 'buffaloRate')
    ? source.buffaloRate
    : '';
  const currentRate = hasRate
    ? source.defaultRate
    : legacyPersonalMode
      ? legacyRate
      : (rates?.[defaultMilkType + '_rate'] ?? '');

  return {
    ledgerName: textValue(source.ledgerName, DEFAULT_SETTINGS.ledgerName, 60) || DEFAULT_SETTINGS.ledgerName,
    tagline: textValue(source.tagline, DEFAULT_SETTINGS.tagline, 100),
    footerNote: textValue(source.footerNote, DEFAULT_SETTINGS.footerNote, 120),
    currency: SUPPORTED_CURRENCIES.includes(source.currency) ? source.currency : DEFAULT_SETTINGS.currency,
    quickEntryEnabled: typeof source.quickEntryEnabled === 'boolean'
      ? source.quickEntryEnabled
      : legacyPersonalMode,
    quickEntryLabel: textValue(source.quickEntryLabel, DEFAULT_SETTINGS.quickEntryLabel, 50)
      || DEFAULT_SETTINGS.quickEntryLabel,
    defaultMilkman: textValue(source.defaultMilkman ?? source.milkman, '', 80),
    defaultMilkType,
    defaultRate: currentRate === null || currentRate === undefined ? '' : String(currentRate),
    lockDefaultRate: typeof source.lockDefaultRate === 'boolean'
      ? source.lockDefaultRate
      : legacyPersonalMode,
  };
}
