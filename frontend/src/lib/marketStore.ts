import { useEffect, useState } from 'react';
import { getPulseMarkets } from './api';
import type { PulseMarkets } from '../types/pulse';

// One copy of the market data for the whole page. The Pulse page already receives it inside its single /home
// call and publishes it here, so the market strip in the header shows the same numbers without a second
// request. On pages that don't load it (every page except Pulse), the strip waits a moment and fetches it
// itself, once. Nothing here is estimated: it is whatever the API returned.
let current: PulseMarkets | null = null;
const listeners = new Set<(m: PulseMarkets) => void>();

export function publishMarkets(m: PulseMarkets): void {
  current = m;
  listeners.forEach((fn) => fn(m));
}

export function useSharedMarkets(fetchAfterMs = 1500, pollMs = 0): PulseMarkets | null {
  const [markets, setMarkets] = useState<PulseMarkets | null>(current);
  useEffect(() => {
    listeners.add(setMarkets);
    let timer: number | undefined;
    if (!current) {
      timer = window.setTimeout(() => {
        if (!current) getPulseMarkets().then(publishMarkets).catch(() => {});
      }, fetchAfterMs);
    }
    // Keep the numbers current while the page stays open (the Pulse page does this itself and publishes here).
    // Only while the tab is visible: a background tab nobody is reading should not keep reading the database.
    const poll =
      pollMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible') getPulseMarkets().then(publishMarkets).catch(() => {});
          }, pollMs)
        : undefined;
    return () => {
      listeners.delete(setMarkets);
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [fetchAfterMs, pollMs]);
  return markets;
}
