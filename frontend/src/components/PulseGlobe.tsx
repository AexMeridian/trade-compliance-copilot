import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoBounds, geoCentroid, geoContains, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { COUNTRY_LABELS } from '../lib/pulseCountries';

// A wireframe, dotted globe you can turn and press. Every land dot is drawn in
// a soft grey; the countries the feed can name are coloured by how many U.S.
// actions named them in the last 30 days (the same count as the "Activity by
// country" panel), and pressing one filters the policy feed to it. Country
// outlines are Natural Earth 1:110m public-domain data from the `world-atlas`
// package, bundled with the app (nothing is fetched from another site) and
// loaded only when this component first appears.

// ISO 3166-1 numeric id (as used by world-atlas) -> the two-letter code the feed uses.
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
};
// The feed tags "the European Union" as one place; the other member states share its count.
const EU_MEMBERS = new Set([40, 56, 100, 191, 196, 203, 208, 233, 246, 300, 348, 372, 428, 440, 442, 528, 616, 620, 642, 703, 705, 724, 752]);
const US_ID = 840;
const ANTARCTICA_ID = 10;

const codeFor = (id: number): string | null => ID_TO_CODE[id] ?? (EU_MEMBERS.has(id) ? 'EU' : null);

const GLOBE_RAMP = ['#0e7490', '#06b6d4', '#67e8f9', '#ecfeff']; // 1..4+ actions, dim to bright
const QUIET = '#8a8a94'; // a country the feed can name, with no actions this month
const OTHER = '#4b4b55'; // land the feed never names
const HOME = '#a78bfa'; // the United States
const SELECTED = '#fb923c';
const HOVERED = '#ffffff';

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
}: {
  breakdown: { country: string; count: number }[];
  activeCountry: string | null;
  onSelect: (code: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [size, setSize] = useState(440);
  const [hover, setHover] = useState<string | null>(null);

  const rotation = useRef<[number, number]>([-95, -22]);
  const pointerRef = useRef<{ x: number; y: number } | null>(null); // where the cursor is, while it is over the globe
  const dragRef = useRef<{ x: number; y: number; r: [number, number]; moved: boolean } | null>(null);
  const hoverRef = useRef<string | null>(null);

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
    const ro = new ResizeObserver(([entry]) => setSize(Math.max(240, Math.min(520, Math.floor(entry.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const projection = useMemo(() => geoOrthographic().clipAngle(90), []);
  const graticule = useMemo(() => geoGraticule10(), []);
  // Only countries the feed can name (or the U.S.) can be hovered or pressed.
  const hittable = useMemo(() => (world ? world.countries.filter((c) => codeFor(c.id) !== null) : []), [world]);

  // Dot colour for each country, from this month's counts.
  const colorFor = useCallback(
    (id: number): string => {
      if (id === US_ID) return HOME;
      const code = codeFor(id);
      if (!code) return OTHER;
      if (code === activeCountry) return SELECTED;
      if (code === hoverRef.current) return HOVERED;
      const n = counts.get(code) ?? 0;
      return n > 0 ? GLOBE_RAMP[stepFor(n, max) - 1] : QUIET;
    },
    [counts, max, activeCountry],
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

    const r = size / 2 - 4;
    projection
      .scale(r)
      .translate([size / 2, size / 2])
      .rotate([rotation.current[0], rotation.current[1]]);
    const path = geoPath(projection, ctx);

    // Ocean and rim.
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Graticule.
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.75;
    ctx.stroke();

    // Country outlines: faint everywhere, strong on the countries the feed names.
    ctx.beginPath();
    for (const c of world.countries) path(c);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // A gentle wash over the country under the cursor, and a warmer one on the chosen country.
    const wash = (code: string | null, fill: string, stroke: string, width: number) => {
      if (!code) return;
      ctx.beginPath();
      for (const c of hittable) if (codeFor(c.id) === code) path(c);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    if (hoverRef.current !== activeCountry) wash(hoverRef.current, 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.9)', 1.4);
    wash(activeCountry, 'rgba(251,146,60,0.2)', SELECTED, 1.8);

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
  }, [world, size, projection, graticule, hittable, activeCountry, colorFor]);

  // Redraw whenever the data, size or selection changes.
  useEffect(() => draw(), [draw]);

  // Turn slowly until the visitor touches it or picks a country (never, if they asked for less motion).
  useEffect(() => {
    if (!world || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (!dragRef.current && !activeCountry && !document.hidden) {
        // Slower under the cursor so a country can be read and pressed as it passes.
        const speed = pointerRef.current ? 0.0028 : 0.008;
        rotation.current = [rotation.current[0] + (now - last) * speed, rotation.current[1]];
        const p = pointerRef.current;
        if (p) {
          const code = hitTest(p.x, p.y);
          if (code !== hoverRef.current) {
            hoverRef.current = code;
            setHover(code);
          }
        }
        draw();
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // hitTest is stable enough for this loop; the loop restarts when the world or selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, activeCountry, draw]);

  // Bring a chosen country to the front (from the list, or after pressing it).
  useEffect(() => {
    if (!world || !activeCountry) return;
    // "The European Union" has no outline of its own, so bring Germany forward for it.
    const id =
      activeCountry === 'EU'
        ? 276
        : Object.keys(ID_TO_CODE)
            .map(Number)
            .find((k) => ID_TO_CODE[k] === activeCountry);
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

  const hitTest = (clientX: number, clientY: number): string | null => {
    const cv = canvas.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const at = projection.invert?.([((clientX - rect.left) / rect.width) * size, ((clientY - rect.top) / rect.height) * size]);
    if (!at) return null;
    for (const c of hittable) if (geoContains(c, at)) return codeFor(c.id);
    return null;
  };

  const say = (code: string) => {
    const n = counts.get(code) ?? 0;
    return `${COUNTRY_LABELS[code] ?? code}: ${n === 0 ? 'no U.S. actions' : `${n} U.S. ${n === 1 ? 'action' : 'actions'}`} in the last 30 days`;
  };
  const shown = hover ?? activeCountry;

  return (
    <div className="min-w-0">
      <div ref={wrap} className="mx-auto w-full min-w-0 max-w-[520px]">
        <canvas
          ref={canvas}
          role="img"
          aria-label="Globe of countries named in recent U.S. trade actions. Use the country list below to choose one."
          style={{ width: size, height: size, cursor: hover ? 'pointer' : dragRef.current ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
          className="mx-auto block select-none"
          onPointerLeave={() => {
            pointerRef.current = null;
            dragRef.current = null;
            hoverRef.current = null;
            setHover(null);
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
            const code = hitTest(e.clientX, e.clientY);
            if (code !== hoverRef.current) {
              hoverRef.current = code;
              setHover(code);
              draw(); // repaint the wash at once, even when the globe is standing still
            }
          }}
          onPointerUp={(e) => {
            const d = dragRef.current;
            dragRef.current = null;
            if (d && !d.moved) {
              const code = hitTest(e.clientX, e.clientY);
              if (code) onSelect(code);
            }
          }}
        />
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1.5rem] text-center text-sm font-medium text-white">
        {shown ? say(shown) : world ? 'Move over a country to see its count. Press it for details. Drag to turn the globe.' : 'Loading the globe…'}
      </p>
      <p className="mt-1 flex items-center justify-center gap-2 text-xs text-[#b4b4bc]" aria-hidden="true">
        Fewer
        <span className="flex gap-1">
          {GLOBE_RAMP.map((c) => (
            <span key={c} className="h-2.5 w-4 rounded-sm" style={{ background: c }} />
          ))}
        </span>
        actions
      </p>
    </div>
  );
}
