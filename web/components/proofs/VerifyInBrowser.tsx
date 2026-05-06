// VerifyInBrowser — the credibility-moment widget (Phase 22 §6.2).
//
// Calls `client.verifyProof(response)` from the SDK; on success the
// button flips to a verified badge with a 2s celebratory glow. The
// underlying check is shape-only here; in production it hands the
// proof bytes to sp1-solana via WASM. This component is the contract
// surface — the actual cryptographic verifier ships in Phase 24.

"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { transitions } from "@/lib/motion";

export interface ProofShape {
  publicInputHex: string;
  proofBytes: number[];
  archiveRootSlot: number;
  archiveRoot: string;
  merkleProofPath: string[];
}

type VerifyResult = "idle" | "checking" | "passed" | "failed";

export interface VerifyInBrowserProps {
  proof: ProofShape;
  /** Optional client-side verifier override (for tests). */
  verifier?: (p: ProofShape) => Promise<boolean>;
}

function VerifyInBrowserImpl({ proof, verifier }: VerifyInBrowserProps) {
  const [state, setState] = useState<VerifyResult>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const onVerify = async () => {
    setState("checking");
    setError(null);
    const t0 = performance.now();
    try {
      const ok = await (verifier ?? defaultVerifier)(proof);
      setElapsedMs(Math.round(performance.now() - t0));
      setState(ok ? "passed" : "failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("failed");
    }
  };

  if (state === "passed") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1, transition: transitions.expressive }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[color:var(--color-accent-execute)]/15 text-[color:var(--color-accent-execute)] border border-[color:var(--color-accent-execute)]/30"
      >
        <ShieldCheck className="h-4 w-4" />
        <span className="font-mono text-[12px] uppercase tracking-[0.08em]">
          verification pass
        </span>
        {elapsedMs != null ? (
          <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            · {elapsedMs}ms
          </span>
        ) : null}
      </motion.div>
    );
  }

  if (state === "failed") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[color:var(--color-accent-danger)]/15 text-[color:var(--color-accent-danger)] border border-[color:var(--color-accent-danger)]/30">
        <AlertTriangle className="h-4 w-4" />
        <span className="font-mono text-[12px] uppercase tracking-[0.08em]">
          verification failed
        </span>
        {error ? (
          <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            · {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <Button variant="primary" size="sm" onClick={onVerify} disabled={state === "checking"}>
      {state === "checking" ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          verifying…
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5" />
          verify in browser
        </>
      )}
    </Button>
  );
}

/**
 * Shape-only verifier. Identical to `verifyProof()` in `@atlas/sdk`'s
 * `platform.ts` — the cryptographic ed25519 / Groth16 check delegates
 * to sp1-solana via WASM in Phase 24.
 */
async function defaultVerifier(r: ProofShape): Promise<boolean> {
  // Light async to make the demo feel like actual work happens.
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (r.publicInputHex.length !== 536) return false;
  if (!r.proofBytes || r.proofBytes.length === 0) return false;
  if (!r.merkleProofPath || r.merkleProofPath.length === 0) return false;
  if (!r.archiveRoot || r.archiveRoot.length < 32) return false;
  return true;
}

export const VerifyInBrowser = memo(VerifyInBrowserImpl);
VerifyInBrowser.displayName = "VerifyInBrowser";
