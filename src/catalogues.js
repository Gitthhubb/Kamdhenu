export const DEFAULT_CATALOGUES = Object.freeze({
  milkTypes: Object.freeze([
    Object.freeze({ value: 'cow', label: 'गाय', active: true }),
    Object.freeze({ value: 'buffalo', label: 'भैंस', active: true }),
  ]),
  shifts: Object.freeze([
    Object.freeze({ value: 'morning', label: 'सुबह', active: true }),
    Object.freeze({ value: 'evening', label: 'शाम', active: true }),
  ]),
  transactionKinds: Object.freeze([
    Object.freeze({ value: 'received', label: 'प्राप्त', active: true, effect: 'received' }),
    Object.freeze({ value: 'remained', label: 'बाकी', active: true, effect: 'remained' }),
    Object.freeze({ value: 'advance', label: 'अग्रिम', active: true, effect: 'advance' }),
    Object.freeze({ value: 'expense', label: 'खर्च', active: true, effect: 'expense' }),
  ]),
  expenseCategories: Object.freeze([
    Object.freeze({ value: 'paddy_stalk', label: 'धान का पुआल', active: true }),
    Object.freeze({ value: 'cattle_feed', label: 'पशु आहार', active: true }),
    Object.freeze({ value: 'khali', label: 'खली', active: true }),
    Object.freeze({ value: 'chokar', label: 'चोकर', active: true }),
    Object.freeze({ value: 'wheat_straw', label: 'गेहूँ का भूसा', active: true }),
    Object.freeze({ value: 'others', label: 'अन्य', active: true }),
  ]),
});

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function normalizeList(input, fallback) {
  if (!Array.isArray(input)) return fallback.map(item => ({ ...item }));
  const seen = new Set();
  const result = [];
  for (const item of input.slice(0, 40)) {
    if (!isObject(item)
      || typeof item.value !== 'string'
      || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(item.value)
      || typeof item.label !== 'string') continue;
    const value = item.value;
    const label = item.label.trim().slice(0, 60);
    if (!label || seen.has(value)) continue;
    seen.add(value);
    const entry = { value, label, active: item.active !== false };
    if (typeof item.historicalLabel === 'string' && item.historicalLabel.trim()) entry.historicalLabel = item.historicalLabel.trim().slice(0, 60);
    if (fallback.some(option => Object.prototype.hasOwnProperty.call(option, 'effect'))) {
      const validEffects = ['received', 'remained', 'advance', 'expense'];
      const fallbackEffect = fallback.find(option => option.value === value)?.effect || 'received';
      entry.effect = validEffects.includes(item.effect) ? item.effect : fallbackEffect;
    }
    result.push(entry);
  }
  if (!result.some(item => item.active)) return fallback.map(item => ({ ...item }));
  return result;
}

export function normalizeCatalogues(value) {
  const source = isObject(value) ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_CATALOGUES).map(([key, fallback]) => [
    key,
    normalizeList(source[key], fallback),
  ]));
}
