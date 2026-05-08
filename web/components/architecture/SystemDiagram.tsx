// SystemDiagram — interactive Atlas blueprint (Phase 22 §2, Wave 5).
//
// Hand-laid layout (positions in `nodes.ts`). Each node is mapped
// onto one of five categories — source / pipeline / commit /
// onchain / data — and rendered with the corresponding accent.
//
// Hover semantics:
//   - hover a node → edges originating *or terminating* at that
//     node light up in the node's accent at 0.9 opacity, 1.2px
//     stroke; every other edge fades to 0.15 opacity.
//   - radial glow appears behind the hovered node.
//
// Play story:
//   - 8-stage lifecycle: ingest → features → consensus → allocate
//     → explain → prove → verify → settle. 600 ms per stage, 2 s
//     pause at the end before reset.
//   - Lights up each stage node and the path edge into it.

"use client";

import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Panel } from "@/components/primitives/Panel";
import { cn } from "@/components/primitives";
import { transitions } from "@/lib/motion";
import {
  ARCHITECTURE_NODES, ARCHITECTURE_EDGES,
  type ArchitectureNode,
} from "./nodes";

const VIEW_W = 1100;
const VIEW_H = 620;

// Five categories per the brief — collapsing the older `kind` set.
type Category = "source" | "pipeline" | "commit" | "onchain" | "data";

const CATEGORY_INFO: Record<Category, { label: string; accent: string; rgba: string }> = {
  source:   { label: "data source",      accent: "var(--color-accent-zk)",       rgba: "166,130,255" },
  pipeline: { label: "pipeline stage",   accent: "var(--color-accent-electric)", rgba: "63,140,255" },
  commit:   { label: "commitment",       accent: "var(--color-accent-proof)",    rgba: "244,120,198" },
  onchain:  { label: "on-chain program", accent: "var(--color-accent-execute)",  rgba: "60,227,154" },
  data:     { label: "store / archive",  accent: "var(--color-ink-tertiary)",    rgba: "93,101,119" },
};

function categorize(n: ArchitectureNode): Category {
  if (n.kind === "source")  return "source";
  if (n.kind === "program") return "onchain";
  if (n.kind === "store")   return "data";
  // `stage` splits: `pi.*` are commitments, the rest are pipeline.
  if (n.id.startsWith("pi.")) return "commit";
  return "pipeline";
}

// Brief-defined 8-stage lifecycle play story. `pathEdges` are the
// edges to highlight as we step into each stage.
interface LifecycleStep {
  nodeId: string;
  /** Edge to highlight as we land on this stage. */
  edge?: [string, string];
  label: string;
}

const LIFECYCLE: readonly LifecycleStep[] = [
  { nodeId: "stg.ingest",     label: "ingest",    edge: ["src.helius",     "stg.ingest"] },
  { nodeId: "stg.features",   label: "features",  edge: ["stg.ingest",     "stg.features"] },
  { nodeId: "stg.consensus",  label: "consensus", edge: ["stg.features",   "stg.consensus"] },
  { nodeId: "stg.allocate",   label: "allocate",  edge: ["stg.consensus",  "stg.allocate"] },
  { nodeId: "stg.explain",    label: "explain",   edge: ["stg.allocate",   "stg.explain"] },
  { nodeId: "stg.prove",      label: "prove",     edge: ["stg.explain",    "stg.prove"] },
  { nodeId: "prog.verifier",  label: "verify",    edge: ["pi.public-input","prog.verifier"] },
  { nodeId: "prog.rebalancer",label: "settle",    edge: ["prog.verifier",  "prog.rebalancer"] },
] as const;

const STEP_MS = 600;
const PAUSE_AT_END_MS = 2_000;

