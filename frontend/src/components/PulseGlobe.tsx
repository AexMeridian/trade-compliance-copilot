import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoBounds, geoCentroid, geoContains, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { getCurrentTheme, THEME_CHANGE_EVENT, type Theme } from '../lib/theme';

// A wireframe, dotted globe you can turn and press. Every country the feed
// can name is coloured by how many U.S. actions named it in the last 30 days
// (the same count as the "Activity by country" panel); every OTHER country in
// the world is still drawn, outlined and hoverable -- with its real name
// (read straight from the bundled map data, not this file's own curated
// list) and an honest "not tracked individually" note -- rather than left as
// dead, uncoloured land. Pressing a country only filters the feed when it is
// one this app actually tags (see lib/pulse/country.ts); pressing anywhere
// else is a no-op, and the cursor reflects that. The United States itself is
// shaded its own "home" colour rather than counted, but just as hoverable and
// pressable, and pressing it opens a card about the feed as a whole instead
// of a per-country count. Country outlines are Natural Earth 1:110m
// public-domain data from the `world-atlas` package, bundled with the app
// (nothing is fetched from another site) and loaded only when this component
// first appears.

// ISO 3166-1 numeric id (as used by world-atlas) -> the code the feed uses.
// 'US' is a code no action or headline is ever tagged with (see
// lib/pulseCountries.ts) -- it exists only so the globe can single out the
// reporting country itself, the same way it does any other place.
const ID_TO_CODE: Record<number, string> = {
  156: 'CN',
  704: 'VN',
  410: 'KR',
  484: 'MX',
  124: 'CA',
  356: 'IN',
  360: 'ID',
  458: 'MY',
  512: 'OM',
  380: 'IT',
  392: 'JP',
  276: 'DE',
  76: 'BR',
  158: 'TW',
  764: 'TH',
  792: 'TR',
  804: 'UA',
  643: 'RU',
  364: 'IR',
  408: 'KP',
  192: 'CU',
  760: 'SY',
  862: 'VE',
  112: 'BY',
  104: 'MM',
  4: 'AF',
  826: 'GB',
  250: 'FR',
  756: 'CH',
  376: 'IL',
  682: 'SA',
  784: 'AE',
  840: 'US',
};
const CODE_TO_ID = new Map<string, number>(Object.entries(ID_TO_CODE).map(([id, code]) => [code, Number(id)]));

// The feed's 'EU' code means a document said "the European Union" itself, not
// any one member state -- distinct from a document naming, say, Germany by
// name (which already has its own code above). There's no single landmass to
// colour for a supranational bloc, so these ids are used only for two purely
// visual things when 'EU' is the active/hovered code: aiming the camera, and
// tracing the bloc's outline. They never recolour a member state's own dots --
// each of those is drawn with its own (real, usually untracked) color, same
// as any other country not in ID_TO_CODE, so the bloc never reads as one flat
// block on the map.
const EU_FOOTPRINT_IDS = [40, 56, 100, 191, 196, 203, 208, 233, 246, 300, 348, 372, 428, 440, 442, 528, 616, 620, 642, 703, 705, 724, 752];
const ANTARCTICA_ID = 10;

const codeFor = (id: number): string | null => ID_TO_CODE[id] ?? null;
const idsForCode = (code: string): number[] => {
  if (code === 'EU') return EU_FOOTPRINT_IDS;
  const id = CODE_TO_ID.get(code);
  return id === undefined ? [] : [id];
};

