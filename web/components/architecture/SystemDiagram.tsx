// SystemDiagram — interactive Atlas blueprint (Phase 22 §2).
//
// Force-directed-style layout precomputed by hand for a stable
// frame-zero render; positions live in `nodes.ts`. Hover surfaces
// a side panel with file links + invariants. "Play story" mode
// walks one rebalance through the graph.

"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Panel } from "@/components/primitives/Panel";
import { cn } from "@/components/primitives";
import { transitions } from "@/lib/motion";
import { ARCHITECTURE_NODES, ARCHITECTURE_EDGES, PLAY_SEQUENCE } from "./nodes";

const VIEW_W = 1100;
const VIEW_H = 620;

function SystemDiagramImpl() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const tickRef = useRef<number | null>(null);

  // Play-story autoplay.
  useEffect(() => {
    if (!playing) return;
    tickRef.current = window.setTimeout(() => {
      setStep((s) => {
        const next = s + 1;
        if (next >= PLAY_SEQUENCE.length) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 1100);
    return () => {
      if (tickRef.current != null) clearTimeout(tickRef.current);
    };
  }, [playing, step]);

  const currentLitNodes = useMemo(() => {
    if (!playing && step === 0) return new Set<string>();
    return new Set(PLAY_SEQUENCE.slice(0, step + 1));
  }, [playing, step]);

  const focused = active ?? hovered;
  const focusedNode = focused ? ARCHITECTURE_NODES.find((n) => n.id === focused) : null;

  const reset = useCallback(() => {
    setPlaying(false);
    setStep(0);
  }, []);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-9">
        <Panel surface="raised" density="dense" className="overflow-hidden p-0">
          <header className="flex items-center justify-between px-4 h-10 border-b border-[color:var(--color-line-soft)]">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              live blueprint · hover any node
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant={playing ? "destructive" : "primary"}
                size="sm"
                onClick={() => setPlaying((p) => !p)}
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
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full h-[620px] block"
            role="img"
            aria-label="Atlas system architecture diagram"
          >
            <defs>
              <linearGradient id="edgeGrad" x1="0%" x2="100%">
                <stop offset="0%"   stopColor="#3F8CFF" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#A682FF" stopOpacity={0.5} />
              </linearGradient>
              <radialGradient id="nodeGlow">
                <stop offset="0%"   stopColor="#A682FF" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#A682FF" stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* Edges */}
            {ARCHITECTURE_EDGES.map(([from, to]) => {
              const a = ARCHITECTURE_NODES.find((n) => n.id === from);
              const b = ARCHITECTURE_NODES.find((n) => n.id === to);
              if (!a || !b) return null;
              const lit = currentLitNodes.has(from) && currentLitNodes.has(to);
              return (
                <line
                  key={`${from}->${to}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={lit ? "#A682FF" : "url(#edgeGrad)"}
                  strokeWidth={lit ? 2 : 1}
                  strokeOpacity={lit ? 0.9 : 0.35}
                />
              );
            })}

            {/* Nodes */}
            {ARCHITECTURE_NODES.map((n) => {
              const lit = currentLitNodes.has(n.id);
              const isFocused = focused === n.id;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}
                  onClick={() => setActive(n.id)}
                  style={{ cursor: "pointer" }}
                >
                  {(lit || isFocused) ? (
                    <circle r={28} fill="url(#nodeGlow)" />
                  ) : null}
                  <circle
                    r={NODE_R[n.kind]}
                    fill={NODE_FILL[n.kind]}
                    stroke={lit ? "#A682FF" : isFocused ? "#3F8CFF" : "rgba(255,255,255,0.16)"}
                    strokeWidth={lit ? 2 : isFocused ? 1.5 : 1}
                  />
                  <text
                    y={NODE_R[n.kind] + 12}
                    textAnchor="middle"
                    className="font-mono"
                    fontSize={11}
                    fill={lit || isFocused ? "#E6EAF2" : "#9AA3B5"}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <footer className="px-4 h-10 border-t border-[color:var(--color-line-soft)] flex items-center gap-4">
            <Legend swatch={NODE_FILL.program} label="on-chain program" />
            <Legend swatch={NODE_FILL.stage}   label="pipeline stage" />
            <Legend swatch={NODE_FILL.source}  label="data source" />
            <Legend swatch={NODE_FILL.store}   label="store / archive" />
            <span className="ml-auto font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
              step {playing ? step + 1 : "—"} / {PLAY_SEQUENCE.length}
            </span>
          </footer>
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
                <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                  {focusedNode.kind}
                </p>
                <h3 className="font-mono text-[16px] mt-1 text-[color:var(--color-ink-primary)]">
                  {focusedNode.label}
                </h3>
                <p className="mt-3 text-[13px] text-[color:var(--color-ink-secondary)]">
                  {focusedNode.purpose}
                </p>
                {focusedNode.invariants?.length ? (
                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                      invariants
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {focusedNode.invariants.map((id) => (
                        <li key={id} className="font-mono text-[11px] text-[color:var(--color-accent-zk)]">
                          {id}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {focusedNode.source ? (
                  <p className="mt-4 text-[11px] text-[color:var(--color-ink-tertiary)] font-mono">
                    {focusedNode.source}
                  </p>
                ) : null}
                {focusedNode.docHref ? (
                  <a
                    href={focusedNode.docHref}
                    className="mt-4 inline-block text-[12px] text-[color:var(--color-accent-electric)] hover:underline"
                  >
                    open the docs →
                  </a>
                ) : null}
              </>
            ) : (
              <p className="text-[13px] text-[color:var(--color-ink-secondary)]">
                Hover a node to see its purpose, invariants, and source files.
                Click "play story" to walk one rebalance through the diagram.
              </p>
            )}
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

const NODE_R = { program: 14, stage: 12, source: 10, store: 11 } as const;
const NODE_FILL = {
  program: "rgba(63,140,255,0.18)",
  stage:   "rgba(166,130,255,0.18)",
  source:  "rgba(60,227,154,0.18)",
  store:   "rgba(244,120,198,0.18)",
} as const;

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
      <span className={cn("h-2.5 w-2.5 rounded-full")} style={{ background: swatch }} />
      {label}
    </span>
  );
}

export const SystemDiagram = memo(SystemDiagramImpl);
SystemDiagram.displayName = "SystemDiagram";
