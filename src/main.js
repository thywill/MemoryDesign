import { loadStacks } from "./data.js";

const shelf = await loadStacks();

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (list) => list[Math.floor(rnd() * list.length)];
let hseed = 331;
const hj = () => (hseed = (hseed * 48271) % 2147483647) / 2147483647 - .5;
let jseed = 97;
const jit = () => (jseed = (jseed * 48271) % 2147483647) / 2147483647 - .5;

const colors = ["#2447f0","#2e6b4f","#d8382a","#1d2f63","#e87a2e","#2a5db8","#1f1e1d","#7a2229","#c9652a","#d4432e",
                "#0f5c57","#f2c230","#5a2d82","#e6ddc9","#133b2c","#b8322a","#1b4d8f","#2b2b2b","#e25b7a","#6b7d2f"];

const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (.299 * (n >> 16) + .587 * ((n >> 8) & 255) + .114 * (n & 255)) / 255; };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const near = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90; };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[ch]));

function paintCover(el, c) {
  el.style.setProperty("--line", "var(--bg)");
  if (c.front) {
    el.style.background = c.color;
    el.style.color = "";
    const alt = el.classList.contains("face") ? `Cover of ${c.title} by ${c.artist}` : "";
    el.innerHTML = `<img class="cover-img" draggable="false" src="${esc(c.front)}" alt="${esc(alt)}">`;
    el.querySelector("img").addEventListener("error", () => {
      c.front = null;
      paintCover(el, c);
    }, { once: true });
    return;
  }
  const ink = lum(c.color) > .62 ? "#1c1b19" : "#fbf8f1";
  el.style.background = c.color;
  el.style.color = ink;
  let mark;
  switch (c.style) {
    case 0: mark = `<div class="m-serif">${esc(c.title)}</div>`; break;
    case 1: mark = `<div class="m-heavy">${esc(c.title)}</div>`; break;
    case 2: mark = `<div class="m-script">${esc(c.title)}</div>`; break;
    case 3: mark = `<div class="m-initial">${esc(c.title.charAt(0))}</div>`; break;
    case 4: mark = `<div class="m-badge">${esc(c.title).split(" ").join("<br>")}</div>`; break;
    default: mark = `<div class="m-emblem"><i>${esc(c.artist.replace("The ", "").charAt(0))}</i><span>${esc(c.artist)}</span></div>`;
  }
  el.innerHTML = `<div class="mark">${mark}</div>`;
}

function fillBack(c) {
  faceBack.classList.remove("has-photo");
  if (c.back) {
    faceBack.classList.add("has-photo");
    faceBack.innerHTML = `<img class="cover-img" draggable="false" src="${esc(c.back)}" alt="${esc(`Back cover of ${c.title} by ${c.artist}`)}">`;
    faceBack.querySelector("img").addEventListener("error", () => {
      c.back = null;
      fillBack(c);
    }, { once: true });
    return;
  }
  // No back scan: keep the generated sleeve, filled with the tracklist.
  faceBack.style.setProperty("--b-accent", lum(c.color) > .62 ? "#1c1b19" : c.color);
  const li = (track) => `<li><span>${esc(track.name)}</span><span>${esc(track.time)}</span></li>`;
  const labelName = String(c.label || "Independent").replace(/\s+records$/i, "");
  faceBack.innerHTML = `
    <div class="back-head"><div><h3>${esc(c.title)}</h3><p>${esc(c.artist)}</p></div><span class="cat">${esc(c.cat)}</span></div>
    <div class="sides"><div><h4>Side A</h4><ol>${(c.sideA || []).map(li).join("")}</ol></div><div><h4>Side B</h4><ol>${(c.sideB || []).map(li).join("")}</ol></div></div>
    <div class="back-foot"><span>${esc(labelName)} Records, ${esc(c.year)}<br>${esc(c.genre)}, stereo, 33⅓ RPM</span><span class="barcode" aria-hidden="true"></span></div>`;
}

