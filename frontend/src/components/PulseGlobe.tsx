import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoBounds, geoCentroid, geoContains, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { WORLD_CODE_TO_ID, WORLD_ID_TO_CODE } from '../lib/worldCountries';
import { getCurrentTheme, THEME_CHANGE_EVENT, type Theme } from '../lib/theme';
import { useLiveArcs } from '../lib/useLiveArcs';

// A wireframe, dotted globe you can turn and press. Every country is
// pressable and opens a card -- coloured by how many U.S. actions named it
// in the last 30 days (the same count as the "Activity by country" panel)
// when it has any, or the same neutral "no actions on record" shade as a
// tracked country with zero actions when it doesn't. The United States
// itself is shaded its own "home" colour rather than counted, but just as
// hoverable and pressable, and pressing it opens a card about the feed as a
// whole instead of a per-country count. Country outlines are Natural Earth
// 1:110m public-domain data from the `world-atlas` package, bundled with the
// app (nothing is fetched from another site) and loaded only when this
// component first appears.

// ISO 3166-1 numeric id (as used by world-atlas) -> the ISO alpha-2 code
// every per-country table in this app keys on -- see worldCountries.ts.
// Pressing any of them opens PulseCountryCard, which already renders a
// correct (if thin) card for a code with no U.S. trade-action history: it
// isn't a special case here, just the default for most of the globe.
const ID_TO_CODE: Record<number, string> = WORLD_ID_TO_CODE;
const CODE_TO_ID = WORLD_CODE_TO_ID;

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
  // Light mode only: the ocean is a lit, glass-like sphere (gradient + limb shading +
  // specular highlight) instead of a flat fill, so the globe reads as a physical object.
  sphere?: boolean;
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
    home: '#fbbf24',
    hovered: '#ffffff',
  },
  light: {
    ocean: '#eef1f6', // fallback only; the sphere gradient below is what is drawn
    rim: 'rgba(71,85,105,0.4)',
    graticule: 'rgba(51,65,85,0.14)',
    outline: 'rgba(51,65,85,0.26)',
    hoverFill: 'rgba(51,65,85,0.1)',
    hoverStroke: 'rgba(30,41,59,0.85)',
    // Same dim-to-bright meaning as dark's ramp (more actions = stronger), but the
    // strength comes from saturation and depth, not near-white: teal, cyan-blue,
    // royal blue, deep navy. Each step stays readable on the pale blue ocean.
    ramp: ['#2dd4bf', '#0891b2', '#2563eb', '#1e3a8a'],
    quiet: '#7c8db0',
    home: '#d99a00',
    hovered: '#0b1220',
    sphere: true,
  },
};

