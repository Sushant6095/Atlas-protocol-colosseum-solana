//! SP1 guest program — runs inside the zkVM.
//!
//! Proves the statement:
//!   "Given committed model M (hash = model_hash) and onchain state S
//!    (hash = state_root), the model produced allocation A (hash = alloc_root)."
//!
//! Public inputs (committed via sp1_zkvm::io::commit) — must match the layout
//! enforced in atlas_rebalancer::execute_rebalance:
//!   state_root: [u8; 32]
//!   alloc_root: [u8; 32]
//!   slot: u64
//!   vault_id: [u8; 32]
//!   model_hash: [u8; 32]

#![no_main]
sp1_zkvm::entrypoint!(main);

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ProverInput {
    pub model_weights_l1: Vec<f32>,    // Layer 1 weights (input -> hidden)
    pub model_bias_l1: Vec<f32>,
    pub model_weights_l2: Vec<f32>,    // Layer 2 weights (hidden -> output)
    pub model_bias_l2: Vec<f32>,
    pub onchain_state: Vec<f32>,       // [kamino_apy, drift_apy, jup_apy, mfi_apy, vol, tvl_idle, tvl_deployed, ...]
    pub vault_id: [u8; 32],
    pub slot: u64,
}

#[derive(Serialize, Deserialize)]
pub struct ProverOutput {
    pub state_root: [u8; 32],
    pub alloc_root: [u8; 32],
    pub slot: u64,
    pub vault_id: [u8; 32],
    pub model_hash: [u8; 32],
}

const HIDDEN: usize = 16;
const N_PROTOCOLS: usize = 5; // Kamino, Drift, Jupiter, Marginfi, Idle

pub fn main() {
    let input: ProverInput = bincode::deserialize(&sp1_zkvm::io::read_vec()).unwrap();

    // 1. Compute model hash (Poseidon over flattened weights).
    let model_hash = poseidon_hash_floats(&[
        input.model_weights_l1.as_slice(),
        input.model_bias_l1.as_slice(),
        input.model_weights_l2.as_slice(),
        input.model_bias_l2.as_slice(),
    ].concat());

    // 2. Compute state root.
    let mut state_bytes = Vec::with_capacity(32 + 8 + input.onchain_state.len() * 4);
    state_bytes.extend_from_slice(&input.vault_id);
    state_bytes.extend_from_slice(&input.slot.to_le_bytes());
    for f in &input.onchain_state {
        state_bytes.extend_from_slice(&f.to_le_bytes());
    }
    let state_root = poseidon_hash_bytes(&state_bytes);

    // 3. Run MLP inference: y = softmax(W2 * relu(W1 * x + b1) + b2)
    let n_in = input.onchain_state.len();
    assert_eq!(input.model_weights_l1.len(), n_in * HIDDEN, "L1 weight shape");
    assert_eq!(input.model_bias_l1.len(), HIDDEN, "L1 bias shape");
    assert_eq!(input.model_weights_l2.len(), HIDDEN * N_PROTOCOLS, "L2 weight shape");
    assert_eq!(input.model_bias_l2.len(), N_PROTOCOLS, "L2 bias shape");

    let mut hidden = vec![0f32; HIDDEN];
    for h in 0..HIDDEN {
        let mut acc = input.model_bias_l1[h];
        for i in 0..n_in {
            acc += input.model_weights_l1[h * n_in + i] * input.onchain_state[i];
        }
        hidden[h] = acc.max(0.0);
    }

    let mut logits = vec![0f32; N_PROTOCOLS];
    for o in 0..N_PROTOCOLS {
        let mut acc = input.model_bias_l2[o];
        for h in 0..HIDDEN {
            acc += input.model_weights_l2[o * HIDDEN + h] * hidden[h];
        }
        logits[o] = acc;
    }
    let alloc = softmax(&logits);

    // 4. Commit allocation as Poseidon hash.
    let mut alloc_bytes = Vec::with_capacity(N_PROTOCOLS * 4);
    for v in &alloc {
        alloc_bytes.extend_from_slice(&v.to_le_bytes());
    }
    let alloc_root = poseidon_hash_bytes(&alloc_bytes);

    // 5. Commit public outputs.
    sp1_zkvm::io::commit(&state_root);
    sp1_zkvm::io::commit(&alloc_root);
    sp1_zkvm::io::commit(&input.slot);
    sp1_zkvm::io::commit(&input.vault_id);
    sp1_zkvm::io::commit(&model_hash);
}

fn softmax(x: &[f32]) -> Vec<f32> {
    let m = x.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let exps: Vec<f32> = x.iter().map(|v| (v - m).exp()).collect();
    let sum: f32 = exps.iter().sum();
    exps.iter().map(|v| v / sum).collect()
}

/// Placeholder Poseidon-over-floats — Phase 2 swaps for true Poseidon over BN254
/// scalar field via `light_poseidon` crate. Keeping a deterministic stub here
/// so the guest compiles in Phase 1.
fn poseidon_hash_floats(xs: &[f32]) -> [u8; 32] {
    let mut bytes = Vec::with_capacity(xs.len() * 4);
    for v in xs {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    poseidon_hash_bytes(&bytes)
}

fn poseidon_hash_bytes(b: &[u8]) -> [u8; 32] {
    use sp1_zkvm::syscalls::syscall_keccak_permute;
    let mut state = [0u64; 25];
    let chunk_size = 8 * 17; // keccak rate
    for chunk in b.chunks(chunk_size) {
        for (i, c) in chunk.chunks(8).enumerate() {
            let mut buf = [0u8; 8];
            buf[..c.len()].copy_from_slice(c);
            state[i] ^= u64::from_le_bytes(buf);
        }
        syscall_keccak_permute(&mut state);
    }
    let mut out = [0u8; 32];
    for (i, w) in state[..4].iter().enumerate() {
        out[i * 8..(i + 1) * 8].copy_from_slice(&w.to_le_bytes());
    }
    out
}
