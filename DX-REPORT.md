# DX-REPORT — Building Atlas on Jupiter

Honest developer-experience write-up from the Atlas team, submitted to
the Jupiter DX bounty during Colosseum Frontier. We integrated Jupiter
twice: once for Lend / Perps composition (`crates/atlas-jupiter`) and
once for predictive route forecasting (`crates/atlas-execution-routes/src/predictive.rs`).
This document is the before / after view through those two paths — what
helped, what cost us hours, and what we wish existed.

We have **not** wired live Swap V2 against mainnet inside this submission.
The integration we ship is offline-typed (allowlist program ids, hedge
sizing math, naked-short guards, predictive-quote scoring) plus
proptests that pin the invariants. Live wiring is on the post-hackathon
roadmap. Reading this report with that scope in mind is the fair frame.

---

## tl;dr

- **Jupiter is the most discoverable Solana program in the ecosystem.**
  Two Atlas engineers — neither of whom had touched Jupiter before —
  both had a runnable mental model inside 25 minutes.
- **The Quote API surface is the single best decision the team has made.**
  Quote-first, swap-second is the right factoring; the entire
  predictive-routing extension (directive 12 §7) only exists because
  the Quote API can be called speculatively without committing to a tx.
- **The cliffs are concentrated in three places.** (1) Token-2022 +
  Jupiter Lend composition, (2) versioned-tx + ALT discovery for the
  swap instruction, (3) finding the canonical naked-short / lend-risk
  guarantees programmatically. None are show-stoppers; all cost half a
  day each.
- **The AI Stack story is where Jupiter is leaving the most upside on
  the table.** Skills exist informally in the Discord; nothing
  ergonomic ships in the docs. There is no `llms.txt`, no MCP server,
  no first-party `jup` CLI. The agent-as-developer assumption is no
  longer hypothetical — it is how Atlas was built.

---

## Onboarding timeline

Wall-clock from `git clone` to the first useful integration.

| Min   | Event                                                                 |
|-------|-----------------------------------------------------------------------|
| 0:00  | Land on `dev.jup.ag`. Quickstart is good — quote + swap in 5 lines.   |
| 0:08  | First Quote-API call against mainnet returns. Visually sane.          |
| 0:12  | Swap-tx generation works. Want to inspect → realize it's versioned-tx.|
| 0:34  | Versioned-tx + ALT decoded; can simulate. (Cost: 22 min.)             |
| 0:55  | Need Lend (Phase 12 §5). Find docs; conceptually clear.               |
| 1:25  | Token-2022 + Jupiter Lend allocation: 30 min trying to find whether   |
|       | a mint with `TransferFeeConfig` is supported as collateral. Answer:   |
|       | "depends on the pool config." No machine-readable manifest.           |
| 1:35  | Decide to ship offline allowlist + naked-short guard in Rust          |
|       | (`atlas-jupiter`); skip live wiring for this submission.              |
| 1:55  | Predictive routing — 3 Quote-API calls at `now / now+lag / now+lag+1` |
|       | for forecast drift signal. Composition pattern lands cleanly.         |
| 2:30  | `forecast_penalty_bps` + `predictive_routing_drift_bps` typed,        |
|       | proptest passes. End of session 1.                                    |

Net: **two hours to two production-shaped Rust modules, no live
wiring**. With one missing manifest the wall-clock would have been
~80 minutes.

---

## What confused us

1. **"Jupiter Lend" vs "Jupiter Lite" vs "Jupiter v6 swap" vs
   "Ultra".** The product surface area is wide and the names overlap.
   We had to read three pages to confirm Lend is the right product for
   our use case (treasury-grade yield with allowlist controls). A
   single "what is each Jupiter product and when to use it" page —
   one paragraph each — would have saved half an hour.
2. **Versioned-tx + ALT.** The swap endpoint returns a versioned tx
   with ALTs. Standard tutorials gloss past the deserialization step.
   The fact that you need `VersionedTransaction.deserialize` + lookup
   the ALTs to inspect ix-level data is the single biggest 22-minute
   detour we hit. A "decoding the swap tx" page would land.
3. **Slippage units.** We were never confused, but we caught ourselves
   double-checking — bps vs % vs decimals shows up in different
   places. A pinned "all units are bps everywhere" sentence in the
   Quote API doc would close the loop.
