import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

// For a horizontally scrolling tab row: fades whichever edge still has hidden tabs (so a clipped tab never looks
// like a rendering fault) and keeps the selected tab in view. `activeKey` is whatever identifies the selected tab.
export function useScrollCue(activeKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  useEffect(() => {
    const el = ref.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && tab && el.scrollWidth > el.clientWidth) {
      const left = tab.offsetLeft - 24;
      const right = tab.offsetLeft + tab.offsetWidth + 24;
      if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left);
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
    }
    measure();
  }, [activeKey, measure]);
  const stops = `${more.left ? 'transparent, black 40px' : 'black, black'}, ${more.right ? 'black calc(100% - 48px), transparent' : 'black, black'}`;
  const style: CSSProperties | undefined =
    more.left || more.right ? { maskImage: `linear-gradient(to right, ${stops})`, WebkitMaskImage: `linear-gradient(to right, ${stops})` } : undefined;
  return { ref, style, onScroll: measure };
}
