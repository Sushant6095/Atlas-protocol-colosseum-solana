//! Alert engine — directive §4.2 dedup + auto-resolve + maintenance windows.
//!
//! The engine is fully deterministic. The caller drives wall time via the
//! `triggered_at_unix` field on every `Alert`; replay tools feed historical
//! timestamps and get the exact same dispatch sequence.
//!
//! Anti-pattern §7 enforced: the engine refuses to dispatch raw strings.
//! Every alert flows through `render_alert`, every dispatched alert is
//! reachable via the sink trait — there is no `log::error!("rebalance failed")`
//! fast path.

use crate::kind::{Alert, AlertClass, AlertKind};
use crate::render::render_alert;
use crate::sink::{AlertDispatcher, AlertSink, SinkError};
use std::collections::HashMap;

/// Suppression knobs (directive §4.2).
#[derive(Clone, Copy, Debug)]
pub struct SuppressionConfig {
    /// Same `(class, vault_id)` arriving within this window is collapsed.
    pub dedup_window_seconds: u64,
    /// Auto-resolve when the underlying condition clears for K consecutive slots.
    pub auto_resolve_clear_slots: u8,
}

impl Default for SuppressionConfig {
    fn default() -> Self {
        Self { dedup_window_seconds: 60, auto_resolve_clear_slots: 8 }
    }
}

/// A maintenance window suppresses non-security pages between `start_unix` and
/// `end_unix`. Security pages always fire. Notifies and digests fire normally
/// — maintenance windows are *page* suppression only.
#[derive(Clone, Copy, Debug)]
pub struct MaintenanceWindow {
    pub start_unix: u64,
    pub end_unix: u64,
}

impl MaintenanceWindow {
    pub fn covers(&self, t_unix: u64) -> bool {
        t_unix >= self.start_unix && t_unix < self.end_unix
    }
}

#[derive(Clone, Debug)]
struct DedupState {
    /// Wall-time of the most recent fire that triggered a dispatch.
    last_fired_unix: u64,
    /// Buffered count of suppressed events since the last fire. Re-emitted
    /// in the `[xN]` prefix on the next fire.
    pending_count: u32,
    /// Slots since condition was last re-asserted. When this hits
    /// `auto_resolve_clear_slots` we emit a resolution log line.
    consecutive_clear_slots: u8,
}

#[derive(Debug)]
pub struct AlertEngine {
    config: SuppressionConfig,
    /// Active maintenance windows. Earliest first.
    maintenance: Vec<MaintenanceWindow>,
    /// Per `(class, vault_id, kind)` dedup state.
    state: HashMap<(AlertClass, [u8; 32], AlertKind), DedupState>,
    /// Counters for the §6 telemetry SLO `atlas_alerts_page_per_day`.
    pages_dispatched: u64,
    pages_suppressed: u64,
}

impl AlertEngine {
    pub fn new(config: SuppressionConfig) -> Self {
        Self {
            config,
            maintenance: Vec::new(),
            state: HashMap::new(),
            pages_dispatched: 0,
            pages_suppressed: 0,
        }
    }

    pub fn with_maintenance(mut self, w: MaintenanceWindow) -> Self {
        self.maintenance.push(w);
        self
    }

    pub fn add_maintenance_window(&mut self, w: MaintenanceWindow) {
        self.maintenance.push(w);
    }

    pub fn pages_dispatched(&self) -> u64 { self.pages_dispatched }
    pub fn pages_suppressed(&self) -> u64 { self.pages_suppressed }

    /// Send an alert through the engine.
    ///
    /// Returns `Some(rendered_text)` when the alert was dispatched (or would
    /// have been if a sink were attached). Returns `None` when suppressed by
    /// dedup or maintenance window.
    pub async fn fire(
        &mut self,
        sink: &dyn AlertSink,
        alert: Alert,
    ) -> Result<Option<String>, EngineError> {
        // 1) Maintenance-window check — security pages bypass.
        if alert.class() == AlertClass::Page && !alert.kind.is_security() {
            for w in &self.maintenance {
                if w.covers(alert.triggered_at_unix) {
                    self.pages_suppressed += 1;
                    tracing::info!(
                        kind = ?alert.kind,
                        vault_id = ?alert.vault_id,
                        "alert.suppressed.maintenance_window"
                    );
                    return Ok(None);
                }
            }
        }

        // 2) Dedup: collapse same (class, vault_id, kind) within window.
        let key = (alert.class(), alert.vault_id, alert.kind);
        let now = alert.triggered_at_unix;
        let dedup_count: u32;
        match self.state.get_mut(&key) {
            Some(st) => {
                let within_window =
                    now.saturating_sub(st.last_fired_unix) < self.config.dedup_window_seconds;
                if within_window {
                    st.pending_count = st.pending_count.saturating_add(1);
                    st.consecutive_clear_slots = 0;
                    if alert.class() == AlertClass::Page {
                        self.pages_suppressed += 1;
                    }
                    tracing::info!(
                        kind = ?alert.kind,
                        vault_id = ?alert.vault_id,
                        pending = st.pending_count,
                        "alert.suppressed.dedup"
                    );
                    return Ok(None);
                }
                // Window expired — fire and reset count, carrying the buffered
                // count into the rendered `[xN]` prefix on this fire.
                dedup_count = st.pending_count.saturating_add(1);
                st.last_fired_unix = now;
                st.pending_count = 0;
                st.consecutive_clear_slots = 0;
            }
            None => {
                dedup_count = 1;
                self.state.insert(
                    key,
                    DedupState {
                        last_fired_unix: now,
                        pending_count: 0,
                        consecutive_clear_slots: 0,
                    },
                );
            }
        }

        // 3) Render and dispatch.
        let rendered = render_alert(&alert, dedup_count).map_err(EngineError::Render)?;
        AlertDispatcher::dispatch(sink, &rendered, &alert)
            .await
            .map_err(EngineError::Sink)?;
        if alert.class() == AlertClass::Page {
            self.pages_dispatched += 1;
        }
        Ok(Some(rendered))
    }

