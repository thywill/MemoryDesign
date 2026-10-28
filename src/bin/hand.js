import { N, colX } from "./constants.js";
import { store, travel, camX } from "./store.js";
import { openRecord, putBack, takeRecord } from "./actions.js";
import { player } from "./player.js";
import { sfx } from "./sound.js";

// The laptop is the bin. A phone sends small JSON messages through a public relay.
// This module turns those into the same actions the mouse uses.
const KEY = "lowlamp-screen-delay";
const HOTSPOT = "Couldn't reach the phone. Try a phone hotspot.";

const listeners = new Set();
let snap = { phase: "idle", code: "", url: "", status: "", delay: readDelay() };

let client = null;
let topics = null;
let phoneHere = false;
let failTimer = 0;
let wantClose = false;

const controls = new Map();
const heights = new Map();
let racks = [];
let col = 0;
let tier = 0;
let cursor = 0;
let acrossCarry = 0;
let flowAt = 0;
let driftAt = 0;
let driving = false;

export function phoneZoomed() {
  return phoneHere;
}

export function phoneCrateId() {
  return driving ? crateAt()?.id ?? null : null;
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
  racks = wall.map((p) => ({
    front: p.crates.find((c) => c.tier === 0) || p.crates[0],
    back: p.crates.find((c) => c.tier === 1) || null,
  }));
}

function crateAt() {
  const rack = racks[col];
  if (!rack) return null;
  return tier === 1 && rack.back ? rack.back : rack.front;
}

