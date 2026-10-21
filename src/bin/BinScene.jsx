import React, { useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PITCH, CAM, colX } from "./constants.js";
import { useThemeBg } from "./theme.js";
import { store, dragging, travel, pointerN } from "./store.js";
import { ensureAudio, sfx } from "./sound.js";
import { buildPicks } from "./data.js";
import { Cabinet } from "./Cabinet.jsx";
import { Compartment } from "./Compartment.jsx";
import { CameraRig } from "./CameraRig.jsx";
import { Inspect } from "./Inspect.jsx";
import { ShopWall } from "./ShopWall.jsx";
import { Hud } from "./Hud.jsx";

// A soft room environment for reflections; the warm key light lives in CameraRig.
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.32;
    return () => { env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

// The shop wall fills the view behind the bin, and the fog fades the far stacks into the wall's colour.
function Scene({ wall }) {
  const theme = useThemeBg();
  return (
    <>
      <fog attach="fog" args={[theme.wall, 2.6, 4.6]} />
      <ShopWall wall={wall} theme={theme} />
      <Environment />
      <hemisphereLight args={["#fff2df", "#5a3a28", 0.55]} />
      <CameraRig />
      <Cabinet wall={wall} />
      {wall.map((p) => p.crates.map((c) => <Compartment key={c.id} crate={c} x={colX(p.col)} />))}
      <Inspect />
    </>
  );
}

// Input: wheel and drag move along the bin, arrow keys step, Home/End jump to the ends.
function App({ wall }) {
  const wrapRef = useRef();
  useEffect(() => {
    const el = wrapRef.current;
    const clamp = (v) => Math.max(travel.min, Math.min(travel.max, v));
    const nudge = (dx) => { travel.target = clamp(travel.target + dx); if (!store.get().moved) store.set({ moved: true }); };
    let down = null;
    const pd = (e) => { ensureAudio(); if (store.get().inspect) return; down = { x: e.clientX, t: travel.target }; };
    const pm = (e) => {
      pointerN.x = (e.clientX / innerWidth) * 2 - 1; pointerN.y = (e.clientY / innerHeight) * 2 - 1;
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!dragging.v && Math.abs(dx) > 8) { dragging.v = true; document.body.classList.add("dragging"); store.set({ hover: null }); }
      if (dragging.v) { travel.target = clamp(down.t - dx * 0.003); if (!store.get().moved) store.set({ moved: true }); }
    };
    const pu = () => { down = null; setTimeout(() => { dragging.v = false; document.body.classList.remove("dragging"); }, 0); };
    const wh = (e) => { if (store.get().inspect) return; e.preventDefault(); nudge((e.deltaY + e.deltaX) * 0.0016); };
    const kd = (e) => {
      ensureAudio();
      const s = store.get();
      if (s.inspect) {
        if (e.key === "Escape") store.set({ closing: true });
        if (e.key === "f" || e.key === "F") { sfx("slide"); store.set({ flipped: !s.flipped }); }
        if (e.key === "s" || e.key === "S") { sfx("slide"); store.set({ out: !s.out }); }
        return;
      }
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(PITCH * 2); }
      if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-PITCH * 2); }
      if (e.key === "Home") nudge(-1e3);
      if (e.key === "End") nudge(1e3);
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
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 38, near: 0.05, far: 20, position: [0, CAM.y, CAM.z] }}
        gl={{ alpha: true, antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 0.95 }}
        onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap; document.body.classList.add("ready"); }}>
        <Scene wall={wall} />
      </Canvas>
      <div className="lens" aria-hidden="true" />
      <Hud />
    </div>
  );
}

const fonts = ['66px "Permanent Marker"', '40px "DM Serif Display"', 'italic 40px "DM Serif Display"', '40px "Archivo Black"', '500 40px "Oswald"', '600 40px "Oswald"', '30px "DM Sans"'];

// `shelf` is the real catalogue from src/data.js; empty slots get placeholder records.
export function mountBin(el, shelf) {
  Promise.race([
    Promise.all(fonts.map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 3500)),
  ]).finally(() => {
    const wall = buildPicks(shelf);
    createRoot(el).render(<App wall={wall} />);
  });
}
