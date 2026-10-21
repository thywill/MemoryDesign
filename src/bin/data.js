import { N } from "./constants.js";

let seed = 11;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const pick = (a) => a[Math.floor(rnd() * a.length)];

export const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const lum = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
export const near = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0]-y[0], x[1]-y[1], x[2]-y[2]) < 90; };
export const shade = (h, p) => { const [r, g, b] = rgb(h); const t = p > 0 ? 255 : 0, q = Math.abs(p);
  const c = (v) => Math.round(v + (t - v) * q); return `rgb(${c(r)},${c(g)},${c(b)})`; };

const colors = ["#2447f0","#2e6b4f","#d8382a","#1d2f63","#e87a2e","#2a5db8","#1f1e1d","#7a2229","#c9652a","#d4432e",
  "#0f5c57","#f2c230","#5a2d82","#e6ddc9","#133b2c","#b8322a","#1b4d8f","#2b2b2b","#e25b7a","#6b7d2f"];
const artists = ["The Low Tides","Marigold Static","Odessa Vaughn","Brother Kasimir","The Velvet Porch","Nia & the Nightshift","Cedar Hollow Band","Dub Parliament","Ruby Calloway","Sonny Arcade","The Gravel Saints","Lorna Pike","Midnight Ferry","Tomás Rivera Trio","Deacon Blue Moon","Paloma Reyes","Static Ghosts","Hattie Mae Wilson","King Tubbs Jr.","The Honeycombs"];
const titles = ["Sunday Wires","Heat in the Hallway","Paper Moon","Slow Burn","Coastline","Rain on Tin","Late Bus Home","Brass & Honey","Echo Chamber","Night Market","Dust","Porch Light","Second Pressing","Blue Hour","High Street","Wildflower","Lullaby","Northbound","Golden","Back Room"];
const words = ["Midnight","Velvet","River","Static","Honey","Ghost","Summer","Neon","Paper","Golden","Lonely","Electric","Sweet","Broken","Silver","Holy","Motel","Satellite","Rain","Highway","Mercy","Radio","Harbor","Engine"];
const tails = ["Blues","Stomp","Serenade","Shuffle","Dream","Waltz","Groove","Lullaby","Parade","Train","Prayer","Dance","Song","Skank","Boogie","Hymn","Ride"];
const labels = ["Brickyard","Oak Hill","Low Lamp","Sidewalk","Tin Roof","Ninth Ave","Golden Mile"];

const mkTracks = (n) => Array.from({ length: n }, () => ({ name: `${pick(words)} ${pick(tails)}`, time: `${2 + Math.floor(rnd()*4)}:${String(Math.floor(rnd()*60)).padStart(2, "0")}` }));

// Placeholder record for slots the real catalogue doesn't fill.
function makeRecord(genre, prev) {
  let color = pick(colors);
  while (prev && near(color, prev)) color = pick(colors);
  const c = { color, style: Math.floor(rnd() * 6), title: pick(titles), artist: pick(artists), genre,
    year: 1958 + Math.floor(rnd() * 36), label: pick(labels),
    cat: `${String.fromCharCode(65 + Math.floor(rnd()*26))}${String.fromCharCode(65 + Math.floor(rnd()*26))}-${100 + Math.floor(rnd()*900)}` };
  c.sideA = mkTracks(4 + Math.floor(rnd() * 3));
  c.sideB = mkTracks(4 + Math.floor(rnd() * 3));
  return c;
}

// A real album from public/catalog.json. Colour and type style only matter until the cover
// image loads, or if it never does; the colour is then replaced by the cover's average.
function realRecord(album, prev) {
  let color = pick(colors);
  while (prev && near(color, prev)) color = pick(colors);
  return {
    ...album, color, style: Math.floor(rnd() * 6),
    label: String(album.label || "Independent").replace(/\s+records$/i, ""),
  };
}

