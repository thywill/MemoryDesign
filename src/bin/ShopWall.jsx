import React, { useEffect, useMemo, useState } from "react";
import { PITCH, EDGE_PAD, WALL_Z, WALL_H, WALL_TILE, WALL_MARGIN } from "./constants.js";
import { coverImage, drawShopWall, drawShopFloor } from "./textures.js";

let covers = null;
// Up to 40 of the real covers, waited for once (at most 4s) and reused for every theme.
function loadCovers(wall) {
  if (!covers) {
    const recs = wall.flatMap((p) => p.crates.flatMap((cr) => cr.recs.map((r) => r.c))).filter((c) => c.front).slice(0, 40);
    const all = Promise.allSettled(recs.map(coverImage)).then((rs) => rs.filter((x) => x.status === "fulfilled").map((x) => x.value));
    covers = Promise.race([all, new Promise((r) => setTimeout(r, 4000))]).then((imgs) => imgs || []);
  }
  return covers;
}

// A defocused record-shop wall and floor. They sit in the world, so the wall parallaxes as the camera travels.
export function ShopWall({ wall, theme }) {
  const [images, setImages] = useState(null);
  useEffect(() => { let live = true; loadCovers(wall).then((imgs) => live && setImages(imgs)); return () => { live = false; }; }, [wall]);
  const n = wall.length, cx = ((n - 1) * PITCH) / 2, width = n * PITCH + 2 * EDGE_PAD + 2 * WALL_MARGIN;
  const maps = useMemo(() => {
    if (!images) return null;
    const w = drawShopWall(images, theme);
    w.repeat.set(width / WALL_TILE, 1);
    return { wall: w, floor: drawShopFloor(theme) };
  }, [images, theme.dark, width]);
  useEffect(() => () => { if (maps) { maps.wall.dispose(); maps.floor.dispose(); } }, [maps]);
  if (!maps) return null;
  const depth = 2 * -WALL_Z;
  return (
    <group>
      <mesh position={[cx, WALL_H / 2, WALL_Z]}>
        <planeGeometry args={[width, WALL_H]} />
        <meshBasicMaterial map={maps.wall} toneMapped={false} />
      </mesh>
      <mesh position={[cx, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial map={maps.floor} toneMapped={false} />
      </mesh>
    </group>
  );
}