function SystemDiagramImpl(): JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);
  const [active, setActive]   = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [step, setStep]       = useState(-1);

  const tickRef = useRef<number | null>(null);

  // ── Play-story tick ────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    if (step >= LIFECYCLE.length) {
      tickRef.current = window.setTimeout(() => {
        setPlaying(false);
        setStep(-1);
      }, PAUSE_AT_END_MS);
      return () => { if (tickRef.current != null) clearTimeout(tickRef.current); };
    }
    tickRef.current = window.setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => { if (tickRef.current != null) clearTimeout(tickRef.current); };
  }, [playing, step]);

  // Set of node ids that have been visited so far in the play story.
  const playLitNodes = useMemo(() => {
    if (step < 0) return new Set<string>();
    return new Set(LIFECYCLE.slice(0, step + 1).map((s) => s.nodeId));
  }, [step]);

  // Set of "from→to" edge keys to highlight in play mode.
  const playLitEdges = useMemo(() => {
    if (step < 0) return new Set<string>();
    const out = new Set<string>();
    for (const s of LIFECYCLE.slice(0, step + 1)) {
      if (s.edge) out.add(`${s.edge[0]}→${s.edge[1]}`);
    }
    return out;
  }, [step]);

  const focused = active ?? hovered;
  const focusedNode = focused ? ARCHITECTURE_NODES.find((n) => n.id === focused) ?? null : null;

  // Edges incident to the focused node.
  const focusedIncident = useMemo(() => {
    if (!focused) return new Set<string>();
    const out = new Set<string>();
    for (const [from, to] of ARCHITECTURE_EDGES) {
      if (from === focused || to === focused) out.add(`${from}→${to}`);
    }
    return out;
  }, [focused]);

  const reset = useCallback(() => { setPlaying(false); setStep(-1); }, []);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-9">
        <Panel surface="raised" density="dense" className="overflow-hidden p-0">
          <header className="flex items-center justify-between px-5 h-14 border-b border-[color:var(--color-line-soft)]">
            <span className="font-mono text-[13px] uppercase tracking-[0.20em] text-[color:var(--color-ink-secondary)]">
              live blueprint · hover any node
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant={playing ? "ghost" : "primary"}
                size="sm"
                onClick={() => { setPlaying((p) => !p); if (!playing && step < 0) setStep(0); }}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? "pause" : "play story"}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" />
                reset
              </Button>
            </div>
          </header>

          <div className="relative">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="w-full h-[620px] block"
              role="img"
              aria-label="Atlas system architecture diagram"
            >
              {/* ── Edges ──────────────────────────────────────── */}
              {ARCHITECTURE_EDGES.map(([from, to]) => {
                const a = ARCHITECTURE_NODES.find((n) => n.id === from);
                const b = ARCHITECTURE_NODES.find((n) => n.id === to);
                if (!a || !b) return null;

                const key = `${from}→${to}`;
                const playLit  = playLitEdges.has(key);
                const focusLit = focused != null && focusedIncident.has(key);
                const lit = playLit || focusLit;

                // Determine accent: in focus mode, use focused
                // node's category; in play mode, use pipeline accent.
                const accentRgba = playLit
                  ? CATEGORY_INFO.pipeline.rgba
                  : focusLit && focusedNode
                  ? CATEGORY_INFO[categorize(focusedNode)].rgba
                  : CATEGORY_INFO.pipeline.rgba;

                const stroke = lit
                  ? `rgba(${accentRgba},0.9)`
                  : "var(--color-line-medium)";
                const opacity = lit
                  ? 1
                  : focused
                  ? 0.15
                  : 0.5;
                const width = lit ? 1.2 : 0.6;

                return (
                  <line
                    key={key}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={stroke}
                    strokeWidth={width}
                    strokeOpacity={opacity}
                    style={{
                      transition: "stroke 220ms cubic-bezier(0.2,0.8,0.2,1), stroke-opacity 220ms, stroke-width 220ms",
                    }}
                  />
                );
              })}

              {/* ── Nodes ──────────────────────────────────────── */}
              {ARCHITECTURE_NODES.map((n) => {
                const cat = categorize(n);
                const info = CATEGORY_INFO[cat];
                const lit = playLitNodes.has(n.id);
                const isFocused = focused === n.id;
                const r = isFocused || lit ? 12 : 8;

                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}
                    onClick={() => setActive((a) => (a === n.id ? null : n.id))}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Glow ring on hover/lit. */}
                    {(isFocused || lit) && (
                      <circle
                        r={28}
                        fill={`rgba(${info.rgba},0.18)`}
                        style={{
                          filter: `drop-shadow(0 0 12px rgba(${info.rgba},0.55))`,
                        }}
                      />
                    )}

                    {/* Node body. */}
                    <circle
                      r={r}
                      fill={`rgba(${info.rgba},0.85)`}
                      stroke={info.accent}
                      strokeWidth={1}
                      style={{
                        transition: "r 220ms cubic-bezier(0.2,0.8,0.2,1)",
                      }}
                    />

                    {/* Label. */}
                    <text
                      y={r + 18}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize={14}
                      fontWeight={500}
                      letterSpacing="0.04em"
                      fill={isFocused || lit ? "var(--color-ink-primary)" : "var(--color-ink-secondary)"}
                      opacity={isFocused || lit ? 1 : 0.85}
                      style={{ transition: "opacity 220ms, fill 220ms" }}
                    >
                      {n.label.toLowerCase()}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Bottom-right legend, overlaid on the SVG. */}
            <Legend />

            {/* Step counter, top-right. */}
            <div className="absolute top-3 right-4 font-mono text-[12px] text-[color:var(--color-ink-tertiary)] uppercase tracking-[0.16em]">
              {playing
                ? `step ${Math.min(step + 1, LIFECYCLE.length)} / ${LIFECYCLE.length} · ${LIFECYCLE[Math.min(step, LIFECYCLE.length - 1)]?.label ?? ""}`
                : "idle"}
            </div>
          </div>
        </Panel>
      </div>

      {/* Side panel */}
      <div className="col-span-12 lg:col-span-3">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1, transition: transitions.mediumReveal }}
          key={focused ?? "empty"}
        >
          <Panel surface="raised" density="default">
            {focusedNode ? (
              <>
                <p
                  className="font-mono text-[12px] uppercase tracking-[0.20em]"
                  style={{ color: CATEGORY_INFO[categorize(focusedNode)].accent }}
                >
                  {CATEGORY_INFO[categorize(focusedNode)].label}
                </p>
                <h3 className="font-display font-semibold tracking-tight text-[24px] leading-[1.15] mt-2 text-[color:var(--color-ink-primary)]">
                  {focusedNode.label}
                </h3>
                <p className="mt-4 text-[15px] leading-[1.6] text-[color:var(--color-ink-secondary)]">
                  {focusedNode.purpose}
                </p>
                {focusedNode.invariants?.length ? (
                  <div className="mt-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-tertiary)]">
                      invariants
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {focusedNode.invariants.map((id) => (
                        <li key={id} className="font-mono text-[13px] text-[color:var(--color-accent-zk)]">
                          {id}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {focusedNode.source ? (
                  <p className="mt-5 text-[12px] text-[color:var(--color-ink-tertiary)] font-mono break-all">
                    {focusedNode.source}
                  </p>
                ) : null}
                {focusedNode.docHref ? (
                  <a
                    href={focusedNode.docHref}
                    className="mt-5 inline-block font-medium text-[15px] text-[color:var(--color-accent-electric)] hover:text-[color:var(--color-ink-primary)]"
                  >
                    open the docs →
                  </a>
                ) : null}
              </>
            ) : (
              <p className="text-[15px] leading-[1.6] text-[color:var(--color-ink-secondary)]">
                Hover a node to see its purpose, invariants, and source files.
                Click <span className="font-mono text-[color:var(--color-accent-electric)]">play story</span>{" "}
                to walk one rebalance from ingestion to settlement.
              </p>
            )}
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

function Legend(): JSX.Element {
  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 grid gap-2",
        "rounded-[var(--radius-md)] border border-[color:var(--color-line-soft)]",
        "bg-[color:var(--color-surface-sunken)]/90 backdrop-blur-[2px]",
        "px-4 py-3",
      )}
      style={{ gridTemplateColumns: "auto 1fr" }}
    >
      {(Object.keys(CATEGORY_INFO) as Category[]).map((k) => (
        <span key={k} className="contents">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full self-center"
            style={{ background: CATEGORY_INFO[k].accent }}
          />
          <span className="font-mono text-[12px] lowercase tracking-[0.06em] text-[color:var(--color-ink-secondary)] pl-2.5">
            {CATEGORY_INFO[k].label}
          </span>
        </span>
      ))}
    </div>
  );
}

export const SystemDiagram = memo(SystemDiagramImpl);
SystemDiagram.displayName = "SystemDiagram";
