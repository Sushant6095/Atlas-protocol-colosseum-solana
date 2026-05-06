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