/* ------------------------------------------------------------------ */
/*  Curation: one genre per column, three dividers front to back       */
/* ------------------------------------------------------------------ */
// laid out the way most US record stores are: new arrivals by the door, then rock, soul, hip hop and so on
export const PICKERS = [
  { name: "New arrivals", plate: "New arrivals", themes: ["New arrivals", "Staff picks", "Just in – used"] },
  { name: "Rock", plate: "Rock LPs", themes: ["Rock A–M", "Rock N–Z", "Classic rock"] },
  { name: "Soul / R&B", plate: "Soul / R&B LPs", themes: ["Soul / R&B", "Motown", "Funk"] },
  { name: "Hip hop", plate: "Hip hop LPs", themes: ["Hip hop / rap", "East coast", "West coast"] },
  { name: "Jazz", plate: "Jazz LPs", themes: ["Jazz", "Blue Note era", "Jazz vocals"] },
  { name: "Blues", plate: "Blues LPs", themes: ["Blues", "Delta blues", "Chicago blues"] },
  { name: "Country", plate: "Country LPs", themes: ["Country", "Outlaw country", "Bluegrass"] },
  { name: "Folk", plate: "Folk LPs", themes: ["Folk / singer-songwriter", "Americana", "Protest songs"] },
  { name: "Pop", plate: "Pop LPs", themes: ["Pop", "Girl groups", "80s pop"] },
  { name: "Punk & indie", plate: "Punk & indie", themes: ["Punk", "Indie rock", "Grunge"] },
  { name: "Electronic", plate: "Electronic", themes: ["Electronic", "Disco / dance", "House"] },
  { name: "Soundtracks", plate: "Soundtracks", themes: ["Soundtracks", "Comedy", "Dollar bin"] },
];

// Where the catalogue's genres are filed. The bin has no reggae or world section,
// so those go to the front of the store with the new arrivals and staff picks.
const FILED_UNDER = {
  "New arrivals": ["Reggae", "Dub"],
  "Staff picks": ["Ambient", "Highlife"],
  "Just in – used": ["Afrobeat", "Latin"],
  "Rock A–M": ["Krautrock"],
  "Rock N–Z": ["Surf"],
  "Classic rock": ["Rockabilly"],
  "Soul / R&B": ["Soul", "Gospel"],
  "Funk": ["Funk"],
  "Hip hop / rap": ["Hip hop"],
  "Jazz": ["Jazz"],
  "Jazz vocals": ["Bossa nova"],
  "Blues": ["Blues"],
  "Country": ["Country"],
  "Folk / singer-songwriter": ["Folk"],
  "Punk": ["Punk"],
  "Indie rock": ["Post-punk"],
  "Electronic": ["Electronic"],
  "Disco / dance": ["Disco"],
  "Soundtracks": ["Soundtracks"],
  "Comedy": ["Comedy"],
};

const PRICES = ["$8", "$10", "$12", "$12", "$15", "$18", "$20", "$25", "$6", "$35", "3 for $10"];
let uid = 0;

// `shelf` is the catalogue as loaded by src/data.js: [{ genre, records }].
export function buildPicks(shelf) {
  const byGenre = new Map(shelf.map((s) => [s.genre, s.records]));
  return PICKERS.map((p, col) => ({
    ...p, col,
    crates: p.themes.map((theme, t) => {
      const real = (FILED_UNDER[theme] || []).flatMap((g) => byGenre.get(g) || []);
      const recs = [];
      for (let k = 0; k < N; k++) {
        const prev = recs[k - 1]?.c.color;
        const c = k < real.length ? realRecord(real[k], prev) : makeRecord(theme, prev);
        // how this particular copy has lived: wear, sleeve, sticker, how it sits in the stack
        c.wear = {
          ring: rnd() < 0.4 ? 0.03 + rnd() * 0.07 : 0, edge: 0.05 + rnd() * 0.13, fade: rnd() * 0.035,
          sticker: theme === "Dollar bin" ? { price: "$1", x: 0.62 + rnd() * 0.2, y: 0.06 + rnd() * 0.1, r: (rnd() - 0.5) * 0.4, tone: "#f6d24a" } : rnd() < 0.42 ? { price: pick(PRICES), x: 0.6 + rnd() * 0.25, y: 0.06 + rnd() * 0.12, r: (rnd() - 0.5) * 0.4, tone: rnd() < 0.6 ? "#fbf9f2" : rnd() < 0.5 ? "#f6d24a" : "#f39a4a" } : null,
          sleeved: rnd() < 0.55, gatefold: rnd() < 0.12,
          dx: (rnd() - 0.5) * 0.012, rz: (rnd() - 0.5) * 0.022, lean: (rnd() - 0.5) * 0.05, seed: Math.floor(rnd() * 1e6),
        };
        recs.push({ id: `r${uid++}`, c });
      }
      return { id: `c${uid++}`, genre: theme, tier: t, recs, tilt: (rnd() - 0.5) * 0.03, lift: rnd() * 0.012 };
    }),
  }));
}
