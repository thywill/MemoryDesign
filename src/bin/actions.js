import { store, travel } from "./store.js";
import { sfx } from "./sound.js";
import { player } from "./player.js";

// Shared by the mouse, the keyboard, and the phone. The phone calls these; it does not reimplement them.
let lastPointer = 0;

export function notePointer() {
  lastPointer = performance.now();
}

// True while a drag, wheel, or arrow key is moving the camera, so a phone pan does not fight it.
export function pointerRecent() {
  return performance.now() - lastPointer < 500;
}

export function nudgeCamera(dx) {
  notePointer();
  travel.target = Math.max(travel.min, Math.min(travel.max, travel.target + dx));
  if (!store.get().moved) store.set({ moved: true });
}

export function openRecord(rec) {
  if (!rec) return;
  player.record = null;
  sfx("slide");
  store.set({ onPlayer: null, inspect: { rec }, flipped: false, closing: false, out: false, hover: null, placing: false });
}

export function putBack() {
  store.set({ closing: true, placing: false });
}

export function takeRecord() {
  const rec = store.get().inspect?.rec;
  if (!rec) return;
  const taken = store.get().taken;
  if (taken.length >= 3 || taken.some((r) => r.id === rec.id)) return;
  store.set({ taken: [...taken, rec] });
}
