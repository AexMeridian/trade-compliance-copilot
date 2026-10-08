import { useEffect, useRef, useState } from 'react';

// Live data for the globe's arcs: refreshed every five minutes while the tab is visible and
// the globe is on screen, from one small endpoint that the server and the edge both cache
// for five minutes (src/routes/pulse/live.ts), so this adds almost no load.

export interface LiveArcCountry {
  country: string;
  count: number;
  latest: { title: string; url: string; date: string; tag: string }[];
}
export interface LiveArcs {
  asOf: string;
  countries: LiveArcCountry[];
}

const REFRESH_MS = 5 * 60_000;
const FRESH_MS = 12_000; // how long a country keeps its "new action" ping

export function useLiveArcs(shouldPoll: () => boolean) {
  const [live, setLive] = useState<LiveArcs | null>(null);
  const lastCounts = useRef<Map<string, number> | null>(null);
  const lastFetch = useRef(0);
  /** country code -> time (ms) until which a "new action" ping should show */
  const freshUntil = useRef(new Map<string, number>());
  const poll = useRef(shouldPoll);
  poll.current = shouldPoll;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      lastFetch.current = Date.now();
      try {
        const res = await fetch('/api/pulse/live-arcs');
        if (!res.ok) return;
        const data = (await res.json()) as LiveArcs;
        if (cancelled) return;
        const prev = lastCounts.current;
        const next = new Map(data.countries.map((c) => [c.country, c.count]));
        if (prev) {
          for (const [code, count] of next) {
            if (count > (prev.get(code) ?? 0)) freshUntil.current.set(code, Date.now() + FRESH_MS);
          }
        }
        lastCounts.current = next;
        setLive(data);
      } catch {
        // Offline or the API is down: keep showing what we already have.
      }
    }

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && poll.current()) void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && poll.current() && Date.now() - lastFetch.current >= REFRESH_MS) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { live, freshUntil };
}
