import { useSyncExternalStore } from "react";

// A tiny store for what the HUD needs to know about.
export const store = (() => {
  let s = { hover: null, hoverCrate: null, inspect: null, flipped: false, closing: false, moved: false, progress: 0, out: false, sound: true, request: null, taken: [], onPlayer: null, placing: false };
  const ls = new Set();
  return {
    get: () => s,
    set: (p) => { s = { ...s, ...p }; ls.forEach((l) => l()); },
    sub: (l) => { ls.add(l); return () => ls.delete(l); },
  };
})();
export const useStore = (sel) => useSyncExternalStore(store.sub, () => sel(store.get()));

// Per-frame state shared between components, kept out of React.
export const registry = new Map();      // record id -> mesh (for the close-up animation)
export const noRay = () => {};          // used to switch picking off
export const clock = { t: 0 };
export const dragging = { v: false };
export const camX = { v: 0 };
export const travel = { target: 0, min: 0, max: 0 };
export const started = { v: false };
export const pointerN = { x: 0, y: 0 };
