import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { S, N, LEAN, zFor } from "./constants.js";
import { store, registry, clock } from "./store.js";
import { drawWornCover, coverImage, recGeo, paperBack, wornEdge } from "./textures.js";
import { sfx } from "./sound.js";

// A record in a compartment: springy, cascading, a little untidy.
export function Record({ rec, k, crateState }) {
  const g = useRef(), m = useRef();
  const w = rec.c.wear;
  const mats = useMemo(() => {
    rec.tex = rec.tex || drawWornCover(rec.c, 256);
    const front = w.sleeved
      ? new THREE.MeshPhysicalMaterial({ map: rec.tex, roughness: 0.68, clearcoat: 0.85, clearcoatRoughness: 0.28, envMapIntensity: 0.4 })
      : new THREE.MeshStandardMaterial({ map: rec.tex, roughness: 0.78, envMapIntensity: 0.3 });
    const edge = new THREE.MeshStandardMaterial({ color: wornEdge(rec.c), roughness: 0.85, envMapIntensity: 0.3 });
    return [edge, edge, edge, edge, front, paperBack];
  }, [rec]);
  // once the real cover arrives, the edges take its colour
  useEffect(() => { if (rec.c.front) coverImage(rec.c).then(() => mats[0].color.set(wornEdge(rec.c)), () => {}); }, [rec, mats]);
  useEffect(() => { registry.set(rec.id, m.current); return () => registry.delete(rec.id); }, [rec]);
  const st = useRef({ a: -LEAN + w.lean, v: 0, y: 0, vy: 0, rz: w.rz, tgt: -LEAN + w.lean, pend: null, since: 0 });
  useFrame((_, dt) => {
    const { h, px } = crateState.current, c = st.current;
    const rest = -LEAN + w.lean;
    let a = rest, y = 0, rz = w.rz;
    if (h >= 0) {
      if (k < h) a = Math.min(0.86, 0.5 + (h - 1 - k) * 0.034 + w.lean * 0.3);   // pushed forward, resting on each other
      else if (k === h) { a = -0.03; y = 0.09; rz = -px * 0.09; }                 // pinched and lifted
    }
    // records start moving one after another, outward from your finger
    if (Math.abs(a - c.tgt) > 1e-4) {
      if (c.pend === null || Math.abs(c.pend - a) > 1e-4) { c.pend = a; c.since = clock.t; }
      const delay = h >= 0 ? Math.abs(h - 1 - k) * 0.011 : (N - k) * 0.006;
      if (clock.t - c.since >= delay) {
        if ((a > 0.2) !== (c.tgt > 0.2)) sfx("flick");
        c.tgt = a; c.pend = null;
      }
    }
    // a damped spring, stepped finely so it never explodes
    const steps = Math.ceil(Math.min(dt, 0.05) / 0.008), sd = Math.min(dt, 0.05) / steps;
    for (let i = 0; i < steps; i++) {
      c.v += ((c.tgt - c.a) * 210 - c.v * 19) * sd; c.a += c.v * sd;
      c.vy += ((y - c.y) * 260 - c.vy * 24) * sd; c.y += c.vy * sd;
    }
    c.rz = THREE.MathUtils.damp(c.rz, rz, 10, dt);
    g.current.rotation.set(c.a, 0, c.rz);
    g.current.position.y = c.y;
    m.current.visible = store.get().inspect?.rec.id !== rec.id;
  });
  return (
    <group ref={g} position={[w.dx, 0, zFor(k)]}>
      <mesh ref={m} geometry={recGeo} material={mats} position={[0, S / 2, 0]} scale={[1, 1, w.gatefold ? 1.9 : 1]} castShadow receiveShadow />
    </group>
  );
}
