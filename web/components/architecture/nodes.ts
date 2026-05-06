// Hand-laid Atlas blueprint (Phase 22 §2). Positions are tuned for a
// 1100×620 viewBox; updates here are the only place to add a new
// node. Edges are directed: `[from, to]`.

export type NodeKind = "program" | "stage" | "source" | "store";

export interface ArchitectureNode {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  purpose: string;
  invariants?: string[];
  source?: string;
  docHref?: string;
}

export const ARCHITECTURE_NODES: ArchitectureNode[] = [
  // ── Sources ────────────────────────────────────────────────────────
  { id: "src.triton",    label: "yellowstone (triton)",   kind: "source",  x: 80,   y: 80,
    purpose: "Tier-B quorum geyser. Counts toward min_sources.",
    source: "crates/atlas-bus/src/adapters.rs",
    docHref: "/architecture#ingestion" },
  { id: "src.helius",    label: "yellowstone (helius)",   kind: "source",  x: 80,   y: 200,
    purpose: "Tier-B quorum geyser; partner of Triton + QuickNode.",
    source: "crates/atlas-bus/src/adapters.rs" },
  { id: "src.qn",        label: "yellowstone (quicknode)", kind: "source", x: 80,   y: 320,
    purpose: "Tier-B quorum geyser; rounds out the diversity guard.",
    source: "crates/atlas-bus/src/adapters.rs" },
  { id: "src.rpc-fast",  label: "rpc fast",               kind: "source",  x: 80,   y: 440,
    purpose: "Tier-A latency. Hot-path single-source reads only.",
    source: "crates/atlas-rpc-router/src/role.rs",
    invariants: ["I-22 latency-tier separation"] },
  { id: "src.pyth",      label: "pyth hermes",            kind: "source",  x: 80,   y: 540,
    purpose: "Pull-oracle ingestion + freshness gate.",
    source: "crates/atlas-bus/src/adapters.rs" },

  // ── Pipeline stages (column 2) ─────────────────────────────────────
  { id: "stg.ingest",    label: "01 · ingest",     kind: "stage",   x: 280, y: 90,
    purpose: "Stage 01 — quorum read of vault state + protocol accounts.",
    invariants: ["I-7"], source: "crates/atlas-pipeline/src/stage_ingest.rs" },
  { id: "stg.features",  label: "02 · features",   kind: "stage",   x: 280, y: 180,
    purpose: "Feature extraction with point-in-time leakage guards.",
    invariants: ["I-2"], source: "crates/atlas-warehouse/src/feature_store.rs" },
  { id: "stg.consensus", label: "03 · consensus",  kind: "stage",   x: 280, y: 270,
    purpose: "7-agent ensemble: Risk · Yield · Liquidity · TailRisk · Compliance · Execution · Observer.",
    invariants: ["I-1"], source: "crates/atlas-pipeline/src/agents.rs" },
  { id: "stg.allocate",  label: "04 · allocate",   kind: "stage",   x: 280, y: 360,
    purpose: "Bounded LIE allocator; clamps ratios to mandate caps.",
    source: "crates/atlas-lie/src/allocator.rs" },
  { id: "stg.explain",   label: "05 · explain",    kind: "stage",   x: 280, y: 450,
    purpose: "Canonical structured explanation; explanation_hash binds prose to commitment.",
    source: "crates/atlas-pipeline/src/explanation.rs" },
  { id: "stg.prove",     label: "06 · prove",      kind: "stage",   x: 280, y: 540,
    purpose: "SP1 zkVM execution → Groth16 proof. Off-chain prover network.",
    source: "prover/zkvm-program",
    invariants: ["I-4"] },

  // ── Public input (middle) ──────────────────────────────────────────
  { id: "pi.public-input", label: "public input v2/v3/v4", kind: "stage", x: 540, y: 230,
    purpose: "Fixed-size public input bound into every proof. v3 + confidential, v4 + private execution.",
    source: "crates/atlas-public-input/src/lib.rs",
    invariants: ["I-4", "I-15"] },
  { id: "pi.disclosure", label: "disclosure policy hash", kind: "stage", x: 540, y: 340,
    purpose: "Phase 14 §6 — folds into every proof; viewing keys gate disclosure.",
    source: "crates/atlas-confidential/src/disclosure.rs",
    invariants: ["I-17"] },

  // ── On-chain programs (column 4) ───────────────────────────────────
  { id: "prog.verifier",  label: "atlas_verifier",   kind: "program", x: 800, y: 80,
    purpose: "Mainnet Groth16 verifier. Reads public input, runs sp1-solana, gates settlement.",
    invariants: ["I-3", "I-23"] },
  { id: "prog.vault",     label: "atlas_vault",      kind: "program", x: 800, y: 180,
    purpose: "Custody account. Strategy commitment hash is set at create + immutable.",
    invariants: ["I-1", "I-16"] },
  { id: "prog.rebalancer",label: "atlas_rebalancer", kind: "program", x: 800, y: 280,
    purpose: "Submits the bundle; CPIs allowlisted. Snapshot/diff guard on writable accounts.",
    source: "programs/atlas-rebalancer" },
  { id: "prog.keeper",    label: "atlas_keeper_registry", kind: "program", x: 800, y: 380,
    purpose: "Phase 15 mandate registry. Cross-role signing rejected at the ix entry.",
    invariants: ["I-18", "I-19", "I-21"] },
  { id: "prog.per",       label: "atlas_per_gateway", kind: "program", x: 800, y: 480,
    purpose: "Phase 18 PER session lifecycle. Auto-undelegates past MAX_PER_SESSION_SLOTS.",
    invariants: ["I-22", "I-24"] },
  { id: "prog.alt",       label: "atlas_alt_keeper", kind: "program", x: 800, y: 560,
    purpose: "ALT lifecycle keeper.",
    invariants: ["I-18"] },

  // ── Stores (column 5) ──────────────────────────────────────────────
  { id: "store.warehouse", label: "warehouse", kind: "store", x: 1010, y: 220,
    purpose: "TimescaleDB-style warehouse. Phase 03; replay-byte-equivalent.",
    invariants: ["I-5"] },
  { id: "store.bubblegum", label: "bubblegum tree", kind: "store", x: 1010, y: 360,
    purpose: "Compressed receipt tree; rebalance + disclosure + PER session events anchor here.",
    invariants: ["I-8"] },
  { id: "store.ledger",    label: "unified ledger", kind: "store", x: 1010, y: 480,
    purpose: "Phase 13 — deposits + rebalances + payouts + invoices joined onto one timeline.",
    source: "crates/atlas-payments/src/ledger.rs" },
];

