import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { S } from "./constants.js";
import { useThemeBg } from "./theme.js";
import { store, useStore, registry, pointerN } from "./store.js";
import { drawWornCover, drawBack, drawDisc, imageTexture, recGeo, wornEdge } from "./textures.js";
import { sfx } from "./sound.js";

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), up = new THREE.Vector3();
const dir = new THREE.Vector3(), q1 = new THREE.Quaternion();
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeO = (t) => 1 - Math.pow(1 - t, 3);

// In your hands: lift it out, bring it close, tilt it, flip it (F), slide the vinyl out (S), put it back (Esc).
export function Inspect() {
  const insp = useStore((s) => s.inspect);
  const { camera, size } = useThree();
  const { bg, dark } = useThemeBg();
  const backdrop = dark ? 0.9 : 0.86;
  const grp = useRef(), inner = useRef(), disc = useRef(), bd = useRef();
  const t = useRef(0), flip = useRef(0), tilt = useRef({ x: 0, y: 0 }), slide = useRef(0);
  const mats = useMemo(() => {
    if (!insp) return null;
    const c = insp.rec.c;
    const edge = new THREE.MeshStandardMaterial({ color: wornEdge(c), roughness: 0.85 });
    const front = c.wear.sleeved
      ? new THREE.MeshPhysicalMaterial({ map: drawWornCover(c, 768), roughness: 0.6, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 0.6 })
      : new THREE.MeshStandardMaterial({ map: drawWornCover(c, 768), roughness: 0.78, envMapIntensity: 0.3 });
    return [edge, edge, edge, edge, front, new THREE.MeshStandardMaterial({ map: drawBack(c), roughness: 0.8, envMapIntensity: 0.3 })];
  }, [insp]);
  // the real back scan replaces the drawn back once it has loaded
  useEffect(() => {
    const src = insp?.rec.c.back;
    if (!src || !mats) return;
    let live = true;
    imageTexture(src).then((tx) => { if (live) { mats[5].map.dispose(); mats[5].map = tx; } else tx.dispose(); }, () => {});
    return () => { live = false; };
  }, [insp, mats]);
  const discMats = useMemo(() => {
    if (!insp) return null;
    const face = new THREE.MeshPhysicalMaterial({ map: drawDisc(insp.rec.c), roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.1 });
    return [new THREE.MeshStandardMaterial({ color: "#111" }), face, face];
  }, [insp]);
  useEffect(() => { t.current = 0; flip.current = 0; slide.current = 0; tilt.current = { x: 0, y: 0 }; }, [insp]);

  useFrame((state, dt) => {
    if (!insp || !grp.current) return;
    const s = store.get(), d = Math.min(dt, 0.05);
    // close the sleeve first, then put it back
    const wantOut = s.out && !s.closing;
    slide.current = THREE.MathUtils.damp(slide.current, wantOut ? 1 : 0, 6, d);
    if (s.closing && slide.current > 0.02) { /* wait for the disc to go back in */ }
    else t.current = Math.max(0, Math.min(1, t.current + (s.closing ? -1 : 1) * d * 1.45));
    if (s.closing && t.current === 0) { sfx("thud"); store.set({ inspect: null, closing: false, flipped: false, out: false }); return; }

    const src = registry.get(insp.rec.id);
    src.getWorldPosition(v1); src.getWorldQuaternion(q1);
    up.set(0, 1, 0).applyQuaternion(q1);
    const aspect = size.width / size.height;
    const fit = S / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, aspect)) * (wantOut || slide.current > 0.05 ? 1.9 : 1.4);
    const dist = Math.max(0.6, fit);
    camera.getWorldDirection(dir);
    v2.copy(camera.position).addScaledVector(dir, dist);
    // first draw it straight up out of the stack, then bring it to you
    const T = t.current, lift = easeO(Math.min(1, T / 0.38)), travelT = easeIO(Math.max(0, (T - 0.3) / 0.7));
    v3.copy(v1).addScaledVector(up, 0.36 * lift);
    grp.current.position.lerpVectors(v3, v2, travelT);
    grp.current.quaternion.slerpQuaternions(q1, camera.quaternion, travelT);
    // in your hands it follows the mouse a little, like you are tilting it to the light
    const held = travelT > 0.95 ? 1 : 0;
    tilt.current.y = THREE.MathUtils.damp(tilt.current.y, held * pointerN.x * 0.42, 5, d);
    tilt.current.x = THREE.MathUtils.damp(tilt.current.x, held * pointerN.y * 0.3, 5, d);
    flip.current = THREE.MathUtils.damp(flip.current, s.flipped && !s.closing ? Math.PI : 0, 6, d);
    const sway = Math.sin(state.clock.elapsedTime * 0.8) * 0.015 * travelT;
    inner.current.rotation.set(tilt.current.x + sway, flip.current + tilt.current.y, Math.sin(flip.current) * 0.05);
    disc.current.position.x = slide.current * 0.2 * (s.flipped ? -1 : 1);
    disc.current.rotation.z = slide.current * 0.6;
    disc.current.visible = slide.current > 0.003;
    bd.current.position.copy(camera.position).addScaledVector(dir, dist + 0.35);
    bd.current.quaternion.copy(camera.quaternion);
    bd.current.material.opacity = travelT * backdrop;
  });

  if (!insp) return null;
  return (
    <>
      <group ref={grp}>
        <group ref={inner}>
          <mesh geometry={recGeo} material={mats} castShadow
            onClick={(e) => { e.stopPropagation(); sfx("slide"); store.set({ flipped: !store.get().flipped }); }} />
          <mesh ref={disc} rotation={[Math.PI / 2, 0, 0]} material={discMats}>
            <cylinderGeometry args={[0.149, 0.149, 0.0016, 128]} />
          </mesh>
        </group>
      </group>
      <mesh ref={bd} renderOrder={5} onClick={(e) => { e.stopPropagation(); store.set({ closing: true }); }}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial color={bg} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
