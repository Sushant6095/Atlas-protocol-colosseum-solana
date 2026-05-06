//! Drift → alert bridge.

use atlas_alert::{Alert, AlertEngine, AlertKind, AlertSink};
use atlas_registry::drift::{
    brier_score_bps, evaluate_drift, mae_bps, DefensiveBaseline, DriftAlert, DriftReport,
    DriftThresholds,
};
use serde::{Deserialize, Serialize};

/// One observation window. `predicted_apy_bps` and `realised_apy_bps`
/// must be paired (same length, aligned by rebalance index).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MonitorWindow {
    pub vault_id: [u8; 32],
    pub model_id: [u8; 32],
    pub slot: u64,
    pub triggered_at_unix: u64,
    pub predicted_apy_bps_7d: Vec<i32>,
    pub realised_apy_bps_7d: Vec<i32>,
    pub predicted_apy_bps_30d: Vec<i32>,
    pub realised_apy_bps_30d: Vec<i32>,
    pub defensive_observed_per_kslot: f64,
    pub defensive_baseline: DefensiveBaseline,
    pub agent_predictions_bps: Vec<u32>,
    pub agent_outcomes: Vec<bool>,
}

/// Map a `DriftAlert` to its production `AlertKind`. Currently every
/// drift signal funnels into `AlertKind::DegradedModeEntered` (Notify
/// class) so governance is informed but not paged. Sustained drift
/// transitions to a Page via the registry's `DriftFlagged → Slashed`
/// path which is operator-driven, not auto.
pub const fn drift_alert_to_alert_kind(_d: DriftAlert) -> AlertKind {
    AlertKind::DegradedModeEntered
}

/// Compose a fully-rendered `Alert` with the fields the
/// `defensive_mode_entered` template expects. All template fields are
/// populated so render warnings do not fire.
pub fn drift_alert_to_alert(
    d: DriftAlert,
    window: &MonitorWindow,
    drift_report: &DriftReport,
) -> Alert {
    let kind = drift_alert_to_alert_kind(d);
    let trigger = match d {
        DriftAlert::Mae7d => "drift_mae_7d",
        DriftAlert::Mae30d => "drift_mae_30d",
        DriftAlert::DefensiveTriggerSpike => "defensive_trigger_spike",
        DriftAlert::BrierScoreBlowup => "brier_calibration",
    };
    let severity_bps = match d {
        DriftAlert::Mae7d => drift_report.mae_7d_bps,
        DriftAlert::Mae30d => drift_report.mae_30d_bps,
        DriftAlert::DefensiveTriggerSpike => {
            (drift_report.defensive_trigger_rate_per_kslot * 1_000.0) as u32
        }
        DriftAlert::BrierScoreBlowup => drift_report.brier_score_bps,
    };
    Alert::new(kind, window.vault_id, window.slot, window.triggered_at_unix)
        .with_field("vault_id", hex32(window.vault_id))
        .with_field("slot", window.slot.to_string())
        .with_field("trigger", trigger)
        .with_field("severity_bps", severity_bps.to_string())
        .with_field("protocol", "model")
        .with_field("idle_share_pct", "0")
        .with_field("fallback_protocol", "none")
        .with_field("fallback_share_pct", "0")
        .with_field("public_input_hash", hex32(window.model_id))
}

