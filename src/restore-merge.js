const SAFE_DOCUMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function normalizeMilkRecord(row = {}) {
  return {
    date: String(row.sale_date ?? row.date ?? ''),
    shift: String(row.shift ?? 'morning'),
    milkman: String(row.buyer ?? row.milkman ?? ''),
    milkType: String(row.milk_type ?? row.milkType ?? 'cow'),
    quantity: Number(row.quantity),
    rate: Number(row.rate),
    amount: Number(row.amount),
    remarks: String(row.remarks ?? ''),
  };
}

export function normalizeTransactionRecord(row = {}) {
  return {
    date: String(row.date ?? ''),
    kind: String(row.kind ?? ''),
    amount: Number(row.amount),
    party: String(row.party ?? ''),
    category: String(row.category ?? ''),
    remarks: String(row.remarks ?? ''),
  };
}

function isSafeDocumentId(id) {
  return typeof id === 'string' && SAFE_DOCUMENT_ID.test(id) && !/^__.*__$/.test(id);
}

export function planRestoreMerge(incoming = [], existing = [], normalize) {
  if (typeof normalize !== 'function') {
    throw new TypeError('A record normalizer is required.');
  }

  const prepared = incoming.map(item => ({
    item,
    record: normalize(item),
    sourceId: isSafeDocumentId(item?.id) ? item.id : null,
  }));
  const seenIds = new Set(existing.map(item => item?.id).filter(isSafeDocumentId));
  const sourceIds = new Set(seenIds);
  const seenFingerprints = new Set(
    existing.map(item => JSON.stringify(normalize(item))),
  );

  // Pre-register identified incoming rows so an ID-less legacy copy is
  // skipped regardless of which representation appears first in the backup.
  for (const candidate of prepared) {
    if (candidate.sourceId && !sourceIds.has(candidate.sourceId)) {
      sourceIds.add(candidate.sourceId);
      seenFingerprints.add(JSON.stringify(candidate.record));
    }
  }

  const additions = [];
  for (const candidate of prepared) {
    const { record, sourceId } = candidate;

    if (sourceId) {
      if (seenIds.has(sourceId)) continue;
      seenIds.add(sourceId);
      additions.push({ id: sourceId, record });
      continue;
    }

    const fingerprint = JSON.stringify(record);
    if (seenFingerprints.has(fingerprint)) continue;

    seenFingerprints.add(fingerprint);
    additions.push({ id: null, record });
  }

  return additions;
}
