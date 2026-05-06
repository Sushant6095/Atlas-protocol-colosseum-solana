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
        // §7.1 enumerates 9 REST endpoints.
        assert_eq!(rest_endpoints().len(), 9);
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
    fn no_write_endpoints_in_rest() {
        // §7.1: "All read endpoints public + rate-limited. No write endpoints."
        // The single POST is /simulate/{ix} which is a read-side simulator.
        let posts: Vec<_> = rest_endpoints().iter().filter(|r| r.method == Method::Post).collect();
        assert_eq!(posts.len(), 1);
        assert_eq!(posts[0].path, "/api/v1/simulate/{ix}");
    }
}
