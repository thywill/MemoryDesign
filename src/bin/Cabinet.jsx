import React, { useMemo } from "react";
import * as THREE from "three";
import { PITCH, EDGE_PAD, colX } from "./constants.js";
import { woodMat, drawPlate, perforated } from "./textures.js";

export function Cabinet({ wall }) {
  const W = woodMat();
  const plates = useMemo(() => wall.map((p) => drawPlate(p.plate)), [wall]);
  const perf = useMemo(() => { const t = perforated(); t.repeat.set(wall.length * 0.9, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }); }, [wall]);
  const n = wall.length, L = n * PITCH + 2 * EDGE_PAD, cx = ((n - 1) * PITCH) / 2;
  return (
    <group>
      <mesh material={W.face} position={[cx, 0.37, 0]} castShadow receiveShadow><boxGeometry args={[L, 0.74, 0.84]} /></mesh>
      <mesh material={W.face} position={[cx, 0.845, -0.2]} castShadow receiveShadow><boxGeometry args={[L, 0.21, 0.44]} /></mesh>
      <mesh material={W.face} position={[cx, 1.04, -0.42 - 0.02]} castShadow receiveShadow><boxGeometry args={[L, 0.62, 0.04]} /></mesh>
      <mesh material={perf} position={[cx, 0.32, 0.421]}><planeGeometry args={[L - 0.08, 0.5]} /></mesh>
      {plates.map((t, i) => (
        <mesh key={i} position={[colX(i), 0.66, 0.422]}>
          <planeGeometry args={[0.24, 0.045]} /><meshStandardMaterial map={t} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
