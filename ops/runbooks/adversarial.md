# Runbook — Adversarial events (7xxx)

Covers `StaleProofReplayDetected`, `ForgedVaultTarget`,
`ManipulatedStateRoot`.

## Severity

**Adversarial events are security pages. They bypass maintenance windows
and are never auto-retried.**

## Triage

1. Capture the public input hash from the alert.
2. `atlas inspect <PUBLIC_INPUT_HASH>` for the full record + balances diff
   + vetoes + Bubblegum proof.
3. Cross-reference the forensic engine output for the surrounding window
   — were there `LargeStableExit`, `WhaleEntry`, or `LiquidationCascade`
   signals? Adversaries usually leave more than one fingerprint.

## Decision tree

| Class | Action |
|---|---|
| `StaleProofReplayDetected` | Reject. The proof matches an earlier accepted public input. Identify the source channel and quarantine. The on-chain verifier will reject anyway, but recording it pre-on-chain saves a verifier CU and produces a forensic anchor. |
| `ForgedVaultTarget` | Reject and emit security event. The `vault_id` in the public input doesn't match the bundle target. This is either a serializer bug (page engineering) or an active attack (page security). |
| `ManipulatedStateRoot` | Reject and emit security event. The state root the prover signed doesn't match the on-chain account hashes the verifier reconstructs. Treat as compromise until proven otherwise. |

## Anti-patterns

- Do not auto-retry security events.
- Do not silence the alert on first occurrence — security events should
  always escalate.
- Do not investigate without the forensic engine output. The forensic
  signals are the contemporaneous evidence; logs alone are not enough.
