// @atlas/sdk — platform client (directive 09 §7.2).
//
// Thin client over /api/v1/*. Same surface as the atlas-rs Rust
// crate: getVault, listRebalances, getRebalance, getProof,
// simulateDeposit, verifyProof, streamRebalances. Uses the host's
// fetch + WebSocket so it runs in browsers and Node 18+ unchanged.

export interface PlatformConfig {
  /** Base URL, e.g. `https://atlas.example`. No trailing slash. */
  baseUrl: string;
  /** Optional fetch override (for tests). */
  fetchImpl?: typeof fetch;
}

export interface RebalanceListing {
  publicInputHash: string;
  slot: number;
  status: "landed" | "aborted" | "rejected";
}

export interface ProofResponse {
  publicInputHex: string;
  proofBytes: number[];
  archiveRootSlot: number;
  archiveRoot: string;
  merkleProofPath: string[];
  blackbox: unknown;
}

// ─── Phase 15 — Operator Agent surface ──────────────────────────────────

export type KeeperRole =
  | "rebalance_keeper"
  | "settlement_keeper"
  | "alt_keeper"
  | "archive_keeper"
  | "hedge_keeper"
  | "pyth_post_keeper"
  | "attestation_keeper";

export type ActionClass =
  | "rebalance_execute"
  | "settlement_settle"
  | "alt_mutate"
  | "archive_append"
  | "hedge_open_close_resize"
  | "pyth_post"
  | "attestation_sign"
  | "disclosure_log_write";

export type AgentPersona = "risk" | "yield" | "compliance" | "execution";

export interface AgentReality {
  concrete_crate: string;
  concrete_program: string | null;
  deterministic: boolean;
  gated_by_proof: boolean;
  gated_by_attestation: boolean;
}

export interface AgentCard {
  persona: AgentPersona;
  display_name: string;
  one_liner: string;
  responsibilities: string[];
  reality: AgentReality;
}

export interface KeeperMandateView {
  keeper_pubkey: string;
  role: KeeperRole;
  valid_from_slot: number;
  valid_until_slot: number;
  max_actions: number;
  max_notional_per_action_q64: string;
  max_notional_total_q64: string;
  actions_used: number;
  notional_used_q64: string;
  remaining_actions: number;
  remaining_notional_q64: string;
  issued_by_squads_tx: string;
}

export type PendingPriority = "critical" | "normal" | "low";

export type PendingState =
  | "pending"
  | "approved"
  | "rejected"
  | "stale"
  | "executed";

export type PendingReason =
  | "mandate_renewal"
  | "mandate_scope_expansion"
  | "above_auto_threshold"
  | "caps_exhausted"
  | "compliance_hold"
  | "manual";

export interface PendingBundleView {
  bundle_id: string;
  treasury_id: string;
  keeper_pubkey: string;
  role: KeeperRole;
  action: ActionClass;
  priority: PendingPriority;
  reason: PendingReason;
  notional_q64: string;
  submitted_at_slot: number;
  valid_until_slot: number;
  summary: string;
  state: PendingState;
  decision_squads_tx: string | null;
}

// ─── Phase 17 — RPC Router + /infra Observatory ────────────────────────

export type RpcRole = "tier_a_latency" | "tier_b_quorum" | "tier_c_archive";

export type FreshnessBand = "green" | "amber" | "red";

export interface FreshnessBudgetView {
  vault_id: string;
  current_slot: number;
  last_proof_slot: number;
  slot_drift: number;
  freshness_remaining_slots: number;
  verification_window_seconds_remaining: number;
  band: FreshnessBand;
}

export type ProofPipelineStage =
  | "ingest"
  | "infer"
  | "consensus"
  | "prove"
  | "submit";

export interface ProofPipelineTimelineView {
  vault_id: string;
  bundle_id: string;
  stage_durations_ms: [ProofPipelineStage, number][];
}

