export function escapeCsvCell(value) {
  let text = String(value ?? '');
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function createCsv(rows) {
  const body = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
  return '\ufeff' + body;
}
