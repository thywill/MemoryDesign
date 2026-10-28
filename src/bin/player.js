import { store } from "./store.js";
import { crackle } from "./sound.js";

// The turntable. play() drops the needle; stop() lifts it. There is no streamed audio yet.
export const player = {
  record: null,
  play(record) {
    this.record = record;
    crackle();
    store.set({ onPlayer: record, inspect: null, placing: false, closing: false, flipped: false, out: false });
  },
  stop() {
    this.record = null;
    store.set({ onPlayer: null });
  },
};
