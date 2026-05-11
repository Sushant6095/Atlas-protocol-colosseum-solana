"use client";

// /decision-engine — React Flow architecture diagram.
//
// 7 agents arranged in 3 layers (6 sensors, 3 deciders, 1 executor),
// dagre-laid-out left → right with animated edges. The proof-bearing
// edge from Aggregator → Rebalancer renders accent.proof pink; every
// other normal-signal edge renders accent.electric blue; the
// Anomaly → Rebalancer refusal path renders accent.danger.
//
// Click any node to open a side sheet with reasoning + 3 recent
// decisions + GitHub link. The "▶ Simulate rebalance" ShimmerButton
// cascades a 3s animation across all 10 nodes: sensors light, then
// deciders, then proof edge animates pink, then Rebalancer flashes
// green with a "PROOF MINTED" pill and a bottom-right toast.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Activity,
  ShieldCheck,
  CircleDot,
  ExternalLink,
  PlayCircle,
} from "lucide-react";
import {
  AGENTS,
  EDGES,
  DECISION_METRICS,
  type AgentNode,
  type AgentStatus,
} from "@/lib/decision-engine/agents";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { DecisionEngineDepth } from "@/components/decision/DecisionEngineDepth";

const NODE_W = 200;
const NODE_H = 96;

const STATUS_COLOR: Record<AgentStatus, string> = {
  PASS:   "#3CE39A",
  WATCH:  "#F7B955",
  REFUSE: "#FF6166",
};

const GITHUB_ORG = "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/tree/main/crates";

type AgentNodeData = {
  agent: AgentNode;
  flash: boolean;
  override: AgentStatus | null;
  [k: string]: unknown;
};

function AgentRectNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const { agent, flash, override } = data;
  const status = override ?? agent.status;
  const color = STATUS_COLOR[status];

  return (
    <div
      className="relative rounded-[10px] border transition-all duration-300"
      style={{
        width: NODE_W,
        height: NODE_H,
        background: "#0B0D12",
        borderColor: flash
          ? color
          : "color-mix(in oklab, #ffffff 8%, transparent)",
        boxShadow: flash
          ? `0 0 0 1px ${color}, 0 0 32px -8px ${color}aa`
          : "0 1px 2px rgba(0,0,0,0.4)",
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: "#0B0D12", border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#0B0D12", border: "none" }} />

      <div className="flex h-full flex-col justify-between p-3">
        <div className="flex items-center justify-between gap-2">
          <p
            className="font-display text-[13px] font-semibold leading-none"
            style={{ color: "#FFFFFF" }}
          >
            {agent.name}
          </p>
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em]"
            style={{
              color,
              border: `1px solid color-mix(in oklab, ${color} 40%, transparent)`,
              background: `color-mix(in oklab, ${color} 10%, transparent)`,
            }}
          >
            <CircleDot className="h-2 w-2" />
            {status}
          </span>
        </div>

        <div className="flex items-center justify-between font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span>{agent.latencyMs}ms</span>
          <span>{new Date(agent.lastRunAt).toLocaleTimeString([], { hour12: false })}</span>
        </div>
      </div>
    </div>
  );
}

const NODE_TYPES = { agent: AgentRectNode };

function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 120, nodesep: 28, marginx: 40, marginy: 40 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });
}

interface SimState {
  /** Map of node id → status override (null = use real status). */
  overrides: Record<string, AgentStatus | null>;
  /** Set of node ids currently flashing. */
  flashing: Set<string>;
  /** Set of edge ids in proof mode. */
  proofEdges: Set<string>;
  /** Receipt toast. */
  toast: string | null;
}

const INITIAL_SIM: SimState = {
  overrides: {},
  flashing: new Set(),
  proofEdges: new Set(),
  toast: null,
};

