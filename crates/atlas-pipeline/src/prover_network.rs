//! Prover network — registry, dispatch, slashing accounts.
//!
//! Directive §10: single-prover is acceptable for v1, but the architecture
//! must accept `M ≥ 1` provers without code change. We build the registry,
//! dispatch fn, and slashing logic now; production wires this to the on-chain
//! `atlas_registry` program in Phase 2.

use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ProverPubkey(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProverRecord {
    pub pubkey: ProverPubkey,
    /// Stake in Token-2022 lamports (or USDG lamports — caller controls token).
    pub stake: u64,
    /// Reputation EMA in bps `[0, 10_000]`. New provers default to 5_000.
    pub reputation_bps: u32,
    pub last_proof_slot: u64,
    /// Tracked p99 wall-time (ms) per epoch — used in latency component of
    /// the reputation EMA.
    pub p50_ms: u32,
    pub p99_ms: u32,
    pub correctness_bps: u32, // EMA of pass/fail over last 200 proofs
    pub slashed: bool,
}

impl ProverRecord {
    pub fn new(pubkey: ProverPubkey, initial_stake: u64) -> Self {
        Self {
            pubkey,
            stake: initial_stake,
            reputation_bps: 5_000,
            last_proof_slot: 0,
            p50_ms: 0,
            p99_ms: 0,
            correctness_bps: 5_000,
            slashed: false,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct ProverRegistry {
    pub provers: BTreeMap<ProverPubkey, ProverRecord>,
}

impl ProverRegistry {
    pub fn upsert(&mut self, record: ProverRecord) {
        self.provers.insert(record.pubkey, record);
    }

    pub fn get(&self, key: &ProverPubkey) -> Option<&ProverRecord> {
        self.provers.get(key)
    }

    /// Active provers — not slashed, with positive stake.
    pub fn active(&self) -> Vec<&ProverRecord> {
        self.provers
            .values()
            .filter(|p| !p.slashed && p.stake > 0)
            .collect()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SlashReason {
    InvalidProof,         // verifier rejected the submitted proof
    MissedDeadline,       // proof not delivered before T_deadline
    DuplicateSubmission,  // same (vault, slot) submitted by same prover twice
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SlashOutcome {
    pub stake_burned: u64,
    pub reputation_delta_bps: i32,
    pub force_quarantine: bool,
}

pub const T_DEADLINE_SLOTS: u64 = 200;

/// Apply a slashing action. Returns the resulting `SlashOutcome`. Does not
/// mutate the registry — callers wire this to on-chain accounts via CPI.
pub fn apply_slash(record: &ProverRecord, reason: SlashReason, miss_slots: Option<u64>) -> SlashOutcome {
    match reason {
        SlashReason::InvalidProof => SlashOutcome {
            stake_burned: record.stake,
            reputation_delta_bps: -10_000,
            force_quarantine: true,
        },
        SlashReason::MissedDeadline => {
            // Linear stake reduction proportional to overshoot beyond T_deadline.
            let miss = miss_slots.unwrap_or(0);
            let frac_bps = ((miss as u128 * 10_000)
                .saturating_div(T_DEADLINE_SLOTS.max(1) as u128)) as u64;
            let burn = (record.stake as u128 * frac_bps as u128 / 10_000) as u64;
            SlashOutcome {
                stake_burned: burn.min(record.stake),
                reputation_delta_bps: -((frac_bps.min(2_000)) as i32),
                force_quarantine: false,
            }
        }
        SlashReason::DuplicateSubmission => SlashOutcome {
            stake_burned: 0,
            reputation_delta_bps: -500,
            force_quarantine: false,
        },
    }
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

/// Round-robin weighted by reputation, deterministic given the same registry
/// snapshot and randomness beacon. The beacon prevents gaming via predictable
/// dispatch (a dishonest prover cannot consistently target their own slots).
///
/// Algorithm:
///   1. Filter to active provers.
///   2. Compute total reputation.
///   3. Use the beacon as a random offset modulo total reputation.
///   4. Iterate sorted-by-pubkey, accumulating reputation; pick the prover
///      whose cumulative window contains the offset.
pub fn dispatch_prover<'a>(
    registry: &'a ProverRegistry,
    slot: u64,
    vault_id: &[u8; 32],
    randomness_beacon: &[u8; 32],
) -> Option<&'a ProverRecord> {
    let active: Vec<&ProverRecord> = registry.active();
    if active.is_empty() {
        return None;
    }
    let total_reputation: u64 = active.iter().map(|p| p.reputation_bps as u64).sum();
    if total_reputation == 0 {
        // Fallback: deterministic round-robin on (slot, vault, beacon) hash.
        let pick = mix_to_index(slot, vault_id, randomness_beacon, active.len());
        return Some(active[pick]);
    }

    let offset = mix_to_offset(slot, vault_id, randomness_beacon, total_reputation);
    let mut acc: u64 = 0;
    for p in &active {
        acc += p.reputation_bps as u64;
        if acc > offset {
            return Some(*p);
        }
    }
    active.last().copied()
}

fn mix_to_offset(slot: u64, vault_id: &[u8; 32], beacon: &[u8; 32], modulus: u64) -> u64 {
    let h = mix_hash(slot, vault_id, beacon);
    let n = u64::from_le_bytes(h[..8].try_into().unwrap_or([0u8; 8]));
    if modulus == 0 {
        0
    } else {
        n % modulus
    }
}

fn mix_to_index(slot: u64, vault_id: &[u8; 32], beacon: &[u8; 32], modulus: usize) -> usize {
    let h = mix_hash(slot, vault_id, beacon);
    let n = u64::from_le_bytes(h[..8].try_into().unwrap_or([0u8; 8]));
    if modulus == 0 {
        0
    } else {
        (n as usize) % modulus
    }
}

fn mix_hash(slot: u64, vault_id: &[u8; 32], beacon: &[u8; 32]) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(b"atlas.dispatch.v1");
    h.update(slot.to_le_bytes());
    h.update(vault_id);
    h.update(beacon);
    h.finalize().into()
}

// ─── Reputation EMA ────────────────────────────────────────────────────────

pub const EMA_ALPHA_BPS: u32 = 500; // 5% — over ~200 rebalances ≈ EMA window

pub fn update_reputation(record: &mut ProverRecord, correctness: bool, latency_ms: u32) {
    let correct_bps: u32 = if correctness { 10_000 } else { 0 };
    let latency_score: u32 = latency_score_bps(latency_ms);
    let new_bps = (correct_bps + latency_score) / 2;
    record.reputation_bps =
        ema_step(record.reputation_bps, new_bps, EMA_ALPHA_BPS);
    if correctness {
        record.correctness_bps = ema_step(record.correctness_bps, 10_000, EMA_ALPHA_BPS);
    } else {
        record.correctness_bps = ema_step(record.correctness_bps, 0, EMA_ALPHA_BPS);
    }
    record.p99_ms = ema_step_u32(record.p99_ms, latency_ms);
}

fn latency_score_bps(latency_ms: u32) -> u32 {
    // 0ms → 10_000, 90s → 0. Linear, clamped.
    let cap_ms = 90_000u32;
    if latency_ms >= cap_ms {
        return 0;
    }
    10_000 - (latency_ms as u64 * 10_000 / cap_ms as u64) as u32
}

fn ema_step(prev: u32, new: u32, alpha_bps: u32) -> u32 {
    let prev = prev as u64;
    let new = new as u64;
    let alpha = alpha_bps as u64;
    let blended = (prev * (10_000 - alpha) + new * alpha) / 10_000;
    blended.min(10_000) as u32
}

fn ema_step_u32(prev: u32, new: u32) -> u32 {
    if prev == 0 {
        return new;
    }
    ((prev as u64 + new as u64) / 2) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pk(n: u8) -> ProverPubkey {
        ProverPubkey([n; 32])
    }

    #[test]
    fn upsert_and_active() {
        let mut reg = ProverRegistry::default();
        reg.upsert(ProverRecord::new(pk(1), 1_000));
        reg.upsert(ProverRecord::new(pk(2), 0)); // zero stake → inactive
        let mut three = ProverRecord::new(pk(3), 1_000);
        three.slashed = true;
        reg.upsert(three);

        assert_eq!(reg.active().len(), 1);
        assert_eq!(reg.active()[0].pubkey, pk(1));
    }

    #[test]
    fn invalid_proof_burns_full_stake() {
        let r = ProverRecord::new(pk(1), 1_000);
        let s = apply_slash(&r, SlashReason::InvalidProof, None);
        assert_eq!(s.stake_burned, 1_000);
        assert!(s.force_quarantine);
        assert_eq!(s.reputation_delta_bps, -10_000);
    }

    #[test]
    fn missed_deadline_proportional_burn() {
        let r = ProverRecord::new(pk(1), 1_000);
        // Missed by half the deadline window → 50% stake burn.
        let s = apply_slash(
            &r,
            SlashReason::MissedDeadline,
            Some(T_DEADLINE_SLOTS / 2),
        );
        assert_eq!(s.stake_burned, 500);
        assert!(!s.force_quarantine);
    }

    #[test]
    fn duplicate_submission_reputation_only() {
        let r = ProverRecord::new(pk(1), 1_000);
        let s = apply_slash(&r, SlashReason::DuplicateSubmission, None);
        assert_eq!(s.stake_burned, 0);
        assert_eq!(s.reputation_delta_bps, -500);
    }

    #[test]
    fn dispatch_picks_a_prover_when_active() {
        let mut reg = ProverRegistry::default();
        for n in 1..=3u8 {
            reg.upsert(ProverRecord::new(pk(n), 1_000));
        }
        let beacon = [9u8; 32];
        let vault = [1u8; 32];
        let pick = dispatch_prover(&reg, 100, &vault, &beacon).unwrap();
        assert!(reg.get(&pick.pubkey).is_some());
    }

    #[test]
    fn dispatch_deterministic_for_same_inputs() {
        let mut reg = ProverRegistry::default();
        for n in 1..=5u8 {
            reg.upsert(ProverRecord::new(pk(n), 1_000));
        }
        let beacon = [42u8; 32];
        let vault = [1u8; 32];
        let a = dispatch_prover(&reg, 100, &vault, &beacon).unwrap().pubkey;
        let b = dispatch_prover(&reg, 100, &vault, &beacon).unwrap().pubkey;
        assert_eq!(a, b);
    }

    #[test]
    fn dispatch_returns_none_when_no_active() {
        let reg = ProverRegistry::default();
        let beacon = [0u8; 32];
        let vault = [0u8; 32];
        assert!(dispatch_prover(&reg, 100, &vault, &beacon).is_none());
    }

    #[test]
    fn reputation_ema_moves_toward_signal() {
        let mut r = ProverRecord::new(pk(1), 1_000);
        let initial = r.reputation_bps;
        for _ in 0..50 {
            update_reputation(&mut r, true, 1_000);
        }
        // Many correct fast proofs → reputation rises.
        assert!(r.reputation_bps > initial);
    }

    #[test]
    fn reputation_drops_on_failures() {
        let mut r = ProverRecord::new(pk(1), 1_000);
        r.reputation_bps = 9_000;
        for _ in 0..50 {
            update_reputation(&mut r, false, 60_000);
        }
        assert!(r.reputation_bps < 9_000);
    }

    #[test]
    fn dispatch_weighted_by_reputation() {
        let mut reg = ProverRegistry::default();
        let mut a = ProverRecord::new(pk(1), 1_000);
        a.reputation_bps = 1_000;
        let mut b = ProverRecord::new(pk(2), 1_000);
        b.reputation_bps = 9_000;
        reg.upsert(a);
        reg.upsert(b);

        // Run many dispatches under varying beacons; high-reputation prover should win
        // a strict majority.
        let mut a_wins = 0u32;
        let mut b_wins = 0u32;
        for n in 0..1_000u32 {
            let mut beacon = [0u8; 32];
            beacon[..4].copy_from_slice(&n.to_le_bytes());
            let pick = dispatch_prover(&reg, n as u64, &[7u8; 32], &beacon).unwrap();
            if pick.pubkey == pk(1) {
                a_wins += 1;
            } else {
                b_wins += 1;
            }
        }
        assert!(b_wins > a_wins * 5, "high-reputation prover did not dominate: a={}, b={}", a_wins, b_wins);
    }
}