export const ARCHITECTURE_EDGES: [string, string][] = [
  // Sources → ingest
  ["src.triton",   "stg.ingest"],
  ["src.helius",   "stg.ingest"],
  ["src.qn",       "stg.ingest"],
  ["src.rpc-fast", "stg.ingest"],
  ["src.pyth",     "stg.features"],
  // Pipeline chain
  ["stg.ingest",    "stg.features"],
  ["stg.features",  "stg.consensus"],
  ["stg.consensus", "stg.allocate"],
  ["stg.allocate",  "stg.explain"],
  ["stg.explain",   "stg.prove"],
  // Pipeline → public input
  ["stg.prove",     "pi.public-input"],
  ["stg.explain",   "pi.public-input"],
  ["pi.disclosure", "pi.public-input"],
  // Public input → programs
  ["pi.public-input", "prog.verifier"],
  ["prog.verifier",   "prog.rebalancer"],
  ["prog.rebalancer", "prog.vault"],
  ["prog.rebalancer", "prog.keeper"],
  ["prog.rebalancer", "prog.per"],
  ["prog.rebalancer", "prog.alt"],
  // Programs → stores
  ["prog.vault",      "store.warehouse"],
  ["prog.rebalancer", "store.bubblegum"],
  ["prog.per",        "store.bubblegum"],
  ["prog.vault",      "store.ledger"],
];

/**
 * Play-story sequence — the order in which the diagram lights up
 * for a single rebalance walkthrough.
 */
export const PLAY_SEQUENCE: string[] = [
  "src.triton",
  "src.helius",
  "src.qn",
  "stg.ingest",
  "src.pyth",
  "stg.features",
  "stg.consensus",
  "stg.allocate",
  "stg.explain",
  "stg.prove",
  "pi.public-input",
  "prog.verifier",
  "prog.rebalancer",
  "prog.keeper",
  "prog.per",
  "prog.vault",
  "store.bubblegum",
  "store.warehouse",
  "store.ledger",
];
