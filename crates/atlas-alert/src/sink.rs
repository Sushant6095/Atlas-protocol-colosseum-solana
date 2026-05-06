//! Alert sinks (PagerDuty / Slack / Discord webhooks).
//!
//! The crate keeps the network adapter behind a trait so unit tests don't
//! need a real webhook. Production deployments wire concrete implementations
//! that read URLs from `ops/secrets/` (e.g., `pagerduty.url`, `slack.url`).
//! Webhook URLs are secret — never log them.

use crate::kind::{Alert, AlertClass};
use async_trait::async_trait;

#[derive(Debug, thiserror::Error)]
pub enum SinkError {
    #[error("transport failure: {0}")]
    Transport(String),
    #[error("auth failure")]
    Auth,
    #[error("rate limited; retry after {retry_after_ms} ms")]
    RateLimited { retry_after_ms: u64 },
}

#[async_trait]
pub trait AlertSink: Send + Sync {
    async fn page(&self, rendered: &str, alert: &Alert) -> Result<(), SinkError>;
    async fn notify(&self, rendered: &str, alert: &Alert) -> Result<(), SinkError>;
    async fn digest(&self, rendered: &str, alert: &Alert) -> Result<(), SinkError>;
}

/// Convenience dispatcher — picks the right sink method based on
/// `alert.class()`. Concrete sinks shouldn't override this.
pub struct AlertDispatcher;

impl AlertDispatcher {
    pub async fn dispatch(
        sink: &dyn AlertSink,
        rendered: &str,
        alert: &Alert,
    ) -> Result<(), SinkError> {
        match alert.class() {
            AlertClass::Page => sink.page(rendered, alert).await,
            AlertClass::Notify => sink.notify(rendered, alert).await,
            AlertClass::Digest => sink.digest(rendered, alert).await,
        }
    }
}

/// Drops every call. Used by tests that want the engine wired without
/// fan-out side effects.
pub struct NoopSink;

#[async_trait]
impl AlertSink for NoopSink {
    async fn page(&self, _r: &str, _a: &Alert) -> Result<(), SinkError> { Ok(()) }
    async fn notify(&self, _r: &str, _a: &Alert) -> Result<(), SinkError> { Ok(()) }
    async fn digest(&self, _r: &str, _a: &Alert) -> Result<(), SinkError> { Ok(()) }
}

/// Captures every dispatched alert in memory. Used by tests asserting
/// dedup, suppression, and class routing.
#[derive(Default)]
pub struct RecordingSink {
    inner: tokio::sync::Mutex<Vec<(AlertClass, String, Alert)>>,
}

impl RecordingSink {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn snapshot(&self) -> Vec<(AlertClass, String, Alert)> {
        self.inner.lock().await.clone()
    }
}

#[async_trait]
impl AlertSink for RecordingSink {
    async fn page(&self, r: &str, a: &Alert) -> Result<(), SinkError> {
        self.inner.lock().await.push((AlertClass::Page, r.to_string(), a.clone()));
        Ok(())
    }
    async fn notify(&self, r: &str, a: &Alert) -> Result<(), SinkError> {
        self.inner.lock().await.push((AlertClass::Notify, r.to_string(), a.clone()));
        Ok(())
    }
    async fn digest(&self, r: &str, a: &Alert) -> Result<(), SinkError> {
        self.inner.lock().await.push((AlertClass::Digest, r.to_string(), a.clone()));
        Ok(())
    }
}
