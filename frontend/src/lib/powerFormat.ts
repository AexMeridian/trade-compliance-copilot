import type { PowerUnit } from './api';

const compact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(abs >= 1e13 ? 0 : 1)} trillion`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)} billion`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)} million`;
  if (abs >= 1e4) return `${Math.round(n / 1e3)} thousand`;
  return Math.round(n).toLocaleString('en-US');
};

/** One readable string per figure, with its unit, so a reader never has to guess what a bare number means. */
export function formatValue(unit: PowerUnit, v: number): string {
  switch (unit) {
    case 'usd':
      return `${v < 0 ? '-' : ''}$${compact(Math.abs(v))}`;
    case 'usd_per_person':
      return `${v < 0 ? '-' : ''}$${Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString('en-US') : Math.abs(v).toFixed(1)} per person`;
    case 'pct':
      return `${v.toFixed(Math.abs(v) >= 10 ? 1 : 2)}%`;
    case 'count':
      return compact(v);
    case 'index':
      return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
    case 'distance':
      return v.toFixed(2);
    case 'per_1000':
      return `${v < 1 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US')} per 1,000`;
  }
}

/** The short form used on axis ends and in CSV-free spots. */
export function formatShort(unit: PowerUnit, v: number): string {
  return formatValue(unit, v).replace(' per person', '/person').replace(' per 1,000', '/1,000').replace(' trillion', 'T').replace(' billion', 'B').replace(' million', 'M').replace(' thousand', 'k');
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
