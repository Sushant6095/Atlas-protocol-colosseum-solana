// BackgroundField — Wave 4.
//
// The hero's single 3D scene. A Pleiades-anchored constellation of
// seven bright stars, an instanced dust field, and a slow drift of
// the camera around the cluster. Everything is governed by the
// shared supervisor so:
//
//   - the Canvas mounts only when the host enters the viewport;
//   - the FPS supervisor halves `useFrame` updates when frames go
//     long for >1s, doubles back when they recover;
//   - reduced-motion / low-core devices render the first frame and
//     freeze (no autoplay rotation outside the viewport ever).
//
// Atlas is named for the Pleiades' father (Atlas the Titan); the
// scene's seven primary stars are placed on the canonical Pleiades
// equatorial offsets so the silhouette reads as the constellation,
// not "another particle field."

"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import * as THREE from "three";
import { useSceneSupervisor } from "@/lib/three/supervisor";
import { threeBudget } from "@/lib/tokens";
import Image from "next/image";

// Canonical Pleiades equatorial positions (right-ascension,
// declination), scaled to a unit cube so the constellation is
// recognisable in any viewport. Names: Alcyone, Atlas, Electra,
// Maia, Merope, Taygete, Pleione.
const PLEIADES: { name: string; x: number; y: number; z: number; mag: number }[] = [
  { name: "Alcyone", x:  0.00, y:  0.00, z:  0.0, mag: 1.00 },
  { name: "Atlas",   x:  0.36, y: -0.18, z:  0.1, mag: 0.78 },
  { name: "Electra", x: -0.42, y:  0.22, z: -0.1, mag: 0.66 },
  { name: "Maia",    x: -0.10, y:  0.58, z:  0.0, mag: 0.58 },
  { name: "Merope",  x:  0.18, y: -0.46, z:  0.0, mag: 0.50 },
  { name: "Taygete", x: -0.55, y:  0.04, z:  0.05, mag: 0.46 },
  { name: "Pleione", x:  0.46, y:  0.18, z:  0.0, mag: 0.42 },
];

// Per-tier dust counts. Tier-1 is the desktop / retina default;
// tier-2/3 progressively halve so the GPU stays under budget.
const DUST_COUNT: Record<"tier1" | "tier2" | "tier3", number> = {
  tier1: 600,
  tier2: 300,
  tier3: 120,
};

export interface BackgroundFieldProps {
  /** Maximum px height; aspect-square inside it. */
  maxHeightPx?: number;
  className?: string;
}

export function BackgroundField({
  maxHeightPx = 560, className,
}: BackgroundFieldProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const supervisor = useSceneSupervisor(hostRef, { surface: "landing" });
  const dustCount = DUST_COUNT[supervisor.lod];

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={className}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: maxHeightPx,
        aspectRatio: "1 / 1",
        marginInline: "auto",
      }}
    >
      {/* Reduced-motion / low-end fallback — branded still hero. */}
      {(supervisor.freeze || !supervisor.mounted) && <FrozenFallback />}

      {supervisor.mounted && !supervisor.freeze && (
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 2.6], fov: 45 }}
          frameloop="always"
          style={{ position: "absolute", inset: 0 }}
        >
          <SceneInner
            updateMultiplier={supervisor.updateMultiplier}
            dustCount={dustCount}
          />
        </Canvas>
      )}
    </div>
  );
}

function FrozenFallback(): JSX.Element {
  // The fallback is the static brand mark, lightly glowed. No JS,
  // no GPU. Loads even when reduced-motion is set.
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "grid", placeItems: "center",
        background: "radial-gradient(circle at 60% 35%, rgba(166,130,255,0.18) 0%, transparent 65%)",
      }}
    >
      <Image
        src="/brand/atlas-mark.png"
        alt=""
        width={220}
        height={220}
        priority
        style={{ filter: "drop-shadow(0 0 24px rgba(63,140,255,0.45))" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// r3f scene
// ─────────────────────────────────────────────────────────────────

function SceneInner({
  updateMultiplier, dustCount,
}: {
  updateMultiplier: number;
  dustCount: number;
}): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Points>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  // Build dust geometry once per LOD.
  const dustGeometry = useMemo(() => {
    const positions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      // Sphere shell with varying radii around the cluster.
      const r = 0.85 + Math.random() * 0.65;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [dustCount]);

  const dustMaterial = useMemo(() => new THREE.PointsMaterial({
    color: new THREE.Color("#7DB7FF"),
    size: 0.012,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  // FPS-supervisor-aware update loop.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * updateMultiplier;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.06;
      groupRef.current.rotation.x = Math.sin(t * 0.04) * 0.08;
    }
    if (dustRef.current) {
      dustRef.current.rotation.y = -t * 0.02;
    }
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.18 + 0.06 * Math.sin(t * 0.6);
    }
  });

  return (
    <>
      {/* Single focused light source — not ambient flood. */}
      <ambientLight intensity={0.15} />
      <pointLight position={[2, 1.5, 2]} intensity={1.4} color="#7DB7FF" />
      <pointLight position={[-2, -1, -1]} intensity={0.4} color="#A682FF" />

      <group ref={groupRef}>
        {PLEIADES.map((s) => <Star key={s.name} {...s} />)}

        {/* Halo behind the cluster — single pulsing glow. */}
        <mesh ref={haloRef} position={[0, 0, -0.2]}>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshBasicMaterial
            color="#3F8CFF"
            transparent
            opacity={0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      <points ref={dustRef} geometry={dustGeometry} material={dustMaterial} />
    </>
  );
}

function Star({ x, y, z, mag, name }: { name: string; x: number; y: number; z: number; mag: number }): JSX.Element {
  const ref = useRef<THREE.Mesh>(null);
  const radius = 0.045 + mag * 0.06;
  // Atlas (the namesake star) gets a softer cyan-white. Others tint
  // toward zk-violet to match the palette.
  const colour = name === "Atlas" ? "#E6EAF2" : "#B8C7FF";

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const m = ref.current.material as THREE.MeshBasicMaterial;
    // Twinkle — small, deterministic per star via name length.
    const phase = (name.length % 5) * 0.7;
    m.opacity = 0.85 + 0.10 * Math.sin(t * 0.8 + phase);
  });

  return (
    <group position={[x, y, z]}>
      {/* Bright core */}
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial color={colour} transparent opacity={0.95} />
      </mesh>
      {/* Soft halo */}
      <mesh>
        <sphereGeometry args={[radius * 2.6, 16, 16]} />
        <meshBasicMaterial
          color={name === "Atlas" ? "#7DB7FF" : "#A682FF"}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Keep the supervisor budget knobs reachable for tests.
export const __budget = threeBudget;
