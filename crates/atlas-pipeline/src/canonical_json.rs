//! Canonical JSON serializer for hash-committed explanations.
//!
//! Per directive §7 + §14 (anti-pattern): never call `serde_json::to_string` on
//! a struct that hits Poseidon. The serializer produced here is the only path
//! to canonical bytes, with these invariants:
//!
//! - Object keys sorted lexicographically by UTF-8 codepoint.
//! - No whitespace between tokens.
//! - Numbers: integers only — directive bans floats in commitment paths (I-5).
//! - Strings: ASCII-only with minimal RFC 8259 escaping for control chars.
//! - Arrays preserve insertion order (caller responsibility).
//! - Output is UTF-8 bytes, ready for `hash_with_tag(b"atlas.expl.v2", ...)`.
//!
//! This module is deliberately small: the explanation schema has integer bps,
//! short string enums, and arrays of objects. We never need full JSON.

use std::collections::BTreeMap;

#[derive(Clone, Debug)]
pub enum Value {
    /// Signed integer (bps, severity, etc).
    Int(i64),
    /// String — ASCII required (caller verifies via `string`).
    String(String),
    /// Ordered array; caller controls element order.
    Array(Vec<Value>),
    /// Map with lexicographic key order at emit time.
    Object(BTreeMap<String, Value>),
}

#[derive(Debug, thiserror::Error)]
pub enum CanonicalJsonError {
    #[error("non-ascii byte 0x{0:02x} in string — explanation schema is ASCII-only")]
    NonAsciiString(u8),
    #[error("control character 0x{0:02x} requires escape but is not handled")]
    UnhandledControl(u8),
}

/// Encode a value to canonical UTF-8 bytes.
pub fn encode(value: &Value) -> Result<Vec<u8>, CanonicalJsonError> {
    let mut out = Vec::with_capacity(256);
    emit(value, &mut out)?;
    Ok(out)
}

fn emit(v: &Value, out: &mut Vec<u8>) -> Result<(), CanonicalJsonError> {
    match v {
        Value::Int(n) => {
            // No leading zeros, no plus sign — Rust's Display is canonical for i64.
            out.extend_from_slice(n.to_string().as_bytes());
        }
        Value::String(s) => emit_string(s, out)?,
        Value::Array(arr) => {
            out.push(b'[');
            for (i, el) in arr.iter().enumerate() {
                if i > 0 {
                    out.push(b',');
                }
                emit(el, out)?;
            }
            out.push(b']');
        }
        Value::Object(map) => {
            out.push(b'{');
            // BTreeMap iteration is already lexicographic on UTF-8 byte keys —
            // but we are explicit here to make the contract auditable.
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            for (i, k) in keys.iter().enumerate() {
                if i > 0 {
                    out.push(b',');
                }
                emit_string(k, out)?;
                out.push(b':');
                if let Some(val) = map.get(*k) {
                    emit(val, out)?;
                }
            }
            out.push(b'}');
        }
    }
    Ok(())
}

fn emit_string(s: &str, out: &mut Vec<u8>) -> Result<(), CanonicalJsonError> {
    out.push(b'"');
    for &b in s.as_bytes() {
        match b {
            0x22 => out.extend_from_slice(b"\\\""),
            0x5C => out.extend_from_slice(b"\\\\"),
            0x08 => out.extend_from_slice(b"\\b"),
            0x09 => out.extend_from_slice(b"\\t"),
            0x0A => out.extend_from_slice(b"\\n"),
            0x0C => out.extend_from_slice(b"\\f"),
            0x0D => out.extend_from_slice(b"\\r"),
            x if x < 0x20 => return Err(CanonicalJsonError::UnhandledControl(x)),
            x if x >= 0x80 => return Err(CanonicalJsonError::NonAsciiString(x)),
            x => out.push(x),
        }
    }
    out.push(b'"');
    Ok(())
}

/// Convenience: `(key, value)` pairs into an ordered Object.
pub fn obj<I>(entries: I) -> Value
where
    I: IntoIterator<Item = (&'static str, Value)>,
{
    let mut m = BTreeMap::new();
    for (k, v) in entries {
        m.insert(k.to_string(), v);
    }
    Value::Object(m)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_object_is_two_braces() {
        let v = Value::Object(BTreeMap::new());
        assert_eq!(encode(&v).unwrap(), b"{}");
    }

    #[test]
    fn keys_sorted_lexicographically() {
        let v = obj([
            ("zebra", Value::Int(3)),
            ("apple", Value::Int(1)),
            ("monkey", Value::Int(2)),
        ]);
        assert_eq!(encode(&v).unwrap(), br#"{"apple":1,"monkey":2,"zebra":3}"#);
    }

    #[test]
    fn arrays_preserve_order() {
        let v = Value::Array(vec![Value::Int(3), Value::Int(1), Value::Int(2)]);
        assert_eq!(encode(&v).unwrap(), b"[3,1,2]");
    }

    #[test]
    fn no_whitespace_anywhere() {
        let v = obj([
            ("k", Value::Array(vec![Value::Int(1), Value::Int(2)])),
            ("regime", Value::String("defensive".into())),
        ]);
        let bytes = encode(&v).unwrap();
        assert!(!bytes.contains(&b' '));
        assert!(!bytes.contains(&b'\n'));
        assert!(!bytes.contains(&b'\t'));
    }

    #[test]
    fn rejects_non_ascii() {
        let v = Value::String("üñíçødé".into());
        assert!(encode(&v).is_err());
    }

    #[test]
    fn deterministic_across_runs() {
        let mk = || {
            obj([
                ("schema", Value::String("atlas.explanation.v2".into())),
                ("regime", Value::String("defensive".into())),
                ("confidence_bps", Value::Int(8700)),
                ("agent_disagreement_bps", Value::Int(1200)),
            ])
        };
        assert_eq!(encode(&mk()).unwrap(), encode(&mk()).unwrap());
    }
}
