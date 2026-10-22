import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { TREND_READINGS } from '../../lib/power/trends.js';
import { POWER_EVENTS } from '../../lib/power/events.js';
import { PEW_DRIVERS, PEW_DRIVER_SOURCE } from '../../lib/power/pewDrivers.js';
import { PEW_CN_FAVORABLE, PEW_US_FAVORABLE } from '../../lib/power/pewTrends.generated.js';
import { PEW_DISCLAIMER } from '../../lib/power/opinion.js';

// Trend readings for the Soft Power scoreboard: other publishers' published figures by year (lib/power/trends.ts), Pew's per-country
// trend of views of the U.S. and China, the Pew confidence-in-the-president pairs, and dated events. Static data bundled with the Worker:
// no database read, so it costs nothing against the free quota, and a browser may keep it for a day. Readings switched off in
// trends.ts are not served.
export const trendsRoute: PulseApp = new Hono<{ Bindings: Env }>();

trendsRoute.get('/trends', (c) => {
  c.header('Cache-Control', 'public, max-age=86400');
  return c.json({
    readings: TREND_READINGS.filter((r) => r.enabled).map(({ enabled: _enabled, ...r }) => r),
    events: POWER_EVENTS,
    pew: {
      disclaimer: PEW_DISCLAIMER,
      usFavorable: PEW_US_FAVORABLE,
      cnFavorable: PEW_CN_FAVORABLE,
      us: {
        name: 'Pew Research Center, Spring 2026 Global Attitudes Survey: U.S. image topline',
        url: 'https://www.pewresearch.org/wp-content/uploads/sites/20/2026/06/pg_2026.06.23_us-image-2026_topline.pdf',
        release: 'June 23, 2026',
      },
      cn: {
        name: 'Pew Research Center, "Views of China and Xi Are Improving Globally" (topline in the report)',
        url: 'https://www.pewresearch.org/wp-content/uploads/sites/20/2026/07/pg_2026.06.15_global-views-china-2026_report.pdf',
        release: 'July 15, 2026',
      },
      drivers: { source: PEW_DRIVER_SOURCE, countries: PEW_DRIVERS },
    },
  });
});
