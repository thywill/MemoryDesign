import React, { useMemo } from "react";
import { PITCH, EDGE_PAD, colX } from "./constants.js";
import { woodMat, drawPlate } from "./textures.js";

export function Cabinet({ wall }) {
  const W = woodMat();
  const plates = useMemo(() => wall.map((p) => drawPlate(p.plate)), [wall]);
  const n = wall.length, L = n * PITCH + 2 * EDGE_PAD, cx = ((n - 1) * PITCH) / 2;
  return (
    <group>
      <mesh material={W.face} position={[cx, 0.37, 0]} castShadow receiveShadow><boxGeometry args={[L, 0.74, 1.26]} /></mesh>
      <mesh material={W.face} position={[cx, 0.84, -0.21]} castShadow receiveShadow><boxGeometry args={[L, 0.2, 0.84]} /></mesh>
      <mesh material={W.face} position={[cx, 1.04, -0.42]} castShadow receiveShadow><boxGeometry args={[L, 0.2, 0.42]} /></mesh>
      {plates.map((t, i) => (
        <mesh key={i} position={[colX(i), 0.7, 0.632]}>
          <planeGeometry args={[0.24, 0.045]} /><meshStandardMaterial map={t} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
