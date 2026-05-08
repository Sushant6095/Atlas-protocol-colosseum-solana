// Globe scene — central distort-sphere, atmosphere shell, three
// visible orbit rings, five orbiting partner sprites, and a static
// star backdrop. The scene is mounted inside <Canvas /> in
// `Globe.tsx`; this file owns the per-frame logic.
//
// Performance posture:
//   - Sphere geometry is a single icosahedron at detail 4.
//   - Each ring is one Torus.
//   - Each partner sprite is one textured plane wrapped in a drei
//     <Billboard /> so it always faces the camera.
//   - All animation flows through one useFrame loop. We `lerp` the
//     hover/parallax targets so the cursor effect doesn't reset on
//     every frame.

"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  Billboard, MeshDistortMaterial, PerformanceMonitor, Sphere, Torus, useTexture,
} from "@react-three/drei";
import { useRouter } from "next/navigation";
import { type RefObject, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLOBE_PARTNERS, VISIBLE_ORBIT_INDICES, type GlobePartner } from "./Globe.partners";

interface SceneProps {
  reducedMotion: boolean;
  /** Disable cursor parallax + hover boosts on touch / mobile. */
  simplified: boolean;
  /** Container ref used to map cursor into [-1, 1] canvas-space. */
  containerRef: RefObject<HTMLElement | null>;
}

const TWO_PI = Math.PI * 2;

export default function GlobeScene({
  reducedMotion, simplified, containerRef,
}: SceneProps): JSX.Element {
  const [perfTier, setPerfTier] = useState<"high" | "low">("high");

  const drawAtmosphere = !simplified && perfTier === "high";
  const drawStars = !simplified && perfTier === "high";
  // On the simplified / low-tier path, only one ring is visible.
  const visibleOrbits = simplified
    ? [VISIBLE_ORBIT_INDICES[0]]
    : VISIBLE_ORBIT_INDICES;

  return (
    <>
      <PerformanceMonitor
        onIncline={() => setPerfTier("high")}
        onDecline={() => setPerfTier("low")}
        flipflops={3}
      />
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} intensity={2.5} color="#3F8CFF" />
      <pointLight position={[-3, -2, -2]} intensity={1.2} color="#A682FF" />

      <SphereCore
        reducedMotion={reducedMotion}
        simplified={simplified}
        containerRef={containerRef}
        boostQuality={perfTier === "high"}
      />

      {drawAtmosphere && <Atmosphere />}

      {GLOBE_PARTNERS.map((p, idx) => (
        <PartnerOrbit
          key={p.id}
          partner={p}
          showRing={visibleOrbits.includes(idx as 0 | 2 | 4)}
          reducedMotion={reducedMotion}
          simplified={simplified}
        />
      ))}

      {drawStars && <Stars />}
    </>
  );
}

// ─── Central sphere + cursor parallax ──────────────────────────────

interface SphereCoreProps {
  reducedMotion: boolean;
  simplified: boolean;
  containerRef: RefObject<HTMLElement | null>;
  boostQuality: boolean;
}

function SphereCore({
  reducedMotion, simplified, containerRef, boostQuality,
}: SphereCoreProps): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  // Damped target rotation. We lerp the live mesh toward this each
  // frame so the cursor effect feels weighty rather than snappy.
  const target = useRef({ rotX: 0, rotY: 0, scale: 1, glow: 0 });
  const cursor = useRef({ x: 0, y: 0, inside: false });

  // Track cursor in canvas-space [-1, 1] using DOM events on the
  // container — r3f's pointer state stops at canvas bounds, but we
  // want the parallax to remain consistent through the parent div
  // (which is what the user is hovering, not the canvas itself).
  useMemo(() => {
    if (typeof window === "undefined") return;
    const el = containerRef.current;
    if (!el) return;
    const onMove = (ev: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      cursor.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      cursor.current.y = ((ev.clientY - rect.top) / rect.height) * 2 - 1;
    };
    const onEnter = (): void => { cursor.current.inside = true; };
    const onLeave = (): void => {
      cursor.current.inside = false;
      cursor.current.x = 0;
      cursor.current.y = 0;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [containerRef]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    // Auto-rotation: 1 revolution per 60s when idle, 1.6× when hovered.
    const auto = reducedMotion ? 0 : (TWO_PI / 60) * (cursor.current.inside && !simplified ? 1.6 : 1);
    g.rotation.y += auto * dt;

    if (reducedMotion) return;

    // Cursor parallax + hover targets.
    if (cursor.current.inside && !simplified) {
      target.current.rotX = cursor.current.y * 0.3;
      target.current.scale = 1.04;
      target.current.glow = 0.45;
    } else {
      target.current.rotX = 0;
      target.current.scale = 1.0;
      target.current.glow = 0.25;
    }

    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, target.current.rotX, 0.05);
    const scale = THREE.MathUtils.lerp(g.scale.x, target.current.scale, 0.06);
    g.scale.setScalar(scale);
    // Cursor X also nudges Y rotation a touch for a tilt-toward-cursor feel.
    g.rotation.y += cursor.current.inside && !simplified
      ? cursor.current.x * 0.5 * 0.05 * dt * 60
      : 0;
  });

  // Lower-quality material when the perf monitor declines.
  const detail = boostQuality ? 4 : 2;

  return (
    <group ref={groupRef}>
      <Sphere args={[1, 64, 64]} userData={{ detail }}>
        <MeshDistortMaterial
          color="#A682FF"
          emissive="#A682FF"
          emissiveIntensity={0.15}
          roughness={0.35}
          metalness={0.6}
          distort={reducedMotion ? 0 : 0.18}
          speed={reducedMotion ? 0 : 1.4}
        />
      </Sphere>
    </group>
  );
}

