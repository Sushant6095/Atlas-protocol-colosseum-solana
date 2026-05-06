//! Zero-copy account-layout invariants (directive §3.2).
//!
//! Hot-path accounts (vault state, position state, risk state, prover
//! registry) are zero-copy: `bytemuck::Pod + Zeroable`, `repr(C)`,
//! explicit-endian, no `Vec<T>`. This module exposes the runnable
//! checks that pin those invariants on the off-chain side: alignment,
//! size, and a hex-fixture round trip. Programs in `programs/` use the
//! on-chain Pinocchio-friendly equivalents at compile time.

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ZeroCopyLayoutError {
    #[error("expected size {expected} bytes, computed {actual}")]
    BadSize { expected: usize, actual: usize },
    #[error("expected alignment {expected}, computed {actual}")]
    BadAlign { expected: usize, actual: usize },
    #[error("hex fixture length {hex_len} != expected {expected_bytes} bytes (×2)")]
    BadHexLen { hex_len: usize, expected_bytes: usize },
    #[error("round-trip failed: re-encoded bytes diverge from input")]
    RoundTripDiverge,
}

/// Assert that a zero-copy layout has a fixed size and alignment. Use
/// this in account-type tests.
pub fn assert_pod_layout(
    actual_size: usize,
    actual_align: usize,
    expected_size: usize,
    expected_align: usize,
) -> Result<(), ZeroCopyLayoutError> {
    if actual_size != expected_size {
        return Err(ZeroCopyLayoutError::BadSize {
            expected: expected_size,
            actual: actual_size,
        });
    }
    if actual_align != expected_align {
        return Err(ZeroCopyLayoutError::BadAlign {
            expected: expected_align,
            actual: actual_align,
        });
    }
    Ok(())
}

/// Round-trip a hex fixture against a serializer/deserializer pair.
/// Used by per-account-type tests to lock the byte layout — any field
/// reorder, alignment shift, or endian flip changes the hex and fails
/// the test.
pub fn hex_round_trip<S, D>(
    hex: &str,
    expected_bytes: usize,
    deserialize: D,
    serialize: S,
) -> Result<(), ZeroCopyLayoutError>
where
    D: Fn(&[u8]) -> Vec<u8>,
    S: Fn(&[u8]) -> Vec<u8>,
{
    let trimmed = hex.trim();
    if trimmed.len() != expected_bytes * 2 {
        return Err(ZeroCopyLayoutError::BadHexLen {
            hex_len: trimmed.len(),
            expected_bytes,
        });
    }
    let bytes = decode_hex(trimmed).ok_or(ZeroCopyLayoutError::RoundTripDiverge)?;
    let decoded = deserialize(&bytes);
    let re_encoded = serialize(&decoded);
    if re_encoded != bytes {
        return Err(ZeroCopyLayoutError::RoundTripDiverge);
    }
    Ok(())
}

fn decode_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 { return None; }
    let mut out = Vec::with_capacity(s.len() / 2);
    let bytes = s.as_bytes();
    for i in (0..bytes.len()).step_by(2) {
        let hi = (bytes[i] as char).to_digit(16)?;
        let lo = (bytes[i + 1] as char).to_digit(16)?;
        out.push(((hi << 4) | lo) as u8);
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pod_layout_match_passes() {
        assert_pod_layout(64, 8, 64, 8).unwrap();
    }

    #[test]
    fn pod_layout_mismatch_rejects() {
        assert!(matches!(
            assert_pod_layout(63, 8, 64, 8),
            Err(ZeroCopyLayoutError::BadSize { .. })
        ));
        assert!(matches!(
            assert_pod_layout(64, 4, 64, 8),
            Err(ZeroCopyLayoutError::BadAlign { .. })
        ));
    }

    #[test]
    fn hex_round_trip_passes_on_identity() {
        // identity ser/de: pass the bytes through unchanged.
        let hex = "deadbeefcafebabe";
        hex_round_trip(
            hex,
            8,
            |b| b.to_vec(),
            |b| b.to_vec(),
        )
        .unwrap();
    }

    #[test]
    fn hex_round_trip_rejects_bad_length() {
        let hex = "deadbeef";
        assert!(matches!(
            hex_round_trip(hex, 8, |b| b.to_vec(), |b| b.to_vec()),
            Err(ZeroCopyLayoutError::BadHexLen { .. })
        ));
    }

    #[test]
    fn hex_round_trip_detects_serializer_drift() {
        // ser flips first byte → re-encoded != input.
        let hex = "00112233";
        let r = hex_round_trip(
            hex,
            4,
            |b| b.to_vec(),
            |b| {
                let mut out = b.to_vec();
                out[0] ^= 0xff;
                out
            },
        );
        assert!(matches!(r, Err(ZeroCopyLayoutError::RoundTripDiverge)));
    }
}
