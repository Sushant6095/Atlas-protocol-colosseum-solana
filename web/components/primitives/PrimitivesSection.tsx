import { PrimitiveCard } from "./PrimitiveCard";
import { AnimVerification }  from "./anim/AnimVerification";
import { AnimAllocation }    from "./anim/AnimAllocation";
import { AnimPrewarm }       from "./anim/AnimPrewarm";
import { AnimTriggers }      from "./anim/AnimTriggers";
import { AnimConfidential }  from "./anim/AnimConfidential";
import { AnimPrivateExec }   from "./anim/AnimPrivateExec";

export function PrimitivesSection() {
  return (
    <section className="border-t border-line-soft bg-surface-base px-6 py-32 md:px-12">
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-ink-tertiary">
          SIX PRIMITIVES
        </p>
        <h2 className="mt-6 max-w-3xl font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-5xl">
          Atlas at the protocol layer.<br />
          <span className="bg-gradient-to-r from-accent-electric via-accent-zk to-accent-proof bg-clip-text text-transparent">
            Six primitives.
          </span>
        </h2>
        <p className="mt-8 max-w-2xl font-body text-base leading-relaxed text-ink-secondary md:text-lg">
          Each primitive is a small piece of the Atlas system. Every rebalance
          touches all six.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line-medium bg-line-medium md:grid-cols-2 lg:grid-cols-3">
          <PrimitiveCard
            title="Proof Verification"
            description="Every rebalance ships a Groth16 proof. Solana checks alt_bn128 pairing in ~250k CU before any USDC moves."
            accent="electric"
          >
            <AnimVerification />
          </PrimitiveCard>
          <PrimitiveCard
            title="AI Allocation"
            description="Seven specialist agents vote on each move. One hard veto collapses to the pre-committed defensive vector."
            accent="zk"
          >
            <AnimAllocation />
          </PrimitiveCard>
          <PrimitiveCard
            title="Treasury Pre-warm"
            description="Cashflow signals from Dodo trigger buffer-ratcheting rebalances before scheduled payouts. Deadline-safe by construction."
            accent="execute"
          >
            <AnimPrewarm />
          </PrimitiveCard>
          <PrimitiveCard
            title="Proof-Gated Triggers"
            description="Stop-loss orders that refuse to fire during oracle anomalies. Conditions are committed and verifier-checked."
            accent="proof"
          >
            <AnimTriggers />
          </PrimitiveCard>
          <PrimitiveCard
            title="Confidential Mode"
            description="Token-2022 confidential transfer. Allocation ratios stay public; absolute notionals hidden behind viewing keys."
            accent="warn"
          >
            <AnimConfidential />
          </PrimitiveCard>
          <PrimitiveCard
            title="Private Execution"
            description="Vault state delegates to a MagicBlock ephemeral rollup. Routing path stays private; final state settles on mainnet."
            accent="danger"
          >
            <AnimPrivateExec />
          </PrimitiveCard>
        </div>
      </div>
    </section>
  );
}
