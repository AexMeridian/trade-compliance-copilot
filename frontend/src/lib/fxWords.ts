// Currency moves in words. Every series on this site is "units of the currency per 1 U.S. dollar", so a rise means the currency
// weakened: a bare "Up 3.2%" read as the peso rising, the opposite of what happened.

export const CURRENCY_NAMES: Record<string, string> = {
  EUR: 'Euro',
  CNY: 'Chinese yuan',
  JPY: 'Japanese yen',
  MXN: 'Mexican peso',
  CAD: 'Canadian dollar',
  GBP: 'British pound',
  INR: 'Indian rupee',
  KRW: 'South Korean won',
  PHP: 'Philippine peso',
  BRL: 'Brazilian real',
  CHF: 'Swiss franc',
  AUD: 'Australian dollar',
  TRY: 'Turkish lira',
  ZAR: 'South African rand',
  SGD: 'Singapore dollar',
  THB: 'Thai baht',
  IDR: 'Indonesian rupiah',
  RUB: 'Russian ruble',
};

export const currencyName = (code: string) => CURRENCY_NAMES[code] ?? code;

/** e.g. "The Mexican peso weakened 3.2% against the dollar over 30 days (a dollar buys more pesos)." */
export function fxMoveText(code: string, changePct: number, period = 'over 30 days'): string {
  const name = currencyName(code);
  const abs = Math.abs(changePct).toFixed(1);
  if (Math.abs(changePct) < 0.05) return `The ${name} was little changed against the dollar ${period}.`;
  return changePct > 0
    ? `The ${name} weakened ${abs}% against the dollar ${period} (a dollar buys more).`
    : `The ${name} strengthened ${abs}% against the dollar ${period} (a dollar buys less).`;
}