// Drawn on a <canvas>, so none of this can be a CSS custom property --
// PulseGlobe listens for THEME_CHANGE_EVENT (lib/theme.ts) and keeps its own
// palette in sync instead of relying on the cascade. SELECTED stays one
// color in both themes (orange reads fine against either hero background);
// everything else needs a real second value now that the hero itself can be
// light, not just dark (see index.css's --color-hero-* comment).
const SELECTED = '#fb923c';
interface GlobePalette {
  ocean: string;
  rim: string;
  graticule: string;
  outline: string;
  hoverFill: string;
  hoverStroke: string;
  ramp: string[]; // 1..4+ actions, dim to bright
  quiet: string; // any real country: no actions this month, tracked or not
  home: string; // the United States
  hovered: string;
}
const PALETTES: Record<Theme, GlobePalette> = {
  dark: {
    ocean: '#000000',
    rim: '#ffffff',
    graticule: 'rgba(255,255,255,0.16)',
    outline: 'rgba(255,255,255,0.28)',
    hoverFill: 'rgba(255,255,255,0.16)',
    hoverStroke: 'rgba(255,255,255,0.9)',
    ramp: ['#0e7490', '#06b6d4', '#67e8f9', '#ecfeff'],
    quiet: '#8a8a94',
    home: '#a78bfa',
    hovered: '#ffffff',
  },
  light: {
    ocean: '#eef2f8',
    rim: '#0b1220',
    graticule: 'rgba(11,18,32,0.16)',
    outline: 'rgba(11,18,32,0.26)',
    hoverFill: 'rgba(11,18,32,0.08)',
    hoverStroke: 'rgba(11,18,32,0.8)',
    // Same dim-to-bright meaning as dark's ramp, but inverted luminance --
    // "brightest" can't mean "near-white" on a near-white ocean.
    ramp: ['#cfe6ef', '#7cc3db', '#1f93ad', '#0a5d73'],
    quiet: '#9a9aa5',
    home: '#6d28d9',
    hovered: '#0b1220',
  },
};

type Country = Feature<Geometry, { name: string }> & { id: number };
interface Dot {
  lng: number;
  lat: number;
  v: [number, number, number]; // unit vector, to skip dots on the far side cheaply
  id: number;
}
interface World {
  countries: Country[];
  dots: Dot[];
}

// ---- Land dots: a regular grid of points, kept where they fall inside a country.
function pointInRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInGeometry(x: number, y: number, g: Geometry): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some((rings) => pointInRing(x, y, rings[0]) && !rings.slice(1).some((hole) => pointInRing(x, y, hole)));
}

let worldPromise: Promise<World> | null = null;
function loadWorld(): Promise<World> {
  worldPromise ??= Promise.all([import('topojson-client'), import('world-atlas/countries-110m.json')]).then(([topo, mod]) => {
    // The package ships plain JSON with no TopoJSON types, so it is read loosely here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topology: any = mod.default;
    const fc = topo.feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
    const countries = fc.features.map((f) => ({ ...f, id: parseInt(String(f.id), 10) })) as Country[];
    const dots: Dot[] = [];
    const step = 1.4;
    for (const c of countries) {
      if (c.id === ANTARCTICA_ID) continue;
      const [[minLng, minLat], [maxLng0, maxLat]] = geoBounds(c);
      const maxLng = maxLng0 < minLng ? maxLng0 + 360 : maxLng0; // crosses the antimeridian
      for (let lng = minLng; lng <= maxLng; lng += step) {
        const x = lng > 180 ? lng - 360 : lng;
        for (let lat = minLat; lat <= maxLat; lat += step) {
          if (!pointInGeometry(x, lat, c.geometry)) continue;
          const la = (lat * Math.PI) / 180;
          const lo = (x * Math.PI) / 180;
          dots.push({ lng: x, lat, id: c.id, v: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)] });
        }
      }
    }
    return { countries, dots };
  });
  return worldPromise;
}

const stepFor = (count: number, max: number) => Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));

