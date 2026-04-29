"use client";

import { motion } from "framer-motion";
import { ProofPipeline } from "@/components/ProofPipeline";
import { Footer } from "@/components/Footer";
import {
  CircuitBoard,
  Lock,
  Cpu,
  ShieldCheck,
  Layers,
  GitBranch,
  Eye,
  Zap,
} from "lucide-react";

const steps = [
  {
    n: "01",
    icon: <Eye />,
    title: "Snapshot",
    body:
      "Off-chain orchestrator pulls the vault's current balances and live APYs / utilization / volatility from Kamino, Drift, Jupiter, and marginfi at a specific Solana slot.",
    bullets: [
      "Fetched via Helius RPC + protocol SDKs",
      "Slot pinned in the proof's public inputs",
      "Protocol stats normalized to f32 features",
    ],
    color: "#29d3ff",
  },
  {
    n: "02",
    icon: <Cpu />,
    title: "Inference",
    body:
      "A 3-layer MLP scores every protocol on risk-adjusted yield. Output is a softmax over five buckets: Kamino, Drift, Jupiter, marginfi, idle. Weights are committed via Poseidon at vault creation.",
    bullets: [
      "16-hidden-unit ReLU + softmax MLP",
      "~50KB weights, deterministic f32 path",
      "Model hash baked into vault state",
    ],
    color: "#7c5cff",
  },
  {
    n: "03",
    icon: <CircuitBoard />,
    title: "SP1 zkVM proof",
    body:
      "The same MLP runs again — this time inside SP1's RISC-V zkVM. SP1 produces a STARK that the inference was correct given (state_root, model_hash, vault_id, slot).",
    bullets: [
      "RISC-V Rust guest, identical math",
      "Public inputs: state_root, alloc_root, slot, vault_id, model_hash",
      "GPU prover on RunPod RTX 4090",
    ],
    color: "#ff5cf0",
  },
  {
    n: "04",
    icon: <GitBranch />,
    title: "Groth16 wrap",
    body:
      "The STARK is recursively wrapped into a 256-byte BN254 Groth16 proof. Solana programs can verify Groth16 cheaply via the alt_bn128 syscalls — STARKs would not fit the CU budget.",
    bullets: [
      "sp1-recursion → Groth16 wrapper",
      "256 bytes proof + 32 byte vk_hash",
      "Fits a single Versioned Transaction",
    ],
    color: "#f7c948",
  },
  {
    n: "05",
    icon: <ShieldCheck />,
    title: "Onchain verify",
    body:
      "atlas_verifier executes the BN254 pairing check via Solana's native syscalls. ~250k CU. The rebalancer rejects the tx if the proof, the slot, or the model hash do not match.",
    bullets: [
      "alt_bn128_pairing + alt_bn128_g1_compress",
      "Freshness window: 150 slots (~60s)",
      "model_hash must equal vault.approved_model_hash",
    ],
    color: "#29d391",
  },
  {
    n: "06",
    icon: <Layers />,
    title: "Atomic execute",
    body:
      "Same transaction: CPI into Kamino / Drift / Jupiter / marginfi to reach the proven allocation, then atlas_vault::record_rebalance updates NAV. Bundled via Jito so all-or-nothing.",
    bullets: [
      "Address Lookup Tables pack 30+ accounts",
      "Jito bundle = MEV-resistant landing",
      "Reverts on any leg failure",
    ],
    color: "#ffffff",
  },
];