// A <canvas> cannot read a CSS variable: assigning 'var(--color-hue-green)' to fillStyle is
// silently ignored and the previous colour is reused. The alliance globe colours countries
// by theme-aware CSS variables, so they are resolved to real colours here before drawing.
const resolveColor = (color: string): string => {
  const m = /^var\((--[\w-]+)\)$/.exec(color);
  if (!m) return color;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#8a8a94';
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

const TAG_NOUN: Record<string, string> = { Tariff: 'Tariff', Sanctions: 'Sanctions', 'Export Control': 'Export control', 'Trade Agreement': 'Trade agreement', Other: 'Notice' };

// What sits behind an arc: the country, how many actions named it in the last 30 days, and
// the latest few from the Federal Register, each linked to the official notice.
function ArcTooltip({
  code,
  x,
  y,
  width,
  count,
  latest,
}: {
  code: string;
  x: number;
  y: number;
  width: number;
  count: number;
  latest: { title: string; url: string; date: string; tag: string }[];
}) {
  const name = COUNTRY_LABELS[code] ?? code;
  const boxW = Math.min(300, width - 16);
  const left = Math.max(8, Math.min(x + 14, width - boxW - 8));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 rounded-md border border-hero-border-strong bg-hero-bg/95 p-3 text-left text-hero-ink shadow-lg backdrop-blur"
      style={{ left, top: Math.max(8, y + 16), width: boxW }}
    >
      <p className="text-sm font-semibold">
        U.S. to {name}
      </p>
      <p className="text-xs text-hero-ink-muted">
        {count} action{count === 1 ? '' : 's'} in the last 30 days. Press to open.
      </p>
      {latest.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t border-hero-divider pt-2">
          {latest.slice(0, 2).map((a) => (
            <li key={a.url} className="text-xs leading-snug">
              <span className="text-hero-ink-faint">
                {TAG_NOUN[a.tag] ?? a.tag}, {a.date}
              </span>
              <br />
              <span className="line-clamp-2">{a.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const stepFor = (count: number, max: number) => Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));

export function PulseGlobe({
  breakdown: breakdownProp,
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
  const onScreenRef = useRef(true); // false once the globe has scrolled out of view
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

  // Live arcs: the same counts the page loaded with, refreshed every five minutes while this
  // globe is on screen (lib/useLiveArcs.ts), plus the latest actions behind each busy country.
  const { live, freshUntil } = useLiveArcs(() => onScreenRef.current);
  const breakdown = useMemo(() => (live ? live.countries.map((c) => ({ country: c.country, count: c.count })) : breakdownProp), [live, breakdownProp]);
  const latestFor = useMemo(() => new Map((live?.countries ?? []).map((c) => [c.country, c.latest])), [live]);
  const arcRunsRef = useRef(new Map<string, [number, number][][]>()); // each arc's on-screen polyline runs, rebuilt every draw, for hit-testing
  const arcHoverRef = useRef<string | null>(null);
  const [arcHover, setArcHover] = useState<{ code: string; x: number; y: number } | null>(null);

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
    if (palette.sphere) {
      // Lit from the upper left: bright sky-white core falling to a deeper blue at the far limb.
      const lit = ctx.createRadialGradient(size / 2 - r * 0.38, size / 2 - r * 0.42, r * 0.05, size / 2, size / 2, r);
      lit.addColorStop(0, '#ffffff');
      lit.addColorStop(0.5, '#f1f4f8');
      lit.addColorStop(0.88, '#dce3ec');
      lit.addColorStop(1, '#c6d0dd');
      ctx.fillStyle = lit;
    } else {
      ctx.fillStyle = palette.ocean;
    }
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
      ctx.fillStyle = resolveColor(color);
      ctx.fill();
    }

    // Light mode: limb shading over the dots and a soft specular glint, so the dotted
    // surface curves away from the viewer instead of sitting flat on a disc.
    if (palette.sphere) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r, 0, 2 * Math.PI);
      ctx.clip();
      const limb = ctx.createRadialGradient(size / 2, size / 2, r * 0.62, size / 2, size / 2, r);
      limb.addColorStop(0, 'rgba(51,65,85,0)');
      limb.addColorStop(1, 'rgba(51,65,85,0.12)');
      ctx.fillStyle = limb;
      ctx.fillRect(0, 0, size, size);
      const glint = ctx.createRadialGradient(size / 2 - r * 0.45, size / 2 - r * 0.5, 0, size / 2 - r * 0.45, size / 2 - r * 0.5, r * 0.55);
      glint.addColorStop(0, 'rgba(255,255,255,0.35)');
      glint.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glint;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();
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
    arcRunsRef.current.clear();
    for (const arc of activeArcs) {
      const interp = geoInterpolate(arc.from, arc.to);
      const hot = arcHoverRef.current === arc.code;
      ctx.strokeStyle = arc.color;
      ctx.shadowColor = arc.color;
      ctx.shadowBlur = hot ? size / 28 : size / 55;
      ctx.lineWidth = hot ? Math.max(2.4, size / 210) : Math.max(1.1, size / 420);
      ctx.globalAlpha = hot ? 1 : 0.85;
      ctx.beginPath();
      let drawing = false;
      const runs: [number, number][][] = [];
      let run: [number, number][] = [];
      for (let i = 0; i <= STEPS; i++) {
        const [lng, lat] = interp(i / STEPS);
        const p = near(lng, lat) ? projection([lng, lat]) : null;
        if (p) {
          run.push([p[0], p[1]]);
          if (drawing) ctx.lineTo(p[0], p[1]);
          else {
            ctx.moveTo(p[0], p[1]);
            drawing = true;
          }
        } else if (drawing) {
          ctx.stroke();
          ctx.beginPath();
          drawing = false;
          runs.push(run);
          run = [];
        }
      }
      if (drawing) ctx.stroke();
      if (run.length) runs.push(run);
      arcRunsRef.current.set(arc.code, runs);
    }
    ctx.restore();

    // One radar ping on the single hottest country -- "here's where it's
    // busiest right now". Deliberately just one, not one per arc: the point
    // is to draw the eye to a focal moment, not to turn the globe into a
    // light show.
    // A country that gained an action since the last live refresh also pings, faster and
    // wider, for a few seconds -- the visible sign that new data just arrived.
    const nowMs = Date.now();
    const pinged = activeArcs.filter((a, i) => (i === 0 && !reducedMotion) || (freshUntil.current.get(a.code) ?? 0) > nowMs);
    for (const arc of pinged) {
      const [lng, lat] = arc.to;
      const p = near(lng, lat) ? projection([lng, lat]) : null;
      if (p) {
        const isNew = (freshUntil.current.get(arc.code) ?? 0) > nowMs;
        const period = isNew ? 1100 : 1700;
        const phase = (clock % period) / period;
        ctx.beginPath();
        ctx.arc(p[0], p[1], dotR * 1.6 + phase * size * (isNew ? 0.1 : 0.065), 0, 2 * Math.PI);
        ctx.strokeStyle = arc.color;
        ctx.shadowColor = arc.color;
        ctx.shadowBlur = size / 40;
        ctx.globalAlpha = Math.max(0, 1 - phase) * 0.85;
        ctx.lineWidth = isNew ? 2.6 : 1.8;
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
    // Stop drawing while the globe is scrolled out of view: on a long page it would
    // otherwise burn CPU/GPU at 30 fps for as long as the visitor reads below it.
    const el = wrap.current;
    const io = el ? new IntersectionObserver(([entry]) => { onScreenRef.current = entry.isIntersecting; }) : null;
    if (el && io) io.observe(el);
    const tick = (now: number) => {
      if (document.hidden || !onScreenRef.current) {
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
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
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

  // The arc (if any) under the pointer, by distance to the on-screen polyline in canvas pixels.
  // Arcs are only ever the real U.S.-to-country lines, so this stays a data interaction.
  const hitTestArc = (clientX: number, clientY: number): string | null => {
    const cv = canvas.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * size;
    const py = ((clientY - rect.top) / rect.height) * size;
    const reach = Math.max(9, size / 55);
    let best: { code: string; d: number } | null = null;
    for (const [code, runs] of arcRunsRef.current) {
      for (const run of runs) {
        for (let i = 1; i < run.length; i++) {
          const [ax, ay] = run[i - 1];
          const [bx, by] = run[i];
          const dx = bx - ax;
          const dy = by - ay;
          const len2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
          const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
          if (d <= reach && (!best || d < best.d)) best = { code, d };
        }
      }
    }
    return best?.code ?? null;
  };
  const setArcAt = (code: string | null, clientX: number, clientY: number) => {
    const box = wrap.current?.getBoundingClientRect();
    if (code !== arcHoverRef.current) {
      arcHoverRef.current = code;
      draw();
    }
    setArcHover(code && box ? { code, x: clientX - box.left, y: clientY - box.top } : null);
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
        <div className="globe-shadow pointer-events-none absolute inset-x-[14%] -bottom-[3%] -z-10 h-[7%]" aria-hidden="true" />
        <div ref={wrap} className={`relative w-full min-w-0 rounded-full ${!booted ? 'globe-boot' : ''}`}>
          <canvas
            ref={canvas}
            role="img"
            aria-label={
              ariaLabel ?? 'Globe of every country, coloured by how many U.S. actions named it in the last 30 days. Use the country list below to choose one.'
            }
            style={{ width: size, height: size, cursor: hoverIsPressable || arcHover ? 'pointer' : dragRef.current ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
            className="globe-ring-glow mx-auto block select-none"
            onPointerLeave={() => {
              pointerRef.current = null;
              dragRef.current = null;
              hoverIdRef.current = null;
              setHoverId(null);
              arcHoverRef.current = null;
              setArcHover(null);
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
              const overArc = hitTestArc(e.clientX, e.clientY);
              setArcAt(overArc, e.clientX, e.clientY);
              // While an arc is under the cursor it takes priority: no country wash behind it.
              const id = overArc ? null : hitTestId(e.clientX, e.clientY);
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
                const arcCode = hitTestArc(e.clientX, e.clientY);
                if (arcCode) {
                  onSelect(arcCode);
                  return;
                }
                const id = hitTestId(e.clientX, e.clientY);
                const code = id !== null ? codeFor(id) : null;
                if (code) onSelect(code);
              }
            }}
          />
          {arcHover && (
            <ArcTooltip
              code={arcHover.code}
              x={arcHover.x}
              y={arcHover.y}
              width={wrap.current?.clientWidth ?? size}
              count={counts.get(arcHover.code) ?? 0}
              latest={latestFor.get(arcHover.code) ?? []}
            />
          )}
        </div>
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1.5rem] text-center text-sm font-medium text-hero-ink">
        {shownMessage ?? (world ? 'Move over a country to see its count. Press it for details. Drag to turn the globe.' : 'Loading the globe…')}
      </p>
      {live && (
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-hero-ink-faint" title="Counts refresh about every five minutes while this page is open">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-clear" aria-hidden="true" />
          Live. Updated {new Date(live.asOf).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Hover or press an arc for the latest actions.
        </p>
      )}
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