4. **Whether a Token-2022 mint with `TransferFeeConfig` works as
   collateral on Lend.** The answer ("depends on the pool") is fine,
   but only after 30 minutes of grep. A machine-readable manifest
   (`/v1/lend/supported_collateral?extensions=transfer_fee`) would be
   ideal.

---

## What broke

- **Nothing in Jupiter broke for us.** Quote API responses are
  consistent; the contract is stable; no surprise schema drift over
  the integration window.
- **What broke in our stack while integrating Jupiter** was bs58 /
  ws version conflicts in pnpm peer resolution. That is on us; just
  worth noting that the Solana frontend ecosystem still resolves
  unstably and Jupiter's web SDK inherits the same pain.

---

## AI Stack feedback (Skills · CLI · MCP · `llms.txt`) — at length

This is where Jupiter has the most upside, and where we have the most
to say. Atlas was built with Claude Code as a co-author through every
phase. The AI-developer is no longer a thought experiment; it is the
shape of the median PR.

### `llms.txt`

There is no `llms.txt` at the root of `dev.jup.ag`. We had to
hand-write a Skill for Claude that summarized "what is Quote API, what
is Swap API, what are the units, what are the gotchas." That Skill is
~80 lines and it works — but it should not be on each integrator to
re-derive. **Action: publish `llms.txt` at the doc root.** It should
contain the same factoring this DX report uses — product surface in
one paragraph each, Quote-first / Swap-second factoring, units pinned
in bps, Token-2022 caveats explicit.

### MCP server

We would use a Jupiter MCP server immediately. Concretely the most
valuable tools would be:

- `quote(input_mint, output_mint, amount, slippage_bps)` — same
  contract as Quote API.
- `swap_tx(quote, user_public_key)` — returns the versioned-tx +
  ALT addresses, **decoded**.
- `lend_pool_info(pool_id)` — supported collateral + extension
  manifest, machine-readable.
- `predictive_quote(input, output, amount, horizons)` — wraps three
  Quote calls and returns the forecast drift signal.

Atlas would consume this MCP from the executor agent during
simulation. The Quote API is already MCP-shaped; it just is not yet
wrapped.

### First-party `jup` CLI

`jup quote SOL USDC 1` + `jup swap --dry-run` + `jup lend pools` would
collapse the discoverability cliff. The pattern Solana CLI set (one
binary, subcommands per surface) is the right shape. Bonus: an
`--explain` flag that prints the underlying Quote-API request +
response would be the single highest-leverage thing we can think of
for new integrators.

### Skills

