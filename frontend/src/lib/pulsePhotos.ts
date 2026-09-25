// Photographs used on Pulse. All four are U.S. government or public-domain
// images from Wikimedia Commons, so no permission or fee is involved;
// credits are still shown next to each one (and linked to the Commons page
// that carries the original description and license). They are decorative:
// the text beside them says everything, so they carry empty alt text.

export interface Photo {
  src: string;
  credit: string;
  href: string;
  position: string; // CSS object-position, to keep the interesting part in a wide crop
}

export const PHOTOS: Record<'hero' | 'policy' | 'markets' | 'news', Photo> = {
  hero: {
    src: '/photos/hero.jpg',
    credit: 'Container terminal, Port of Miami. James R. Tourtellotte, U.S. Customs and Border Protection (public domain)',
    href: 'https://commons.wikimedia.org/wiki/File:Aerial_photograph_of_the_Port_of_Miami_Container_Port.jpg',
    position: '50% 40%',
  },
  policy: {
    src: '/photos/policy.jpg',
    credit: 'U.S. Capitol at night. Diliff (public domain)',
    href: 'https://commons.wikimedia.org/wiki/File:US_Capitol_Building_at_night_Jan_2006.jpg',
    position: '50% 32%',
  },
  markets: {
    src: '/photos/markets.jpg',
    credit: 'New York Stock Exchange floor, 1963. Thomas J. O’Halloran, Library of Congress (public domain)',
    href: 'https://commons.wikimedia.org/wiki/File:NY_stock_exchange_traders_floor_LC-U9-10548-6.jpg',
    position: '50% 45%',
  },
  news: {
    src: '/photos/news.jpg',
    credit: 'Container yard, Port of Long Beach. Charles Csavossy (public domain)',
    href: 'https://commons.wikimedia.org/wiki/File:Port_of_Long_Beach,_California_-4.jpg',
    position: '50% 55%',
  },
};
