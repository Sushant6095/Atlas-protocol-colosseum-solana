# Game-day runbook — Prover network full outage

SP1 prover unreachable; off-chain proving stops. Bundles cannot be
composed because they need a proof.

## Pre-flight

- Kill switch: scenario halts if `atlas_proof_gen_seconds p99`
  exceeds 300 s for more than 10 minutes (at that point the keeper
  has already halted on its own).
- Channel: #atlas-chaos.

## Inject

```sh
atlas-chaos run --scenario prover-outage --target staging --seed 12349 --output reports/gameday-prover.json
```

`ProverByzantine invalid_proof=true delay_ms=0` simulates a prover
that returns invalid proofs without delay — the off-chain verifier
mirror catches them.

## Observe

1. Off-chain proof verification rejects every output; `atlas_failure_uncategorized_total`
   stays 0 because every reject is classified as `4002
   ProofVerifyFailed`.
2. Pipeline halts at stage 12. No bundle is ever composed.
3. The alert engine PAGES (`AlertKind::ProverNetworkDown`) — this is
   one of the five Page-class events.

## Recover

1. Failover to the local fallback prover (`prover.local`). If it
   produces a valid proof, the pipeline resumes.
2. If both prover paths fail, halt rebalances entirely. There is no
   third path.
3. Once SP1 mainnet recovers, drain the backlog of pending
   rebalances one at a time and verify the on-chain root commitment
   moves forward in lockstep.

## Debrief

Validate that the pager actually pages within MTTD ≤ 60 s. If it
doesn't, the alert engine's dedup window is too aggressive for a
hard-down event and needs tightening per the directive 05 §4.2 reset.
