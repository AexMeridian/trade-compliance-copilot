import { useEffect, useMemo, useRef, useState } from 'react';

// The scenery behind the hero globe: in dark theme, a starfield with a soft horizon glow.
// Light theme has no backdrop (the globe sits on the plain hero colour). Purely decorative
// (aria-hidden, no pointer events). The stars come from a fixed seed, so the sky is the same
// on every visit and every page; they are static SVG with a gentle twinkle on a few of them,
// paused while the hero is scrolled out of view and off entirely under reduced motion
// (index.css, "Hero backdrop"). Visibility by theme is CSS, so a theme switch needs no redraw.

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

function buildStars() {
  const rnd = seeded(20261008);
  return Array.from({ length: 360 }, (_, i) => {
    const big = rnd() < 0.06;
    return {
      x: rnd() * W,
      y: rnd() * H,
      r: big ? 1.5 : 0.5 + rnd() * 0.6,
      o: 0.18 + rnd() * 0.62,
      twinkle: i % 9 === 0,
      delay: rnd() * 6,
    };
  });
}

export function HeroBackdrop() {
  const stars = useMemo(buildStars, []);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Twinkling only runs while the hero is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className={`hero-backdrop pointer-events-none absolute inset-0 -z-10 overflow-hidden ${visible ? '' : 'is-paused'}`}>
      <svg className="hero-stars absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        {stars.map((s, i) => (
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
      </svg>
      <div className="hero-horizon" />
    </div>
  );
}
