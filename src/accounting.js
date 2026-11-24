const ACCOUNTING_EFFECTS = new Set(['received', 'remained', 'advance', 'expense']);

export function getTransactionEffect(transaction, transactionKinds = []) {
  const configured = transactionKinds.find(item => item.value === transaction?.kind)?.effect;
  if (ACCOUNTING_EFFECTS.has(transaction?.kindEffect)) return transaction.kindEffect;
  if (ACCOUNTING_EFFECTS.has(configured)) return configured;
  return ACCOUNTING_EFFECTS.has(transaction?.kind) ? transaction.kind : null;
}

export function summarizeTransactions(transactions = [], transactionKinds = []) {
  const totals = { received: 0, remained: 0, advance: 0, expense: 0 };
  for (const transaction of transactions) {
    const effect = getTransactionEffect(transaction, transactionKinds);
    if (effect) totals[effect] += Number(transaction.amount) || 0;
  }
  return totals;
}
