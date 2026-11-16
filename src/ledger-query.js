export function getMonthDateRange(monthKey) {
  if (typeof monthKey !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw new TypeError('Expected a valid YYYY-MM month key.');
  }

  const [year, month] = monthKey.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthKey = String(nextMonth).padStart(2, '0');

  return {
    startDate: monthKey + '-01',
    endDateExclusive: String(nextYear).padStart(4, '0') + '-' + nextMonthKey + '-01',
  };
}
