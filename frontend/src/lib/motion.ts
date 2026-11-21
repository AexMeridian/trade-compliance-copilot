import { useEffect, useState } from 'react';

// One site-wide "pause motion" switch (WCAG 2.2.2): the ticker, the globes and the starfield twinkle all stop while it is on.
// The state lives on <html data-motion="paused"> so CSS and the globe loop can read it without prop plumbing; the choice is
// remembered in localStorage (best effort) and the system "reduce motion" setting already stops all of these by itself.
const KEY = 'motion';
export const MOTION_EVENT = 'aex-motion-change';

export const motionPaused = (): boolean => document.documentElement.getAttribute('data-motion') === 'paused';

export function setMotionPaused(paused: boolean): void {
  if (paused) document.documentElement.setAttribute('data-motion', 'paused');
  else document.documentElement.removeAttribute('data-motion');
  try {
    if (paused) localStorage.setItem(KEY, 'paused');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
  window.dispatchEvent(new Event(MOTION_EVENT));
}

export function restoreMotionChoice(): void {
  try {
    if (localStorage.getItem(KEY) === 'paused') document.documentElement.setAttribute('data-motion', 'paused');
  } catch {
    /* ignore */
  }
}

export function useMotionPaused(): boolean {
  const [paused, setPaused] = useState(motionPaused);
  useEffect(() => {
    const sync = () => setPaused(motionPaused());
    sync();
    window.addEventListener(MOTION_EVENT, sync);
    return () => window.removeEventListener(MOTION_EVENT, sync);
  }, []);
  return paused;
}

// True once the browser has had a chance to paint and is idle (or after `timeout` ms regardless): used to start heavy
// below-the-fold or decorative work, such as the home globe, after the first paint instead of competing with it.
export function useAfterPaint(timeout = 1500): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, [timeout]);
  return ready;
}