const wall = document.getElementById("wall");
const stacks = [];
shelf.forEach(({ genre, records: albumRecs }) => {
  const count = albumRecs.length;
  const stack = document.createElement("div");
  stack.className = "stack";
  stack.style.setProperty("--n", count);
  const recs = [];
  for (let k = 0; k < count; k++) {
    const c = albumRecs[k];
    c.style = Math.floor(rnd() * 6);
    c.color = pick(colors);
    while (k > 0 && near(c.color, recs[k - 1].c.color)) c.color = pick(colors);
    const el = document.createElement("div");
    el.className = "rec";
    el.style.setProperty("--pos", k);
    jit(); jit();
    el.dataset.lean = (hj() * 1.6).toFixed(2);
    paintCover(el, c);
    stack.appendChild(el);
    recs.push({ el, c });
  }
  const tag = document.createElement("span");
  tag.className = "tag";
  stack.appendChild(tag);
  const hit = document.createElement("button");
  hit.className = "hit";
  hit.setAttribute("aria-label", `${genre} stack, ${count} records. Use up and down arrows to flip, Enter to look closer.`);
  stack.appendChild(hit);
  const st = { stack, recs, tag, genre, sel: -1 };
  setTag(st, -1);
  stacks.push(st);

  const pickAt = (e) => {
    if (drag && drag.st === st) return;
    const r = hit.getBoundingClientRect(), w = r.width, edge = w * .055, y = e.clientY;
    const visibleBottom = r.bottom - (st.overlap || 0);
    if (y > visibleBottom) {
      const grace = edge;
      if (st.sel >= 0 && y <= visibleBottom + grace) return;
      select(st, -1);
      return;
    }
    const frontTop = r.bottom - w;
    let k = y >= frontTop ? 0 : Math.ceil((frontTop - y) / edge);
    if (k >= count) k = count - 1;
    select(st, k);
    tiltTo(st, (e.clientX - r.left) / w - .5);
  };
  hit.addEventListener("pointermove", pickAt);
  hit.addEventListener("pointerdown", (e) => { pickAt(e); startPress(st, hit, e); });
  hit.addEventListener("pointerleave", () => select(st, -1));
  hit.addEventListener("click", () => {
    if (st.justDragged) { st.justDragged = false; return; }
    openViewer(st, st.sel < 0 ? 0 : st.sel, hit);
  });
  hit.addEventListener("focus", () => { if (!quietFocus && hit.matches(":focus-visible")) select(st, 0); });
  hit.addEventListener("blur", () => select(st, -1));
  hit.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); select(st, Math.min(count - 1, st.sel + 1)); tiltTo(st, 0); }
    if (e.key === "ArrowDown") { e.preventDefault(); select(st, Math.max(0, st.sel - 1)); tiltTo(st, 0); }
  });
});
let order = [...stacks];

function shadeOf(hex) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  const k = lum(hex) > .6 ? .55 : .35;
  return c.map((v) => Math.round(v * k)).join(", ");
}
const visible = (i) => Math.max(.52, 1 / (1 + .3 * i));
function layout() {
  const gap = Math.min(32, Math.max(12, innerWidth * .018));
  const avail = wall.clientWidth;
  const minW = innerWidth < 700 ? 140 : 220;
  const cols = Math.max(innerWidth < 340 ? 1 : 2, Math.min(6, Math.floor((avail + gap) / (minW + gap))));
  const w = (avail - (cols - 1) * gap) / cols;
  wall.replaceChildren();
  const rows = [];
  for (let i = 0; i < order.length; i += cols) rows.push(order.slice(i, i + cols));
  rows.forEach((group, r) => {
    const row = document.createElement("div");
    row.className = "wall-row";
    row.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const depthAbove = rows.length - r;
    if (r > 0) row.style.marginTop = `${-(1 - visible(depthAbove)) * w}px`;
    const overlap = r < rows.length - 1 ? (1 - visible(rows.length - 1 - r)) * w : 0;
    group.forEach((st, j) => {
      const behind = r > 0 ? rows[r - 1][j] : null;
      st.stack.classList.toggle("has-behind", !!behind);
      if (behind) {
        const cover = behind.recs[0].c;
        st.stack.style.setProperty("--shade", cover.front ? "0, 0, 0" : shadeOf(cover.color));
        const back = st.recs[st.recs.length - 1];
        const neighbor = st.recs.length > 1 ? st.recs[st.recs.length - 2] : null;
        if (!back.c.front) {
          let guard = 0;
          while (guard++ < 16 && (near(back.c.color, cover.color) || (neighbor && near(back.c.color, neighbor.c.color)))) {
            back.c.color = pick(colors);
            paintCover(back.el, back.c);
          }
        }
      }
      st.stack.style.setProperty("--cw", `${w}px`);
      st.stack.style.setProperty("--base", (r + 1) * 100);
      st.overlap = overlap;
      row.appendChild(st.stack);
    });
    wall.appendChild(row);
  });
}
layout();
let rT;
addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(layout, 80); });