export type AttributionVerdict =
  | "consistent"
  | "slot_skew"
  | "content_divergence";

export interface AttributionEntryView {
  source: string;
  verdict: AttributionVerdict;
  observed_slot: number;
  observed_data_hash: string;
  canonical_slot: number;
  canonical_data_hash: string;
}

export interface RpcLatencySample {
  source: string;
  role: RpcRole;
  region: string;
  p50_ms: number;
  p99_ms: number;
}

export interface InfraSnapshot {
  generated_at_slot: number;
  rpc_latency: RpcLatencySample[];
  quorum_match_rate_bps_1h: number;
  slot_lag_per_source: { source: string; lag_slots: number }[];
  attribution_heatmap: { source: string; consistent: number; slot_skew: number; content_divergence: number; outlier_share_bps: number }[];
  network_tps_p50: number;
  network_tps_p99: number;
  jito_landed_rate_bps_1m: number;
  validator_latency_by_region: { region: string; p99_ms: number }[];
  cu_p50_per_rebalance: number;
  cu_p99_per_rebalance: number;
  proof_gen_p50_ms: number;
  proof_gen_p99_ms: number;
  rebalance_e2e_p50_ms: number;
  rebalance_e2e_p99_ms: number;
  pyth_post_latency_p99_ms: number;
  freshness_budgets: FreshnessBudgetView[];
}

// ─── Phase 18 — Private Execution Layer (PER) ──────────────────────────

export type SessionStatus = "open" | "settled" | "expired" | "disputed";

export interface ErSessionView {
  vault_id: string;
  session_id: string;
  magicblock_program: string;
  opened_at_slot: number;
  max_session_slots: number;
  pre_state_commitment: string;
  status: SessionStatus;
  settled_at_slot: number | null;
  opened_receipt_id: string;
}

export type GatewayEventKind =
  | "session_opened"
  | "session_settled"
  | "session_expired"
  | "session_disputed";

export interface GatewayEventView {
  kind: GatewayEventKind;
  vault_id: string;
  session_id: string;
  opened_at_slot?: number;
  settled_at_slot?: number;
  expired_at_slot?: number;
}

export type ExecutionPrivacyView =
  | { kind: "mainnet" }
  | {
      kind: "private_er";
      magicblock_program: string;
      max_session_slots: number;
    };

// ─── Phase 19 — Tether QVAC local-AI surfaces ──────────────────────────

export type QvacSurfaceId =
  | "pre_sign_explainer"
  | "invoice_ocr"
  | "treasury_translation"
  | "second_opinion_analyst";

export interface QvacPrivacyNoticeEntry {
  surface: QvacSurfaceId;
  runs_locally: string[];
  comes_from_atlas: string[];
}

export interface QvacPrivacyNoticeView {
  schema: "atlas.qvac.privacy.v1";
  entries: QvacPrivacyNoticeEntry[];
  /** Last-modified slot — UI shows this so the user can verify the
   *  notice is current. */
  updated_at_slot: number;
}

export interface QvacAlertTemplateView {
  template_id: string;
  canonical_english: string;
  identifiers_to_preserve: string[];
}

export type OcrConfidenceView = "high" | "medium" | "low";
export type OcrSourceView = "local_ocr" | "operator";

export interface OcrField<T> {
  value: T | null;
  confidence: OcrConfidenceView;
  source: OcrSourceView;
}

export interface DraftInvoiceStateView {
  vendor_name: OcrField<string>;
  amount_q64: OcrField<string>;
  mint: OcrField<string>;
  due_at_unix: OcrField<number>;
  vendor_reference: OcrField<string>;
  source: OcrSourceView;
  /** blake3 over the local image bytes; the image stays on the
   *  operator's device. */
  local_image_digest: string;
}

export type AnalystRecommendationView = "approve" | "reject" | "escalate";