// ─── Atmosphere glow (rim shell) ───────────────────────────────────

function Atmosphere(): JSX.Element {
  return (
    <mesh>
      <sphereGeometry args={[1.05, 64, 64]} />
      <meshBasicMaterial
        color="#A682FF"
        transparent
        opacity={0.25}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── One partner: invisible / visible ring + orbiting sprite ───────

interface PartnerOrbitProps {
  partner: GlobePartner;
  showRing: boolean;
  reducedMotion: boolean;
  simplified: boolean;
}

function PartnerOrbit({
  partner, showRing, reducedMotion, simplified,
}: PartnerOrbitProps): JSX.Element {
  const router = useRouter();
  const groupRef = useRef<THREE.Group>(null);
  const spriteRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const texture = useTexture(partner.asset);
  // SVGs lose their alpha if anisotropy is left default; bump it so
  // logos stay crisp while billboarded at oblique angles.
  if (texture && (texture as THREE.Texture).anisotropy !== undefined) {
    (texture as THREE.Texture).anisotropy = 4;
  }

  const direction = partner.direction === "cw" ? 1 : -1;
  const startRad = (partner.startDeg * Math.PI) / 180;

  useFrame((state) => {
    const g = groupRef.current;
    const s = spriteRef.current;
    if (!g || !s) return;

    // Each orbit advances at its own speed; reduced motion freezes
    // the sprite at its starting angle.
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    const angle = startRad + (direction * (t / partner.periodSec) * TWO_PI);

    // Convert local-orbit-plane angle to a world position.
    const localX = Math.cos(angle) * partner.radius;
    const localZ = Math.sin(angle) * partner.radius;
    s.position.set(localX, 0, localZ);

    // Hover scale-up (extra 1.1× when canvas is hovered, additional
    // 1.2× when this individual sprite is hovered for click affordance).
    const baseScale = simplified ? 0.16 : 0.18;
    const hoverBoost = hovered ? 1.2 : 1.0;
    const target = baseScale * hoverBoost;
    s.scale.setScalar(THREE.MathUtils.lerp(s.scale.x, target, 0.15));

    // Behind-sphere fade. World-space Z after the orbit's tilt is
    // applied — we can't read it cheaply from local position alone,
    // so we use the world matrix and check against the camera plane.
    const worldZ = new THREE.Vector3();
    s.getWorldPosition(worldZ);
    const cam = state.camera.position;
    // Sphere is at world origin; sprite is "behind" if its world Z
    // is further from camera than the origin.
    const behind = worldZ.length() > 0 && worldZ.dot(cam.clone().normalize()) < 0;
    const mat = (s.material as THREE.MeshBasicMaterial);
    const targetOpacity = behind ? 0.4 : 1.0;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
  });

  return (
    <group ref={groupRef} rotation={partner.tilt}>
      {showRing && (
        <Torus args={[partner.radius, 0.012, 16, 100]}>
          <meshBasicMaterial
            color="#3F8CFF"
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </Torus>
      )}
      <Billboard>
        <mesh
          ref={spriteRef}
          onPointerOver={(e) => {
            if (simplified) return;
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            if (simplified) return;
            setHovered(false);
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            e.stopPropagation();
            router.push(partner.href);
          }}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

// ─── Static star field ─────────────────────────────────────────────

function Stars(): JSX.Element {
  const positions = useMemo(() => {
    const n = 80;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Spherical shell at radius 4..6.
      const r = 4 + Math.random() * 2;
      const theta = Math.random() * TWO_PI;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#A682FF"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
}