export default function HowItWorksPage() {
  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-5"
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs text-[color:var(--color-muted)]">
            <Lock className="h-3 w-3 text-[color:var(--color-accent-2)]" />
            How proofs work
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight max-w-4xl">
            From <span className="text-gradient">onchain state</span> to a verified rebalance — in six provable steps.
          </h1>
          <p className="text-lg text-[color:var(--color-muted)] max-w-2xl">
            Atlas is not "trust the curator." Every move the AI makes ships with a Groth16
            proof that Solana itself checks before any USDC moves. Here is exactly what
            happens.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="glass rounded-3xl p-8 md:p-12">
          <ProofPipeline />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="space-y-6">
          {steps.map((s, i) => (
            <Step key={s.n} step={s} index={i} />
          ))}
        </div>
      </section>

      {/* deep dive cards */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent-2)] mb-3">
          Under the hood
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 max-w-2xl">
          The math that makes it bulletproof.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DeepCard
            title="Public-input layout (136 bytes)"
            code={`offset  size  field
0       32    state_root
32      32    alloc_root
64      8     slot (u64 LE)
72      32    vault_id (Pubkey)
104     32    model_hash`}
          />
          <DeepCard
            title="Verifier costs (Mollusk)"
            code={`step                    CU
sp1-solana verify       ~250k
state-root recompute     ~30k
Kamino deposit CPI       ~80k
Drift deposit CPI       ~120k
Jupiter swap CPI        ~250k
record_rebalance          ~5k
─────────────────────────────
total                  ~735k
budget                  1.4M`}
          />
          <DeepCard
            title="Strategy commitment"
            code={`Poseidon(
  approved_model_hash,
  allocation_universe,
  cooldown_slots,
  drift_threshold_bps
) → strategy_commitment

stored at init_vault, immutable
admin can NOT rotate post-init`}
          />
          <DeepCard
            title="Failure rejection"
            code={`✗ proof bytes != 256          → reject
✗ vk_hash != registry hash    → reject
✗ slot stale > 150            → reject
✗ model_hash != approved      → reject
✗ vault_id != target          → reject
✗ Groth16 pairing fail        → reject

if any: tx aborts BEFORE CPI`}
          />
        </div>
      </section>

      {/* trust comparison */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent-2)] mb-3">
          Versus the alternatives
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 max-w-3xl">
          What other Solana AI vaults can&apos;t prove.
        </h2>

        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
                <th className="text-left px-6 py-4 font-medium">Property</th>
                <th className="text-center px-6 py-4 font-medium">Trad AI vault</th>
                <th className="text-center px-6 py-4 font-medium">FHE vault</th>
                <th className="text-center px-6 py-4 font-medium bg-[color:var(--color-accent)]/10 text-white">
                  Atlas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {comparison.map((r) => (
                <tr key={r.k}>
                  <td className="px-6 py-4 font-medium">{r.k}</td>
                  <td className="px-6 py-4 text-center text-[color:var(--color-muted)]">{r.a}</td>
                  <td className="px-6 py-4 text-center text-[color:var(--color-muted)]">{r.b}</td>
                  <td className="px-6 py-4 text-center font-medium text-[color:var(--color-success)] bg-[color:var(--color-accent)]/5">{r.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="glass rounded-3xl p-12 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 -z-10 opacity-60"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(124,92,255,0.4), transparent 60%)",
            }}
          />
          <Zap className="h-8 w-8 mx-auto text-[color:var(--color-warn)] mb-4" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Ready to see a real proof land?
          </h2>
          <p className="text-[color:var(--color-muted)] max-w-xl mx-auto">
            Open the vault. Deposit any amount of USDC. Within 6 hours you&apos;ll see your
            first verified rebalance with a Solscan link.
          </p>
          <a
            href="/vaults/atUSDC-v1"
            className="inline-flex mt-8 items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] px-6 py-3 font-medium text-white glow-accent"
          >
            Open vault
          </a>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}

const comparison = [
  { k: "Strategy commitment", a: "off-chain doc", b: "encrypted policy", c: "Poseidon hash, immutable" },
  { k: "Curator can rotate model", a: "yes", b: "yes", c: "no" },
  { k: "Onchain proof per rebalance", a: "—", b: "—", c: "✓ Groth16" },
  { k: "Counterparty audit possible", a: "no", b: "partial", c: "✓ public inputs" },
  { k: "Verification cost", a: "—", b: "high", c: "~$0.0001" },
  { k: "MEV resistance", a: "low", b: "low", c: "✓ Jito bundle" },
];

function Step({
  step,
  index,
}: {
  step: { n: string; icon: React.ReactNode; title: string; body: string; bullets: string[]; color: string };
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
      className="glass rounded-2xl p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-start relative overflow-hidden"
    >
      <div
        className="absolute -top-16 -left-16 h-48 w-48 rounded-full blur-3xl opacity-30"
        style={{ background: step.color }}
      />
      <div className="md:col-span-1 relative">
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: `${step.color}22`, color: step.color }}
        >
          {step.icon}
        </div>
      </div>

      <div className="md:col-span-7 relative space-y-3">
        <div className="text-xs font-mono tracking-widest text-[color:var(--color-muted)]">
          STEP {step.n}
        </div>
        <h3 className="text-2xl font-semibold">{step.title}</h3>
        <p className="text-[color:var(--color-muted)] leading-relaxed">{step.body}</p>
      </div>

      <div className="md:col-span-4 relative">
        <ul className="space-y-2">
          {step.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-[color:var(--color-muted)]">
              <span className="mt-1.5 h-1 w-1 rounded-full flex-shrink-0" style={{ background: step.color }} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function DeepCard({ title, code }: { title: string; code: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
      className="glass rounded-2xl p-6"
    >
      <div className="text-sm font-semibold mb-3">{title}</div>
      <pre className="text-xs font-mono text-[color:var(--color-muted)] leading-relaxed whitespace-pre overflow-x-auto">
        {code}
      </pre>
    </motion.div>
  );
}
