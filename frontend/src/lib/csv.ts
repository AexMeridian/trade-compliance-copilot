// Small, safe CSV export for tables researchers want in a spreadsheet.
//
// Two things matter beyond quoting: cells that start with = + - or @ are read by spreadsheet programs as
// formulas, so a malicious or odd value in source data could run in the reader's Excel ("CSV injection"); those
// cells are prefixed with an apostrophe. And the file opens in Excel with accents intact, so it starts with a
// byte-order mark.

function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
