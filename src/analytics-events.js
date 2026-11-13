const LEDGER_TABS = Object.freeze({
  Milk: 'milk',
  Transactions: 'transactions',
});

export function trackLedgerTabView(analytics, tab, logEvent) {
  const tabName = LEDGER_TABS[tab];

  if (!analytics || !tabName || typeof logEvent !== 'function') {
    return false;
  }

  logEvent(analytics, 'ledger_tab_view', { tab_name: tabName });
  return true;
}
