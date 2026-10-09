import { toCsv } from './csv';

/** Offers a table to the browser as a CSV file download (browser only; the pure part lives in csv.ts). */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const blob = new Blob([`﻿${toCsv(header, rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