let quietFocus = false;

let drag = null;
function setPositions(st) {
  st.recs.forEach((rec, i) => rec.el.style.setProperty("--pos", i));
}
function slotAt(st, y) {
  const count = st.recs.length;
  const r = st.stack.getBoundingClientRect(), w = r.width, edge = w * .055, frontTop = r.bottom - w;
  if (y >= frontTop) return 0;
  return Math.min(count - 1, Math.ceil((frontTop - y) / edge));
}
function startPress(st, hit, e) {
  if (e.button !== 0 || e.pointerType === "touch" || st.sel < 0) return;
  drag = { st, hit, id: e.pointerId, x0: e.clientX, y0: e.clientY, from: st.sel, rec: st.recs[st.sel], live: false };
}
addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const { st } = drag, w = st.stack.offsetWidth, edge = w * .055;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.live) {
    if (Math.hypot(dx, dy) < 6) return;
    drag.live = true;
    try { drag.hit.setPointerCapture(drag.id); } catch (_) {}
    drag.rec.el.classList.remove("sel");
    drag.rec.el.classList.add("dragging");
    st.stack.classList.remove("active");
    st.stack.classList.add("dragging");
    document.body.classList.add("dragging");
    st.sel = -1;
  }
  const to = slotAt(st, e.clientY);
  const cur = st.recs.indexOf(drag.rec);
  if (to !== cur) {
    st.recs.splice(cur, 1);
    st.recs.splice(to, 0, drag.rec);
    setPositions(st);
  }
  const now = st.recs.indexOf(drag.rec);
  drag.rec.el.style.setProperty("--ddx", `${dx}px`);
  drag.rec.el.style.setProperty("--ddy", `${dy + (now - drag.from) * edge}px`);
  st.stack.style.setProperty("--ht", `${Math.max(-6, Math.min(6, dx * .04)).toFixed(2)}deg`);
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.live) return;
  const { st, rec } = d;
  const before = rec.el.getBoundingClientRect();
  rec.el.classList.remove("dragging");
  rec.el.style.removeProperty("--ddx");
  rec.el.style.removeProperty("--ddy");
  st.stack.classList.remove("dragging");
  document.body.classList.remove("dragging");
  st.justDragged = true;
  setTimeout(() => { st.justDragged = false; }, 0);
  const after = rec.el.getBoundingClientRect();
  if (!reduce) rec.el.animate([
    { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(1.04)` },
    { transform: "none" },
  ], { duration: 480, easing: "cubic-bezier(.34,1.4,.64,1)" });
  st.stack.style.setProperty("--ht", "0deg");
  setTag(st, -1);
};
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", endDrag);
document.addEventListener("pointermove", (e) => {
  if (drag) return;
  stacks.forEach((st) => { if (st.sel >= 0 && !st.stack.contains(e.target)) select(st, -1); });
}, { passive: true });

function tiltTo(st, px) {
  if (st.sel < 0) return;
  const deg = px * 5;
  st.stack.style.setProperty("--ht", `${deg.toFixed(2)}deg`);
  const w = st.stack.offsetWidth, h = st.stack.offsetHeight, edge = w * .055;
  const cy = h - st.sel * edge - w / 2;
  st.tag.style.transformOrigin = `${w / 2 - st.tag.offsetLeft}px ${cy - st.tag.offsetTop}px`;
}

function setTag(st, idx) {
  const c = st.recs[idx < 0 ? 0 : idx].c;
  st.tag.textContent = idx < 0 ? st.genre : c.title;
  st.tag.classList.toggle("light", !c.front && lum(c.color) > .62);
}
function select(st, idx) {
  if (st.sel === idx) return;
  if (st.sel >= 0) st.recs[st.sel].el.classList.remove("sel");
  st.sel = idx;
  if (idx >= 0) st.recs[idx].el.classList.add("sel");
  st.stack.classList.toggle("active", idx >= 0);
  st.stack.style.setProperty("--sp", Math.max(0, idx));
  setTag(st, idx);
}

const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
const setMenu = (open) => {
  menuBtn.setAttribute("aria-expanded", String(open));
  menuPanel.hidden = !open;
};
menuBtn.addEventListener("click", () => setMenu(menuPanel.hidden));
document.addEventListener("click", (e) => {
  if (!menuBtn.contains(e.target) && !menuPanel.contains(e.target)) setMenu(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !menuPanel.hidden) setMenu(false);
});
document.getElementById("shuffle").addEventListener("click", () => {
  setMenu(false);
  const before = new Map(stacks.map((s) => [s, s.stack.getBoundingClientRect()]));
  order = [...stacks].sort(() => rnd() - .5);
  layout();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  order.forEach((s) => {
    const a = before.get(s), b = s.stack.getBoundingClientRect();
    s.stack.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }], { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" });
  });
});
const explore = document.getElementById("explore");
explore.addEventListener("click", () => {
  const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 10;
  scrollTo({ top: atEnd ? 0 : scrollY + innerHeight * .8, behavior: "smooth" });
});
addEventListener("scroll", () => {
  const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 10;
  explore.firstChild.textContent = atEnd ? "Back to the top " : "Keep digging ";
  explore.lastElementChild.textContent = atEnd ? "↑" : "↓";
}, { passive: true });

const viewer = document.getElementById("viewer"), cardWrap = document.getElementById("cardWrap");
const flipper = document.getElementById("flipper"), faceFront = document.getElementById("faceFront"), faceBack = document.getElementById("faceBack");
const flipBtn = document.getElementById("flipBtn"), closeBtn = document.getElementById("closeBtn");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let current = null;

const fromRect = (r) => {
  const c = cardWrap.getBoundingClientRect();
  return `translate(${(r.left + r.width / 2) - (c.left + c.width / 2)}px, ${(r.top + r.height / 2) - (c.top + c.height / 2)}px) scale(${r.width / c.width})`;
};

function openViewer(st, idx, returnFocus) {
  const { el, c } = st.recs[idx];
  select(st, -1);
  paintCover(faceFront, c);
  fillBack(c);
  flipper.classList.remove("flipped");
  flipBtn.textContent = "Show back";
  const from = el.getBoundingClientRect();
  viewer.classList.add("show");
  el.classList.add("away");
  current = { el, returnFocus };
  requestAnimationFrame(() => {
    viewer.classList.add("in");
    if (!reduce) cardWrap.animate([{ transform: fromRect(from) }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
    flipBtn.focus({ preventScroll: true });
  });
}
function closeViewer() {
  if (!current) return;
  const { el, returnFocus } = current;
  current = null;
  const done = () => {
    viewer.classList.remove("show", "in");
    el.classList.remove("away");
    quietFocus = true;
    returnFocus && returnFocus.focus({ preventScroll: true });
    quietFocus = false;
  };
  viewer.classList.remove("in");
  if (reduce) { done(); return; }
  flipper.classList.remove("flipped");
  const anim = cardWrap.animate([{ transform: "none" }, { transform: fromRect(el.getBoundingClientRect()) }], { duration: 420, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" });
  anim.onfinish = () => { anim.cancel(); done(); };
}
const toggleFlip = () => {
  const flipped = flipper.classList.toggle("flipped");
  flipBtn.textContent = flipped ? "Show front" : "Show back";
};
flipper.addEventListener("click", toggleFlip);
flipBtn.addEventListener("click", toggleFlip);
closeBtn.addEventListener("click", closeViewer);
viewer.addEventListener("click", (e) => { if (e.target === viewer) closeViewer(); });
document.addEventListener("keydown", (e) => {
  if (!current) return;
  if (e.key === "Escape") closeViewer();
  if (e.key === "Tab") {
    e.preventDefault();
    (document.activeElement === flipBtn ? closeBtn : flipBtn).focus();
  }
});
