// Which tracked market series speaks for a country, or a topic. Mirrors the
// frontend's CURRENCY_FOR / MARKET_TILE_FOR (frontend/src/lib/pulseCountries.ts)
// -- keep the two in sync. A country with no entry simply has no market
// context; nothing is guessed.
import type { Topic } from './topic.js';

export const CURRENCY_FOR: Record<string, string> = {
  DE: 'EUR', FR: 'EUR', IT: 'EUR', CN: 'CNY', JP: 'JPY', MX: 'MXN', CA: 'CAD', GB: 'GBP', IN: 'INR', KR: 'KRW', AU: 'AUD', BR: 'BRL',
  CH: 'CHF', CZ: 'CZK', DK: 'DKK', HK: 'HKD', HU: 'HUF', ID: 'IDR', IL: 'ILS', IS: 'ISK', MY: 'MYR', NO: 'NOK', NZ: 'NZD', PH: 'PHP',
  PL: 'PLN', RO: 'RON', SE: 'SEK', SG: 'SGD', TH: 'THB', TR: 'TRY', ZA: 'ZAR',
};

export const MARKET_TILE_FOR: Record<string, string> = {
  JP: '^N225', DE: '^GDAXI', GB: '^FTSE', CN: '000001.SS', HK: '^HSI', TW: 'TSM', KR: '^KS11', IN: '^NSEI', BR: '^BVSP',
};

// Commodity futures this app tracks, used as the closest real proxy for a
// topic (crude oil for Energy; copper for Metals & minerals).
export const TOPIC_COMMODITY: Partial<Record<Topic, string>> = {
  Energy: 'CL=F',
  'Metals & minerals': 'HG=F',
};