Discord has a tribal knowledge layer ("oh you have to deserialize the
versioned-tx like this," "the Lend pool config is here in the IDL")
that should be Skills, not Discord. A handful of canonical Skills
(`jupiter-quote`, `jupiter-swap-versioned-tx`, `jupiter-lend-collateral`,
`jupiter-predictive-routing`) on the doc site would change the AI-coding
experience materially.

### Why this is the single biggest area to invest in

We will spend the next 18 months building agents that build with
Jupiter. Every Solana team will. The investment that compounds fastest
is the one that makes Jupiter the easiest program to integrate from
an agent's perspective. Nothing here costs more than a small team-week.

---

## If I rebuilt `developers.jup.ag`

One concrete page tree we would propose:

```
/
├── what-is-jupiter           # product surface in 5 paragraphs
├── quickstart                # quote → swap in 5 lines (unchanged)
├── llms.txt                  # NEW — machine-readable index
├── quote-api/
│   ├── overview              # units pinned: bps everywhere
│   ├── multi-leg
│   └── predictive            # NEW — composition pattern we used
├── swap-api/
│   ├── overview
│   ├── versioned-tx          # NEW — full decoding walk
│   └── alt-lookup            # NEW — one page
├── lend/
│   ├── overview
│   ├── supported-collateral  # NEW — machine-readable manifest
│   └── pool-config
├── perps/
├── recipes/
│   ├── treasury-allocator    # what Atlas built
│   ├── hedge-sizing
│   └── naked-short-guard
├── ai-stack/                 # NEW section
│   ├── skills
│   ├── mcp-server
│   └── cli
└── glossary
```

Two ideas inside that tree are load-bearing:

- **`recipes/` is the highest-leverage addition.** Integrators don't
  want API docs first; they want "I am doing X, how do I compose
  Jupiter for X." Treasury, hedge sizing, naked-short guard, predictive
  routing are all in the Atlas integration. Each could be a 200-line
  recipe page.
- **`ai-stack/` belongs in nav, not in a corner.** It is how teams
  are building now; treat it like API docs.

---

## What we wish existed

- `llms.txt` (covered).
- MCP server (covered).
- `jup` CLI (covered).
- Lend supported-collateral manifest, machine-readable.
- A predictive-routing example in the official docs. The 3-Quote
  composition we landed on is non-obvious; one paragraph would save
  weeks of independent invention.
- A "Jupiter for treasury" page. Most public Jupiter material is
  retail-swap shaped. Treasury operators want different guarantees
  (naked-short guard, slippage caps, lend-risk allowlists). The
  composition exists; the docs do not name it.

---

## How Atlas uses Jupiter

Two crates today, both offline-typed pending live wiring:

### `crates/atlas-jupiter` — Lend + Perps composition, allowlist-first

From `crates/atlas-jupiter/Cargo.toml`:

```toml
description = "Jupiter Lend + Perps composition — allowlist program ids,
              hedge sizing, naked-short guard. Implements directive 12 §5 + §6."
```

The module owns three responsibilities:

1. **Allowlist program ids.** Treasury vaults declare which Jupiter
   product ids they may compose. Atlas-runtime rejects any CPI to a
   program id not in the allowlist.
2. **Hedge sizing.** Translates a desired delta-neutral exposure into
   a Perps order spec, gated on liquidity and oracle freshness.
3. **Naked-short guard.** Refuses to open a Perps short unless the
   long-leg cover exists at quote-time and the cover's allocation is
   still ≥ the position notional.

### `crates/atlas-execution-routes/src/predictive.rs` — directive 12 §7

Predictive routing extension. Atlas consults the Quote API at three
forecasted slots (`now`, `now + slot_lag_estimate`,
`now + slot_lag_estimate + 1`) and computes the median + drift:

```rust
pub fn forecast_penalty_bps(q: &ForecastQuotes) -> u32 {
    if q.impact_now_bps < q.impact_lag_bps
       && q.impact_lag_bps < q.impact_lag_plus_one_bps {
        // strictly worsening → penalty proportional to spread
        q.impact_lag_plus_one_bps.saturating_sub(q.impact_now_bps)
    } else {
        0  // flat / improving forecast → no penalty
    }
}
```

Routes whose quoted impact is monotonically worsening across the
horizon are penalised in the route-preference EMA. The drift signal
(observed post-trade impact minus forecast median) is exported as a
telemetry counter for the simulation gate.

This composition is the example we want to see in the Jupiter docs.
It is generally useful, it only requires the Quote API, and it
materially improves rebalance quality on lagging slots.

---

## Concrete actionables (ranked by cost / impact)

| #  | Action                                                                 | Cost   | Impact |
|----|------------------------------------------------------------------------|--------|--------|
| 1  | Publish `llms.txt` at the doc root.                                    | hours  | high   |
| 2  | Add a "versioned-tx + ALT decoding" page to the Swap API docs.         | 1 day  | high   |
| 3  | Ship a machine-readable Lend supported-collateral manifest.            | 2 days | high   |
| 4  | Add a `recipes/predictive-routing` page (the 3-Quote composition).     | 0.5 d  | high   |
| 5  | First-party `jup` CLI (`quote / swap --dry-run / lend pools`).         | 1 wk   | high   |
| 6  | First-party MCP server wrapping Quote / Swap / Lend.                   | 2 wks  | xhigh  |
| 7  | Add a "Jupiter products at a glance" page (Quote / Lend / Lite / Ultra). | hours | medium |
| 8  | Pin "all units are bps" in the Quote API doc.                          | minutes| medium |
| 9  | Add a treasury-shaped page (`recipes/treasury-allocator`).             | 1 day  | medium |
| 10 | Move `ai-stack/` into the top-level nav.                               | hours  | xhigh  |

Net: a fortnight of team-time on items 1, 2, 4, 6, 10 would compound
across every Solana team in the ecosystem for the next 18 months.

---

## Closing

Jupiter is the best-built program on Solana. The DX is already good —
the surface is wide, the contract is stable, the Quote API is the
right abstraction. The investments in this report are about
multiplying that lead — making Jupiter the easiest Solana program to
integrate from an agent's perspective, not just from a human
developer's. That investment compounds harder than any single new
feature.

— The Atlas team, Colosseum Frontier 2026
