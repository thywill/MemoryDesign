import sourceAlbums from "../data/albums.json";

// Albums are listed in data/albums.json. `npm run fetch` asks MusicBrainz for
// the release (tracklist, label, catalog number, year) and the Cover Art
// Archive for front and back scans, then writes public/catalog.json and
// public/covers. A missing back scan stays null so the sleeve falls back to
// the generated cover.

const LABELS = ["Brickyard", "Oak Hill", "Low Lamp", "Sidewalk", "Tin Roof", "Ninth Ave", "Golden Mile"];
const WORDS = ["Midnight", "Velvet", "River", "Static", "Honey", "Ghost", "Summer", "Neon", "Paper", "Golden", "Lonely", "Electric", "Sweet", "Broken", "Silver", "Holy", "Motel", "Satellite", "Rain", "Highway", "Mercy", "Radio", "Harbor", "Engine"];
const TAILS = ["Blues", "Stomp", "Serenade", "Shuffle", "Dream", "Waltz", "Groove", "Lullaby", "Parade", "Train", "Prayer", "Dance", "Song", "Skank", "Boogie", "Hymn", "Ride"];

function albumKey(album) {
  return `${album.genre}||${album.artist}||${album.title}`;
}

function makeRng(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483646 + 1;
}

function fakeCat(rnd) {
  const letter = () => String.fromCharCode(65 + Math.floor(rnd() * 26));
  return `${letter()}${letter()}-${100 + Math.floor(rnd() * 900)}`;
}

function generatedTracks(rnd, count) {
  return Array.from({ length: count }, () => ({
    name: `${WORDS[Math.floor(rnd() * WORDS.length)]} ${TAILS[Math.floor(rnd() * TAILS.length)]}`,
    time: `${2 + Math.floor(rnd() * 4)}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}`,
  }));
}

function cleanTracks(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((track) => track && track.name)
    .map((track) => ({ name: String(track.name), time: track.time ? String(track.time) : "" }));
}

function publicUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\//, "")}`;
}

function toRecord(album, extra) {
  const rnd = makeRng(hashSeed(albumKey(album)));
  const sideA = cleanTracks(extra?.sideA);
  const sideB = cleanTracks(extra?.sideB);
  const record = {
    title: album.title,
    artist: album.artist,
    genre: album.genre,
    year: extra?.year || 1958 + Math.floor(rnd() * 36),
    label: extra?.label || LABELS[Math.floor(rnd() * LABELS.length)],
    cat: extra?.cat || fakeCat(rnd),
    mbid: extra?.mbid || null,
    front: publicUrl(extra?.front),
    back: publicUrl(extra?.back),
    sideA,
    sideB,
  };
  if (!record.sideA.length) {
    record.sideA = generatedTracks(rnd, 4 + Math.floor(rnd() * 3));
    record.sideB = generatedTracks(rnd, 4 + Math.floor(rnd() * 3));
  }
  return record;
}

async function readCatalog() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}catalog.json`, { cache: "no-cache" });
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json.albums) ? json.albums : [];
  } catch {
    return [];
  }
}

export async function loadStacks() {
  const cached = await readCatalog();
  const byKey = new Map(cached.map((album) => [albumKey(album), album]));
  const groups = new Map();
  for (const album of sourceAlbums) {
    if (!album.genre || !album.artist || !album.title) continue;
    if (!groups.has(album.genre)) groups.set(album.genre, []);
    groups.get(album.genre).push(toRecord(album, byKey.get(albumKey(album))));
  }
  return [...groups.entries()].map(([genre, records]) => ({ genre, records }));
}
