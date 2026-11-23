import type { BasicsContent } from './types';

// The front door for people who are not trade professionals: the questions ordinary visitors brought to user testing, each answered on
// its own page with official data and plain words.
export const BASICS_EN: BasicsContent = {
  breadcrumbWire: 'Wire',
  breadcrumbBasics: 'Basics',
  h1: 'Trade, in plain English',
  intro: 'Start here if you are not a trade professional. Each page answers one everyday question with official government data, in plain words.',
  cards: [
    { to: '/prices', title: 'Tariffs and your wallet', text: 'What groceries, medicine, appliances and cars cost compared with a year ago, jobs in steel and cars, and how much tariffs collect.' },
    { to: '/lookup', title: 'Look up a tariff', text: 'Search any product by words or code and see the tariff on it from the country where it is made. Free, no account.' },
    { to: '/de-minimis', title: 'Small packages from abroad', text: 'Why online orders from other countries now owe duty, what changed and when, what your buyers abroad pay, and what you may bring home from a trip.' },
    { to: '/us-china', title: 'The U.S. and China, side by side', text: 'Economy, military, trade, research and how the world sees each, every figure with its year and source.' },
    { to: '/country/mx', title: 'Traveling or sending money home?', text: 'Each country page has a box for travelers and families: the exchange rate in plain words, its trend, a converter, the cost of sending money and the State Department advisory.' },
    { to: '/glossary', title: 'Glossary', text: 'Tariff, HTS, de minimis, sanctions, CPI and every other term on this site, in plain English.' },
  ],
};
