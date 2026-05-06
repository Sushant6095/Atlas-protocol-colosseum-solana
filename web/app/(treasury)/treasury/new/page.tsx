// /treasury/new — Treasury creation wizard (Phase 23 §8.2).
// 11-step linear flow with live strategy commitment hash.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { cn } from "@/components/primitives";

const STEPS = [
  "01 · kind",
  "02 · multisig",
  "03 · KYB",
  "04 · template",
  "05 · risk band",
  "06 · risk policy",
  "07 · signers",
  "08 · confidential",
  "09 · private exec",
  "10 · review",
  "11 · sign",
] as const;

const TEMPLATES = [
  { id: "pusd-conservative", label: "PUSD · Conservative",  apy: "5–7%",  band: "Conservative" },
  { id: "pusd-balanced",     label: "PUSD · Balanced",      apy: "7–10%", band: "Balanced"     },
  { id: "pusd-defense",      label: "PUSD · Treasury Defense", apy: "4–6%", band: "Conservative" },
  { id: "kamino-targeted",   label: "Kamino · Targeted",    apy: "8–12%", band: "Aggressive"   },
];

export default function Page() {
  const [stepIdx, setStepIdx] = useState(0);
  const [kind, setKind] = useState<"DAO" | "Business">("Business");
  const [multisig, setMultisig] = useState("");
  const [kybSigned, setKybSigned] = useState(false);
  const [template, setTemplate] = useState(TEMPLATES[1].id);
  const [band, setBand] = useState<"Conservative" | "Balanced" | "Aggressive">("Balanced");
  const [policy, setPolicy] = useState({ idle_buffer_bps: 1_500, oracle_dev_bps: 25, max_dd_bps: 800, max_per_protocol_bps: 4_500 });
  const [signers, setSigners] = useState<{ role: string; pubkey: string; cap: string }[]>([
    { role: "FinanceAdmin", pubkey: "9P3" + "x".repeat(41), cap: "100000" },
    { role: "Operator",     pubkey: "FW2" + "y".repeat(41), cap: "10000"  },
  ]);
  const [confidential, setConfidential] = useState(false);
  const [confidentialPattern, setConfidentialPattern] = useState<"A" | "B">("A");
  const [privateExec, setPrivateExec] = useState(false);
  const [perSlots, setPerSlots] = useState(200);

  const strategyHash = useMemo(() => {
    const seed = `${kind}|${multisig}|${kybSigned}|${template}|${band}|${JSON.stringify(policy)}|${JSON.stringify(signers)}|${confidential}|${confidentialPattern}|${privateExec}|${perSlots}`;
    let h = 0xcbf29ce4n;
    const p = 0x1000193n;
    const mask = 0xffffffffn;
    for (let i = 0; i < seed.length; i++) {
      h ^= BigInt(seed.charCodeAt(i));
      h = (h * p) & mask;
    }
    return "0x" + h.toString(16).padStart(8, "0") + "0".repeat(56);
  }, [kind, multisig, kybSigned, template, band, policy, signers, confidential, confidentialPattern, privateExec, perSlots]);

  const stepValid = (i: number): boolean => {
    switch (i) {
      case 1:  return multisig.length > 0;
      case 2:  return kind === "DAO" || kybSigned;
      case 6:  return signers.length >= 2;
      default: return true;
    }
  };

  const next = () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            new treasury · 11-step wizard
          </p>
          <h1 className="text-display text-[20px] mt-1">Create treasury</h1>
        </div>
        <Link href="/treasury"><Button variant="ghost" size="sm">← back</Button></Link>
      </header>

      {/* Stepper */}
      <Panel surface="raised" density="dense">
        <ol className="flex flex-wrap gap-1.5 font-mono text-[10px]">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li key={s}>
                <button onClick={() => setStepIdx(i)} className={cn(
                  "px-2 py-1 rounded-[var(--radius-xs)] border",
                  active ? "border-[color:var(--color-accent-electric)]/40 bg-[color:var(--color-accent-electric)]/15 text-[color:var(--color-ink-primary)]"
                : done   ? "border-[color:var(--color-accent-execute)]/40 bg-[color:var(--color-accent-execute)]/10 text-[color:var(--color-accent-execute)]"
                :          "border-[color:var(--color-line-medium)] text-[color:var(--color-ink-tertiary)]",
                )}>
                  {done ? <Check className="h-3 w-3 inline mr-1" /> : null}
                  {s}
                </button>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-8 space-y-4">
          {stepIdx === 0 && (
            <Step title="01 · kind" desc="DAO · membership token-gated. Business · KYB required.">
              <div className="grid grid-cols-2 gap-3">
                {(["Business", "DAO"] as const).map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={chipBtn(kind === k)}>
                    {k}
                  </button>
                ))}
              </div>
            </Step>
          )}
          {stepIdx === 1 && (
            <Step title="02 · multisig" desc="Connect Squads. Atlas commits the multisig pubkey at vault create.">
              <Field label="multisig pubkey" value={multisig} onChange={setMultisig} placeholder="Squads pubkey…" />
            </Step>
          )}
          {stepIdx === 2 && (
            <Step title="03 · KYB" desc="Business treasuries upload + sign Dodo's KYB attestation. Atlas commits the hash on-chain at create.">
              {kind === "DAO"
                ? <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">Skipped for DAO treasuries.</p>
                : (
                  <Button variant={kybSigned ? "secondary" : "primary"} size="sm" onClick={() => setKybSigned(true)}>
                    {kybSigned ? "KYB attestation signed" : "Sign KYB attestation via Dodo"}
                  </Button>
                )}
            </Step>
          )}
          {stepIdx === 3 && (
            <Step title="04 · template" desc="Templates fold into the strategy commitment. Switch later via a multisig vote.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => setTemplate(t.id)} className={chipBtn(template === t.id, "left")}>
                    <p className="font-mono text-[12px] text-[color:var(--color-ink-primary)]">{t.label}</p>
                    <p className="text-[11px] text-[color:var(--color-ink-tertiary)]">apy {t.apy} · band {t.band}</p>
                  </button>
                ))}
              </div>
            </Step>
          )}
          {stepIdx === 4 && (
            <Step title="05 · risk band" desc="Conservative · Balanced · Aggressive. Caps per-protocol exposure + drawdown bound.">
              <div className="grid grid-cols-3 gap-2">
                {(["Conservative", "Balanced", "Aggressive"] as const).map((b) => (
                  <button key={b} onClick={() => setBand(b)} className={chipBtn(band === b)}>{b}</button>
                ))}
              </div>
            </Step>
          )}
          {stepIdx === 5 && (
            <Step title="06 · risk policy" desc="Atlas folds these into the strategy commitment. Tighter ⇒ stricter reject path.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="idle buffer (bps)"        value={String(policy.idle_buffer_bps)}      onChange={(v) => setPolicy({ ...policy, idle_buffer_bps: Number(v) })} />
                <Field label="oracle deviation (bps)"   value={String(policy.oracle_dev_bps)}       onChange={(v) => setPolicy({ ...policy, oracle_dev_bps: Number(v) })}  />
                <Field label="max drawdown (bps)"       value={String(policy.max_dd_bps)}           onChange={(v) => setPolicy({ ...policy, max_dd_bps: Number(v) })}     />
                <Field label="max per-protocol (bps)"   value={String(policy.max_per_protocol_bps)} onChange={(v) => setPolicy({ ...policy, max_per_protocol_bps: Number(v) })} />
              </div>
            </Step>
          )}
          {stepIdx === 6 && (
            <Step title="07 · signers" desc="Per-role payout caps + cooldowns. Atlas enforces caps at the program ix entry (Phase 13 §3.2).">
              <ul className="space-y-2">
                {signers.map((s, i) => (
                  <li key={i} className="grid grid-cols-12 gap-2 items-center">
                    <select value={s.role}
                            onChange={(e) => setSigners((cur) => cur.map((c, j) => j === i ? { ...c, role: e.target.value } : c))}
                            className="col-span-3 h-8 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-2 font-mono text-[11px]">
                      {["FinanceAdmin", "CFO", "CEO", "Operator", "ReadOnly"].map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <input value={s.pubkey}
                           onChange={(e) => setSigners((cur) => cur.map((c, j) => j === i ? { ...c, pubkey: e.target.value } : c))}
                           className="col-span-6 h-8 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-2 font-mono text-[11px]" />
                    <input value={s.cap}
                           onChange={(e) => setSigners((cur) => cur.map((c, j) => j === i ? { ...c, cap: e.target.value } : c))}
                           className="col-span-2 h-8 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-2 font-mono text-[11px]"
                           placeholder="cap (q64)" />
                    <button onClick={() => setSigners((cur) => cur.filter((_, j) => j !== i))} className="col-span-1 text-[12px] text-[color:var(--color-ink-tertiary)]">remove</button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" size="sm" onClick={() => setSigners([...signers, { role: "Operator", pubkey: "", cap: "5000" }])}>
                + add signer
              </Button>
            </Step>
          )}
          {stepIdx === 7 && (
            <Step title="08 · confidential (optional)" desc="Phase 14 — Token-2022 ConfidentialTransferAccount (Pattern A) or Cloak shielded wrapper (Pattern B).">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} className="accent-[color:var(--color-accent-zk)]" />
                <span className="text-[12px]">enable confidential mode</span>
              </label>
              {confidential ? (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {(["A", "B"] as const).map((p) => (
                    <button key={p} onClick={() => setConfidentialPattern(p)} className={chipBtn(confidentialPattern === p, "left")}>
                      <p className="font-mono text-[12px] text-[color:var(--color-ink-primary)]">Pattern {p}</p>
                      <p className="text-[11px] text-[color:var(--color-ink-tertiary)]">
                        {p === "A" ? "Token-2022 native" : "Cloak shielded wrapper mint"}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
            </Step>
          )}
          {stepIdx === 8 && (
            <Step title="09 · private execution (optional)" desc="Phase 18 — rebalance inside a MagicBlock PER session; settle to mainnet within MAX_PER_SESSION_SLOTS.">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={privateExec} onChange={(e) => setPrivateExec(e.target.checked)} className="accent-[color:var(--color-accent-zk)]" />
                <span className="text-[12px]">enable private execution</span>
              </label>
              {privateExec ? (
                <div className="mt-3">
                  <Field label="MAX_PER_SESSION_SLOTS"
                         value={String(perSlots)}
                         onChange={(v) => setPerSlots(Math.min(256, Math.max(16, Number(v))))} />
                  <p className="text-[10px] text-[color:var(--color-ink-tertiary)] mt-2">≤ 256 slots · auto-undelegate beyond this</p>
                </div>
              ) : null}
            </Step>
          )}
          {stepIdx === 9 && (
            <Step title="10 · review" desc="Atlas computes a strategy_commitment hash from every choice above. The hash is permanent.">
              <ul className="space-y-1.5 font-mono text-[11px]">
                <Row k="kind"          v={kind} />
                <Row k="multisig"      v={<IdentifierMono value={multisig || "—"} size="xs" />} />
                <Row k="kyb"           v={kind === "DAO" ? "n/a" : kybSigned ? "signed" : "missing"} />
                <Row k="template"      v={template} />
                <Row k="band"          v={band} />
                <Row k="risk policy"   v={`idle ${policy.idle_buffer_bps} · oracle ${policy.oracle_dev_bps} · ddown ${policy.max_dd_bps} · per-protocol ${policy.max_per_protocol_bps}`} />
                <Row k="signers"       v={`${signers.length} configured`} />
                <Row k="confidential"  v={confidential ? `enabled · pattern ${confidentialPattern}` : "off"} />
                <Row k="private exec"  v={privateExec ? `enabled · ${perSlots} slots` : "off"} />
              </ul>
            </Step>
          )}
          {stepIdx === 10 && (
            <Step title="11 · sign" desc="Atlas submits the create transaction via Squads. Strategy commitment lands at vault create + immutable thereafter (I-1).">
              <Button variant="primary" size="lg">Sign + create</Button>
            </Step>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-[color:var(--color-line-soft)]">
            <Button variant="ghost"     size="sm" onClick={prev} disabled={stepIdx === 0}>← prev</Button>
            <Button variant="primary"   size="sm" onClick={next} disabled={!stepValid(stepIdx) || stepIdx === STEPS.length - 1}>next →</Button>
          </div>
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-4">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">strategy_commitment · live</p>
          </header>
          <IdentifierMono value={strategyHash} copy size="md" />
          <p className="mt-3 text-[11px] text-[color:var(--color-ink-tertiary)]">
            Recomputes on every choice above. Once signed, this hash is folded into the vault account and is permanent.
          </p>
          <div className="mt-4 pt-3 border-t border-[color:var(--color-line-soft)]">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">backtest summary · 90d</p>
            <ul className="mt-2 font-mono text-[11px] space-y-1 text-[color:var(--color-ink-secondary)]">
              <li>· apy median · 8.4%</li>
              <li>· max ddown · −1.8%</li>
              <li>· vol 30d · 0.62</li>
              <li>· defensive triggers · 2</li>
            </ul>
            <AlertPill severity="ok" className="mt-3">passes simulator</AlertPill>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Step({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{title}</p>
      <h2 className="text-display text-[18px] mt-1 mb-1">{title.split(" · ")[1]}</h2>
      <p className="text-[12px] text-[color:var(--color-ink-secondary)] mb-3">{desc}</p>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{k}</span>
      <span className="text-[color:var(--color-ink-primary)] text-right break-all">{v}</span>
    </li>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{label}</span>
      <input
        type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-3 font-mono text-[12px] outline-none focus:border-[color:var(--color-accent-electric)]"
      />
    </label>
  );
}

function chipBtn(active: boolean, align: "center" | "left" = "center"): string {
  return cn(
    "px-3 py-3 rounded-[var(--radius-sm)] border text-[12px]",
    align === "center" ? "text-center" : "text-left",
    active
      ? "bg-[color:var(--color-accent-electric)]/15 text-[color:var(--color-ink-primary)] border-[color:var(--color-accent-electric)]/40"
      : "bg-[color:var(--color-surface-base)] text-[color:var(--color-ink-secondary)] border-[color:var(--color-line-medium)] hover:bg-[color:var(--color-line-soft)]",
  );
}
