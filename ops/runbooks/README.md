# Runbooks

One runbook per `FailureClass` category. Every alert template references
the relevant runbook by relative path so oncall reaches the right page in
one click.

| Category prefix | Runbook | Covers |
|---|---|---|
| 1xxx | [ingestion.md](./ingestion.md) | quorum, source quarantine, RPC timeout, stale account |
| 2xxx | [oracle.md](./oracle.md) | oracle stale, deviation, Pyth pull post failed |
| 3xxx | [inference.md](./inference.md) | agent timeout, hard veto, disagreement |
| 4xxx | [proof.md](./proof.md) | proof gen timeout, verify failed, public input mismatch |
| 5xxx | [execution.md](./execution.md) | CU exhaustion, CPI failure, slippage, post-conditions, ALT |
| 6xxx | [archival.md](./archival.md) | warehouse write failure, Bubblegum lag |
| 7xxx | [adversarial.md](./adversarial.md) | stale proof replay, forged target, manipulated state |

Every page-class alert references the runbook in its template body so an
oncall responder can land on the right page in a single click.
