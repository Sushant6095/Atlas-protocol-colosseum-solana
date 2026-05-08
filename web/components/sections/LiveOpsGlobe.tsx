"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { STAT_FALLBACKS, type LiveStat } from "./Globe.data";

const Globe = dynamic(
  () => import("@/components/magicui/globe").then((m) => m.Globe),
  { ssr: false }
);

const ACCENT: Record<LiveStat["accent"], { text: string; bg: string; line: string }> = {
  electric: { text: "text-accent-electric", bg: "bg-accent-electric", line: "stroke-accent-proof/80" },
  zk:       { text: "text-accent-zk",       bg: "bg-accent-zk",       line: "stroke-accent-proof/80" },
  proof:    { text: "text-accent-proof",    bg: "bg-accent-proof",    line: "stroke-accent-proof/80" },
  execute:  { text: "text-accent-execute",  bg: "bg-accent-execute",  line: "stroke-accent-proof/80" },
};

const POSITION: Record<LiveStat["position"], string> = {
  tl: "top-0 left-0",
  tr: "top-0 right-0",
  bl: "bottom-0 left-0",
  br: "bottom-0 right-0",
};

const LINE_COORDS: Record<LiveStat["position"], { x1: string; y1: string; x2: string; y2: string }> = {
  tl: { x1: "20%", y1: "12%", x2: "40%", y2: "44%" },
  tr: { x1: "80%", y1: "12%", x2: "60%", y2: "44%" },
  bl: { x1: "20%", y1: "88%", x2: "40%", y2: "62%" },
  br: { x1: "80%", y1: "88%", x2: "60%", y2: "62%" },
};

// Magic UI Globe COBEOptions config — same partner regions as before,
// tuned for Atlas accent palette + dark surface. The Magic UI wrapper
// owns auto-rotation, drag interaction, and resize handling.
const GLOBE_CONFIG = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 1.4,
  mapSamples: 16000,
  mapBrightness: 4.5,
  baseColor: [0.18, 0.20, 0.27] as [number, number, number],
  markerColor: [0.247, 0.549, 1.0] as [number, number, number],   // accent.electric
  glowColor: [0.651, 0.510, 1.0] as [number, number, number],     // accent.zk
  markers: [
    // RPC + oracle datacenter regions
    { location: [37.7749,  -122.4194] as [number, number], size: 0.10 },
    { location: [40.7128,  -74.0060]  as [number, number], size: 0.10 },
    { location: [51.5074,  -0.1278]   as [number, number], size: 0.10 },
    { location: [50.1109,  8.6821]    as [number, number], size: 0.10 },
    { location: [1.3521,   103.8198]  as [number, number], size: 0.10 },
    { location: [35.6762,  139.6503]  as [number, number], size: 0.10 },
    // Scatter — global reach
    { location: [34.0522,  -118.2437] as [number, number], size: 0.04 },
    { location: [47.6062,  -122.3321] as [number, number], size: 0.04 },
    { location: [41.8781,  -87.6298]  as [number, number], size: 0.04 },
    { location: [25.7617,  -80.1918]  as [number, number], size: 0.04 },
    { location: [43.6532,  -79.3832]  as [number, number], size: 0.04 },
    { location: [48.8566,  2.3522]    as [number, number], size: 0.04 },
    { location: [52.5200,  13.4050]   as [number, number], size: 0.04 },
    { location: [55.7558,  37.6173]   as [number, number], size: 0.04 },
    { location: [41.9028,  12.4964]   as [number, number], size: 0.04 },
    { location: [40.4168,  -3.7038]   as [number, number], size: 0.04 },
    { location: [22.3193,  114.1694]  as [number, number], size: 0.04 },
    { location: [37.5665,  126.9780]  as [number, number], size: 0.04 },
    { location: [25.0330,  121.5654]  as [number, number], size: 0.04 },
    { location: [13.7563,  100.5018]  as [number, number], size: 0.04 },
    { location: [3.1390,   101.6869]  as [number, number], size: 0.04 },
    { location: [-6.2088,  106.8456]  as [number, number], size: 0.04 },
    { location: [28.6139,  77.2090]   as [number, number], size: 0.04 },
    { location: [19.0760,  72.8777]   as [number, number], size: 0.04 },
    { location: [25.2048,  55.2708]   as [number, number], size: 0.04 },
    { location: [-23.5505, -46.6333]  as [number, number], size: 0.04 },
    { location: [-34.6037, -58.3816]  as [number, number], size: 0.04 },
    { location: [-33.8688, 151.2093]  as [number, number], size: 0.04 },
    { location: [-37.8136, 144.9631]  as [number, number], size: 0.04 },
    { location: [-26.2041, 28.0473]   as [number, number], size: 0.04 },
    { location: [30.0444,  31.2357]   as [number, number], size: 0.04 },
  ],
};

