// Runs `load` every `everyMs` milliseconds, but only while the tab is visible, and once more as soon as a hidden tab comes back
// (so a tab left open overnight shows fresh numbers when read, without asking the server on every tick while nobody looks).
// Returns the cleanup function for useEffect.
export function pollWhileVisible(load: () => void, everyMs: number): () => void {
  let lastRun = Date.now();
  const run = () => {
    lastRun = Date.now();
    load();
  };
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') run();
  }, everyMs);
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRun >= everyMs) run();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
