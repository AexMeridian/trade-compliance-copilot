import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { policyRoute } from './pulse/policy.js';
import { countryRoute } from './pulse/country.js';
import { referenceRoute } from './pulse/reference.js';
import { marketsNewsRoute } from './pulse/marketsNews.js';
import { homeRoute } from './pulse/home.js';
import { feedsRoute } from './pulse/feeds.js';
import { liveRoute } from './pulse/live.js';
import { sanctionCountsRoute } from './pulse/sanctionCounts.js';
import { statusRoute } from './pulse/status.js';
import { connectionsRoute } from './pulseConnections.js';

// The Pulse read API, composed from one module per area (see ./pulse/):
//   policy       feed, coverage, tempo, summary, active-measures  (Federal Register + tariff overlays)
//   country      /country/:code                                   (one country across every source)
//   reference    tariffs, sanctions, NATO, COFER, export-control chart, GTA, WRO
//   marketsNews  markets, news                                    (lazily refreshed)
//   feeds        rss, atom, feed.json                             (public syndication)
//   home         sync, home, rss, snapshots                       (aggregates and publishing)
//   connections  /connections, /convergence, /related             (cross-topic links)
// No two modules share a path, so registration order does not change behavior.
export const pulseRoute = new Hono<{ Bindings: Env }>();

pulseRoute.route('/', connectionsRoute);
pulseRoute.route('/', policyRoute);
pulseRoute.route('/', countryRoute);
pulseRoute.route('/', referenceRoute);
pulseRoute.route('/', marketsNewsRoute);
pulseRoute.route('/', feedsRoute);
pulseRoute.route('/', liveRoute);
pulseRoute.route('/', sanctionCountsRoute);
pulseRoute.route('/', statusRoute);
// /home calls the other routes in-process, so it is given the composed router.
pulseRoute.route('/', homeRoute(pulseRoute));