fn hex32(b: [u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

/// Stateful drift monitor. The caller drives [`observe`] once per
/// observation window. Returns the per-window `DriftReport` so the
/// monitor can be sampled by tests / CLI without firing alerts.
pub struct DriftMonitor {
    thresholds: DriftThresholds,
}

impl DriftMonitor {
    pub fn new(thresholds: DriftThresholds) -> Self {
        Self { thresholds }
    }

    /// Evaluate the window. Fires zero or more alerts through the
    /// supplied engine. Returns the underlying `DriftReport` so the
    /// caller can record metrics, log, or drive a registry transition
    /// from the same data.
    pub async fn observe<S: AlertSink>(
        &mut self,
        window: &MonitorWindow,
        engine: &mut AlertEngine,
        sink: &S,
    ) -> Result<DriftReport, atlas_alert::engine::EngineError> {
        let mae_7d = mae_bps(&window.predicted_apy_bps_7d, &window.realised_apy_bps_7d);
        let mae_30d = mae_bps(&window.predicted_apy_bps_30d, &window.realised_apy_bps_30d);
        let brier = brier_score_bps(&window.agent_predictions_bps, &window.agent_outcomes);
        let report = evaluate_drift(
            mae_7d,
            mae_30d,
            window.defensive_baseline,
            window.defensive_observed_per_kslot,
            brier,
            self.thresholds,
        );
        for d in &report.alerts {
            let alert = drift_alert_to_alert(*d, window, &report);
            engine.fire(sink, alert).await?;
        }
        Ok(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_alert::{RecordingSink, SuppressionConfig};

    fn window_clean() -> MonitorWindow {
        MonitorWindow {
            vault_id: [1u8; 32],
            model_id: [2u8; 32],
            slot: 100,
            triggered_at_unix: 0,
            predicted_apy_bps_7d: vec![100, 100, 100],
            realised_apy_bps_7d: vec![100, 100, 100],
            predicted_apy_bps_30d: vec![100, 100, 100],
            realised_apy_bps_30d: vec![100, 100, 100],
            defensive_observed_per_kslot: 1.0,
            defensive_baseline: DefensiveBaseline { trigger_rate_per_kslot: 1.0 },
            agent_predictions_bps: vec![10_000, 0, 10_000],
            agent_outcomes: vec![true, false, true],
        }
    }

    fn window_drifty() -> MonitorWindow {
        MonitorWindow {
            vault_id: [1u8; 32],
            model_id: [2u8; 32],
            slot: 100,
            triggered_at_unix: 0,
            predicted_apy_bps_7d: vec![1_000, 1_000, 1_000],
            realised_apy_bps_7d: vec![500, 500, 500],
            predicted_apy_bps_30d: vec![100, 100, 100],
            realised_apy_bps_30d: vec![100, 100, 100],
            defensive_observed_per_kslot: 1.0,
            defensive_baseline: DefensiveBaseline { trigger_rate_per_kslot: 1.0 },
            agent_predictions_bps: vec![10_000, 0, 10_000],
            agent_outcomes: vec![true, false, true],
        }
    }

    #[tokio::test]
    async fn clean_window_emits_no_alerts() {
        let mut m = DriftMonitor::new(DriftThresholds::default());
        let mut engine = AlertEngine::new(SuppressionConfig::default());
        let sink = RecordingSink::new();
        let r = m.observe(&window_clean(), &mut engine, &sink).await.unwrap();
        assert!(r.alerts.is_empty());
        assert!(sink.snapshot().await.is_empty());
    }

    #[tokio::test]
    async fn drifty_window_fires_notify() {
        let mut m = DriftMonitor::new(DriftThresholds::default());
        let mut engine = AlertEngine::new(SuppressionConfig::default());
        let sink = RecordingSink::new();
        let r = m.observe(&window_drifty(), &mut engine, &sink).await.unwrap();
        assert!(r.alerts.contains(&DriftAlert::Mae7d));
        let snap = sink.snapshot().await;
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].0, atlas_alert::AlertClass::Notify);
    }

    #[tokio::test]
    async fn dedup_collapses_repeated_observations() {
        let mut m = DriftMonitor::new(DriftThresholds::default());
        let mut engine = AlertEngine::new(SuppressionConfig::default());
        let sink = RecordingSink::new();
        // 3 windows in rapid succession (same triggered_at_unix=0) → only
        // the first fires.
        for _ in 0..3 {
            m.observe(&window_drifty(), &mut engine, &sink).await.unwrap();
        }
        let snap = sink.snapshot().await;
        assert_eq!(snap.len(), 1, "dedup must collapse repeated drift observations");
    }
}
