import { useEffect, useMemo, useRef, useState } from 'react';

// The scenery behind the hero globe: faint trade routes between distant ports in both
// themes, plus a starfield in dark theme. It is atmosphere, not data -- the ports are
// invented points and carry no labels. The real, live routes are the arcs on the globe
// itself (PulseGlobe.tsx). Purely decorative (aria-hidden, no pointer events of its own).
//
// The geometry comes from a fixed seed, so it is identical on every visit and every page,
// and it is drawn once as static SVG. What moves: small "cargo" dots travelling the routes,
// a slow dash drift, a gentle twinkle on a few stars, and a soft spotlight that follows the
// cursor and brightens the routes under it. All motion pauses while the hero is scrolled
// out of view and is off entirely under reduced motion (index.css, "Hero backdrop").
// Colours come from CSS custom properties, so a theme switch needs no redraw.

const W = 1600;
const H = 1000;

// mulberry32: a tiny seeded generator, so the layout never changes between renders.
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Scene {
  arcs: { id: string; d: string; flow: boolean; carrier: boolean; dur: number; begin: number }[];
  nodes: { x: number; y: number; pulse: boolean }[];
  stars: { x: number; y: number; r: number; o: number; twinkle: boolean; delay: number }[];
}

function buildScene(): Scene {
  const rnd = seeded(20261008);
  const cx = W / 2;
  const cy = H / 2;
  const keepOut = 400; // the globe covers the middle; nothing is placed where it would be hidden

  const nodes: Scene['nodes'] = [];
  while (nodes.length < 15) {
    const x = rnd() * W;
    const y = 50 + rnd() * (H - 100);
    if (Math.hypot(x - cx, y - cy) < keepOut) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 120)) continue;
    nodes.push({ x, y, pulse: nodes.length % 4 === 0 });
  }

  const arcs: Scene['arcs'] = [];
  for (let i = 0; i < 26; i++) {
    const a = nodes[Math.floor(rnd() * nodes.length)];
    const b = nodes[Math.floor(rnd() * nodes.length)];
    if (a === b || Math.hypot(a.x - b.x, a.y - b.y) < 220) continue;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 70 - rnd() * 130;
    arcs.push({
      id: `hr-${i}`,
      d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
      flow: i % 3 === 0,
      carrier: arcs.length % 2 === 0, // every other route carries a travelling dot
      dur: 14 + rnd() * 14,
      begin: rnd() * 10,
    });
  }

  const stars: Scene['stars'] = [];
  for (let i = 0; i < 360; i++) {
    const big = rnd() < 0.06;
    stars.push({
      x: rnd() * W,
      y: rnd() * H,
      r: big ? 1.5 : 0.5 + rnd() * 0.6,
      o: 0.18 + rnd() * 0.62,
      twinkle: i % 9 === 0,
      delay: rnd() * 6,
    });
  }
  return { arcs, nodes, stars };
}

export function HeroBackdrop() {
  const scene = useMemo(buildScene, []);
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);

  // Motion only runs while the hero is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The travelling dots use SVG animation, which CSS cannot pause, so pause it directly --
  // also when the visitor prefers reduced motion.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof svg.pauseAnimations !== 'function') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (visible && !reduce) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [visible]);

  // A spotlight that follows the cursor over the hero: the container publishes the pointer
  // position as CSS variables and the bright copy of the routes is masked to a circle there.
  // Throttled to one update per frame; the container itself never takes pointer events.
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${px - box.left}px`);
      el.style.setProperty('--my', `${py - box.top}px`);
      el.classList.add('is-lit');
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const leave = () => el.classList.remove('is-lit');
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const routes = (cls: string) => (
    <g className={cls} fill="none">
      {scene.arcs.map((a) => (
        <path key={a.id} id={cls === 'hero-routes' ? a.id : undefined} d={a.d} className={a.flow ? 'hero-route hero-route-flow' : 'hero-route'} />
      ))}
    </g>
  );
  const ports = (
    <g className="hero-ports">
      {scene.nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r="2.8" className="hero-port" />
          <circle cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r="10" className={n.pulse ? 'hero-port-ring hero-port-pulse' : 'hero-port-ring'} fill="none" />
        </g>
      ))}
    </g>
  );

  return (
    <div ref={ref} aria-hidden="true" className={`hero-backdrop pointer-events-none absolute inset-0 -z-10 overflow-hidden ${visible ? '' : 'is-paused'}`}>
      <svg ref={svgRef} className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className="hero-stars">
          {scene.stars.map((s, i) => (
            <circle
              key={i}
              cx={s.x.toFixed(1)}
              cy={s.y.toFixed(1)}
              r={s.r}
              opacity={s.o.toFixed(2)}
              className={s.twinkle ? 'hero-twinkle' : undefined}
              style={s.twinkle ? { animationDelay: `${s.delay.toFixed(1)}s` } : undefined}
            />
          ))}
        </g>
        {routes('hero-routes')}
        {ports}
        <g className="hero-cargo">
          {scene.arcs
            .filter((a) => a.carrier)
            .map((a) => (
              <circle key={a.id} r="2.4" className="hero-cargo-dot">
                <animateMotion dur={`${a.dur.toFixed(1)}s`} begin={`${a.begin.toFixed(1)}s`} repeatCount="indefinite" rotate="auto">
                  <mpath href={`#${a.id}`} />
                </animateMotion>
              </circle>
            ))}
        </g>
      </svg>
      {/* The bright copy of the routes, revealed only around the cursor. */}
      <svg className="hero-lit absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        {routes('hero-routes-lit')}
        {ports}
      </svg>
      <div className="hero-horizon" />
    </div>
  );
}