export interface AnalystAssessmentView {
  recommendation: AnalystRecommendationView;
  confidence_bps: number;
  concerns: string[];
  comparison_to_last_30d: string;
  fields_to_double_check: string[];
}

export interface AnalystSummaryView {
  assessment: AnalystAssessmentView;
  unrecognised_concerns: { raw_text: string }[];
  clears_for_signing: boolean;
}

export interface PreSignPayload {
  schema: string;
  instruction: "deposit" | "withdraw" | "vault_creation" | "sandbox_approval";
  vaultId: string;
  projectedShareBalance: string;
  projectedApyBps: number;
  projectedProtocolExposureAfter: { protocol: string; bpsAfter: number }[];
  riskDeltaBps: number;
  feesTotalLamports: string;
  computeUnitsEstimated: number;
  warnings: { code: string; severity: "info" | "warn" | "error"; detail: string }[];
  humanSummary: string;
}

export class AtlasPlatform {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: PlatformConfig) {
    this.base = cfg.baseUrl.replace(/\/$/, "");
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async getVault(id: string): Promise<unknown> {
    return this.getJson(`/api/v1/vaults/${id}`);
  }

  async listRebalances(
    vaultId: string,
    from: number,
    to: number,
  ): Promise<RebalanceListing[]> {
    return this.getJson(
      `/api/v1/vaults/${vaultId}/rebalances?from=${from}&to=${to}`,
    );
  }

  async getRebalance(publicInputHash: string): Promise<unknown> {
    return this.getJson(`/api/v1/rebalance/${publicInputHash}`);
  }

  /** Fetches the proof + Bubblegum path. Caller verifies the
   *  signature client-side via sp1-solana. */
  async getProof(publicInputHash: string): Promise<ProofResponse> {
    const r = await this.getJson<ProofResponse>(
      `/api/v1/rebalance/${publicInputHash}/proof`,
    );
    this.verifyProof(r);
    return r;
  }

  async simulateDeposit(vaultId: string, amountQ64: string): Promise<PreSignPayload> {
    return this.postJson<PreSignPayload>("/api/v1/simulate/deposit", {
      vault_id: vaultId,
      amount_q64: amountQ64,
    });
  }

  /** Phase 15 — fetch the four-persona agent dashboard cards. */
  async getAgents(): Promise<AgentCard[]> {
    return this.getJson<AgentCard[]>("/api/v1/agents");
  }

  /** Phase 15 — fetch active keeper mandates + ratcheted usage for a treasury. */
  async getKeepers(treasuryId: string): Promise<KeeperMandateView[]> {
    return this.getJson<KeeperMandateView[]>(`/api/v1/treasury/${treasuryId}/keepers`);
  }

  /** Phase 15 — fetch the pending-approval queue for a treasury. */
  async getPending(treasuryId: string): Promise<PendingBundleView[]> {
    return this.getJson<PendingBundleView[]>(`/api/v1/treasury/${treasuryId}/pending`);
  }

  /** Phase 17 — fetch the /infra public observatory snapshot. */
  async getInfraSnapshot(): Promise<InfraSnapshot> {
    return this.getJson<InfraSnapshot>("/api/v1/infra");
  }

  /** Phase 17 — fetch the slot-drift attribution heatmap. */
  async getAttributionHeatmap(): Promise<AttributionEntryView[]> {
    return this.getJson<AttributionEntryView[]>("/api/v1/infra/attribution");
  }

  /** Phase 17 — fetch the freshness budget for every active vault. */
  async getFreshnessAll(): Promise<FreshnessBudgetView[]> {
    return this.getJson<FreshnessBudgetView[]>("/api/v1/freshness");
  }

  /** Phase 17 — fetch one vault's freshness budget + proof timeline. */
  async getFreshnessForVault(
    vaultId: string,
  ): Promise<{ budget: FreshnessBudgetView; timeline: ProofPipelineTimelineView }> {
    return this.getJson<{ budget: FreshnessBudgetView; timeline: ProofPipelineTimelineView }>(
      `/api/v1/freshness/${vaultId}`,
    );
  }

