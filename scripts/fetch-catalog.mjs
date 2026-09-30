import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UA = "MemoryDesignRecordWall/1.0 (local prototype; catalog builder)";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const albumsPath = path.join(root, "data", "albums.json");
const publicDir = path.join(root, "public");
const coversDir = path.join(publicDir, "covers");
const catalogPath = path.join(publicDir, "catalog.json");

const limitFlag = process.argv.indexOf("--limit");
const limit = limitFlag >= 0 ? Number(process.argv[limitFlag + 1]) : Infinity;

function albumKey(album) {
  return `${album.genre}||${album.artist}||${album.title}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let gate = Promise.resolve();
function schedule(task) {
  const run = gate.then(task, task);
  gate = run.then(() => sleep(1100), () => sleep(1100));
  return run;
}

async function mbFetch(url) {
  return schedule(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 503 || response.status === 429) {
        const retry = Number(response.headers.get("retry-after")) || 5;
        await sleep(retry * 1000);
        continue;
      }
      if (!response.ok) throw new Error(`MusicBrainz ${response.status} for ${url}`);
      return response.json();
    }
    throw new Error(`MusicBrainz unavailable for ${url}`);
  });
}

function lucene(value) {
  return String(value).replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, "\\$&");
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’.]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleRank(found, wanted) {
  const x = norm(found);
  const y = norm(wanted);
  if (!x || !y) return 0;
  if (x === y || x.replace(/ /g, "") === y.replace(/ /g, "")) return 100;
  if (x.startsWith(`${y} `)) return Math.max(40, 80 - (x.length - y.length));
  if (x.endsWith(` ${y}`) && x.length - y.length < 24) return 70;
  return 0;
}

function credit(release) {
  return (release["artist-credit"] || []).map((part) => `${part.name || ""}${part.joinphrase || ""}`).join("");
}

function artistClose(found, wanted) {
  const haystack = norm(found);
  const needle = norm(wanted);
  if (!needle) return false;
  if (haystack.includes(needle) || needle.includes(haystack)) return true;
  const parts = needle.split(" ").filter((part) => part.length > 3);
  const last = parts[parts.length - 1];
  return !!last && haystack.includes(last);
}

function heuristic(release) {
  let score = release.score || 0;
  const media = release.media || [];
  const formats = media.map((medium) => (medium.format || "").toLowerCase()).join(" ");
  if (formats.includes("vinyl")) score += 30;
  if (media.length >= 2) score += 8;
  const tracks = media.reduce((sum, medium) => sum + (medium["track-count"] || 0), 0);
  if (tracks >= 8) score += 5;
  const year = parseInt(release.date, 10);
  if (year) score += Math.max(0, 2020 - year) / 50;
  const note = (release.disambiguation || "").toLowerCase();
  if (note.includes("deluxe") || note.includes("remaster")) score -= 4;
  return score;
}

async function searchReleases(album) {
  const query = `artist:"${lucene(album.artist)}" AND release:"${lucene(album.title)}" AND status:official AND primarytype:album`;
  const url = `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(query)}&fmt=json&limit=8`;
  let data = await mbFetch(url);
  if (!data.releases?.length) {
    const broader = `artist:"${lucene(album.artist)}" AND release:"${lucene(album.title)}" AND status:official`;
    data = await mbFetch(`https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(broader)}&fmt=json&limit=8`);
  }
  const list = data.releases || [];
  const ranked = (artistRequired) => list
    .map((release) => ({
      release,
      titleRank: titleRank(release.title, album.title),
      artistOk: artistClose(credit(release), album.artist),
    }))
    .filter((item) => item.titleRank > 0 && (!artistRequired || item.artistOk))
    .sort((a, b) => b.titleRank - a.titleRank || heuristic(b.release) - heuristic(a.release));
  const matched = ranked(true);
  return (matched.length ? matched : ranked(false)).map((item) => item.release);
}

function artUrls(image) {
  if (!image) return [];
  return [image.thumbnails?.["1200"], image.thumbnails?.large, image.thumbnails?.small, image.image].filter(Boolean);
}

async function coverArt(mbid) {
  await sleep(200);
  const response = await fetch(`https://coverartarchive.org/release/${mbid}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 404) return { front: [], back: [] };
  if (!response.ok) return { front: [], back: [] };
  const data = await response.json();
  const images = data.images || [];
  const front = images.find((image) => image.front || (image.types || []).includes("Front"));
  const back = images.find((image) => image.back || (image.types || []).includes("Back"));
  return { front: artUrls(front), back: artUrls(back) };
}

async function lookupRelease(mbid) {
  return mbFetch(`https://musicbrainz.org/ws/2/release/${mbid}?inc=recordings+labels+artist-credits&fmt=json`);
}