export function LiveOpsGlobe() {
  const [stats, setStats] = useState<LiveStat[]>(STAT_FALLBACKS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/infra")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        setStats([
          { label: "VERIFIED REBALANCES",   value: String(data.rebalances_total ?? 142),    position: "tl", accent: "electric" },
          { label: "PROOFS VERIFIED · 24H", value: String(data.proofs_24h ?? 142),          position: "tr", accent: "zk" },
          { label: "ACTIVE INTEGRATIONS",   value: String(data.integrations ?? 27),         position: "bl", accent: "proof" },
          { label: "LAST REBALANCE",        value: data.last_rebalance_relative ?? "1s ago",position: "br", accent: "execute" },
        ]);
      })
      .catch(() => { /* keep fallbacks */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <section
      data-theme="dark"
      className="relative border-t border-line-soft px-6 py-32 md:px-12 overflow-hidden"
      style={{
        background: "#0F1117",
        ["--color-surface-base" as never]:    "#0F1117",
        ["--color-surface-raised" as never]:  "#161A21",
        ["--color-surface-sunken" as never]:  "#0B0D12",
        ["--color-ink-primary" as never]:     "#E6EAF2",
        ["--color-ink-secondary" as never]:   "#9AA3B5",
        ["--color-ink-tertiary" as never]:    "#5D6577",
        ["--color-line-soft" as never]:       "rgba(255,255,255,0.04)",
        ["--color-line-medium" as never]:     "rgba(255,255,255,0.08)",
        ["--color-line-strong" as never]:     "rgba(255,255,255,0.16)",
        color: "#E6EAF2",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-ink-tertiary">
          LIVE OPERATIONS · GLOBAL
        </p>
        <h2 className="mt-6 text-center font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-5xl">
          One protocol.<br />
          <span className="bg-gradient-to-r from-accent-electric via-accent-zk to-accent-proof bg-clip-text text-transparent">
            Every region. Every proof.
          </span>
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-center font-body text-base leading-relaxed text-ink-secondary md:text-lg">
          Atlas reads from a 3-RPC quorum spanning 6 datacenters, settles bundles
          via Jito Block Engine, and publishes every proof on Solana mainnet.
        </p>

        <div className="relative mx-auto mt-20 aspect-[16/12] w-full max-w-[1100px]">
          {/* connector lines */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {stats.map((stat) => {
              const c = LINE_COORDS[stat.position];
              const accent = ACCENT[stat.accent];
              return (
                <line
                  key={stat.position}
                  x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                  className={accent.line}
                  strokeWidth="0.3"
                  strokeDasharray="0.8 0.6"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {/* Magic UI Globe — wrapper has its own `absolute inset-0`, so
              we drop it inside a sized relative container. */}
          <div className="relative mx-auto aspect-square h-full max-w-[620px]">
            <Globe className="top-0" config={GLOBE_CONFIG} />
          </div>

          {/* stat callouts */}
          {stats.map((stat) => {
            const accent = ACCENT[stat.accent];
            return (
              <div
                key={stat.position}
                className={`absolute ${POSITION[stat.position]} z-10 max-w-[260px]`}
              >
                <div
                  className="rounded-lg border bg-surface-raised/95 px-5 py-4 backdrop-blur-sm shadow-[0_18px_48px_-24px_rgba(0,0,0,0.5)]"
                  style={{ borderColor: "var(--color-line-medium)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`relative inline-block h-1.5 w-1.5 rounded-full ${accent.bg}`}>
                      <span className={`absolute inset-0 rounded-full ${accent.bg} animate-ping opacity-75`} />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
                      {stat.label}
                    </span>
                  </div>
                  <p className={`mt-2 font-mono text-4xl font-semibold tabular-nums ${accent.text}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
