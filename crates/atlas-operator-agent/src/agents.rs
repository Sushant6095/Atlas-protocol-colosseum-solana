//! Multi-agent treasury framing (directive §5 + §13).
//!
//! Atlas does not introduce new "agents". The frontend's `/agents`
//! dashboard maps the four user-facing personas (Risk Agent, Yield
//! Agent, Compliance Agent, Execution Agent) onto the existing
//! Atlas constructs. The mapping is explicit so an auditor can
//! follow each persona back to the deterministic crate that
//! actually does the work — no hidden LLM, no opaque policy.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentPersona {
    Risk,
    Yield,
    Compliance,
    Execution,
}

/// What the persona actually maps to under the hood. Each `concrete`
/// entry is the crate or program that produces the corresponding
/// behaviour; the agent persona is just the user-facing label.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentReality {
    pub concrete_crate: String,
    pub concrete_program: Option<String>,
    pub deterministic: bool,
    pub gated_by_proof: bool,
    pub gated_by_attestation: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentCard {
    pub persona: AgentPersona,
    pub display_name: String,
    pub one_liner: String,
    pub responsibilities: Vec<String>,
    pub reality: AgentReality,
}

/// Render the four canonical agent cards. The frontend's `/agents`
/// page consumes this list verbatim.
pub fn render_agent_card(persona: AgentPersona) -> AgentCard {
    match persona {
        AgentPersona::Risk => AgentCard {
            persona,
            display_name: "Risk Agent".into(),
            one_liner: "Watches exposure caps, leverage, and concentration limits.".into(),
            responsibilities: vec![
                "computes treasury exposure per directive §3".into(),
                "rejects rebalances that breach concentration caps".into(),
                "flags rebalances that drift outside the bounded LIE envelope".into(),
            ],
            reality: AgentReality {
                concrete_crate: "atlas-exposure".into(),
                concrete_program: Some("atlas-rebalancer (rejects on cap breach)".into()),
                deterministic: true,
                gated_by_proof: true,
                gated_by_attestation: false,
            },
        },
        AgentPersona::Yield => AgentCard {
            persona,
            display_name: "Yield Agent".into(),
            one_liner: "Picks routes inside the LIE bound and emits the SP1 proof.".into(),
            responsibilities: vec![
                "scores Kamino / Drift / Marginfi / Jupiter routes".into(),
                "produces the deterministic policy decision (atlas-pipeline)".into(),
                "binds the decision to the SP1 receipt the verifier checks".into(),
            ],
            reality: AgentReality {
                concrete_crate: "atlas-pipeline + atlas-lie".into(),
                concrete_program: Some("atlas-verifier".into()),
                deterministic: true,
                gated_by_proof: true,
                gated_by_attestation: true,
            },
        },
        AgentPersona::Compliance => AgentCard {
            persona,
            display_name: "Compliance Agent".into(),
            one_liner: "Region/sanctions pre-flight + AML grant lifecycle.".into(),
            responsibilities: vec![
                "runs region permission + sanctions pre-flight per directive §10".into(),
                "scopes Dodo's AML reads to payments + invoices only".into(),
                "rejects routes that touch forbidden regions or blocked counterparties".into(),
            ],
            reality: AgentReality {
                concrete_crate: "atlas-payments::compliance".into(),
                concrete_program: None,
                deterministic: true,
                gated_by_proof: false,
                gated_by_attestation: false,
            },
        },
        AgentPersona::Execution => AgentCard {
            persona,
            display_name: "Execution Agent".into(),
            one_liner: "Scoped keeper + independent attestation; mandate-bounded.".into(),
            responsibilities: vec![
                "lands the rebalance/settlement/hedge tx via the scoped keeper".into(),
                "ratchets the on-chain mandate (actions_used + notional_used)".into(),
                "co-signs with an independent attestation_keeper before the program accepts".into(),
            ],
            reality: AgentReality {
                concrete_crate: "atlas-operator-agent".into(),
                concrete_program: Some("atlas_keeper_registry".into()),
                deterministic: true,
                gated_by_proof: true,
                gated_by_attestation: true,
            },
        },
    }
}

/// All four agent cards in canonical order. The frontend renders
/// the dashboard from this list.
pub fn render_all_cards() -> Vec<AgentCard> {
    vec![
        render_agent_card(AgentPersona::Risk),
        render_agent_card(AgentPersona::Yield),
        render_agent_card(AgentPersona::Compliance),
        render_agent_card(AgentPersona::Execution),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_four_personas_render() {
        let cards = render_all_cards();
        assert_eq!(cards.len(), 4);
    }

    #[test]
    fn every_card_is_deterministic() {
        for c in render_all_cards() {
            assert!(c.reality.deterministic, "{:?} marked non-deterministic", c.persona);
        }
    }

    #[test]
    fn every_card_has_a_concrete_crate() {
        for c in render_all_cards() {
            assert!(!c.reality.concrete_crate.is_empty(), "{:?} missing crate", c.persona);
        }
    }

    #[test]
    fn execution_persona_gated_by_attestation() {
        let c = render_agent_card(AgentPersona::Execution);
        assert!(c.reality.gated_by_attestation);
        assert!(c.reality.gated_by_proof);
    }

    #[test]
    fn compliance_persona_does_not_need_proof() {
        let c = render_agent_card(AgentPersona::Compliance);
        assert!(!c.reality.gated_by_proof);
    }

    #[test]
    fn risk_persona_maps_to_exposure_crate() {
        let c = render_agent_card(AgentPersona::Risk);
        assert_eq!(c.reality.concrete_crate, "atlas-exposure");
    }

    #[test]
    fn yield_persona_maps_to_pipeline_and_lie() {
        let c = render_agent_card(AgentPersona::Yield);
        assert!(c.reality.concrete_crate.contains("atlas-pipeline"));
        assert!(c.reality.concrete_crate.contains("atlas-lie"));
    }

    #[test]
    fn execution_persona_maps_to_keeper_registry_program() {
        let c = render_agent_card(AgentPersona::Execution);
        assert_eq!(c.reality.concrete_program.as_deref(), Some("atlas_keeper_registry"));
    }

    #[test]
    fn responsibilities_non_empty() {
        for c in render_all_cards() {
            assert!(!c.responsibilities.is_empty(), "{:?} missing responsibilities", c.persona);
        }
    }
}