  /** Phase 18 — list active and recent PER sessions. */
  async listPerSessions(): Promise<ErSessionView[]> {
    return this.getJson<ErSessionView[]>("/api/v1/per/sessions");
  }

  /** Phase 18 — fetch a single PER session by id. */
  async getPerSession(sessionId: string): Promise<ErSessionView> {
    return this.getJson<ErSessionView>(`/api/v1/per/sessions/${sessionId}`);
  }

  /** Phase 18 — Bubblegum-anchored PER event log. */
  async listPerEvents(): Promise<GatewayEventView[]> {
    return this.getJson<GatewayEventView[]>("/api/v1/per/events");
  }

  /** Phase 18 — fetch a vault's execution privacy declaration. */
  async getExecutionPrivacy(vaultId: string): Promise<ExecutionPrivacyView> {
    return this.getJson<ExecutionPrivacyView>(
      `/api/v1/vaults/${vaultId}/execution_privacy`,
    );
  }

  /** Phase 19 — privacy notice for the local-AI surfaces. */
  async getQvacPrivacyNotice(): Promise<QvacPrivacyNoticeView> {
    return this.getJson<QvacPrivacyNoticeView>("/api/v1/legal/qvac");
  }

  /** Phase 19 — canonical English alert-template corpus the local
   *  NMT translates against. */
  async getQvacAlertTemplates(): Promise<QvacAlertTemplateView[]> {
    return this.getJson<QvacAlertTemplateView[]>("/api/v1/qvac/alert-templates");
  }

  /** Phase 19 — submit an operator-confirmed OCR draft. The image
   *  stays on the operator's device; only structured fields go up. */
  async submitInvoiceDraft(treasuryId: string, draft: DraftInvoiceStateView): Promise<void> {
    await this.postJson(
      `/api/v1/treasury/${treasuryId}/invoices/draft`,
      draft,
    );
  }

  /** Sanity-check that a `ProofResponse` carries every field the
   *  on-chain verifier ix needs. Throws on malformed shapes. */
  verifyProof(r: ProofResponse): void {
    if (r.publicInputHex.length !== 536) {
      throw new Error(
        `public_input_hex must be 268*2 = 536 chars (got ${r.publicInputHex.length})`,
      );
    }
    if (r.proofBytes.length === 0) {
      throw new Error("proof bytes empty — verifier cannot run");
    }
    if (r.merkleProofPath.length === 0) {
      throw new Error("merkle proof path empty — Bubblegum reconstruction needs at least one sibling");
    }
  }

  /** WebSocket subscription to per-vault rebalance events. The
   *  caller owns the socket lifecycle; this method returns the
   *  websocket so cancellation is just `.close()`. */
  streamRebalances(vaultId: string, onMsg: (evt: unknown) => void): WebSocket {
    const url = this.base.replace(/^http/, "ws") + `/api/v1/stream/vault/${vaultId}`;
    const ws = new WebSocket(url);
    ws.addEventListener("message", (e) => {
      try {
        onMsg(JSON.parse(typeof e.data === "string" ? e.data : ""));
      } catch (err) {
        // Surfacing the parse error lets the caller decide whether to
        // reconnect or escalate.
        console.warn("atlas-sdk: malformed stream payload", err);
      }
    });
    return ws;
  }

  private async getJson<T = unknown>(path: string): Promise<T> {
    const r = await this.fetchImpl(this.base + path);
    if (!r.ok) {
      throw new Error(`GET ${path} → ${r.status}`);
    }
    return (await r.json()) as T;
  }

  private async postJson<T = unknown>(path: string, body: unknown): Promise<T> {
    const r = await this.fetchImpl(this.base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`POST ${path} → ${r.status}`);
    }
    return (await r.json()) as T;
  }
}
