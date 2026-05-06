# Runbook — Proof failures (4xxx)

Covers `ProofGenTimeout`, `ProofVerifyFailed`, `ProofPublicInputMismatch`.

## Triage

1. `atlas_proof_gen_seconds p99` — SLO ≤ 75s. Anything past 90s and the
   pipeline starts queueing.
2. SP1 prover health endpoint — separate page, but a hard down event maps
   to `ProverNetworkDown` directly.

## Decision tree

| Class | Action |
|---|---|
| `ProofGenTimeout` | Failover to the local prover. If both prover paths fail → halt and page. |
| `ProofVerifyFailed` | Hard reject; this is either a corrupt proof or a public-input mismatch and must NEVER be retried with the same inputs. Forensic engine emits a `StaleProofReplayDetected` if the proof matches a prior receipt. |
| `ProofPublicInputMismatch` | Reject and trigger forensic recording. The inputs hashed at submission don't match the inputs the verifier reconstructs — this is a serialization drift or an active manipulation. Investigate before any retry. |

## Anti-patterns

- Do not bump the timeout silently to reduce alert noise. Tune the SLO
  through `directives/05` review, not in source.
- Do not retry a `ProofVerifyFailed` with the same public input — the
  verifier is deterministic and will reject again.
