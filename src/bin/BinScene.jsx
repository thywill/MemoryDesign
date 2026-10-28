import React, { useRef, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PITCH, CAM, WALL_C, colX, playerXFor } from "./constants.js";
import { store, dragging, travel, pointerN } from "./store.js";
import { ensureAudio, sfx } from "./sound.js";
import { notePointer, nudgeCamera, putBack } from "./actions.js";
import { bindWall } from "./hand.js";
import { PhoneLink } from "./PhoneLink.jsx";
import { buildPicks, makeRecord, rnd } from "./data.js";
import { Cabinet } from "./Cabinet.jsx";
import { Compartment } from "./Compartment.jsx";
import { CameraRig } from "./CameraRig.jsx";
import { Inspect } from "./Inspect.jsx";
import { RecordPlayer } from "./RecordPlayer.jsx";
import { Hud } from "./Hud.jsx";
import { brickTexture, neonText, drawWornCover } from "./textures.js";

// A soft room environment for reflections; the warm key light lives in CameraRig.
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.2;
    return () => { env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

// Warm brick room: face-out sleeves, track lights, the neon, and the player past the last column.
function Scene({ wall }) {
  const n = wall.length, playerX = playerXFor(n);
  const L = n * PITCH + 14, cx = ((n - 1) * PITCH) / 2;
  const mats = useMemo(() => {
    const brick = brickTexture(); brick.repeat.set(L / 1.6, 1.4);
    return {
      wall: new THREE.MeshStandardMaterial({ color: "#3a2a22", roughness: 0.95 }),
      brick: new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 }),
      floor: new THREE.MeshStandardMaterial({ color: "#2e2622", roughness: 0.45, envMapIntensity: 0.6 }),
      neon: new THREE.MeshBasicMaterial({ map: neonText("Listen here"), transparent: true, toneMapped: false, depthWrite: false }),
    };
  }, [L]);
  // Real covers where the catalogue has them; a generated sleeve until the image arrives, or if it never does.
  const faces = useMemo(() => {
    const reals = wall.flatMap((p) => p.crates.flatMap((cr) => cr.recs.map((r) => r.c))).filter((c) => c.front);
    const out = [];
    let i = 0;
    for (let x = -0.6; x < playerX + 1.4; x += 0.62) for (const y of [1.66, 2.08]) {
      const src = reals.length ? reals[i % reals.length] : null;
      const c = src
        ? { ...src, wear: { ring: 0, edge: 0.06, fade: 0, sticker: null, sleeved: true, gatefold: false, dx: 0, rz: 0, lean: 0, seed: Math.floor(rnd() * 1e6) } }
        : makeRecord("Wall");
      if (!src) c.wear = { ring: 0, edge: 0.06, fade: 0, sticker: null, sleeved: true, gatefold: false, dx: 0, rz: 0, lean: 0, seed: Math.floor(rnd() * 1e6) };
      out.push({ x, y, t: drawWornCover(c, 192) });
      i++;
    }
    return out;
  }, [wall, playerX]);
  return (
    <>
      <color attach="background" args={[WALL_C]} />
      <fog attach="fog" args={[WALL_C, 4.5, 9]} />
      <Environment />
      <hemisphereLight args={["#ffe9d0", "#3a2418", 0.26]} />
      <CameraRig />
      <mesh material={mats.floor} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, 1]} receiveShadow><planeGeometry args={[L, 6]} /></mesh>
      <mesh material={mats.wall} position={[cx, 1.6, -1.12]} receiveShadow><planeGeometry args={[L, 3.6]} /></mesh>
      <mesh material={mats.brick} position={[cx, 1.85, -1.1]} receiveShadow><planeGeometry args={[L, 1.3]} /></mesh>
      {faces.map((f, i) => (
        <group key={i} position={[f.x, f.y, -1.07]}>
          <mesh position={[0, -0.09, 0.03]} castShadow><boxGeometry args={[0.2, 0.012, 0.06]} /><meshStandardMaterial color="#2b2a28" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[0, 0.02, 0.012]} rotation={[-0.06, 0, 0]} castShadow><boxGeometry args={[0.2, 0.2, 0.004]} />
            <meshStandardMaterial attach="material-0" color="#222" /><meshStandardMaterial attach="material-1" color="#222" />
            <meshStandardMaterial attach="material-2" color="#222" /><meshStandardMaterial attach="material-3" color="#222" />
            <meshStandardMaterial attach="material-4" map={f.t} roughness={0.5} /><meshStandardMaterial attach="material-5" color="#222" />
          </mesh>
        </group>
      ))}
      {faces.filter((_, i) => i % 4 === 0).map((f, i) => (
        <group key={i} position={[f.x + 0.3, 2.78, -0.75]}>
          <mesh rotation={[0.6, 0, 0]}><cylinderGeometry args={[0.035, 0.045, 0.12, 16]} /><meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} /></mesh>
          <mesh position={[0, -0.05, 0.04]} rotation={[0.6 + Math.PI / 2, 0, 0]}><circleGeometry args={[0.032, 16]} /><meshBasicMaterial color="#fff2d6" toneMapped={false} /></mesh>
          <pointLight position={[0, -0.3, -0.1]} intensity={1.4} distance={2.2} decay={1.6} color="#ffcf8f" />
        </group>
      ))}
      <mesh position={[cx, 2.84, -0.75]}><boxGeometry args={[L, 0.02, 0.03]} /><meshStandardMaterial color="#151515" /></mesh>
      <mesh material={mats.neon} position={[playerX, 2.45, -1.05]}><planeGeometry args={[1.25, 0.27]} /></mesh>
      <pointLight position={[playerX, 2.3, -0.7]} intensity={1.8} distance={3} decay={1.4} color="#ff6a4a" />
      <RecordPlayer x={playerX} />
      <Cabinet wall={wall} />
      {wall.map((p) => p.crates.map((c) => <Compartment key={c.id} crate={c} x={colX(p.col)} />))}
      <Inspect />
    </>
  );
}