export default function DecisionEnginePage(): JSX.Element {
  const [activeAgent, setActiveAgent] = useState<AgentNode | null>(null);
  const [liveSignal, setLiveSignal] = useState(true);
  const [sim, setSim] = useState<SimState>(INITIAL_SIM);
  const [simRunning, setSimRunning] = useState(false);

  const baseNodes: Node<AgentNodeData>[] = useMemo(
    () =>
      AGENTS.map((a) => ({
        id: a.id,
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          agent: a,
          flash: sim.flashing.has(a.id),
          override: sim.overrides[a.id] ?? null,
        },
      })),
    [sim.flashing, sim.overrides],
  );

  const baseEdges: Edge[] = useMemo(
    () =>
      EDGES.map((e) => {
        const isProof = sim.proofEdges.has(e.id) || e.proof;
        const color = e.refusal ? "#FF6166" : isProof ? "#F478C6" : "#3F8CFF";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: liveSignal,
          style: {
            stroke: color,
            strokeWidth: isProof ? 2 : 1.4,
            strokeDasharray: "4 4",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 14,
            height: 14,
          },
        };
      }),
    [sim.proofEdges, liveSignal],
  );

  const laidOut = useMemo(() => layout(baseNodes, baseEdges) as Node<AgentNodeData>[], [baseNodes, baseEdges]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node<AgentNodeData>) => {
      setActiveAgent(node.data.agent);
    },
    [],
  );

  function runSim(): void {
    if (simRunning) return;
    setSimRunning(true);
    setSim(INITIAL_SIM);

    const sensors  = AGENTS.filter((a) => a.layer === "sensor").map((a) => a.id);
    const deciders = AGENTS.filter((a) => a.layer === "decider").map((a) => a.id);
    const proofEdge = EDGES.find((e) => e.proof);

    // t=0 — sensors flash PASS
    setTimeout(() => {
      setSim((s) => ({
        ...s,
        flashing: new Set(sensors),
        overrides: Object.fromEntries(sensors.map((id) => [id, "PASS" as const])),
      }));
    }, 50);

    // t=800 — deciders flash PASS
    setTimeout(() => {
      setSim((s) => ({
        ...s,
        flashing: new Set([...sensors, ...deciders]),
        overrides: {
          ...s.overrides,
          ...Object.fromEntries(deciders.map((id) => [id, "PASS" as const])),
        },
      }));
    }, 850);

    // t=1600 — proof edge lights pink
    setTimeout(() => {
      if (proofEdge) {
        setSim((s) => ({ ...s, proofEdges: new Set([proofEdge.id]) }));
      }
    }, 1650);

    // t=2400 — Rebalancer flashes green + PROOF MINTED
    setTimeout(() => {
      setSim((s) => ({
        ...s,
        flashing: new Set([...sensors, ...deciders, "rebalancer"]),
        overrides: { ...s.overrides, rebalancer: "PASS" },
        toast: "Receipt 0xa1b…f29 on devnet",
      }));
    }, 2450);

    // t=5500 — clean up
    setTimeout(() => {
      setSim(INITIAL_SIM);
      setSimRunning(false);
    }, 5500);
  }

  // dismiss toast after 4s
  useEffect(() => {
    if (!sim.toast) return;
    const t = setTimeout(() => setSim((s) => ({ ...s, toast: null })), 4000);
    return () => clearTimeout(t);
  }, [sim.toast]);

  const rebalancerOverride = sim.overrides.rebalancer;

  return (
    <main
      className="min-h-screen"
      style={{ background: "#06070A", color: "var(--color-ink-primary)" }}
    >
      {/* sticky header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{
          borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
          background: "color-mix(in oklab, #06070A 86%, transparent)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "var(--color-ink-tertiary)" }}
            >
              <ArrowLeft className="h-3 w-3" /> home
            </Link>
            <span className="font-display text-base font-semibold">Decision Engine</span>
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{
                color: "#A682FF",
                borderColor: "color-mix(in oklab, #A682FF 35%, transparent)",
                background: "color-mix(in oklab, #A682FF 10%, transparent)",
              }}
            >
              <ShieldCheck className="h-3 w-3" /> devnet
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiveSignal((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] hover:opacity-90"
              style={{
                borderColor: liveSignal
                  ? "color-mix(in oklab, #3CE39A 40%, transparent)"
                  : "color-mix(in oklab, #ffffff 12%, transparent)",
                color: liveSignal ? "#3CE39A" : "rgba(255,255,255,0.65)",
                background: liveSignal ? "color-mix(in oklab, #3CE39A 10%, transparent)" : "transparent",
              }}
            >
              <Activity className="h-3 w-3" />
              {liveSignal ? "live signal" : "paused"}
            </button>
          </div>
        </div>
      </header>

      {/* metrics + play button */}
      <section className="mx-auto max-w-7xl px-6 pt-6">
        <div
          className="rounded-[12px] border p-5"
          style={{
            borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
            background: "#0B0D12",
          }}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
              <Metric label="Decisions today"        value={DECISION_METRICS.decisionsToday} />
              <Metric label="Proofs minted"          value={DECISION_METRICS.proofsMinted} />
              <Metric label="Refusals (correct)"     value={DECISION_METRICS.refusalsCorrect} />
              <Metric label="Avg decision time"      value={DECISION_METRICS.avgDecisionMs} suffix="ms" />
            </div>

            <ShimmerButton
              onClick={runSim}
              disabled={simRunning}
              background="#0B0D12"
              shimmerColor="#3F8CFF"
              borderRadius="10px"
              className="px-5 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                {simRunning ? "simulating…" : "Simulate rebalance"}
              </span>
            </ShimmerButton>
          </div>
        </div>
      </section>

      {/* React Flow canvas */}
      <section className="mx-auto max-w-7xl px-6 py-6">
        <div
          className="relative h-[640px] w-full overflow-hidden rounded-[12px] border"
          style={{
            borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
            background: "#06070A",
          }}
        >
          <ReactFlow
            nodes={laidOut}
            edges={baseEdges}
            nodeTypes={NODE_TYPES}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.4}
            maxZoom={1.8}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            panOnScroll
            zoomOnPinch
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1}
              color="rgba(255,255,255,0.08)"
            />
          </ReactFlow>

          {/* rebalancer PROOF MINTED overlay pill */}
          {rebalancerOverride === "PASS" && simRunning && (
            <div
              className="pointer-events-none absolute right-6 top-6 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{
                color: "#3CE39A",
                borderColor: "color-mix(in oklab, #3CE39A 40%, transparent)",
                background: "color-mix(in oklab, #3CE39A 12%, #06070A)",
              }}
            >
              ✓ proof minted
            </div>
          )}
        </div>

        {/* legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.55)" }}>
          <Legend color="#3F8CFF" label="normal signal" />
          <Legend color="#F478C6" label="proof-bearing" />
          <Legend color="#FF6166" label="refusal path" />
        </div>
      </section>

      {/* 7-section engineering deep dive */}
      <DecisionEngineDepth />

      {/* receipt toast */}
      {sim.toast && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-md border px-4 py-3 shadow-lg"
          style={{
            borderColor: "color-mix(in oklab, #3CE39A 40%, transparent)",
            background: "#0B0D12",
            color: "#FFFFFF",
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "#3CE39A" }}>
            ✓ tx settled
          </p>
          <p className="mt-1 font-mono text-[12px]">{sim.toast}</p>
        </div>
      )}

      {/* agent side sheet */}
      <Sheet open={activeAgent !== null} onOpenChange={(o) => !o && setActiveAgent(null)}>
        <SheetContent
          side="right"
          className="w-full max-w-[440px] sm:max-w-[440px]"
          style={{ background: "#0B0D12", color: "#FFFFFF" }}
        >
          {activeAgent && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between gap-3">
                  <SheetTitle className="font-display text-xl">{activeAgent.name}</SheetTitle>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                    style={{
                      color: STATUS_COLOR[activeAgent.status],
                      border: `1px solid color-mix(in oklab, ${STATUS_COLOR[activeAgent.status]} 40%, transparent)`,
                      background: `color-mix(in oklab, ${STATUS_COLOR[activeAgent.status]} 10%, transparent)`,
                    }}
                  >
                    <CircleDot className="h-2.5 w-2.5" />
                    {activeAgent.status}
                  </span>
                </div>
                <SheetDescription className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {activeAgent.layer} · {activeAgent.latencyMs}ms · last {new Date(activeAgent.lastRunAt).toLocaleTimeString([], { hour12: false })}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-6">
                <section>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    reasoning trace
                  </p>
                  <ul className="space-y-1.5 text-[13px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {activeAgent.reasoning.map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="opacity-50">{i + 1}.</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    last 3 decisions
                  </p>
                  <ul className="space-y-2">
                    {activeAgent.recentDecisions.map((d) => (
                      <li
                        key={d.ts}
                        className="rounded-md border p-2.5"
                        style={{
                          borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
                          background: "#06070A",
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                            {d.ts}
                          </span>
                          <span
                            className="font-mono text-[10px] uppercase tracking-[0.16em]"
                            style={{ color: STATUS_COLOR[d.verdict] }}
                          >
                            {d.verdict}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.78)" }}>
                          {d.rationale}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>

                <a
                  href={`${GITHUB_ORG}/${activeAgent.sourceCrate}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] hover:opacity-90"
                  style={{ color: "#3F8CFF" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  view source: crates/{activeAgent.sourceCrate}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p
        className="font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 font-display text-2xl font-semibold tabular-nums leading-none"
        style={{ color: "#FFFFFF" }}
      >
        <NumberTicker value={value} className="text-white" />
        {suffix && <span className="ml-1 text-base opacity-60">{suffix}</span>}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-px w-6" style={{ background: color }} />
      {label}
    </span>
  );
}
