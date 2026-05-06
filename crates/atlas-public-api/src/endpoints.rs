//! Endpoint catalog (directive §7.1).

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Method {
    Get,
    Post,
}

/// Compile-time endpoint row. Holds `&'static str` so it can live in
/// a `const` slice. Not (de)serializable directly — the HTTP server
/// projects these into the wire-format `EndpointSpec` at runtime.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RestEndpoint {
    pub method: Method,
    pub path: &'static str,
    pub description: &'static str,
    pub rate_limit_per_minute: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WsEndpoint {
    pub path: &'static str,
    pub description: &'static str,
    pub rate_limit_messages_per_minute: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct EndpointSpec {
    pub rest_paths: Vec<String>,
    pub websocket_paths: Vec<String>,
}

impl EndpointSpec {
    pub fn from_const() -> Self {
        Self {
            rest_paths: rest_endpoints().iter().map(|r| r.path.to_string()).collect(),
            websocket_paths: websocket_endpoints().iter().map(|w| w.path.to_string()).collect(),
        }
    }
}

pub const fn rest_endpoints() -> &'static [RestEndpoint] {
    &[
        RestEndpoint { method: Method::Get, path: "/api/v1/vaults", description: "list vaults", rate_limit_per_minute: 600 },
        RestEndpoint { method: Method::Get, path: "/api/v1/vaults/{id}", description: "current state, allocation, NAV, last rebalance", rate_limit_per_minute: 600 },
        RestEndpoint { method: Method::Get, path: "/api/v1/vaults/{id}/rebalances", description: "paginated history with Bubblegum proofs", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/rebalance/{public_input_hash}", description: "full black box record", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/rebalance/{public_input_hash}/proof", description: "Groth16 proof bytes", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/rebalance/{public_input_hash}/explanation", description: "canonical structured explanation + human render", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/opportunities", description: "Birdeye-overlaid opportunity scanner output", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/execution/analytics", description: "per-route landing + slippage stats", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Post, path: "/api/v1/simulate/{ix}", description: "pre-sign simulation", rate_limit_per_minute: 600 },
        // Phase 11 — intelligence + treasury cross-chain mirror.
        RestEndpoint { method: Method::Get, path: "/api/v1/wallet-intel/{wallet}", description: "Phase 11 wallet intelligence report (Dune SIM + warehouse)", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/wallet-intel/{wallet}/snapshot/{snapshot_id}", description: "replayable snapshot of an intel report", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/intelligence/heatmap", description: "24h capital flow heatmap with per-cell source provenance", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/intelligence/exposure-graph/{wallet}", description: "wallet \u{2192} protocol \u{2192} asset exposure graph", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/treasury/{entity_id}/intelligence", description: "multi-wallet intelligence aggregate for a treasury entity", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/intel/pusd", description: "stablecoin intelligence dashboard feed (peg / flow / depth)", rate_limit_per_minute: 600 },
        // Phase 12 — Jupiter execution surfaces.
        RestEndpoint { method: Method::Post, path: "/api/v1/triggers", description: "create a proof-gated Jupiter trigger order", rate_limit_per_minute: 120 },
        RestEndpoint { method: Method::Get, path: "/api/v1/triggers/{trigger_id}", description: "read TriggerGate state + most recent attestation", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Post, path: "/api/v1/recurring", description: "open an adaptive Jupiter Recurring plan", rate_limit_per_minute: 120 },
        RestEndpoint { method: Method::Get, path: "/api/v1/recurring/{vault_id}", description: "read current RecurringPlan + commitment hash + version", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Post, path: "/api/v1/hedging/preview", description: "compute hedge sizing from underlying LP exposure (no submit)", rate_limit_per_minute: 120 },
        // Phase 13 — Atlas Treasury OS for internet businesses (Dodo).
        RestEndpoint { method: Method::Post, path: "/api/v1/payments/webhook", description: "Dodo-signed payment schedule ingest (HMAC verified, replay-protected)", rate_limit_per_minute: 600 },
        RestEndpoint { method: Method::Get, path: "/api/v1/treasury/{entity_id}/payments/schedule", description: "most recent verified Dodo payment schedule", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/treasury/{entity_id}/runway", description: "cashflow runway forecast (p10 / p50)", rate_limit_per_minute: 300 },
        RestEndpoint { method: Method::Get, path: "/api/v1/treasury/{entity_id}/invoices", description: "invoice intelligence rollup with settlement distribution", rate_limit_per_minute: 300 },
    ]
}

pub const fn websocket_endpoints() -> &'static [WsEndpoint] {
    &[
        WsEndpoint { path: "/api/v1/stream/network", description: "public network-intelligence stream", rate_limit_messages_per_minute: 1_200 },
        WsEndpoint { path: "/api/v1/stream/vault/{id}", description: "per-vault rebalance event stream", rate_limit_messages_per_minute: 600 },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rest_endpoints_count_matches_directive() {
        // §7.1 enumerates 9 REST endpoints. Phase 11 adds 6 more for
        // wallet intelligence + treasury cross-chain. Phase 12 adds
        // 5 more for Jupiter execution (triggers, recurring, hedging).
        // Phase 13 adds 4 more for Dodo payments + runway + invoices.
        assert_eq!(rest_endpoints().len(), 24);
    }

    #[test]
    fn websocket_endpoints_count_matches_directive() {
        assert_eq!(websocket_endpoints().len(), 2);
    }

    #[test]
    fn endpoint_paths_unique() {
        let mut paths: Vec<&str> = rest_endpoints().iter().map(|r| r.path).collect();
        paths.extend(websocket_endpoints().iter().map(|w| w.path));
        let total = paths.len();
        paths.sort();
        paths.dedup();
        assert_eq!(paths.len(), total);
    }

    #[test]
    fn writeable_endpoints_are_only_authoring_surfaces() {
        // Phase 09 banned write endpoints. Phase 12 added authoring
        // surfaces for proof-gated triggers + adaptive recurring +
        // hedge previews. Phase 13 adds the Dodo webhook ingest
        // (signature-verified before any state change). The actual
        // on-chain ix must still be user-signed.
        let posts: Vec<_> = rest_endpoints().iter().filter(|r| r.method == Method::Post).collect();
        let post_paths: Vec<&str> = posts.iter().map(|r| r.path).collect();
        assert_eq!(posts.len(), 5);
        assert!(post_paths.contains(&"/api/v1/simulate/{ix}"));
        assert!(post_paths.contains(&"/api/v1/triggers"));
        assert!(post_paths.contains(&"/api/v1/recurring"));
        assert!(post_paths.contains(&"/api/v1/hedging/preview"));
        assert!(post_paths.contains(&"/api/v1/payments/webhook"));
    }
}
