import { N, colX } from "./constants.js";
import { store, travel } from "./store.js";
import { openRecord, putBack, takeRecord, pointerRecent } from "./actions.js";
import { player } from "./player.js";

// The laptop is the bin. A phone connects with PeerJS (public broker, no server of our own)
// and sends small JSON messages. This module turns those into the same actions the mouse uses.
const KEY = "lowlamp-screen-delay";
const HOTSPOT = "Couldn't reach the phone. Try a phone hotspot.";

const listeners = new Set();
let snap = { phase: "idle", code: "", url: "", status: "", delay: readDelay() };

let peer = null;
let conn = null;
let generation = 0;
let failTimer = 0;
let wantClose = false;

const controls = new Map();
const heights = new Map();
let columns = [];
let col = 0;
let lean = 0;
let driving = false;

export function phoneCrateId() {
  return driving ? columns[col]?.id ?? null : null;
}

function readDelay() {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function publish(partial) {
  snap = { ...snap, ...partial };
  listeners.forEach((l) => l());
}

export function getPhoneSnap() {
  return snap;
}

export function subscribePhone(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function registerCrate(id, setH) {
  controls.set(id, setH);
  return () => { if (controls.get(id) === setH) controls.delete(id); };
}

export function bindWall(wall) {
  columns = wall.map((p) => p.crates.find((c) => c.tier === 0) || p.crates[0]);
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

function controllerUrl(code) {
  return new URL(`${import.meta.env.BASE_URL}controller.html?room=${code}`, location.origin).href;
}

function clampTravel(v) {
  return Math.max(travel.min, Math.min(travel.max, v));
}

function focus(i) {
  if (!columns.length) return;
  driving = true;
  i = Math.max(0, Math.min(columns.length - 1, i));
  if (i !== col) {
    const prev = columns[col];
    if (prev) controls.get(prev.id)?.(-1, 0);
    col = i;
  }
  const crate = columns[col];
  controls.get(crate.id)?.(heights.get(crate.id) ?? 0, lean);
}

function columnNear(x) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < columns.length; i++) {
    const d = Math.abs(colX(i) - x);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function sendHeld(rec) {
  if (!conn?.open || !rec) return;
  const c = rec.c;
  conn.send({
    type: "held",
    id: rec.id,
    title: c.title,
    artist: c.artist,
    color: c.color,
    front: typeof c.front === "string" ? c.front : null,
  });
}

function apply(msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "pan") {
    if (pointerRecent()) return;
    const x = Math.max(-1, Math.min(1, Number(msg.x) || 0));
    travel.target = clampTravel(travel.min + ((x + 1) / 2) * (travel.max - travel.min));
    if (!store.get().moved) store.set({ moved: true });
    if (!store.get().inspect && !store.get().placing) focus(columnNear(travel.target));
    return;
  }
  if (msg.type === "sweep") {
    const next = Math.max(0, Math.min(columns.length - 1, col + (Number(msg.dir) < 0 ? -1 : 1)));
    if (!pointerRecent()) {
      travel.target = clampTravel(colX(next));
      if (!store.get().moved) store.set({ moved: true });
    }
    if (!store.get().inspect) focus(next);
    else col = next;
    return;
  }
  if (msg.type === "flip") {
    if (store.get().inspect) return;
    driving = true;
    const crate = columns[col];
    if (!crate) return;
    const h = Math.max(0, Math.min(N - 1, (heights.get(crate.id) ?? 0) + (Number(msg.dir) < 0 ? -1 : 1)));
    heights.set(crate.id, h);
    controls.get(crate.id)?.(h, lean);
    return;
  }
  if (msg.type === "lean") {
    driving = true;
    lean = Math.max(-1, Math.min(1, Number(msg.v) || 0));
    if (store.get().inspect) return;
    const crate = columns[col];
    if (!crate) return;
    controls.get(crate.id)?.(heights.get(crate.id) ?? 0, lean);
    return;
  }
  if (msg.type === "inspect") {
    const crate = columns[col];
    const rec = crate?.recs[heights.get(crate.id) ?? 0];
    openRecord(rec);
    sendHeld(rec);
    return;
  }
  if (msg.type === "take") { takeRecord(); return; }
  if (msg.type === "putback") { putBack(); return; }
  if (msg.type === "place") {
    let rec = store.get().inspect?.rec;
    if (!rec) {
      const crate = columns[col];
      rec = crate?.recs[heights.get(crate.id) ?? 0];
      if (rec) openRecord(rec);
    }
    if (!rec) return;
    travel.target = travel.max;
    if (!store.get().moved) store.set({ moved: true });
    store.set({ placing: true });
    return;
  }
  if (msg.type === "lift") {
    const rec = player.record;
    if (!rec) return;
    openRecord(rec);
    sendHeld(rec);
  }
}

function accept(data) {
  let msg = data;
  if (typeof data === "string") {
    try { msg = JSON.parse(data); } catch { return; }
  }
  const wait = Math.max(0, readDelay());
  if (wait === 0) apply(msg);
  else setTimeout(() => apply(msg), wait);
}

function watchConnection(c) {
  if (conn && conn !== c) conn.close();
  conn = c;
  c.on("open", () => {
    clearTimeout(failTimer);
    publish({ phase: "connected", status: "Phone connected" });
  });
  c.on("data", accept);
  c.on("close", () => {
    if (conn === c) conn = null;
    if (wantClose) return;
    publish({ phase: "disconnected", status: "Phone disconnected" });
  });
  c.on("error", () => {
    if (snap.phase === "connected") publish({ phase: "disconnected", status: "Phone disconnected" });
    else publish({ phase: "error", status: HOTSPOT });
  });
}

function openPeer(Peer, code) {
  const gen = ++generation;
  wantClose = false;
  clearTimeout(failTimer);
  if (peer && !peer.destroyed) peer.destroy();
  peer = new Peer("lowlamp-" + code.toLowerCase());
  failTimer = setTimeout(() => {
    if (gen !== generation) return;
    if (!peer?.open && snap.phase !== "connected") publish({ phase: "error", status: HOTSPOT });
  }, 8000);
  peer.on("open", () => {
    if (gen !== generation) return;
    clearTimeout(failTimer);
    if (!conn?.open) publish({ phase: "waiting", status: "Waiting for phone…" });
  });
  peer.on("connection", (c) => { if (gen === generation) watchConnection(c); });
  peer.on("disconnected", () => {
    if (gen !== generation || wantClose) return;
    if (snap.phase === "connected") publish({ phase: "disconnected", status: "Phone disconnected" });
    try { peer.reconnect(); } catch { /* broker already coming back */ }
  });
  peer.on("error", (err) => {
    if (gen !== generation) return;
    if (err?.type === "unavailable-id") {
      const next = roomCode();
      publish({ code: next, url: controllerUrl(next), phase: "waiting", status: "Waiting for phone…" });
      openPeer(Peer, next);
      return;
    }
    if (snap.phase === "connected" || conn?.open) publish({ phase: "disconnected", status: "Phone disconnected" });
    else publish({ phase: "error", status: HOTSPOT });
  });
}

export async function startPhone() {
  if (peer && !peer.destroyed) return;
  const { default: Peer } = await import("peerjs");
  const code = roomCode();
  publish({ phase: "waiting", code, url: controllerUrl(code), status: "Waiting for phone…", delay: readDelay() });
  openPeer(Peer, code);
}

export function disconnectPhone() {
  wantClose = true;
  generation += 1;
  clearTimeout(failTimer);
  try { conn?.close(); } catch { /* already gone */ }
  try { peer?.destroy(); } catch { /* already gone */ }
  conn = null;
  peer = null;
  driving = false;
  publish({ phase: "idle", code: "", url: "", status: "" });
}

export function changeDelay(ms) {
  const next = Math.round(ms);
  try { localStorage.setItem(KEY, String(next)); } catch { /* private mode */ }
  publish({ delay: next });
}

export function applyRemote(msg) {
  apply(msg);
}
