const LEDGER_TABS = Object.freeze({
  Milk: 'milk',
  Transactions: 'transactions',
});

export function trackLedgerTabView(dataLayer, tab) {
  const tabName = LEDGER_TABS[tab];

  if (!Array.isArray(dataLayer) || !tabName) {
    return false;
  }

  dataLayer.push({
    event: 'ledger_tab_view',
    tab_name: tabName,
  });
  return true;
}