    /// Auto-resolve hook: caller invokes this once per slot for every active
    /// `(class, vault_id, kind)` whose underlying condition is clear. After
    /// `auto_resolve_clear_slots` consecutive clears the engine drops the
    /// dedup row and emits an `alert.resolved` span.
    pub fn observe_clear(
        &mut self,
        class: AlertClass,
        vault_id: [u8; 32],
        kind: AlertKind,
    ) -> bool {
        let key = (class, vault_id, kind);
        let resolved = match self.state.get_mut(&key) {
            Some(st) => {
                st.consecutive_clear_slots = st.consecutive_clear_slots.saturating_add(1);
                st.consecutive_clear_slots >= self.config.auto_resolve_clear_slots
            }
            None => false,
        };
        if resolved {
            self.state.remove(&key);
            tracing::info!(?kind, "alert.resolved");
        }
        resolved
    }
}

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("render: {0}")]
    Render(crate::render::RenderError),
    #[error("sink: {0}")]
    Sink(SinkError),
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sink::{NoopSink, RecordingSink};

    fn page_alert(kind: AlertKind, t: u64) -> Alert {
        Alert::new(kind, [1u8; 32], 100, t)
            .with_field("vault_id", "0x01")
            .with_field("slot", "100")
            .with_field("failure_class", "ArchivalWriteFailed")
            .with_field("variant_tag", "6001")
            .with_field("remediation_id", "rem.archival.failed.abort")
            .with_field("remediation_text", "AbortAndPage")
            .with_field("last_ok_slot", "99")
    }

    #[tokio::test]
    async fn dedup_collapses_within_window() {
        let mut e = AlertEngine::new(SuppressionConfig::default());
        let sink = RecordingSink::new();
        // Fire 5 archival-failure pages at t=0, 10, 20, 30, 40 (all within 60s).
        let mut fired = 0;
        for t in [0, 10, 20, 30, 40] {
            if e.fire(&sink, page_alert(AlertKind::ArchivalFailure, t))
                .await
                .unwrap()
                .is_some()
            {
                fired += 1;
            }
        }
        // Only the first one fires; the next 4 are suppressed.
        assert_eq!(fired, 1);
        let snap = sink.snapshot().await;
        assert_eq!(snap.len(), 1);
        assert_eq!(e.pages_dispatched(), 1);
        assert_eq!(e.pages_suppressed(), 4);
    }

    #[tokio::test]
    async fn dedup_expires_after_window_and_buffers_count() {
        let mut e = AlertEngine::new(SuppressionConfig::default());
        let sink = RecordingSink::new();
        // Fire at t=0, suppressed at t=10/20/30, then fire at t=120 (after window).
        e.fire(&sink, page_alert(AlertKind::ArchivalFailure, 0)).await.unwrap();
        for t in [10, 20, 30] {
            e.fire(&sink, page_alert(AlertKind::ArchivalFailure, t)).await.unwrap();
        }
        // 90s after the last fire → outside 60s window.
        let s = e.fire(&sink, page_alert(AlertKind::ArchivalFailure, 120))
            .await
            .unwrap()
            .unwrap();
        // The buffered count (3 pending) gets re-emitted as [x4] on this fire.
        assert!(s.starts_with("[x4] "), "second fire must include suppressed count, got: {s}");
    }

    #[tokio::test]
    async fn maintenance_window_suppresses_non_security_pages() {
        let mut e = AlertEngine::new(SuppressionConfig::default())
            .with_maintenance(MaintenanceWindow { start_unix: 0, end_unix: 1_000 });
        let sink = NoopSink;
        // Archival is a Page but NOT security — suppressed.
        let r1 = e.fire(&sink, page_alert(AlertKind::ArchivalFailure, 500))
            .await
            .unwrap();
        assert!(r1.is_none());
        assert_eq!(e.pages_suppressed(), 1);
        // SecurityEvent always fires.
        let sec = Alert::new(AlertKind::SecurityEvent, [1u8; 32], 100, 500)
            .with_field("vault_id", "0x01")
            .with_field("slot", "100")
            .with_field("failure_class", "ManipulatedStateRoot")
            .with_field("variant_tag", "7003")
            .with_field("public_input_hash", "0xff")
            .with_field("source", "rpc-1")
            .with_field("remediation_id", "rem.adversarial.reject");
        let r2 = e.fire(&sink, sec).await.unwrap();
        assert!(r2.is_some());
    }

    #[tokio::test]
    async fn auto_resolve_after_k_clear_slots() {
        let mut e = AlertEngine::new(SuppressionConfig::default());
        let sink = NoopSink;
        e.fire(&sink, page_alert(AlertKind::ArchivalFailure, 0)).await.unwrap();
        // 7 clears: not yet resolved.
        for _ in 0..7 {
            assert!(!e.observe_clear(AlertClass::Page, [1u8; 32], AlertKind::ArchivalFailure));
        }
        // 8th clear hits threshold.
        assert!(e.observe_clear(AlertClass::Page, [1u8; 32], AlertKind::ArchivalFailure));
    }
}
