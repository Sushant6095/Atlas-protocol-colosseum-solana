# Atlas Confidential Treasury Layer

> AI-managed, zk-verified, privacy-preserving treasury infrastructure
> for stablecoin capital on Solana. Strategy execution is publicly
> auditable. Treasury size, payroll, and vendor settlements are
> confidential by default with auditor-key disclosure. Selective,
> compliant, institutional-grade.

## The principle

**Public verifiability of behavior. Confidentiality of amounts.**

Anyone can verify Atlas:

- followed its strategy commitment,
- produced a valid Groth16 proof,
- moved capital according to the proven allocation ratios,
- did not violate any invariant.

Without learning:

- absolute treasury size,
- per-protocol notional amounts,
- payroll recipients or amounts,
- vendor settlement amounts.

Auditors / regulators / signers see what they need via viewing keys.
Everyone else sees a Pedersen commitment + a passing proof.

## Authoritative surface table (§2)

| Field | Public | Confidential |
|---|---|---|
| `vault_id`, `approved_model_hash` | ✅ | — |
| `allocation_bps` (ratios) | ✅ | — |
| `allocation_ratios_root` | ✅ | — |
| Per-protocol notional amount | — | ✅ Pedersen commitment + range proof |
| Total TVL | — | ✅ aggregate commitment only |
| User shares per vault | — | ✅ each user via own viewing key |
| Rebalance proof verification result | ✅ | — |
| Black-box record schema | ✅ | — |
| Black-box record amount fields | — | ✅ encrypted |
| Payroll recipient + amount | — | ✅ |
| Settlement route choice + venue | ✅ | — |
| Settlement amounts | — | ✅ |
| Strategy commitment hash | ✅ | — |
| KYB attestation hash | ✅ | — |
| Forensic signals (aggregate) | ✅ | — |
| Forensic signals (per-vault notional) | — | ✅ |

`atlas_confidential::surface::classify_field` enforces this table at
construction time. Marking a confidential field as public refuses with
`SurfaceClassificationError::OverrideRefused`.

## What Phase 14 ships

| Surface | Module |
|---|---|
| Surface classification + override refusal | `surface.rs` |
| Pattern A (Token-2022 native) / Pattern B (Cloak wrapped) | `pattern.rs` |
| Pedersen / ElGamal commitments + range-proof contract | `commitment.rs` |
| Public input v3 (300 bytes) with `disclosure_policy_hash` | `public_input_v3.rs` |
| Disclosure policy + viewing key issue / validate / revoke | `disclosure.rs` |
| Confidential payroll batches (encrypted recipient + amount) | `payroll.rs` |
| Bubblegum-anchored disclosure audit log (I-17) | `audit_log.rs` |
| AML clearance + travel-rule payload reference | `compliance.rs` |
| Cloak shielded program added to CPI allowlist | `atlas-cpi-guard` |
| Confidential commitment-path lint extensions | `atlas-runtime::lints` |
| 4 SDK methods + 4 REST endpoints + 7 telemetry metrics | (cross-crate) |
| 3-view playground (public / finance / recipient) | `sdk/playground/confidential.html` |

## Hard rules (new invariants I-13 .. I-17)

- **I-13** Ratios public, notionals confidential.
- **I-14** Verifier sees only what it must.
- **I-15** Selective disclosure is policy-bound.
- **I-16** No "privacy off" mode mid-life. Confidential vault is
  confidential for its entire lifetime.
- **I-17** No silent unblinding. Every decryption inside Atlas
  produces a Bubblegum-anchored audit log entry.

## Disclosure tiers (§6.2)

| Role | Scope | Use |
|---|---|---|
| `PublicAuditor` | `AggregateOnly` | journalists, public dashboards, "yes/no this vault is solvent" |
| `RegulatorTimeWindowed` | `PerTransaction` within window | regulator subpoena, time-bounded |
| `FinanceAdmin` | `Full` | accounting, year-end reporting |
| `Operator` | `PerProtocol` | day-to-day ops without per-payee leak |
| `Recipient` | `RecipientSpecific` | each recipient sees their own payouts |

`Full` scope is reserved for `FinanceAdmin`. The validator refuses
any policy where `Full` is granted to another role
(`DisclosurePolicyError::FullScopeNotForRole`).

## Compliance posture (§7)

- KYB still applies at vault and treasury creation (Phase 13 §3).
- Sanctions screening runs on every payout pre-shield via
  `AmlClearance` attestation; bad signature length, expired clearance,
  recipient mismatch, or null signer all hard-reject.
- Travel rule: amounts above
  `TRAVEL_RULE_THRESHOLD_USD_Q64 = 3 000 USD-Q64` include an off-chain
  encrypted payload; the on-chain record carries
  `TravelRulePayloadRef.payload_hash`.
- Regulator window: a court order triggers issuance of a
  `RegulatorTimeWindowed` viewing key with a time-bounded scope.

> Privacy that resists targeted lawful disclosure is **out of scope**.
> Privacy that resists opportunistic on-chain surveillance is in scope.

## Hard-rule enforcement layers

1. **Type isolation** — confidential modules live in
   `atlas-confidential` and never import plaintext-amount types.
2. **Construction gate** — `surface::classify_field` refuses any
   override of the directive's §2 table.
3. **CI lint** — `forbid_third_party_in_commitment` extends with
   `plaintext_notional`, `cleartext_amount`, `plaintext_balance`,
   `unblinded_amount`. CI blocks any commit that references those
   symbols from canonical commitment-path source files.
4. **Public input** — v3's `disclosure_policy_hash` field commits the
   policy to every proof. Changing the policy means a new vault.
5. **On-chain anchor** — disclosure events Bubblegum-anchored;
   tampering requires breaking the on-chain root.
6. **Lifecycle lock** — `ConfidentialPattern` is immutable
   post-creation (I-16). Migrating means withdrawing all capital and
   creating a new vault — a deliberate, audit-trailed event.

## Positioning

> **Atlas Confidential Treasury Layer** — strategy and proofs are
> public; treasury size, payroll, and vendor settlements are
> confidential by default with auditor-key disclosure. Selective,
> compliant, institutional-grade.
