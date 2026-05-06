# Atlas Infra — Latency-Tier-A RPC + /infra Public Observatory

> Every Atlas claim is publicly observable. RPC latency, slot drift,
> proof freshness, rebalance pipeline timings, validator health — live,
> rate-limited, zero-auth at `/infra`. Latency-tier-A reads on RPC
> Fast. Quorum reads diverse and attributed. The system that proves
> its allocations also proves its plumbing.

## What Phase 17 ships

| Surface | Code |
|---|---|
| `SourceId::RpcFast` adapter (tier-A latency, region-tagged) | [crates/atlas-bus/src/event.rs](crates/atlas-bus/src/event.rs) + [adapters.rs](crates/atlas-bus/src/adapters.rs) |
| `RpcRole` + `RpcRoleSet` + canonical role mapping | [crates/atlas-rpc-router/src/role.rs](crates/atlas-rpc-router/src/role.rs) |
| `RpcRouter` trait + `StaticRouter` reference impl | [crates/atlas-rpc-router/src/router.rs](crates/atlas-rpc-router/src/router.rs) |
| Slot-drift attribution + outlier-share quarantine recommender | [crates/atlas-rpc-router/src/attribution.rs](crates/atlas-rpc-router/src/attribution.rs) |
| Slot Freshness Budget + proof-pipeline timeline | [crates/atlas-rpc-router/src/freshness.rs](crates/atlas-rpc-router/src/freshness.rs) |
| `lint_no_read_hot_in_commitment_path` + `COMMITMENT_PATH_CRATES` | [crates/atlas-runtime/src/lints.rs](crates/atlas-runtime/src/lints.rs) |
| 8 Phase 17 telemetry metrics | [crates/atlas-telemetry/src/lib.rs](crates/atlas-telemetry/src/lib.rs) |
| 4 REST endpoints (`/infra`, `/infra/attribution`, `/freshness`, `/freshness/{id}`) | [crates/atlas-public-api/src/endpoints.rs](crates/atlas-public-api/src/endpoints.rs) |
| `atlas-rs` client `get_infra_snapshot` / `get_attribution_heatmap` / `get_freshness_*` | [crates/atlas-rs/src/client.rs](crates/atlas-rs/src/client.rs) |
| `@atlas/sdk` `getInfraSnapshot` + `getFreshnessAll` + 7 TS types | [sdk/ts/src/platform.ts](sdk/ts/src/platform.ts) |
| `/infra` public observatory page | [sdk/playground/infra.html](sdk/playground/infra.html) |
| Slot Freshness Monitor with timeline drilldown | [sdk/playground/freshness.html](sdk/playground/freshness.html) |
| `@atlas/widgets` embeddable npm package | [sdk/widgets/](sdk/widgets/) |

## The five-item delta

The "RPC Fast integration" wishlist is largely Phase 02 work that already
shipped (multi-RPC, quorum, hot/warm/cold, slot freshness, reliability
EMA, public WSS stream). Phase 17 adds five things — and only these:

1. **Role tags.** `tier_a_latency` / `tier_b_quorum` / `tier_c_archive`.
   RPC Fast joins as tier-A only. Triton / Helius / QuickNode stay
   tier-B. Tier-A does NOT count toward `min_sources` quorum unless
   the source also holds tier-B with attested geographic diversity.
2. **Latency-tiered routing.** `RpcRouter::read_hot` / `read_quorum`
   / `read_archive` are explicit. Calling code declares its read
   class; the runtime lint `lint_no_read_hot_in_commitment_path`
   blocks misuse in `atlas-pipeline` / `atlas-bus` / `atlas-replay` /
   `atlas-warehouse` / `atlas-sandbox` / `atlas-public-input` /
   `atlas-verifier`.
