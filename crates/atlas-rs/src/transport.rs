//! Transport trait — abstracts HTTP so the SDK doesn't pull reqwest
//! into the workspace. Production deployments wire a concrete
//! transport at the binary level.

use async_trait::async_trait;
use std::collections::BTreeMap;

#[derive(Debug, thiserror::Error)]
pub enum TransportError {
    #[error("transport unavailable: {0}")]
    Unavailable(String),
    #[error("HTTP {status}: {body}")]
    HttpStatus { status: u16, body: String },
    #[error("decode error: {0}")]
    Decode(String),
}

#[async_trait]
pub trait HttpTransport: Send + Sync {
    /// GET `path` and return the body bytes. The base URL is the
    /// transport's responsibility.
    async fn get(&self, path: &str) -> Result<Vec<u8>, TransportError>;

    /// POST a JSON body and return the response bytes.
    async fn post_json(&self, path: &str, body: &[u8]) -> Result<Vec<u8>, TransportError>;
}

/// In-memory transport for unit tests. Map of `path -> bytes`.
#[derive(Default)]
pub struct MockTransport {
    inner: tokio::sync::Mutex<BTreeMap<String, Vec<u8>>>,
}

impl MockTransport {
    pub fn new() -> Self { Self::default() }

    pub async fn put(&self, path: impl Into<String>, body: impl Into<Vec<u8>>) {
        self.inner.lock().await.insert(path.into(), body.into());
    }
}

#[async_trait]
impl HttpTransport for MockTransport {
    async fn get(&self, path: &str) -> Result<Vec<u8>, TransportError> {
        self.inner
            .lock()
            .await
            .get(path)
            .cloned()
            .ok_or_else(|| TransportError::HttpStatus {
                status: 404,
                body: format!("no fixture for {path}"),
            })
    }

    async fn post_json(&self, path: &str, _body: &[u8]) -> Result<Vec<u8>, TransportError> {
        // Tests stub POSTs the same way as GETs.
        self.get(path).await
    }
}
