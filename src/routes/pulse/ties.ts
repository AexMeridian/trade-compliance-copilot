import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { CEPII_PARTNERS, CEPII_TIES } from '../../lib/power/cepii.generated.js';

// Shared official languages and colonial history with seven partner powers (CEPII GeoDist, Etalab 2.0). Static data bundled with the
// Worker: no database read, so it costs nothing against the free quota, and a browser may keep it for a day.
export const tiesRoute: PulseApp = new Hono<{ Bindings: Env }>();

tiesRoute.get('/ties', (c) => {
  c.header('Cache-Control', 'public, max-age=86400');
  return c.json({
    partners: CEPII_PARTNERS,
    ties: CEPII_TIES,
    source: {
      name: 'CEPII, GeoDist (Etalab 2.0)',
      url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=6',
      citation: 'Mayer, T. and Zignago, S. (2011), "Notes on CEPII\'s distances measures: the GeoDist database", CEPII Working Paper 2011-25.',
      caveat:
        'A language counts only where it is official in both countries as CEPII codes it (English is coded official in the United States). Colonial relationship means ever, at any time, including long ago. Neither says how people in either country feel about the other.',
    },
  });
});
