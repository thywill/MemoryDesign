import { openRelay, readMessage } from "./relay.js";

const params = new URLSearchParams(location.search);
const room = params.get("room");
const key = params.get("k");
const linkEl = document.getElementById("link");
const hintEl = document.getElementById("hint");
const liveEl = document.getElementById("live");
const sleeveEl = document.getElementById("sleeve");
const discEl = document.getElementById("disc");
const labelEl = document.getElementById("label");

const HINT = {
  DIGGING: "Move to browse · tip to flip · lift to pull out",
  HOLDING: "Carry it · lay me flat to play · tap to keep",
  ON_PLAYER: "Pick me up to stop",
};

if (!room || !key) {
  document.querySelector("main").innerHTML = "<p class=\"miss\">Open this page by scanning the code on the shop screen.</p>";
} else {
  boot(key);
}

function wrap(d) {
  return ((d + 180) % 360 + 360) % 360 - 180;
}

function buzz(ms) {
  try { navigator.vibrate?.(ms); } catch { /* iOS has no vibrate */ }
}

function boot(channel) {
  if (!window.isSecureContext) document.getElementById("insecure").hidden = false;
  let mode = "WAIT";
  let held = null;
  let linked = false;
  const { client, topics } = openRelay(channel);

  const latest = { alpha: 0, beta: 0, gamma: 0, rotA: 0, rotB: 0, rotG: 0, accY: 0 };
  const neutral = { alpha: 0, beta: 0 };
  let gotOri = false;
  let sensorsReady = false;
  let armed = true;
  let lastFlip = 0;
  let lastFlick = 0;
  let lastSweep = 0;
  let lastPull = 0;
  let neutralSince = 0;
  let flatSince = 0;
  let holdUntil = 0;
  let playerUntil = 0;
  let axesAt = 0;

  function send(msg) {
    if (linked && client.connected) client.publish(topics.toShop, JSON.stringify(msg));
  }

  function show() {
    hintEl.textContent = HINT[mode] || "";
    const holding = mode === "HOLDING";
    sleeveEl.hidden = !holding;
    discEl.hidden = mode !== "ON_PLAYER";
    if (holding && held) paintHeld();
    if (mode === "ON_PLAYER" && held) labelEl.textContent = held.title || "";
  }

  function paintHeld() {
    sleeveEl.style.background = held.color || "#c4492f";
    sleeveEl.querySelector("b").textContent = held.title || "";
    sleeveEl.querySelector("span").textContent = held.artist || "";
    const img = sleeveEl.querySelector("img");
    if (held.front) { img.hidden = false; img.src = held.front; img.alt = ""; }
    else { img.hidden = true; img.removeAttribute("src"); }
  }

  function enterHolding(now) {
    mode = "HOLDING";
    holdUntil = now + 700;
    neutralSince = 0;
    flatSince = 0;
    show();
  }

  const hello = setInterval(() => {
    if (!linked && client.connected) client.publish(topics.toShop, JSON.stringify({ type: "hello" }));
  }, 1000);
  const giveUp = setTimeout(() => {
    if (!linked) linkEl.textContent = "Couldn't reach the shop screen.";
  }, 8000);
  client.on("connect", () => {
    client.subscribe(topics.toPhone, () => {
      client.publish(topics.toShop, JSON.stringify({ type: "hello" }));
    });
  });
  client.on("message", (_topic, payload) => {
    const msg = readMessage(payload);
    if (!msg) return;
    if (msg.type === "ack") {
      linked = true;
      clearTimeout(giveUp);
      linkEl.textContent = "Connected to the shop";
      return;
    }
    if (msg.type === "held") { held = msg; if (mode === "HOLDING" || mode === "ON_PLAYER") show(); }
  });
  client.on("close", () => {
    if (!linked) return;
    linked = false;
    linkEl.textContent = "Phone disconnected";
  });
  client.on("error", () => {
    if (!linked) linkEl.textContent = "Couldn't reach the shop screen.";
  });
  addEventListener("pagehide", () => { clearInterval(hello); client.end(true); });

  function yawOf(e) {
    if (e.alpha != null) return e.alpha;
    if (e.webkitCompassHeading != null) return (360 - e.webkitCompassHeading) % 360;
    return null;
  }

  function onOrientation(e) {
    const yaw = yawOf(e);
    if (yaw == null && e.beta == null) return;
    if (yaw != null) latest.alpha = yaw;
    if (e.beta != null) latest.beta = e.beta;
    latest.gamma = e.gamma || 0;
    gotOri = true;
    if (mode !== "WAIT" && !sensorsReady) {
      neutral.alpha = latest.alpha;
      neutral.beta = latest.beta;
      sensorsReady = true;
    }
    if (mode !== "DIGGING" || e.beta == null) return;
    const rel = e.beta - neutral.beta;
    if (Math.abs(rel) < 8) armed = true;
    const now = performance.now();
    let dir = 0;
    if (rel > 18) dir = 1;
    else if (rel < -18) dir = -1;
    if (dir && (armed || now - lastFlip > 220)) {
      armed = false;
      lastFlip = now;
      send({ type: "flip", dir });
      buzz(12);
    }
  }

  function onMotion(e) {
    const r = e.rotationRate;
    if (r) {
      latest.rotA = r.alpha || 0;
      latest.rotB = r.beta || 0;
      latest.rotG = r.gamma || 0;
    }
    if (e.acceleration && e.acceleration.y != null) latest.accY = e.acceleration.y;
    if (!gotOri || mode !== "DIGGING") return;
    const now = performance.now();
    if (Math.abs(latest.rotA) > 180 && now - lastSweep > 400) {
      lastSweep = now;
      send({ type: "sweep", dir: latest.rotA > 0 ? 1 : -1 });
      buzz(25);
    }
    if (Math.abs(latest.rotB) > 220 && now - lastFlick > 220) {
      lastFlick = now;
      lastFlip = now;
      armed = false;
      send({ type: "flip", dir: latest.rotB > 0 ? 1 : -1 });
      buzz(12);
    }
    if (latest.accY > 6 && now - lastPull > 600) {
      lastPull = now;
      send({ type: "inspect" });
      enterHolding(now);
    }
  }

  function gestures(now) {
    if (!gotOri) return;
    if (mode === "HOLDING" && now > holdUntil) {
      if (Math.abs(latest.beta - neutral.beta) < 8) {
        if (!neutralSince) neutralSince = now;
        if (now - neutralSince > 400) {
          neutralSince = 0;
          send({ type: "putback" });
          mode = "DIGGING";
          show();
        }
      } else neutralSince = 0;
      const rate = Math.hypot(latest.rotA, latest.rotB, latest.rotG);
      const flat = Math.abs(latest.beta) < 12 && Math.abs(latest.gamma) < 12 && rate < 15;
      if (mode === "HOLDING" && flat) {
        if (!flatSince) flatSince = now;
        if (now - flatSince > 700) {
          flatSince = 0;
          send({ type: "place" });
          mode = "ON_PLAYER";
          playerUntil = now + 800;
          buzz(40);
          show();
        }
      } else flatSince = 0;
    }
    if (mode === "ON_PLAYER" && now > playerUntil) {
      const rate = Math.hypot(latest.rotA, latest.rotB, latest.rotG);
      const flat = Math.abs(latest.beta) < 12 && Math.abs(latest.gamma) < 12;
      if (!flat || rate > 120) {
        send({ type: "lift" });
        enterHolding(now);
      }
    }
  }

  function sendAxes(now) {
    if (!sensorsReady || (mode !== "DIGGING" && mode !== "HOLDING")) return;
    if (now - axesAt < 33) return;
    axesAt = now;
    const x = Math.max(-1, Math.min(1, wrap(latest.alpha - neutral.alpha) / 35));
    send({ type: "pan", x });
    if (mode === "DIGGING") {
      const v = Math.max(-1, Math.min(1, (latest.beta - neutral.beta) / 35));
      send({ type: "lean", v });
    }
  }

  let listening = false;
  function listen() {
    if (listening) return;
    listening = true;
    addEventListener("deviceorientation", (e) => { onOrientation(e); const now = performance.now(); gestures(now); sendAxes(now); });
    addEventListener("devicemotion", (e) => { onMotion(e); const now = performance.now(); gestures(now); sendAxes(now); });
  }

  async function keepAwake() {
    try { await navigator.wakeLock?.request("screen"); } catch { /* not available */ }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && mode !== "WAIT") keepAwake();
  });

  document.getElementById("start").addEventListener("click", async () => {
    listen();
    let allowed = true;
    try {
      const asks = [];
      if (typeof DeviceOrientationEvent?.requestPermission === "function") asks.push(DeviceOrientationEvent.requestPermission());
      if (typeof DeviceMotionEvent?.requestPermission === "function") asks.push(DeviceMotionEvent.requestPermission());
      const answers = await Promise.all(asks);
      if (answers.some((answer) => answer !== "granted")) allowed = false;
    } catch { allowed = false; }
    await keepAwake();
    sensorsReady = false;
    mode = "DIGGING";
    document.getElementById("start").hidden = true;
    liveEl.hidden = false;
    document.getElementById("denied").hidden = allowed;
    show();
    listen();
  });

  document.getElementById("recal").addEventListener("click", () => {
    neutral.alpha = latest.alpha;
    neutral.beta = latest.beta;
    armed = true;
  });
  document.getElementById("pull").addEventListener("click", () => {
    send({ type: "inspect" });
    enterHolding(performance.now());
  });
  document.getElementById("play").addEventListener("click", () => {
    send({ type: "place" });
    mode = "ON_PLAYER";
    playerUntil = performance.now() + 800;
    buzz(40);
    show();
  });
  sleeveEl.addEventListener("click", () => {
    if (mode === "HOLDING") send({ type: "take" });
  });
  sleeveEl.querySelector("img").addEventListener("error", (e) => { e.currentTarget.hidden = true; });
}
