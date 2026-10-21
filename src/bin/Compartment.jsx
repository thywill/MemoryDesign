import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { S, N, GAP, LEAN, W_IN, D_IN, WT, FRONT_H, SIDE_H, SIDE_T, PITCH, PICK_H, TIER_Y, TIER_Z, zFor, zTop0 } from "./constants.js";
import { store, noRay, dragging, camX } from "./store.js";
import { woodMat, drawCardDivider } from "./textures.js";
import { sfx } from "./sound.js";
import { Record } from "./Record.jsx";

// A stack plus its divider, and an invisible picking box that maps the pointer to a record:
// the front face is the front record, the top is whichever edge is under the pointer.
export function Compartment({ crate, x }) {
  const outer = useRef(), grp = useRef(), pickRef = useRef();
  const state = useRef({ h: -1, px: 0 });
  const W = woodMat();
  const divider = useMemo(() => new THREE.MeshStandardMaterial({ map: drawCardDivider(crate.genre), roughness: 0.92, envMapIntensity: 0.25 }), [crate]);
  const setH = (h, px) => {
    state.current.px = px;
    if (state.current.h === h) return;
    state.current.h = h;
    if (h >= 0) store.set({ hover: crate.recs[h].c, hoverCrate: crate.id });
    else if (store.get().hoverCrate === crate.id) store.set({ hover: null, hoverCrate: null });
  };
  useFrame(() => {
    // only stacks near the camera render
    const near = Math.abs(x - camX.v) < 3.2;
    outer.current.visible = near;
    const on = near && !store.get().inspect && !dragging.v;
    pickRef.current.raycast = on ? THREE.Mesh.prototype.raycast : noRay;
    if (!on && state.current.h >= 0) setH(-1, 0);
  });
  const onMove = (e) => {
    if (store.get().inspect || dragging.v) return;
    e.stopPropagation();
    const p = grp.current.worldToLocal(e.point.clone());
    let k;
    if (p.y < PICK_H - 0.004 && p.z > D_IN / 2 - 0.004) k = 0;
    else k = Math.round((zTop0 - p.z) / GAP);
    setH(Math.max(0, Math.min(N - 1, k)), Math.max(-0.5, Math.min(0.5, p.x / W_IN)));
  };
  const onClick = (e) => {
    if (e.delta > 6 || store.get().inspect || dragging.v) return;
    onMove(e);
    const h = state.current.h; if (h < 0) return;
    sfx("slide");
    store.set({ inspect: { rec: crate.recs[h] }, flipped: false, closing: false, out: false, hover: null });
  };
  return (
    <group ref={outer} position={[x, TIER_Y[crate.tier] + WT, TIER_Z[crate.tier]]}>
      <group ref={grp}>
        <mesh material={W.inner} position={[0, -WT / 2, 0]} receiveShadow><boxGeometry args={[PITCH, WT, D_IN + 2 * WT]} /></mesh>
        <mesh material={W.side} position={[PITCH / 2, SIDE_H / 2, 0]} castShadow receiveShadow><boxGeometry args={[SIDE_T, SIDE_H, D_IN]} /></mesh>
        <mesh material={W.face} position={[0, FRONT_H / 2, D_IN / 2 + WT / 2]} castShadow receiveShadow><boxGeometry args={[PITCH, FRONT_H, WT]} /></mesh>
        {crate.recs.map((rec, k) => <Record key={rec.id} rec={rec} k={k} crateState={state} />)}
        <group position={[0, crate.lift, zFor(N) - 0.006]} rotation={[-LEAN, 0, crate.tilt]}>
          <mesh position={[0, (S + 0.07) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[W_IN - 0.014, S + 0.07, 0.0025]} />
            <meshStandardMaterial attach="material-0" color="#e9e5da" />
            <meshStandardMaterial attach="material-1" color="#e9e5da" />
            <meshStandardMaterial attach="material-2" color="#e9e5da" />
            <meshStandardMaterial attach="material-3" color="#e9e5da" />
            <primitive object={divider} attach="material-4" />
            <meshStandardMaterial attach="material-5" color="#e9e5da" />
          </mesh>
        </group>
        <mesh ref={pickRef} position={[0, PICK_H / 2, 0.01]} onPointerMove={onMove} onPointerDown={onMove}
          onPointerOut={() => setH(-1, 0)} onClick={onClick}>
          <boxGeometry args={[PITCH, PICK_H, D_IN + 2 * WT]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