export function PulseGlobe({
  breakdown,
  activeCountry,
  onSelect,
  groupColorFor,
  describe,
  legend,
  ariaLabel,
}: {
  breakdown: { country: string; count: number }[];
  activeCountry: string | null;
  onSelect: (code: string) => void;
  // Optional: color countries by some other grouping (e.g. alliance
  // membership on the Influence page) instead of this month's action count.
  // Returning null falls back to the neutral "no group" shade. Only ever
  // called for a code this app tracks (see codeFor) -- never for a country
  // drawn only from the map's own name.
  groupColorFor?: (code: string) => string | null;
  // Optional: replace the count-based hover/status sentence with a custom
  // one. Same rule as groupColorFor -- tracked codes only.
  describe?: (code: string) => string;
  // Optional: replace the "Fewer ... actions" count key with a different legend.
  legend?: { swatch: string; label: string }[];
  ariaLabel?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [size, setSize] = useState(440);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>(() => getCurrentTheme());

  const rotation = useRef<[number, number]>([-95, -22]);
  const pointerRef = useRef<{ x: number; y: number } | null>(null); // where the cursor is, while it is over the globe
  const dragRef = useRef<{ x: number; y: number; r: [number, number]; moved: boolean } | null>(null);
  const hoverIdRef = useRef<number | null>(null);
  const clockRef = useRef(performance.now()); // feeds the arc/ping animation phase; set every animation frame, read inside draw()
  const lastDrawRef = useRef(0); // throttles the ambient tick's own redraws (see the tick effect below)
  const [booted, setBooted] = useState(false); // flips true once, after the one-time boot-sweep plays (see .globe-boot, index.css)

  const counts = useMemo(() => new Map(breakdown.map((b) => [b.country, b.count])), [breakdown]);
  const max = Math.max(...breakdown.map((b) => b.count), 1);

  useEffect(() => {
    let live = true;
    loadWorld().then((w) => live && setWorld(w));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize(Math.max(240, Math.min(760, Math.floor(entry.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The canvas can't read CSS custom properties, so it needs its own nudge
  // when the toggle (ThemeToggle.tsx) fires lib/theme.ts's setTheme().
  useEffect(() => {
    const onThemeChange = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  const projection = useMemo(() => geoOrthographic().clipAngle(90), []);
  const graticule = useMemo(() => geoGraticule10(), []);

  // Every country's centroid, computed once per world load -- feeds the
  // trade-flow arcs below without re-walking geometry every frame.
  const centroidFor = useMemo(() => {
    const m = new Map<number, [number, number]>();
    if (!world) return m;
    for (const c of world.countries) m.set(c.id, geoCentroid(c));
    return m;
  }, [world]);

  // "Where the action is": a great-circle line from the U.S. to each of this
  // month's most-active countries, brightness matched to the same ramp as
  // the dots. Capped at 4 so the globe doesn't turn into a cat's cradle --
  // this is meant to read as "here's where it's hottest right now", not a
  // map of every relationship. Real data only: a country only gets a line
  // when it has at least one action this month and a drawable landmass.
  const activeArcs = useMemo(() => {
    const us = centroidFor.get(840);
    if (!us) return [];
    const palette = PALETTES[theme];
    return breakdown
      .filter((b) => b.country !== 'US' && b.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((b) => {
        const id = CODE_TO_ID.get(b.country);
        const to = id === undefined ? undefined : centroidFor.get(id);
        if (!to) return null;
        return { code: b.country, from: us, to, color: palette.ramp[stepFor(b.count, max) - 1] };
      })
      .filter((a): a is { code: string; from: [number, number]; to: [number, number]; color: string } => a !== null);
  }, [breakdown, centroidFor, theme, max]);
  // Every country is hoverable (so its real name always shows), except
  // Antarctica -- excluded from the dot grid above for the same reason, and
  // odd to single out with a "not tracked" message since it is never a
  // plausible trade-action target.
  const hittable = useMemo(() => (world ? world.countries.filter((c) => c.id !== ANTARCTICA_ID) : []), [world]);

  // Dot colour for each country, from this month's counts. A country this
  // feed doesn't track gets the same "quiet" shade as a tracked one with zero
  // actions -- both are honestly "no U.S. actions on record", just for a
  // different reason -- rather than a separate, darker "unknown" bucket.
  const colorFor = useCallback(
    (id: number): string => {
      const palette = PALETTES[theme];
      const code = codeFor(id);
      if (code === 'US') return palette.home;
      if (code && code === activeCountry) return SELECTED;
      if (id === hoverIdRef.current) return palette.hovered;
      if (!code) return palette.quiet;
      if (groupColorFor) return groupColorFor(code) ?? palette.quiet;
      const n = counts.get(code) ?? 0;
      return n > 0 ? palette.ramp[stepFor(n, max) - 1] : palette.quiet;
    },
    [counts, max, activeCountry, groupColorFor, theme],
  );

  const draw = useCallback(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !world) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== size * dpr) {
      cv.width = size * dpr;
      cv.height = size * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const palette = PALETTES[theme];
    const r = size / 2 - 4;
    projection
      .scale(r)
      .translate([size / 2, size / 2])
      .rotate([rotation.current[0], rotation.current[1]]);
    const path = geoPath(projection, ctx);

    // Ocean and rim.
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, 2 * Math.PI);
    ctx.fillStyle = palette.ocean;
    ctx.fill();
    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Graticule.
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = palette.graticule;
    ctx.lineWidth = 0.75;
    ctx.stroke();

    // Country outlines: faint everywhere, strong on the countries the feed names.
    ctx.beginPath();
    for (const c of world.countries) path(c);
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // A gentle wash over the country (or, for 'EU', the whole bloc's
    // footprint) under the cursor, and a warmer one on the chosen one.
    const washIds = (ids: number[], fill: string, stroke: string, width: number) => {
      if (ids.length === 0) return;
      ctx.beginPath();
      for (const c of hittable) if (ids.includes(c.id)) path(c);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    const activeIds = activeCountry ? idsForCode(activeCountry) : [];
    if (hoverIdRef.current !== null && !activeIds.includes(hoverIdRef.current)) {
      washIds([hoverIdRef.current], palette.hoverFill, palette.hoverStroke, 1.4);
    }
    washIds(activeIds, 'rgba(251,146,60,0.2)', SELECTED, 1.8);

    // Halftone dots, one pass per colour. A dot is on the near side when it
    // points the same way as the centre of the view.
    const [lambda, phi] = projection.rotate();
    const cl = (-phi * Math.PI) / 180;
    const co = (-lambda * Math.PI) / 180;
    const cx = Math.cos(cl) * Math.cos(co);
    const cy = Math.cos(cl) * Math.sin(co);
    const cz = Math.sin(cl);
    const buckets = new Map<string, Dot[]>();
    for (const d of world.dots) {
      if (d.v[0] * cx + d.v[1] * cy + d.v[2] * cz <= 0.02) continue;
      const color = colorFor(d.id);
      const list = buckets.get(color);
      if (list) list.push(d);
      else buckets.set(color, [d]);
    }
    const dotR = Math.max(1, size / 380);
    for (const [color, list] of buckets) {
      ctx.beginPath();
      for (const d of list) {
        const p = projection([d.lng, d.lat]);
        if (!p) continue;
        ctx.moveTo(p[0] + dotR, p[1]);
        ctx.arc(p[0], p[1], dotR, 0, 2 * Math.PI);
      }
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Trade-flow arcs: a great circle from the U.S. to each hot country,
    // clipped to the visible hemisphere the same way the dots are (a point's
    // unit vector must face the camera), with a marching-dashes flow to read
    // as live movement rather than a static line. Drawn over the dots, like
    // telemetry overlaid on terrain.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = clockRef.current;
    const near = (lng: number, lat: number): boolean => {
      const la = (lat * Math.PI) / 180;
      const lo = (lng * Math.PI) / 180;
      const vx = Math.cos(la) * Math.cos(lo);
      const vy = Math.cos(la) * Math.sin(lo);
      const vz = Math.sin(la);
      return vx * cx + vy * cy + vz * cz > 0.02;
    };
    const STEPS = 48;
    ctx.save();
    ctx.lineWidth = Math.max(1.1, size / 420);
    ctx.setLineDash(reducedMotion ? [] : [5, 6]);
    ctx.lineDashOffset = reducedMotion ? 0 : -((clock / 45) % 11);
    ctx.globalAlpha = 0.85;
    for (const arc of activeArcs) {
      const interp = geoInterpolate(arc.from, arc.to);
      ctx.strokeStyle = arc.color;
      ctx.shadowColor = arc.color;
      ctx.shadowBlur = size / 55;
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i <= STEPS; i++) {
        const [lng, lat] = interp(i / STEPS);
        const p = near(lng, lat) ? projection([lng, lat]) : null;
        if (p) {
          if (drawing) ctx.lineTo(p[0], p[1]);
          else {
            ctx.moveTo(p[0], p[1]);
            drawing = true;
          }
        } else if (drawing) {
          ctx.stroke();
          ctx.beginPath();
          drawing = false;
        }
      }
      if (drawing) ctx.stroke();
    }
    ctx.restore();

    // One radar ping on the single hottest country -- "here's where it's
    // busiest right now". Deliberately just one, not one per arc: the point
    // is to draw the eye to a focal moment, not to turn the globe into a
    // light show.
    if (!reducedMotion && activeArcs[0]) {
      const [lng, lat] = activeArcs[0].to;
      const p = near(lng, lat) ? projection([lng, lat]) : null;
      if (p) {
        const period = 1700;
        const phase = (clock % period) / period;
        ctx.beginPath();
        ctx.arc(p[0], p[1], dotR * 1.6 + phase * size * 0.065, 0, 2 * Math.PI);
        ctx.strokeStyle = activeArcs[0].color;
        ctx.shadowColor = activeArcs[0].color;
        ctx.shadowBlur = size / 40;
        ctx.globalAlpha = Math.max(0, 1 - phase) * 0.85;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }
  }, [world, size, projection, graticule, hittable, activeCountry, colorFor, theme, activeArcs]);

  // Redraw whenever the data, size or selection changes.
  useEffect(() => draw(), [draw]);

  // Turn slowly until the visitor touches it or picks a country (never, if
  // they asked for less motion) -- and, regardless of rotation, keep the
  // clock advancing so the trade-flow arcs and radar ping (drawn inside
  // draw()) keep animating even while a country is selected or the globe is
  // being dragged. The redraw itself is capped to ~30fps here (throttled
  // independently of rAF's own ~60-120Hz cadence): before the arcs/ping
  // existed, this branch was a no-op whenever a country was selected, so
  // selecting one cost nothing. Now it always redraws for the ambient
  // animation, so this cap keeps that from quietly doubling the globe's GPU/
  // battery cost for as long as a country card stays open. Drag and hover
  // stay instantly responsive -- those paths call draw() directly from their
  // own event handlers, not through this throttle.
  useEffect(() => {
    if (!world || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (document.hidden) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!dragRef.current && !activeCountry) {
        // Slower under the cursor so a country can be read and pressed as it passes.
        const speed = pointerRef.current ? 0.0028 : 0.008;
        rotation.current = [rotation.current[0] + (now - last) * speed, rotation.current[1]];
        const p = pointerRef.current;
        if (p) {
          const id = hitTestId(p.x, p.y);
          if (id !== hoverIdRef.current) {
            hoverIdRef.current = id;
            setHoverId(id);
          }
        }
      }
      clockRef.current = now;
      if (now - lastDrawRef.current >= 33) {
        lastDrawRef.current = now;
        draw();
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // hitTestId is stable enough for this loop; the loop restarts when the world or selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, activeCountry, draw]);

  // The boot-sweep (index.css's .globe-boot) plays once, right after the
  // globe first has real data to show -- not on every re-render.
  useEffect(() => {
    if (!world || booted || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setBooted(true), 950);
    return () => clearTimeout(t);
  }, [world, booted]);

  // Bring a chosen country to the front (from the list, or after pressing it).
  useEffect(() => {
    if (!world || !activeCountry) return;
    // "The European Union" has no outline of its own, so bring Germany
    // forward as a representative centre -- a camera choice, not a claim
    // that Germany was individually named.
    const id = activeCountry === 'EU' ? 276 : CODE_TO_ID.get(activeCountry);
    const target = world.countries.find((c) => c.id === id);
    if (!target) return;
    const [lng, lat] = geoCentroid(target);
    const from = rotation.current;
    const to: [number, number] = [-lng, Math.max(-60, Math.min(60, -lat))];
    const dl = ((((to[0] - from[0] + 180) % 360) + 360) % 360) - 180; // shortest way round
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      rotation.current = [from[0] + dl * e, from[1] + (to[1] - from[1]) * e];
      draw();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // Only when the choice changes; redrawing for other reasons must not re-aim the globe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCountry, world]);

  const hitTestId = (clientX: number, clientY: number): number | null => {
    const cv = canvas.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const at = projection.invert?.([((clientX - rect.left) / rect.width) * size, ((clientY - rect.top) / rect.height) * size]);
    if (!at) return null;
    for (const c of hittable) if (geoContains(c, at)) return c.id;
    return null;
  };

  const sayForCode = (code: string): string => {
    if (describe) return describe(code);
    if (code === 'US') return 'United States: the country these trade actions come from. Press it for the feed as a whole.';
    const n = counts.get(code) ?? 0;
    return `${COUNTRY_LABELS[code] ?? code}: ${n === 0 ? 'no U.S. actions' : `${n} U.S. ${n === 1 ? 'action' : 'actions'}`} in the last 30 days`;
  };
  const sayForId = (id: number): string => {
    const code = codeFor(id);
    if (code) return sayForCode(code);
    const name = world?.countries.find((c) => c.id === id)?.properties.name ?? 'This place';
    return `${name}: not tracked individually in this feed`;
  };
  const shownMessage = hoverId !== null ? sayForId(hoverId) : activeCountry ? sayForCode(activeCountry) : null;
  // A hovered country is only pressable when it's one the feed actually
  // tags -- everywhere else, hovering still shows the name, but the cursor
  // stays a plain grab/drag hand rather than implying a click will do something.
  const hoverIsPressable = hoverId !== null && codeFor(hoverId) !== null;

  return (
    <div className="min-w-0">
      <div className="relative mx-auto w-full max-w-[760px]">
        {/* The atmosphere behind the sphere (index.css's .globe-halo) -- sized
            a bit larger than the globe and blurred, so it reads as a glow
            the globe sits inside rather than a flat circle on the page. */}
        <div className="globe-halo pointer-events-none absolute -inset-[22%] -z-10 rounded-full blur-3xl" aria-hidden="true" />
        <div ref={wrap} className={`relative w-full min-w-0 rounded-full ${!booted ? 'globe-boot' : ''}`}>
          <canvas
            ref={canvas}
            role="img"
            aria-label={
              ariaLabel ?? 'Globe of every country, coloured by how many U.S. actions named it in the last 30 days. Use the country list below to choose one.'
            }
            style={{ width: size, height: size, cursor: hoverIsPressable ? 'pointer' : dragRef.current ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
            className="globe-ring-glow mx-auto block select-none"
            onPointerLeave={() => {
              pointerRef.current = null;
              dragRef.current = null;
              hoverIdRef.current = null;
              setHoverId(null);
              draw();
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = { x: e.clientX, y: e.clientY, r: [...rotation.current], moved: false };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (d && e.buttons !== 0) {
                const dx = e.clientX - d.x;
                const dy = e.clientY - d.y;
                if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
                rotation.current = [d.r[0] + dx * 0.4, Math.max(-80, Math.min(80, d.r[1] - dy * 0.4))];
                draw();
                return;
              }
              pointerRef.current = { x: e.clientX, y: e.clientY };
              const id = hitTestId(e.clientX, e.clientY);
              if (id !== hoverIdRef.current) {
                hoverIdRef.current = id;
                setHoverId(id);
                draw(); // repaint the wash at once, even when the globe is standing still
              }
            }}
            onPointerUp={(e) => {
              const d = dragRef.current;
              dragRef.current = null;
              if (d && !d.moved) {
                const id = hitTestId(e.clientX, e.clientY);
                const code = id !== null ? codeFor(id) : null;
                if (code) onSelect(code);
              }
            }}
          />
        </div>
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1.5rem] text-center text-sm font-medium text-hero-ink">
        {shownMessage ?? (world ? 'Move over a country to see its count. Press it for details. Drag to turn the globe.' : 'Loading the globe…')}
      </p>
      {legend ? (
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-hero-ink-faint" aria-hidden="true">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.swatch }} />
              {l.label}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-1 flex items-center justify-center gap-2 text-xs text-hero-ink-faint" aria-hidden="true">
          Fewer
          <span className="flex gap-1">
            {PALETTES[theme].ramp.map((c) => (
              <span key={c} className="h-2.5 w-4 rounded-sm" style={{ background: c }} />
            ))}
          </span>
          actions
        </p>
      )}
    </div>
  );
}
