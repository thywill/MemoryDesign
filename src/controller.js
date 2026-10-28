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
  DIGGING: "Screen up, slide forward through the sleeves.",
  HOLDING: "Turn it over for the back. Lay it flat to play.",
  ON_PLAYER: "Pick it up to stop",
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

  const latest = { alpha: 0, beta: 0, gamma: 0, rotA: 0, rotB: 0, rotG: 0, accX: 0, accY: 0, accZ: 0 };
  const neutral = { alpha: 0, beta: 0, gamma: 0 };
  const smooth = { x: 0, y: 0, z: 0 };
  let gotOri = false;
  let sensorsReady = false;
  let armed = true;
  let raising = 0;
  let lastPull = 0;
  let flatSince = 0;
  let holdUntil = 0;
  let playerUntil = 0;
  let pose = "flat";
  let pendingPose = "flat";
  let poseSince = 0;
  let flowAt = 0;
  let poseHint = HINT.DIGGING;

  function send(msg) {
    if (linked && client.connected) client.publish(topics.toShop, JSON.stringify(msg));
  }

  function show() {
    hintEl.textContent = mode === "ON_PLAYER" ? HINT.ON_PLAYER : poseHint;
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
    const a = e.acceleration;
    const g = e.accelerationIncludingGravity;
    if (a && a.x != null) {
      latest.accX = a.x;
      latest.accY = a.y || 0;
      latest.accZ = a.z || 0;
    } else if (g) {
      latest.accX = (g.x || 0) - grav.x;
      latest.accY = (g.y || 0) - grav.y;
      latest.accZ = (g.z || 0) - grav.z;
      grav.x += ((g.x || 0) - grav.x) * 0.08;
      grav.y += ((g.y || 0) - grav.y) * 0.08;
      grav.z += ((g.z || 0) - grav.z) * 0.08;
    }
  }

  const grav = { x: 0, y: 0, z: 0 };

  function pullOut(now) {
    lastPull = now;
    send({ type: "inspect" });
    enterHolding(now);
  }

  function nudge(v) {
    const dead = 0.42;
    if (Math.abs(v) < dead) return 0;
    return Math.max(-1, Math.min(1, Math.sign(v) * (Math.abs(v) - dead) / 1.5));
  }

  // Loose poses. A hand never holds a perfect angle, so the gaps keep the last one.
  function rawPose() {
    const b = latest.beta;
    const g = Math.abs(latest.gamma);
    const absB = Math.abs(b);
    if (absB > 145) return "down";
    if (g > 50) return "side";
    if (b > 48 && b < 130 && g < 42) return "face";
    if (absB < 34 && g < 40) return "flat";
    return pose;
  }

  function settlePose(now) {
    const next = rawPose();
    if (next !== pendingPose) { pendingPose = next; poseSince = now; }
    const wait = next === "face" ? 240 : 150;
    if (next !== pose && now - poseSince > wait) pose = next;
    return pose;
  }

  function note(text) {
    if (poseHint === text) return;
    poseHint = text;
    hintEl.textContent = text;
  }

  function setBack(back) {
    if (back === shownBack) return;
    shownBack = back;
    send({ type: "turn", back });
    show();
  }

  function gestures(now) {
    if (!gotOri || !sensorsReady) return;
    smooth.x += (latest.accX - smooth.x) * 0.35;
    smooth.y += (latest.accY - smooth.y) * 0.35;
    smooth.z += (latest.accZ - smooth.z) * 0.35;
    const here = settlePose(now);
    const rate = Math.hypot(latest.rotA, latest.rotB, latest.rotG);
    const still = rate < 20 && nudge(smooth.x) === 0 && nudge(smooth.y) === 0;

    if (mode === "DIGGING") {
      if (here === "face" && now - lastPull > 700) {
        note("That sleeve is coming up.");
        pullOut(now);
      } else if (here === "side") {
        note("On its side. Slide and the view follows the phone.");
        if (now - flowAt > 50) {
          flowAt = now;
          const v = nudge(smooth.z) * (latest.gamma < 0 ? 1 : -1);
          if (v) send({ type: "drift", v });
        }
      } else {
        note("Screen up. Slide forward through the sleeves, sideways for the next rack.");
        if (here === "flat" && now - flowAt > 50) {
          flowAt = now;
          const along = nudge(smooth.y);
          const across = nudge(smooth.x);
          if (along || across) send({ type: "flow", along, across });
        }
      }
      return;
    }

    if (mode === "HOLDING") {
      if (here === "down") {
        note("The back of the sleeve.");
        setBack(true);
      } else if (here === "face") {
        note("Turn it over for the back. Lay it flat on the table to play.");
        setBack(false);
      } else if (here === "flat") {
        note("Hold it still on the table and it plays.");
        setBack(false);
        if (now > holdUntil && still) {
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
      } else {
        note("Bring the screen up to look, or lay it flat to play.");
        flatSince = 0;
      }
      return;
    }

    if (mode === "ON_PLAYER" && now > playerUntil && (here === "face" || here === "side")) {
      send({ type: "lift" });
      enterHolding(now);
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
