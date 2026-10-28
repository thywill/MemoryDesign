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
  DIGGING: "Reach forward for the next sleeve, then pause. Lift to pull it out.",
  HOLDING: "Turn your phone to see the back. Reach forward to put it back.",
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
  let shownBack = false;
  const { client, topics } = openRelay(channel);

  const latest = { alpha: 0, beta: 0, gamma: 0, rotA: 0, rotB: 0, rotG: 0, accY: 0 };
  const neutral = { alpha: 0, beta: 0, gamma: 0 };
  let gotOri = false;
  let sensorsReady = false;
  let armed = true;
  let raising = 0;
  let lastFlip = 0;
  let lastPull = 0;
  let neutralSince = 0;
  let flatSince = 0;
  let holdUntil = 0;
  let playerUntil = 0;

  function send(msg) {
    if (linked && client.connected) client.publish(topics.toShop, JSON.stringify(msg));
  }

  function show() {
    hintEl.textContent = HINT[mode] || "";
    const holding = mode === "HOLDING";
    sleeveEl.hidden = !holding;
    discEl.hidden = mode !== "ON_PLAYER";
    document.getElementById("racks").hidden = mode !== "DIGGING";
    document.getElementById("pull").hidden = mode !== "DIGGING";
    document.getElementById("return").hidden = !holding;
    if (holding && held) paintHeld();
    if (mode === "ON_PLAYER" && held) labelEl.textContent = held.title || "";
  }

  function paintHeld() {
    sleeveEl.style.background = held.color || "#c4492f";
    sleeveEl.querySelector("b").textContent = held.title || "";
    sleeveEl.querySelector("span").textContent = shownBack ? "Back" : (held.artist || "");
    const img = sleeveEl.querySelector("img");
    const src = shownBack && held.back ? held.back : held.front;
    if (src) { img.hidden = false; img.src = src; img.alt = ""; }
    else { img.hidden = true; img.removeAttribute("src"); }
  }

  function enterHolding(now) {
    mode = "HOLDING";
    shownBack = false;
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
    if (e.gamma != null) latest.gamma = e.gamma;
    gotOri = true;
    if (mode !== "WAIT" && !sensorsReady) {
      neutral.alpha = latest.alpha;
      neutral.beta = latest.beta;
      neutral.gamma = latest.gamma;
      sensorsReady = true;
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
    if (latest.accY > 6 && now - lastPull > 700) pullOut(now);
  }

  function pullOut(now) {
    lastPull = now;
    send({ type: "inspect" });
    enterHolding(now);
  }

  // Reaching into the bin tips the top of the phone away and lowers beta.
  // One reach, then back toward upright, then the next sleeve. The camera stays put.
  function dig(now) {
    const rel = latest.beta - neutral.beta;
    if (rel > -10) armed = true;
    if (armed && rel < -18 && now - lastFlip > 280) {
      armed = false;
      lastFlip = now;
      send({ type: "flip", dir: 1 });
      buzz(12);
    }
    if (rel > 34) {
      if (!raising) raising = now;
      if (now - raising > 240 && now - lastPull > 700) pullOut(now);
    } else if (rel < 26) raising = 0;
  }

  function turnSleeve() {
    const roll = wrap(latest.gamma - neutral.gamma);
    const back = Math.abs(roll) > 50 ? true : Math.abs(roll) < 18 ? false : shownBack;
    if (back === shownBack) return;
    shownBack = back;
    send({ type: "turn", back });
    show();
  }

  function gestures(now) {
    if (!gotOri || !sensorsReady) return;
    if (mode === "DIGGING") dig(now);
    if (mode === "HOLDING") turnSleeve();
    if (mode === "HOLDING" && now > holdUntil) {
      const rel = latest.beta - neutral.beta;
      if (rel < -18) {
        if (!neutralSince) neutralSince = now;
        if (now - neutralSince > 450) {
          neutralSince = 0;
          shownBack = false;
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

  let listening = false;
  function listen() {
    if (listening) return;
    listening = true;
    addEventListener("deviceorientation", (e) => { onOrientation(e); gestures(performance.now()); });
    addEventListener("devicemotion", (e) => { onMotion(e); gestures(performance.now()); });
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
    neutral.gamma = latest.gamma;
    armed = true;
    raising = 0;
  });
  document.getElementById("prev").addEventListener("click", () => { send({ type: "rack", dir: -1 }); buzz(12); });
  document.getElementById("next").addEventListener("click", () => { send({ type: "rack", dir: 1 }); buzz(12); });
  document.getElementById("pull").addEventListener("click", () => pullOut(performance.now()));
  document.getElementById("return").addEventListener("click", () => {
    if (mode !== "HOLDING") return;
    shownBack = false;
    send({ type: "putback" });
    mode = "DIGGING";
    show();
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
