import { useEffect, useRef } from 'react';
import { geoOrthographic, geoPath, geoGraticule, geoBounds, geoDistance } from 'd3-geo';
import { timer } from 'd3-timer';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

// Real lanes from this app's own seeded sample cases (not decorative stock
// coordinates): the USMCA/Section 338 case (Toronto), the clean-pass apple
// import (Gothenburg), and the export license-required case (St. Petersburg),
// all routed through the US entry point the classification/duty-stack
// examples assume. [lng, lat] order, matching d3-geo's convention.
const HUB: Position = [-118.24, 34.05]; // Los Angeles / Long Beach
const SPOKES: Position[] = [
  [-79.38, 43.65], // Toronto, CA
  [11.97, 57.71], // Gothenburg, SE
  [30.34, 59.93], // St. Petersburg, RU
];

function pointInRing(point: Position, ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInFeature(point: Position, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates;
    if (!pointInRing(point, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) if (pointInRing(point, rings[i])) return false;
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const rings of geometry.coordinates) {
      if (!pointInRing(point, rings[0])) continue;
      let inHole = false;
      for (let i = 1; i < rings.length; i++) {
        if (pointInRing(point, rings[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

// A dotted halftone fill for every land feature, sampled once at module load
// -- the bundled outline never changes, so every mount of <Globe /> reuses
// this instead of resampling ~127 polygons on every page visit.
function buildLandDots(fc: FeatureCollection, spacingDeg = 1.3): Position[] {
  const dots: Position[] = [];
  for (const feature of fc.features as Feature[]) {
    if (!feature.geometry) continue;
    const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(feature);
    for (let lng = minLng; lng <= maxLng; lng += spacingDeg) {
      for (let lat = minLat; lat <= maxLat; lat += spacingDeg) {
        if (pointInFeature([lng, lat], feature.geometry)) dots.push([lng, lat]);
      }
    }
  }
  return dots;
}

// The land outline (~200KB) is fetched as its own chunk on demand rather
// than inlined into the main bundle, and the sampled dot set is cached at
// module scope so a second mount (e.g. navigating back to "/") is instant.
let cachedDots: Position[] | null = null;
let dotsPromise: Promise<Position[]> | null = null;
function loadLandDots(): Promise<Position[]> {
  if (cachedDots) return Promise.resolve(cachedDots);
  if (!dotsPromise) {
    dotsPromise = import('../data/land-110m.json').then((mod) => {
      const fc = (mod.default ?? mod) as unknown as FeatureCollection;
      cachedDots = buildLandDots(fc);
      return cachedDots;
    });
  }
  return dotsPromise;
}

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const canvasEl = canvas;
    const ctx = context;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Strict black-and-white instrument, with exactly one accent (a stamped-
    // ink amber) reserved for the trade lanes -- everything else on the page
    // stays greyscale, so this is the one place color appears.
    const colors = {
      sphere: '#0d0d0c',
      outline: 'rgba(240, 238, 232, 0.4)',
      graticule: 'rgba(240, 238, 232, 0.12)',
      dot: 'rgba(240, 238, 232, 0.55)',
      accent: '#c9862f',
    };

    const projection = geoOrthographic().clipAngle(90).precision(0.3);
    const path = geoPath(projection, ctx);
    const graticuleLines = geoGraticule().step([15, 15])();
    const arcs = SPOKES.map((to) => ({ type: 'LineString' as const, coordinates: [HUB, to] }));

    let rotation: [number, number] = [19, -25]; // Atlantic-facing start, hub + all three spokes in view
    let width = 0;
    let height = 0;
    let landDots: Position[] = [];

    function isFront(point: Position): boolean {
      const center: [number, number] = [-rotation[0], -rotation[1]];
      return geoDistance(point as [number, number], center) < Math.PI / 2;
    }

    function resize() {
      const box = canvasEl.getBoundingClientRect();
      width = box.width;
      height = box.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = width * dpr;
      canvasEl.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const radius = Math.min(width, height) / 2 - 1.5;
      projection.scale(radius).translate([width / 2, height / 2]);
      render();
    }

    function render() {
      ctx.clearRect(0, 0, width, height);
      projection.rotate(rotation);
      const [cx, cy] = projection.translate();
      const r = projection.scale();

      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.fillStyle = colors.sphere;
      ctx.fill();

      // Mild shine -- a soft specular highlight offset toward the upper
      // left, the way a lit physical object (not a glowing UI element) picks
      // up light. Drawn once per frame as a radial gradient, not a CSS glow.
      const shine = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.05, cx - r * 0.1, cy - r * 0.1, r * 1.15);
      shine.addColorStop(0, 'rgba(255, 253, 246, 0.16)');
      shine.addColorStop(0.5, 'rgba(255, 253, 246, 0.04)');
      shine.addColorStop(1, 'rgba(255, 253, 246, 0)');
      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.fillStyle = shine;
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.outline;
      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.stroke();

      ctx.beginPath();
      path(graticuleLines);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = colors.graticule;
      ctx.stroke();

      // Halftone land dots -- one accumulated path + one fill(), not one
      // draw call per dot (the visible set still runs into the thousands).
      ctx.beginPath();
      const dotRadius = Math.max(0.7, width / 420);
      for (const p of landDots) {
        if (!isFront(p)) continue;
        const projected = projection(p as [number, number]);
        if (!projected) continue;
        const [x, y] = projected;
        ctx.moveTo(x + dotRadius, y);
        ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
      }
      ctx.fillStyle = colors.dot;
      ctx.fill();

      // Lanes + endpoints -- the one deliberate touch of color.
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = colors.accent;
      ctx.globalAlpha = 0.85;
      for (const arc of arcs) {
        ctx.beginPath();
        path(arc);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = colors.accent;
      for (const p of [HUB, ...SPOKES]) {
        if (!isFront(p)) continue;
        const projected = projection(p as [number, number]);
        if (!projected) continue;
        const [x, y] = projected;
        const markerR = p === HUB ? dotRadius * 2.6 : dotRadius * 2;
        ctx.beginPath();
        ctx.arc(x, y, markerR, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    let destroyed = false;
    const rotationTimer = timer(() => {
      if (destroyed || dragging || reduceMotion) return;
      rotation = [rotation[0] + 0.12, rotation[1]];
      render();
    });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvasEl.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      rotation = [rotation[0] + dx * 0.35, Math.max(-80, Math.min(80, rotation[1] - dy * 0.35))];
      render();
    }
    function onPointerUp(e: PointerEvent) {
      dragging = false;
      canvasEl.releasePointerCapture(e.pointerId);
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const current = projection.scale();
      const baseline = Math.min(width, height) / 2 - 1.5;
      const next = Math.max(baseline * 0.65, Math.min(baseline * 1.8, current * (e.deltaY > 0 ? 0.92 : 1.08)));
      projection.scale(next);
      render();
    }

    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('pointercancel', onPointerUp);
    canvasEl.addEventListener('wheel', onWheel, { passive: false });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasEl);
    resize();

    loadLandDots().then((dots) => {
      if (destroyed) return;
      landDots = dots;
      render();
    });

    return () => {
      destroyed = true;
      rotationTimer.stop();
      resizeObserver.disconnect();
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      canvasEl.removeEventListener('pointermove', onPointerMove);
      canvasEl.removeEventListener('pointerup', onPointerUp);
      canvasEl.removeEventListener('pointercancel', onPointerUp);
      canvasEl.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div className="aspect-square w-full cursor-grab touch-none active:cursor-grabbing">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} aria-hidden="true" />
    </div>
  );
}