function pile(crate) {
  return Math.min(N, crate?.recs?.length || 0);
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

function secretKey() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function controllerUrl(code, key) {
  const url = new URL(`${import.meta.env.BASE_URL}controller.html`, location.origin);
  url.searchParams.set("room", code);
  url.searchParams.set("k", key);
  return url.href;
}

function publishPhone(msg) {
  if (!client?.connected || !topics) return;
  client.publish(topics.toPhone, JSON.stringify(msg));
}

function clampTravel(v) {
  return Math.max(travel.min, Math.min(travel.max, v));
}

function columnNear(x) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < racks.length; i++) {
    const d = Math.abs(colX(i) - x);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function leave(crate) {
  if (crate) controls.get(crate.id)?.(-1, 0);
}

function activate(crate, h) {
  if (!crate) return;
  driving = true;
  heights.set(crate.id, h);
  controls.get(crate.id)?.(h, 0);
}

function glide() {
  travel.target = clampTravel(colX(col));
  if (!store.get().moved) store.set({ moved: true });
}

// One sleeve deeper, then the back row, then the next rack. Backing up reverses that.
function stepSleeve(dir) {
  if (store.get().inspect || store.get().placing) return;
  const from = crateAt();
  if (!from) return;
  const len = pile(from);
  if (!len) return;
  const h = heights.get(from.id) ?? 0;
  const deeper = dir > 0;
  if (deeper && h < len - 1) { activate(from, h + 1); return; }
  if (!deeper && h > 0) { activate(from, h - 1); return; }
  let nextCol = col;
  let nextTier = tier;
  if (deeper) {
    if (tier === 0 && racks[col]?.back) nextTier = 1;
    else if (col < racks.length - 1) { nextCol = col + 1; nextTier = 0; }
    else return;
  } else if (tier === 1) nextTier = 0;
  else if (col > 0) { nextCol = col - 1; nextTier = racks[col - 1]?.back ? 1 : 0; }
  else return;
  leave(from);
  col = nextCol;
  tier = nextTier;
  const landed = crateAt();
  const n = pile(landed);
  activate(landed, deeper ? 0 : Math.max(0, n - 1));
  glide();
}

function stepRack(dir) {
  if (!racks.length) return;
  const from = crateAt();
  if (dir < 0 && tier === 1) {
    leave(from);
    tier = 0;
    if (!store.get().inspect && !store.get().placing) activate(crateAt(), heights.get(crateAt()?.id) ?? 0);
    return;
  }
  const next = col + (dir < 0 ? -1 : 1);
  if (next < 0 || next >= racks.length) return;
  leave(from);
  col = next;
  tier = 0;
  if (!store.get().inspect && !store.get().placing) activate(crateAt(), heights.get(crateAt()?.id) ?? 0);
  glide();
}

function sequence() {
  const rack = racks[col];
  if (!rack) return [];
  const out = [];
  const push = (crate, t) => {
    if (!crate) return;
    const n = pile(crate);
    for (let h = 0; h < n; h++) out.push({ crate, h, tier: t });
  };
  push(rack.front, 0);
  push(rack.back, 1);
  return out;
}

function showSpot(spot) {
  if (!spot) return;
  const prev = crateAt();
  if (prev && prev.id !== spot.crate.id) leave(prev);
  tier = spot.tier;
  activate(spot.crate, spot.h);
}

// Screen-up: forward motion walks the sleeves, sideways steps to the next rack in the frame.
function flowMove(along, across) {
  if (store.get().inspect || store.get().placing) return;
  const now = performance.now();
  const dt = Math.min(0.09, flowAt ? (now - flowAt) / 1000 : 0.05);
  flowAt = now;
  const seq = sequence();
  if (!seq.length) return;
  cursor = Math.max(0, Math.min(seq.length - 1, cursor + along * 2.6 * dt));
  showSpot(seq[Math.round(cursor)]);
  acrossCarry += across * dt;
  const step = acrossCarry > 0.48 ? 1 : acrossCarry < -0.48 ? -1 : 0;
  if (!step) return;
  acrossCarry = 0;
  const before = col;
  stepRack(step);
  if (col === before) return;
  const seq2 = sequence();
  cursor = step > 0 ? 0 : Math.max(0, seq2.length - 1);
  showSpot(seq2[Math.round(cursor)]);
}

// On its edge: slide with the phone and the camera follows that same direction.
function driftMove(v) {
  if (store.get().inspect || store.get().placing) return;
  const now = performance.now();
  const dt = Math.min(0.09, driftAt ? (now - driftAt) / 1000 : 0.05);
  driftAt = now;
  travel.target = clampTravel(travel.target + v * 1.25 * dt);
  if (!store.get().moved) store.set({ moved: true });
  const near = columnNear(travel.target);
  if (near === col) return;
  leave(crateAt());
  col = near;
  tier = 0;
  const seq = sequence();
  cursor = 0;
  showSpot(seq[0]);
}

function greet() {
  if (!store.get().inspect && !store.get().placing && racks.length) {
    col = columnNear(camX.v || travel.target);
    tier = 0;
    cursor = heights.get(crateAt()?.id) ?? 0;
    activate(crateAt(), cursor);
  }
}

function sendHeld(rec) {
  if (!rec) return;
  const c = rec.c;
  publishPhone({
    type: "held",
    id: rec.id,
    title: c.title,
    artist: c.artist,
    color: c.color,
    front: typeof c.front === "string" ? c.front : null,
    back: typeof c.back === "string" ? c.back : null,
  });
}

function apply(msg) {
  if (!msg || typeof msg !== "object") return;
  // Wrist angle used to drag the camera. Rack changes are explicit, so a tilt can dig without sliding the shop.
  if (msg.type === "pan" || msg.type === "lean") return;
  if (msg.type === "flow") { flowMove(Number(msg.along) || 0, Number(msg.across) || 0); return; }
  if (msg.type === "drift") { driftMove(Number(msg.v) || 0); return; }
  if (msg.type === "sweep" || msg.type === "rack") { stepRack(Number(msg.dir) < 0 ? -1 : 1); return; }
  if (msg.type === "flip") { stepSleeve(Number(msg.dir) < 0 ? -1 : 1); return; }
  if (msg.type === "turn") {
    if (!store.get().inspect) return;
    const back = !!msg.back;
    if (!!store.get().flipped === back) return;
    sfx("slide");
    store.set({ flipped: back });
    return;
  }
  if (msg.type === "inspect") {
    const crate = crateAt();
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
      const crate = crateAt();
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

function attachRelay(relay) {
  client = relay.client;
  topics = relay.topics;
  phoneHere = false;
  clearTimeout(failTimer);
  failTimer = setTimeout(() => {
    if (!client?.connected && snap.phase !== "connected") publish({ phase: "error", status: HOTSPOT });
  }, 8000);
  client.on("connect", () => {
    clearTimeout(failTimer);
    client.subscribe(topics.toShop);
    if (!phoneHere) publish({ phase: "waiting", status: "Waiting for phone…" });
  });
  client.on("message", (_topic, payload) => {
    const msg = readMessage(payload);
    if (!msg) return;
    if (msg.type === "hello") {
      phoneHere = true;
      greet();
      publishPhone({ type: "ack" });
      publish({ phase: "connected", status: "Phone connected" });
      return;
    }
    accept(msg);
  });
  client.on("error", () => {
    if (!phoneHere) publish({ phase: "error", status: HOTSPOT });
  });
  client.on("close", () => {
    if (wantClose) return;
    if (phoneHere) {
      phoneHere = false;
      publish({ phase: "disconnected", status: "Phone disconnected" });
    }
  });
}

function readMessage(payload) {
  const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
  try { return JSON.parse(text); } catch { return null; }
}

export async function startPhone() {
  if (client) return;
  wantClose = false;
  const { openRelay } = await import("../relay.js");
  const code = roomCode();
  const key = secretKey();
  publish({ phase: "waiting", code, url: controllerUrl(code, key), status: "Waiting for phone…", delay: readDelay() });
  attachRelay(openRelay(key));
}

export function disconnectPhone() {
  wantClose = true;
  clearTimeout(failTimer);
  try { client?.end(true); } catch { /* already gone */ }
  client = null;
  topics = null;
  phoneHere = false;
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