function formatTime(ms) {
  const value = Number(ms);
  if (!value || value < 0) return "";
  const seconds = Math.round(value / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function mapTrack(track) {
  return {
    name: track.title,
    time: formatTime(track.length || track.recording?.length),
  };
}

function sidesFromRelease(release) {
  const media = release.media || [];
  const lettered = [];
  for (const medium of media) {
    for (const track of medium.tracks || []) {
      const match = String(track.number || "").match(/^([A-Da-d])\d/);
      lettered.push({ side: match ? match[1].toUpperCase() : null, track: mapTrack(track) });
    }
  }
  const letters = new Set(lettered.map((item) => item.side).filter(Boolean));
  if (letters.has("A") && letters.has("B")) {
    return {
      sideA: lettered.filter((item) => item.side === "A").map((item) => item.track),
      sideB: lettered.filter((item) => item.side && item.side !== "A").map((item) => item.track),
    };
  }
  if (media.length >= 2) {
    return {
      sideA: (media[0].tracks || []).map(mapTrack),
      sideB: media.slice(1).flatMap((medium) => (medium.tracks || []).map(mapTrack)),
    };
  }
  const all = lettered.map((item) => item.track);
  const mid = Math.ceil(all.length / 2);
  return { sideA: all.slice(0, mid), sideB: all.slice(mid) };
}

function labelOf(release) {
  const info = (release["label-info"] || []).find((item) => item.label?.name) || {};
  return {
    label: info.label?.name || "",
    cat: info["catalog-number"] || "",
  };
}

function extensionFor(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer.slice(0, 4).toString() === "RIFF") return "webp";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  return null;
}

async function cacheImage(urls, stem) {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = extensionFor(buffer);
      if (!ext || buffer.length < 500) continue;
      const filename = `${stem}.${ext}`;
      await fs.writeFile(path.join(coversDir, filename), buffer);
      return `/covers/${filename}`;
    } catch {
      // try the next URL
    }
  }
  return null;
}

async function fileExists(urlPath) {
  if (!urlPath) return true;
  try {
    await fs.access(path.join(publicDir, urlPath.replace(/^\//, "")));
    return true;
  } catch {
    return false;
  }
}

async function isCached(entry) {
  if (!entry?.resolved || !entry.mbid || !entry.sideA?.length) return false;
  if (entry.front && !(await fileExists(entry.front))) return false;
  if (entry.back && !(await fileExists(entry.back))) return false;
  return true;
}

async function writeCatalog(albums) {
  const body = JSON.stringify({ generatedAt: new Date().toISOString(), albums }, null, 2);
  const temp = `${catalogPath}.tmp`;
  await fs.writeFile(temp, body);
  await fs.rename(temp, catalogPath);
}

async function resolveAlbum(album) {
  const releases = await searchReleases(album);
  if (!releases.length) {
    return { ...album, resolved: true, mbid: null, year: null, label: "", cat: "", front: null, back: null, sideA: [], sideB: [] };
  }
  let best = null;
  for (const release of releases.slice(0, 5)) {
    const art = await coverArt(release.id);
    const candidate = { release, art };
    const score = (item) => (item.art.front.length ? 2 : 0) + (item.art.back.length ? 1 : 0);
    if (!best || score(candidate) > score(best)) best = candidate;
    if (art.front.length && art.back.length) break;
  }
  const full = await lookupRelease(best.release.id);
  const { label, cat } = labelOf(full);
  const { sideA, sideB } = sidesFromRelease(full);
  const year = parseInt(full.date, 10) || null;
  const front = await cacheImage(best.art.front, `${full.id}-front`);
  const back = await cacheImage(best.art.back, `${full.id}-back`);
  console.log(`    ${credit(full)} — ${full.title} (${full.date || "n.d."})`);
  return {
    genre: album.genre,
    artist: album.artist,
    title: album.title,
    resolved: true,
    mbid: full.id,
    year,
    label,
    cat,
    front,
    back,
    sideA,
    sideB,
  };
}

const source = JSON.parse(await fs.readFile(albumsPath, "utf8"));
const albums = source.slice(0, limit);
await fs.mkdir(coversDir, { recursive: true });

let existing = [];
try {
  const previous = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  existing = Array.isArray(previous.albums) ? previous.albums : [];
} catch {
  existing = [];
}
const byKey = new Map(existing.map((album) => [albumKey(album), album]));
const failures = [];

for (let index = 0; index < albums.length; index++) {
  const album = albums[index];
  const key = albumKey(album);
  const cached = byKey.get(key);
  const label = `[${index + 1}/${albums.length}] ${album.artist} — ${album.title}`;
  if (await isCached(cached)) {
    console.log(`${label}  cached`);
    continue;
  }
  try {
    const entry = await resolveAlbum(album);
    byKey.set(key, entry);
    const tracks = (entry.sideA?.length || 0) + (entry.sideB?.length || 0);
    console.log(`${label}  ${entry.mbid || "no match"}  front:${entry.front ? "yes" : "no"} back:${entry.back ? "yes" : "no"} tracks:${tracks}`);
  } catch (error) {
    failures.push(`${album.artist} — ${album.title}: ${error.message}`);
    console.error(`${label}  FAILED ${error.message}`);
  }
  const ordered = source.map((item) => byKey.get(albumKey(item))).filter(Boolean);
  await writeCatalog(ordered);
}

const done = albums.map((item) => byKey.get(albumKey(item))).filter(Boolean);
const withFront = done.filter((item) => item.front).length;
const withBack = done.filter((item) => item.back).length;
console.log(`\n${done.length}/${albums.length} resolved, ${withFront} fronts, ${withBack} backs, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exitCode = 1;
}