3. **Slot-drift attribution.** When the quorum engine sees
   disagreement, `AttributionEngine::record` distinguishes
   `SlotSkew` (lagging on slot, agreeing on content — soft fault)
   from `ContentDivergence` (different state at the same slot —
   hard fault). Per-source outlier share rolls up into the
   `/infra` heatmap and triggers `quarantine_candidates()` once a
   source crosses `OUTLIER_QUARANTINE_BPS = 4_000`.
4. **`/infra` public observatory.** A single page with twelve panels
   covering RPC latency, slot lag, attribution, TPS, Jito landed
   rate, validator latency, CU consumption, proof gen, rebalance
   e2e, Pyth post latency, and the per-vault freshness budget.
   Public, rate-limited, zero auth — judges, integrators, and
   regulators all see the same dashboard.
5. **Slot Freshness Monitor.** A glanceable surface showing
   `slot_drift = current_slot - last_proof_slot` against
   `MAX_STALE_SLOTS = 150` (Phase 01 I-3). Green > 50% remaining,
   amber 10–50%, red < 10%. Click a vault to expand a drilldown
   timeline of `ingest → infer → consensus → prove → submit`.

## Hard rules

| Rule | Enforced where |
|---|---|
| `read_hot` is single-source by design; commitment-path crates may not use it | `atlas-runtime::lint_no_read_hot_in_commitment_path` (CI-enforced) |
| Tier-A latency vendor does not vouch for itself on consistency | `RpcRoleSet::counts_in_quorum` returns false unless `tier_b_quorum` is also set |
| Dual-role tagging requires geographic-diversity attestation | `RpcRoleSet::from_roles` returns `DualRoleWithoutDiversity` otherwise |
| Slot-drift attribution requires quorum context | `AttributionEngine::record` returns `InsufficientQuorum` for single-sample paths |
| Confidential vault notionals never appear in `/infra` panels | Phase 14 boundary; aggregate metrics only |

## Telemetry

| Metric | SLO |
|---|---|
| `atlas_rpc_tier_a_read_ms` (p99) | ≤ 250 ms |
| `atlas_rpc_tier_b_read_ms` (p99) | ≤ 800 ms |
| `atlas_rpc_quorum_attribution_outlier_share_bps` | tracked; alert on cliff |
| `atlas_infra_dashboard_render_ms` (p99) | ≤ 1500 cold / 600 warm |
| `atlas_freshness_window_remaining_pct` (p10) | ≥ 30 |
| `atlas_read_hot_commitment_path_misuse_total` | hard alert on any |
| `atlas_rpc_quorum_disagreement_kind_total` | tracked per kind |
| `atlas_rpc_tier_a_hot_read_total` | dashboarded — sizes the latency win |

## Acceptance bar

- 36 unit tests in [crates/atlas-rpc-router](crates/atlas-rpc-router/) cover: tier-only-A
  excluded from quorum, dual-role diversity gate, RPC Fast canonical
  mapping, p99 budgets, hot-read over-budget rejection,
  commitment-path-misuse rejection, quorum below-min rejection,
  attribution distinguishes skew vs divergence, total disagreement
  detection, outlier-share growth, quarantine candidate selection,
  freshness band thresholds, timeline dominant-stage detection,
  fraction-bps math, last-proof-ahead saturation.
- 5 lint tests in [crates/atlas-runtime](crates/atlas-runtime/src/lints.rs) cover:
  `read_hot(`, `ReadClass::Hot`, `router.read_hot` flagged in
  `atlas-pipeline`; clean quorum read passes; non-commitment-path
  crates exempt.
- `/infra` rendering: every panel updates from existing Phase 02 /
  Phase 09 telemetry. No new instrumentation beyond §3 attribution.

## Why this is the right delta

Anyone can buy an RPC. The point is not that RPC Fast exists, it's
that Atlas's read paths are structurally split between *latency-
optimised* and *consistency-optimised* — and the split is enforced by
a runtime lint, not a code review. RPC Fast is the latency vendor;
Triton / Helius / QuickNode are the consistency vendors; the program
never crosses the streams. The `/infra` page proves it in real time.
