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
  milkSuppliers: Object.freeze([]),
  transactionParties: Object.freeze([]),
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

function normalizeList(input, fallback, catalogueKey) {
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
    if (catalogueKey === 'milkSuppliers') {
      const rawRate = item.defaultRate;
      if (rawRate === '' || rawRate === null || rawRate === undefined) entry.defaultRate = '';
      else {
        const parsedRate = Number(rawRate);
        entry.defaultRate = (typeof rawRate === 'number' || (typeof rawRate === 'string' && rawRate.trim() !== ''))
          && Number.isFinite(parsedRate) && parsedRate >= 0 ? String(parsedRate) : '';
      }
    }
    if (typeof item.historicalLabel === 'string' && item.historicalLabel.trim()) entry.historicalLabel = item.historicalLabel.trim().slice(0, 60);
    if (fallback.some(option => Object.prototype.hasOwnProperty.call(option, 'effect'))) {
      const validEffects = ['received', 'remained', 'advance', 'expense'];
      const fallbackEffect = fallback.find(option => option.value === value)?.effect || 'received';
      entry.effect = validEffects.includes(item.effect) ? item.effect : fallbackEffect;
    }
    result.push(entry);
  }
  if (!result.some(item => item.active) && fallback.length > 0) return fallback.map(item => ({ ...item }));
  return result;
}

export function normalizeCatalogues(value) {
  const source = isObject(value) ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_CATALOGUES).map(([key, fallback]) => [
    key,
    normalizeList(source[key], fallback, key),
  ]));
}

function catalogueValue(prefix, label, items) {
  const hash = Array.from(label).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7).toString(36);
  const base = prefix + '_' + hash;
  let candidate = base;
  let suffix = 2;
  while (items.some(item => item.value === candidate)) candidate = base + '_' + suffix++;
  return candidate;
}

export function mergeMilkSuppliers(settings, names = []) {
  const items = [...(settings.catalogues.milkSuppliers || [])];
  for (const raw of names) {
    const label = String(raw || '').trim().slice(0, 60);
    if (!label || items.some(item => item.label.toLocaleLowerCase() === label.toLocaleLowerCase())) continue;
    if (items.length >= 40) break;
    items.push({ value: catalogueValue('supplier', label, items), label, defaultRate: '', active: true });
  }
  return { ...settings, catalogues: { ...settings.catalogues, milkSuppliers: items } };
}

export function ensureMilkSupplier(settings, name, defaultRate = '') {
  const label = String(name || '').trim().slice(0, 60);
  if (!label) return settings;
  let rawRate = '';
  if (defaultRate !== '' && defaultRate !== null && defaultRate !== undefined) {
    const parsed = Number(defaultRate);
    if (Number.isFinite(parsed) && parsed >= 0) rawRate = String(parsed);
  }
  const items = [...(settings.catalogues.milkSuppliers || [])];
  const index = items.findIndex(item => item.label.toLocaleLowerCase() === label.toLocaleLowerCase());
  if (index >= 0) {
    const current = items[index];
    items[index] = {
      ...current,
      active: true,
      defaultRate: current.defaultRate !== '' ? current.defaultRate : rawRate,
    };
  } else if (items.length < 40) {
    items.push({ value: catalogueValue('supplier', label, items), label, defaultRate: rawRate, active: true });
  }
  return { ...settings, catalogues: { ...settings.catalogues, milkSuppliers: items } };
}

export function getMilkSupplierDefaultRate(settings, name) {
  const label = String(name || '').trim();
  const item = (settings.catalogues.milkSuppliers || []).find(entry =>
    entry.active && entry.label.toLocaleLowerCase() === label.toLocaleLowerCase());
  return item?.defaultRate ?? '';
}