// Input: wheel and drag move along the bin, arrow keys step, Home/End jump to the ends.
function App({ wall }) {
  const wrapRef = useRef();
  useEffect(() => bindWall(wall), [wall]);
  useEffect(() => {
    const el = wrapRef.current;
    let down = null;
    const pd = (e) => { ensureAudio(); if (store.get().inspect) return; down = { x: e.clientX, t: travel.target }; };
    const pm = (e) => {
      pointerN.x = (e.clientX / innerWidth) * 2 - 1; pointerN.y = (e.clientY / innerHeight) * 2 - 1;
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!dragging.v && Math.abs(dx) > 8) { dragging.v = true; document.body.classList.add("dragging"); store.set({ hover: null }); }
      if (dragging.v) { notePointer(); travel.target = Math.max(travel.min, Math.min(travel.max, down.t - dx * 0.003)); if (!store.get().moved) store.set({ moved: true }); }
    };
    const pu = () => { down = null; setTimeout(() => { dragging.v = false; document.body.classList.remove("dragging"); }, 0); };
    const wh = (e) => { if (store.get().inspect) return; e.preventDefault(); nudgeCamera((e.deltaY + e.deltaX) * 0.0016); };
    const kd = (e) => {
      ensureAudio();
      const s = store.get();
      if (s.inspect) {
        if (e.key === "Escape") putBack();
        if (e.key === "f" || e.key === "F") { sfx("slide"); store.set({ flipped: !s.flipped }); }
        if (e.key === "s" || e.key === "S") { sfx("slide"); store.set({ out: !s.out }); }
        return;
      }
      if (e.key === "ArrowRight") { e.preventDefault(); nudgeCamera(PITCH * 2); }
      if (e.key === "ArrowLeft") { e.preventDefault(); nudgeCamera(-PITCH * 2); }
      if (e.key === "Home") nudgeCamera(-1e3);
      if (e.key === "End") nudgeCamera(1e3);
    };
    el.addEventListener("pointerdown", pd);
    addEventListener("pointermove", pm);
    addEventListener("pointerup", pu);
    addEventListener("pointercancel", pu);
    el.addEventListener("wheel", wh, { passive: false });
    addEventListener("keydown", kd);
    return () => {
      el.removeEventListener("pointerdown", pd); removeEventListener("pointermove", pm);
      removeEventListener("pointerup", pu); removeEventListener("pointercancel", pu);
      el.removeEventListener("wheel", wh); removeEventListener("keydown", kd);
    };
  }, []);
  return (
    <div ref={wrapRef} className="stage">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 42, near: 0.05, far: 20, position: [0, CAM.y, CAM.z] }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 0.95 }}
        onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap; document.body.classList.add("ready"); }}>
        <Scene wall={wall} />
      </Canvas>
      <div className="lens" aria-hidden="true" />
      <Hud />
      <PhoneLink />
    </div>
  );
}

const fonts = ['66px "Permanent Marker"', '40px "DM Serif Display"', 'italic 40px "DM Serif Display"', '40px "Archivo Black"', '500 40px "Oswald"', '600 40px "Oswald"', '30px "DM Sans"'];

// `shelf` may still be loading. Fonts start immediately so the welcome screen is not waiting on them.
export function mountBin(el, shelf) {
  Promise.all([
    Promise.race([
      Promise.all(fonts.map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 3500)),
    ]),
    Promise.resolve(shelf),
  ]).then(([, data]) => {
    createRoot(el).render(<App wall={buildPicks(data)} />);
  });
}
