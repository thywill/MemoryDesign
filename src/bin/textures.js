import * as THREE from "three";
import { S, T, WALL_H } from "./constants.js";
import { rnd, rgb, lum } from "./data.js";

export const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
export const mkCanvas = (w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; };
function wrap(g, text, maxW) {
  const out = []; let line = "";
  text.split(" ").forEach((w) => { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
  if (line) out.push(line); return out;
}
const lines = (g, ls, x, y, lh) => ls.forEach((l, i) => g.fillText(l, x, y + (i - (ls.length - 1) / 2) * lh));
// Real titles can be long: shrink the type until the line fits.
function fitFont(g, text, maxW, px, font) {
  g.font = `${px}px ${font}`;
  while (g.measureText(text).width > maxW && px > 10) { px -= 2; g.font = `${px}px ${font}`; }
}
function clip(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  while (text.length > 1 && g.measureText(`${text}…`).width > maxW) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

/* ------------------------------------------------------------------ */
/*  Real cover images                                                  */
/* ------------------------------------------------------------------ */
const images = new Map();
// Resolves with the decoded front image, and gives the record the cover's average colour
// so the sleeve edges, disc label and drawn back match the art.
export function coverImage(c) {
  if (!c.front) return Promise.reject(new Error("no cover"));
  if (!images.has(c.front)) images.set(c.front, loadImage(c.front));
  return images.get(c.front).then((img) => {
    if (!c.coverColor) {
      const cv = mkCanvas(8, 8), g = cv.getContext("2d");
      g.drawImage(img, 0, 0, 8, 8);
      const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gr = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4, hex = (v) => Math.round(v / n).toString(16).padStart(2, "0");
      c.coverColor = c.color = `#${hex(r)}${hex(gr)}${hex(b)}`;
    }
    return img;
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
export function imageTexture(src) {
  return loadImage(src).then((img) => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; });
}

/* ------------------------------------------------------------------ */
/*  Canvas textures                                                    */
/* ------------------------------------------------------------------ */
function coverCanvas(c, size = 256) {
  const cv = mkCanvas(size, size), g = cv.getContext("2d"), u = size / 100;
  g.fillStyle = c.color; g.fillRect(0, 0, size, size);
  const ink = lum(c.color) > 0.62 ? "#1c1b19" : "#fbf8f1";
  g.fillStyle = ink; g.strokeStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
  switch (c.style) {
    case 0: g.font = `${14 * u}px "DM Serif Display"`; lines(g, wrap(g, c.title.toUpperCase(), 80 * u), 50 * u, 50 * u, 13 * u); break;
    case 1: g.save(); g.translate(50 * u, 50 * u); g.transform(1, 0, -0.12, 1, 0, 0);
      g.font = `italic ${11 * u}px "Archivo Black"`; lines(g, wrap(g, c.title.toUpperCase(), 78 * u), 0, 0, 11 * u); g.restore(); break;
    case 2: g.font = `italic ${17 * u}px "DM Serif Display"`; lines(g, wrap(g, c.title, 82 * u), 50 * u, 50 * u, 16 * u); break;
    case 3: g.font = `${62 * u}px "DM Serif Display"`; g.fillText(c.title.charAt(0), 50 * u, 54 * u); break;
    case 4: { g.save(); g.translate(50 * u, 50 * u); g.rotate(-0.14); g.font = `${9 * u}px "Archivo Black"`;
      const ls = c.title.toUpperCase().split(" "); const w = Math.max(...ls.map((l) => g.measureText(l).width)) + 10 * u;
      const h = ls.length * 10 * u + 7 * u; g.lineWidth = 1.4 * u; g.strokeRect(-w / 2, -h / 2, w, h);
      lines(g, ls, 0, 0, 10 * u); g.restore(); break; }
    default: g.lineWidth = 1.2 * u; g.beginPath(); g.arc(50 * u, 44 * u, 16 * u, 0, Math.PI * 2); g.stroke();
      g.font = `${15 * u}px "DM Serif Display"`; g.fillText(c.artist.replace("The ", "").charAt(0), 50 * u, 45 * u);
      g.font = `500 ${5 * u}px "Oswald"`; g.letterSpacing = `${0.8 * u}px`; g.fillText(c.artist.toUpperCase(), 50 * u, 70 * u);
  }
  return cv;
}
export const drawCover = (c, size = 256) => tex(coverCanvas(c, size));

export function drawBack(c) {
  const s = 1024, cv = mkCanvas(s, s), g = cv.getContext("2d");
  const accent = lum(c.color) > 0.62 ? "#1c1b19" : c.color;
  g.fillStyle = "#f7f4ec"; g.fillRect(0, 0, s, s);
  g.font = `600 26px "Oswald"`; const cw = g.measureText(c.cat).width + 32;
  g.fillStyle = "#1c1b19"; g.textBaseline = "alphabetic";
  fitFont(g, c.title, s - 144 - cw - 24, 76, '"DM Serif Display"'); g.fillText(c.title, 72, 150);
  fitFont(g, c.artist, s - 144 - cw - 24, 34, '"DM Sans"'); g.fillText(c.artist, 72, 200);
  g.fillStyle = accent; g.fillRect(72, 236, s - 144, 4);
  g.font = `600 26px "Oswald"`;
  g.fillRect(s - 72 - cw, 96, cw, 50); g.fillStyle = "#fff"; g.fillText(c.cat, s - 72 - cw + 16, 131);
  const col = (side, list, x) => {
    g.fillStyle = accent; g.font = `600 28px "Oswald"`; g.letterSpacing = "4px"; g.fillText(side, x, 312); g.letterSpacing = "0px";
    g.font = `28px "DM Sans"`;
    const lh = Math.min(52, 480 / Math.max(1, list.length));
    list.forEach((t, i) => {
      const y = 368 + i * lh; g.fillStyle = "rgba(28,27,25,.45)"; g.fillText(`${i + 1}.`, x, y);
      g.fillStyle = "#1c1b19"; g.fillText(clip(g, t.name, 290), x + 40, y);
      g.textAlign = "right"; g.fillStyle = "rgba(28,27,25,.6)"; g.fillText(t.time, x + 400, y); g.textAlign = "left";
      g.fillStyle = "rgba(0,0,0,.1)"; g.fillRect(x, y + 16, 400, 2);
    });
  };
  col("SIDE A", c.sideA, 72); col("SIDE B", c.sideB, 552);
  g.fillStyle = "rgba(28,27,25,.75)"; g.font = `26px "DM Sans"`;
  g.fillText(`${c.label} Records, ${c.year}`, 72, 900); g.fillText(`${c.genre}, stereo, 33⅓ RPM`, 72, 940);
  g.fillStyle = "#1c1b19"; for (let x = 0; x < 180; x += 6) if (rnd() > 0.35) g.fillRect(s - 252 + x, 880, rnd() > 0.5 ? 4 : 2, 70);
  return tex(cv);
}

export function drawPlate(text) {
  const cv = mkCanvas(512, 96), g = cv.getContext("2d");
  g.fillStyle = "#171615"; g.fillRect(0, 0, 512, 96);
  g.fillStyle = "#f2efe8"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `600 44px "Oswald"`; g.letterSpacing = "5px"; g.fillText(text.toUpperCase(), 256, 50);
  return tex(cv);
}

/* ------------------------------------------------------------------ */
/*  Surfaces                                                           */
/* ------------------------------------------------------------------ */
let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const cv = mkCanvas(128, 128), g = cv.getContext("2d"), d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); grainTile = cv; return cv;
}

// paper grain, faded ink, ring wear, frayed edges, a price sticker, over whatever is printed on the sleeve
function paintWear(g, base, c, size) {
  const w = c.wear, u = size / 100;
  g.drawImage(base, 0, 0, size, size);
  let s = w.seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.save(); g.globalCompositeOperation = "overlay"; g.globalAlpha = 0.14;
  g.fillStyle = g.createPattern(grain(), "repeat"); g.fillRect(0, 0, size, size); g.restore();
  g.fillStyle = `rgba(255,244,222,${w.fade})`; g.fillRect(0, 0, size, size);
  if (w.ring) {
    g.save(); g.globalCompositeOperation = "screen";
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = `rgba(255,255,255,${w.ring * (0.4 + r() * 0.6)})`; g.lineWidth = 0.4 * u + r() * 1.2 * u;
      const a0 = r() * Math.PI * 2, a1 = a0 + 0.4 + r() * 1.6;
      g.beginPath(); g.arc(50 * u, 50 * u, 42 * u + (r() - 0.5) * 2.4 * u, a0, a1); g.stroke();
    }
    g.restore();
  }
  g.save(); g.globalCompositeOperation = "screen";
  g.strokeStyle = `rgba(255,255,255,${w.edge * 0.8})`; g.lineWidth = 0.8 * u; g.strokeRect(0.4 * u, 0.4 * u, size - 0.8 * u, size - 0.8 * u);
  for (let i = 0; i < 16; i++) {           // nicks along the edges
    const side = Math.floor(r() * 4), t = r() * size, l = (1 + r() * 4) * u;
    g.fillStyle = `rgba(255,255,255,${w.edge * (0.6 + r())})`;
    if (side === 0) g.fillRect(t, 0, l, 0.6 * u + r() * u); else if (side === 1) g.fillRect(t, size - 1.2 * u, l, 1.2 * u);
    else if (side === 2) g.fillRect(0, t, 0.6 * u + r() * u, l); else g.fillRect(size - 1.2 * u, t, 1.2 * u, l);
  }
  [[0, 0], [size, 0], [0, size], [size, size]].forEach(([x, y]) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, 7 * u); gr.addColorStop(0, `rgba(255,255,255,${w.edge * 1.1})`); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(x - 7 * u, y - 7 * u, 14 * u, 14 * u);
  });
  for (let i = 0; i < 5; i++) {            // light scuffs
    g.strokeStyle = `rgba(255,255,255,${0.04 + r() * 0.06})`; g.lineWidth = 0.3 * u;
    const x = r() * size, y = r() * size; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30 * u, y + (r() - 0.5) * 8 * u); g.stroke();
  }
  g.restore();
  if (w.sticker) {
    const st = w.sticker, sw = (st.price.length > 4 ? 30 : 17) * u, sh = 9 * u;
    g.save(); g.translate(st.x * size, st.y * size + sh / 2); g.rotate(st.r);
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 1.5 * u; g.shadowOffsetY = 0.5 * u;
    g.fillStyle = st.tone; g.beginPath(); g.roundRect(-sw / 2, -sh / 2, sw, sh, 1.2 * u); g.fill();
    g.shadowColor = "transparent"; g.fillStyle = "#1d1c1a"; g.font = `${6.4 * u}px "Permanent Marker"`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(st.price, 0, 0.5 * u); g.restore();
  }
}

