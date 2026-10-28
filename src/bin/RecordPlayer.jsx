import React, { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { woodMat, drawCardDivider, drawDisc, tex, mkCanvas } from "./textures.js";
import { useStore } from "./store.js";

// Sits PLAYER_GAP past the cabinet's right edge. The platter turns at 33⅓ rpm.
export function RecordPlayer({ x }) {
  const W = woodMat(), platter = useRef(), arm = useRef();
  const playing = useStore((s) => s.onPlayer);
  const discMat = useMemo(() => {
    if (!playing?.c?.sideA || !playing.c.wear) return null;
    return new THREE.MeshPhysicalMaterial({ map: drawDisc(playing.c), roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide });
  }, [playing]);
  useEffect(() => () => { discMat?.map?.dispose(); discMat?.dispose(); }, [discMat]);
  const label = useMemo(() => {
    const cv = mkCanvas(256, 256), g = cv.getContext("2d");
    g.fillStyle = "#111"; g.fillRect(0, 0, 256, 256);
    for (let r = 40; r < 128; r += 1.5) { g.strokeStyle = r % 3 < 1.5 ? "#1c1c1e" : "#141416"; g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = "#c4492f"; g.beginPath(); g.arc(128, 128, 38, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f4efe4"; g.font = `600 13px "Oswald"`; g.textAlign = "center"; g.fillText("NOW PLAYING", 128, 124); g.fillText("SIDE A", 128, 142);
    return new THREE.MeshPhysicalMaterial({ map: tex(cv), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
  }, []);
  const card = useMemo(() => new THREE.MeshStandardMaterial({ map: drawCardDivider("Listen here"), roughness: 0.9 }), []);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    platter.current.rotation.y -= d * 3.49;
    if (arm.current) arm.current.rotation.x = THREE.MathUtils.damp(arm.current.rotation.x, playing ? 0.4 : 0, 5, d);
  });
  return (
    <group position={[x, 0, 0.05]}>
      <mesh material={W.face} position={[0, 0.36, 0]} castShadow receiveShadow><boxGeometry args={[0.95, 0.72, 0.6]} /></mesh>
      <mesh material={W.inner} position={[0, 0.36, 0.301]}><planeGeometry args={[0.8, 0.5]} /></mesh>
      {[-0.2, 0.2].map((sx) => <mesh key={sx} position={[sx, 0.36, 0.302]}><circleGeometry args={[0.13, 40]} /><meshStandardMaterial color="#1b1714" roughness={0.9} /></mesh>)}
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow><boxGeometry args={[0.5, 0.08, 0.38]} /><meshStandardMaterial color="#2a2522" roughness={0.45} metalness={0.1} /></mesh>
      <group ref={platter} position={[-0.04, 0.81, 0]}>
        <mesh castShadow><cylinderGeometry args={[0.155, 0.155, 0.012, 64]} /><meshStandardMaterial color="#9a9a9a" metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, 0.008, 0]} material={label}><cylinderGeometry args={[0.149, 0.149, 0.003, 64]} /></mesh>
        {discMat && <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={discMat}><circleGeometry args={[0.149, 48]} /></mesh>}
      </group>
      <mesh ref={arm} position={[0.17, 0.835, -0.1]} rotation={[0, 0.5, 0]} castShadow><boxGeometry args={[0.012, 0.01, 0.24]} /><meshStandardMaterial color="#c9c9c9" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0.18, 0.82, -0.14]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.04, 20]} /><meshStandardMaterial color="#c9c9c9" metalness={0.8} roughness={0.3} /></mesh>
      <group position={[0, 0.72, -0.31]} rotation={[-0.12, 0, 0.03]}>
        <mesh material={card} position={[0, 0.2, 0]}><planeGeometry args={[0.34, 0.38]} /></mesh>
      </group>
    </group>
  );
}
