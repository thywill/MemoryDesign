import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PITCH, EDGE_PAD, TIER_Z, CAM, playerXFor, PLAYER_W, PLAYER_REACH } from "./constants.js";
import { PICKERS } from "./data.js";
import { store, clock, dragging, camX, travel, started, pointerN } from "./store.js";
import { phoneZoomed } from "./hand.js";

const look = new THREE.Vector3();

// Sliding along the bin. The left end stays out of frame; the right end reaches the record player.
export function CameraRig() {
  const { camera, scene, events } = useThree();
  const light = useRef();
  useEffect(() => { scene.add(light.current.target); }, [scene]);
  const last = useRef(-1);
  useFrame((_, dt) => {
    clock.t += Math.min(dt, 0.05);
    const d = Math.min(dt, 0.05), insp = !!store.get().inspect;
    const px = insp ? 0 : pointerN.x, py = insp ? 0 : pointerN.y;
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const zoom = phoneZoomed() && !insp ? 0.85 : 0;
    const z = CAM.z - zoom;
    const halfW = Math.tan(hHalf) * (z - TIER_Z[0]);
    const lo = -PITCH / 2 - EDGE_PAD + halfW, hi = playerXFor(PICKERS.length) + PLAYER_W + PLAYER_REACH - halfW;
    travel.min = lo <= hi ? lo : (lo + hi) / 2; travel.max = lo <= hi ? hi : (lo + hi) / 2;
    if (!started.v) { travel.target = travel.min; camera.position.x = travel.min; started.v = true; }
    travel.target = Math.max(travel.min, Math.min(travel.max, travel.target));
    const before = camera.position.x;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, travel.target + px * 0.03, 4.5, d);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, CAM.y - py * 0.03 - (zoom ? 0.08 : 0), 4, d);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, z, 2.4, d);
    camX.v = camera.position.x;
    look.set(camera.position.x, CAM.lookY - py * 0.02 - (zoom ? 0.14 : 0), CAM.lookZ);
    camera.lookAt(look);
    light.current.position.set(camera.position.x - 0.9, 3.6, 2.6);
    light.current.target.position.set(camera.position.x, 0.95, 0);
    if (Math.abs(before - camera.position.x) > 1e-5 && !insp && !dragging.v) events.update?.();
    const p = travel.max > travel.min ? (camera.position.x - travel.min) / (travel.max - travel.min) : 0;
    if (Math.abs(p - last.current) > 0.004) { last.current = p; store.set({ progress: Math.max(0, Math.min(1, p)) }); }
  });
  return (
    <directionalLight ref={light} intensity={1.15} color="#ffdcae" castShadow
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.015} shadow-radius={4}
      shadow-camera-left={-3.4} shadow-camera-right={3.4} shadow-camera-top={2.4} shadow-camera-bottom={-2.4}
      shadow-camera-near={0.5} shadow-camera-far={8} />
  );
}