// A printed sleeve that has been handled. With a real cover, the generated one shows until the
// image arrives, then the same wear (same seed) is painted over the real art.
export function drawWornCover(c, size = 256) {
  const cv = mkCanvas(size, size), g = cv.getContext("2d");
  paintWear(g, coverCanvas(c, size), c, size);
  const t = tex(cv);
  if (c.front) coverImage(c).then((img) => {
    const k = Math.max(size / img.naturalWidth, size / img.naturalHeight), base = mkCanvas(size, size);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    base.getContext("2d").drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    g.clearRect(0, 0, size, size);
    paintWear(g, base, c, size);
    t.needsUpdate = true;
  }, () => {});
  return t;
}

function woodTexture() {
  const w = 1024, h = 256, cv = mkCanvas(w, h), g = cv.getContext("2d");
  g.fillStyle = "#b98a52"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 1) {
    const v = Math.sin(y * 0.21) * 0.5 + Math.sin(y * 0.047 + 1.3) * 0.8 + Math.sin(y * 0.9) * 0.15;
    g.fillStyle = v > 0.55 ? "rgba(140,96,44,.16)" : v < -0.7 ? "rgba(255,236,196,.12)" : "rgba(0,0,0,0)";
    g.fillRect(0, y, w, 1);
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(120,80,36,${0.05 + Math.random() * 0.08})`; g.lineWidth = 0.6 + Math.random() * 1.2;
    const y = Math.random() * h; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3);
    g.stroke();
  }
  g.globalCompositeOperation = "overlay"; g.globalAlpha = 0.25; g.fillStyle = g.createPattern(grain(), "repeat"); g.fillRect(0, 0, w, h);
  const t = tex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function drawCardDivider(label) {
  const w = 512, h = 560, cv = mkCanvas(w, h), g = cv.getContext("2d");
  g.fillStyle = "#f3f0e8"; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.18; g.fillStyle = g.createPattern(grain(), "repeat"); g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  const gr = g.createLinearGradient(0, 0, 0, 120); gr.addColorStop(0, "rgba(120,100,70,.10)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, 120);                       // handled, slightly grubby top
  g.fillStyle = "#1b1a18"; g.textAlign = "center"; g.textBaseline = "middle";
  let fs = 68; g.font = `${fs}px "Permanent Marker"`;
  while (g.measureText(label).width > w - 54 && fs > 28) { fs -= 3; g.font = `${fs}px "Permanent Marker"`; }
  g.save(); g.translate(w / 2, 50); g.rotate((Math.random() - 0.5) * 0.05);
  g.globalAlpha = 0.9; g.fillText(label, 0, 0); g.globalAlpha = 0.25; g.fillText(label, 0.8, 0.6); g.restore();
  return tex(cv);
}

// the record inside: grooves with track gaps, and a printed centre label
export function drawDisc(c) {
  const s = 1024, cv = mkCanvas(s, s), g = cv.getContext("2d"), cx = s / 2;
  g.fillStyle = "#0d0d0e"; g.beginPath(); g.arc(cx, cx, cx, 0, Math.PI * 2); g.fill();
  let sd = c.wear.seed; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const gaps = Array.from({ length: c.sideA.length }, () => 0.44 + r() * 0.5);
  for (let rad = 0.36 * cx; rad < 0.975 * cx; rad += 1.6) {
    const f = rad / cx, gap = gaps.some((q) => Math.abs(q - f) < 0.006);
    g.strokeStyle = gap ? "rgba(70,70,74,.9)" : (Math.floor(rad) % 3 ? "rgba(26,26,28,1)" : "rgba(38,38,42,1)");
    g.lineWidth = 1; g.beginPath(); g.arc(cx, cx, rad, 0, Math.PI * 2); g.stroke();
  }
  const labelC = lum(c.color) > 0.62 ? "#1f3a5f" : c.color;
  g.fillStyle = labelC; g.beginPath(); g.arc(cx, cx, 0.33 * cx, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = "overlay"; g.globalAlpha = 0.25; g.fillStyle = g.createPattern(grain(), "repeat");
  g.beginPath(); g.arc(cx, cx, 0.33 * cx, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  g.fillStyle = "#f4efe4"; g.textAlign = "center"; g.textBaseline = "middle";
  const labelW = 0.56 * cx;
  g.font = `600 30px "Oswald"`; g.letterSpacing = "4px"; g.fillText(clip(g, c.label.toUpperCase() + " RECORDS", labelW), cx, cx - 112); g.letterSpacing = "0px";
  fitFont(g, c.title, labelW, 44, '"DM Serif Display"'); g.fillText(clip(g, c.title, labelW), cx, cx - 52);
  fitFont(g, c.artist, labelW, 26, '"DM Sans"'); g.fillText(clip(g, c.artist, labelW), cx, cx + 64);
  g.font = `600 22px "Oswald"`; g.fillText(`SIDE A · 33⅓ · ${c.cat}`, cx, cx + 110);
  g.fillStyle = "#0d0d0e"; g.beginPath(); g.arc(cx, cx, 9, 0, Math.PI * 2); g.fill();
  return tex(cv);
}

/* ------------------------------------------------------------------ */
/*  The shop behind the bin, out of focus                              */
/* ------------------------------------------------------------------ */
// One tile of wall, WALL_TILE metres wide and WALL_H tall, repeating horizontally: face-out records
// on three racks, a hand-lettered sign and two gig posters, blurred and washed into the wall colour.
// Everything is drawn wrapped around the tile edges so the repeat has no seam.
export function drawShopWall(images, theme) {
  const W = 2048, H = 1024, lo = 2, P = 48;                 // sharp pass at half resolution, padded for the blur
  const w = W / lo, h = H / lo, m = h / WALL_H;             // m: low-res pixels per metre
  const y = (metres) => (WALL_H - metres) * m;
  const sharp = mkCanvas(w + 2 * P, h), g = sharp.getContext("2d");
  let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const wrapped = (draw) => { for (const dx of [-w, 0, w]) { g.save(); g.translate(P + dx, 0); draw(); g.restore(); } };

  g.fillStyle = theme.wall; g.fillRect(0, 0, sharp.width, h);
  const swatches = ["#c8553d", "#2f5d62", "#e0b04a", "#6b4e71", "#1f3a5f", "#d9cbb0", "#3d3d3d", "#8c2f39", "#4f7a4a"];
  const slots = 13, pitch = w / slots, rec = 0.31 * m;
  const racks = [0.55, 0.98, 1.41];
  const items = [];
  racks.forEach((base, row) => {
    for (let i = 0; i < slots; i++) {
      if (row === 2 && i >= 2 && i <= 4) continue;            // the sign hangs here
      if ((row === 1 || row === 2) && i === 8) continue;       // a tall poster
      if (row === 0 && i === 11) continue;                     // a short poster
      if (r() < 0.12) continue;                                // a gap where something sold
      const x = i * pitch + (pitch - rec) / 2 + (r() - 0.5) * 4;
      const img = images.length && r() < 0.65 ? images[Math.floor(r() * images.length)] : null;
      items.push({ x, y: y(base) - rec, img, color: swatches[Math.floor(r() * swatches.length)] });
    }
  });
  wrapped(() => {
    g.fillStyle = theme.dark ? "#2a2219" : "#b9a888";
    racks.forEach((base) => g.fillRect(0, y(base) - 1, w, 0.025 * m));
    items.forEach((it) => {
      if (it.img) g.drawImage(it.img, it.x, it.y, rec, rec);
      else { g.fillStyle = it.color; g.fillRect(it.x, it.y, rec, rec); }
    });
    g.fillStyle = "#f1e6cf"; g.fillRect(2 * pitch + 10, y(1.70), 3 * pitch - 20, 0.26 * m);
    g.fillStyle = "#b8322a"; g.font = `${0.15 * m}px "Permanent Marker"`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("USED VINYL", 3.5 * pitch, y(1.57));
    const poster = (x, top, bottom, bg, ink) => {
      g.fillStyle = bg; g.fillRect(x, y(top), pitch - 16, (top - bottom) * m);
      g.fillStyle = ink; g.fillRect(x + 8, y(top) + 10, pitch - 32, 0.12 * m);
      g.fillRect(x + 8, y(bottom) - 0.1 * m, pitch - 40, 0.05 * m);
    };
    poster(8 * pitch + 8, 1.74, 0.98, "#e3c24a", "#1b1a18");
    poster(11 * pitch + 8, 0.88, 0.5, "#2f5d62", "#f1e6cf");
  });

  // defocus: blur the low-res pass, then scale it up to the full tile
  const soft = mkCanvas(w + 2 * P, h), sg = soft.getContext("2d");
  sg.filter = "blur(9px)"; sg.drawImage(sharp, 0, 0);
  const cv = mkCanvas(W, H), o = cv.getContext("2d");
  o.imageSmoothingQuality = "high";
  o.drawImage(soft, P, 0, w, h, 0, 0, W, H);

  // wash it back into the wall so the covers only show through faintly
  o.globalAlpha = theme.overlay; o.fillStyle = theme.wall; o.fillRect(0, 0, W, H); o.globalAlpha = 1;

  // light, periodic across the tile: diagonal window light by day, lamp pools after hours
  const lamp = (x, yy, rad, a) => {
    for (const dx of [-W, 0, W]) {
      const gr = o.createRadialGradient(x + dx, yy, 0, x + dx, yy, rad);
      gr.addColorStop(0, theme.light.replace(/[\d.]+\)$/, `${a})`)); gr.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = gr; o.fillRect(x + dx - rad, yy - rad, rad * 2, rad * 2);
    }
  };
  if (theme.dark) {
    lamp(W * 0.22, H * 0.2, 600, 0.2); lamp(W * 0.72, H * 0.24, 540, 0.16);   // just above the frame, so the glow falls into view
    const fall = o.createLinearGradient(0, 0, 0, H); fall.addColorStop(0, "rgba(0,0,0,0)"); fall.addColorStop(1, "rgba(0,0,0,.35)");
    o.fillStyle = fall; o.fillRect(0, 0, W, H);
  } else {
    const L = mkCanvas(W / 4, H / 4), lg = L.getContext("2d");
    lg.filter = "blur(18px)"; lg.fillStyle = theme.light;
    for (const dx of [-W / 4, 0, W / 4]) for (const x0 of [0.08, 0.42]) {
      const x = dx + x0 * (W / 4);
      lg.beginPath(); lg.moveTo(x, -20); lg.lineTo(x + 90, -20); lg.lineTo(x + 230, H / 4 + 20); lg.lineTo(x + 140, H / 4 + 20); lg.fill();
    }
    o.drawImage(L, 0, 0, W, H);
    const top = o.createLinearGradient(0, 0, 0, H * 0.6); top.addColorStop(0, "rgba(255,250,240,.35)"); top.addColorStop(1, "rgba(255,250,240,0)");
    o.fillStyle = top; o.fillRect(0, 0, W, H * 0.6);
  }
  // the wall darkens into exactly the floor's back-edge colour, so the corner has no seam
  const skirt = o.createLinearGradient(0, H * 0.8, 0, H); skirt.addColorStop(0, `${theme.floor}00`); skirt.addColorStop(1, theme.floor);
  o.fillStyle = skirt; o.fillRect(0, H * 0.8, W, H * 0.2);

  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

// The floor: nearly the wall colour, a touch darker in a soft pool under the cabinet.
export function drawShopFloor(theme) {
  const cv = mkCanvas(512, 256), g = cv.getContext("2d");
  g.fillStyle = theme.wall; g.fillRect(0, 0, 512, 256);
  g.save(); g.scale(1, 0.5);
  const gr = g.createRadialGradient(256, 200, 0, 256, 200, 300);
  gr.addColorStop(0, theme.floor); gr.addColorStop(1, theme.wall);
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512); g.restore();
  const back = g.createLinearGradient(0, 0, 0, 60); back.addColorStop(0, theme.floor); back.addColorStop(1, `${theme.floor}00`);
  g.fillStyle = back; g.fillRect(0, 0, 512, 60);
  return tex(cv);
}

/* ------------------------------------------------------------------ */
/*  Shared geometry and materials                                      */
/* ------------------------------------------------------------------ */
export const recGeo = new THREE.BoxGeometry(S, S, T);
export const paperBack = new THREE.MeshStandardMaterial({ color: "#e3dccb", roughness: 0.85, envMapIntensity: 0.3 });
// the sleeve edge colour: the cover's colour, worn lighter
export const wornEdge = (c) => `rgb(${rgb(c.color).map((v) => Math.round(v + (230 - v) * (0.12 + c.wear.edge * 0.5))).join(",")})`;

let WOOD = null;
export const woodMat = () => {
  if (!WOOD) {
    const t = woodTexture();
    WOOD = {
      face: new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, envMapIntensity: 0.35 }),
      side: new THREE.MeshStandardMaterial({ map: t, color: "#e0c9a4", roughness: 0.62, envMapIntensity: 0.3 }),
      inner: new THREE.MeshStandardMaterial({ map: t, color: "#bfa47a", roughness: 0.8, envMapIntensity: 0.25 }),
    };
  }
  return WOOD;
};
