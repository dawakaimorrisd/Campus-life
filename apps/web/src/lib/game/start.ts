import type { Profile } from '$lib/profile';

/**
 * Mounts the 3D campus inside `parent` and returns a cleanup function.
 * If this phone cannot run WebGL, or the 3D view fails to start, a short message is shown instead.
 */
export function startGame(parent: HTMLElement, profile: Profile): () => void {
  let stop: (() => void) | null = null;
  let disposed = false;

  const fail = (why: string) => {
    parent.replaceChildren();
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#fff;background:#151a38;font:700 16px/1.4 system-ui,sans-serif';
    d.textContent = why;
    parent.appendChild(d);
  };

  (async () => {
    try {
      const m = await import('../game3d/Campus3D');
      if (disposed) return;
      stop = m.startCampus3D(parent, profile, (e) => {
        console.warn('[3d] could not start:', e);
        stop?.();
        stop = null;
        if (!disposed) fail('The campus needs WebGL. Please open it in an up-to-date Chrome, Safari or Firefox.');
      });
    } catch (e) {
      console.warn('[3d] could not start:', e);
      if (!disposed) fail('The campus could not start on this device. Please refresh, or try another browser.');
    }
  })();

  return () => {
    disposed = true;
    stop?.();
    stop = null;
  };
}
