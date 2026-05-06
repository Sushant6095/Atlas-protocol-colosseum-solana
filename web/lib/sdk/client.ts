// Atlas SDK client (Phase 21 §1, §6).
//
// The single API client for the entire web app. Server components
// import this directly; client components reach for it via the
// hooks in `useAtlas.ts`. Raw fetch calls to /api/v1/* are
// forbidden by the ESLint rule `no-restricted-syntax: raw fetch
// to api/v1`.
//
// We do not import `@atlas/sdk` from npm yet (the package is part
// of this monorepo at `sdk/ts`). The client below mirrors the
// shape of `AtlasPlatform.platform.ts` so when the package
// publishes the call sites change a single import line.

import { cache } from "react";

export type StaleProfile = "live" | "archival";

export interface AtlasClientConfig {
  /** Public REST root, e.g. `https://atlas.example`. No trailing slash. */
  baseUrl: string;
  /** Forwarded as `Authorization: Bearer <jwt>` for authenticated calls. */
  jwt?: string;
  /** Server-side fetch override (RSC / edge); defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class AtlasClient {
  private readonly base: string;
  private readonly jwt: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: AtlasClientConfig) {
    this.base = cfg.baseUrl.replace(/\/$/, "");
    this.jwt = cfg.jwt;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  // ─── Generic ───────────────────────────────────────────────────────
  async getJson<T = unknown>(path: string): Promise<T> {
    const res = await this.fetchImpl(this.base + path, {
      method: "GET",
      headers: this.headers(),
      credentials: "include",
    });
    if (!res.ok) throw new SdkError(`GET ${path} -> ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  async postJson<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(this.base + path, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new SdkError(`POST ${path} -> ${res.status}`, res.status);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ─── Domain helpers — mirror the Phase 09 §7 endpoint catalog ──────
  // Adding a new helper is the canonical place to wire a new route.

  vaults  = () => this.getJson("/api/v1/vaults");
  vault   = (id: string) => this.getJson(`/api/v1/vaults/${id}`);
  rebalances = (vault: string, from: number, to: number) =>
    this.getJson(`/api/v1/vaults/${vault}/rebalances?from=${from}&to=${to}`);
  rebalance  = (hash: string) => this.getJson(`/api/v1/rebalance/${hash}`);
  proof      = (hash: string) => this.getJson(`/api/v1/rebalance/${hash}/proof`);

  treasury    = (id: string) => this.getJson(`/api/v1/treasury/${id}`);
  ledger      = (id: string) => this.getJson(`/api/v1/treasury/${id}/ledger`);
  runway      = (id: string) => this.getJson(`/api/v1/treasury/${id}/runway`);
  invoices    = (id: string) => this.getJson(`/api/v1/treasury/${id}/invoices`);
  pending     = (id: string) => this.getJson(`/api/v1/treasury/${id}/pending`);
  keepers     = (id: string) => this.getJson(`/api/v1/treasury/${id}/keepers`);

  agents      = () => this.getJson("/api/v1/agents");

  infra            = () => this.getJson("/api/v1/infra");
  attribution      = () => this.getJson("/api/v1/infra/attribution");
  freshnessAll     = () => this.getJson("/api/v1/freshness");
  freshnessForVault = (id: string) => this.getJson(`/api/v1/freshness/${id}`);

  perSessions = () => this.getJson("/api/v1/per/sessions");
  perSession  = (sid: string) => this.getJson(`/api/v1/per/sessions/${sid}`);
  perEvents   = () => this.getJson("/api/v1/per/events");
  vaultExecutionPrivacy = (id: string) =>
    this.getJson(`/api/v1/vaults/${id}/execution_privacy`);

  qvacPrivacyNotice  = () => this.getJson("/api/v1/legal/qvac");
  qvacAlertTemplates = () => this.getJson("/api/v1/qvac/alert-templates");

  walletIntel  = (wallet: string) => this.getJson(`/api/v1/wallet-intel/${wallet}`);
  heatmap      = () => this.getJson("/api/v1/intelligence/heatmap");

  triggerById  = (id: string) => this.getJson(`/api/v1/triggers/${id}`);
  recurringFor = (vaultId: string) => this.getJson(`/api/v1/recurring/${vaultId}`);

  simulateDeposit(vaultId: string, amountQ64: string) {
    return this.postJson<unknown>("/api/v1/simulate/deposit", {
      vault_id: vaultId,
      amount_q64: amountQ64,
    });
  }

  // ─── Auth (BFF endpoints — same origin) ─────────────────────────────
  authChallenge(wallet: string) {
    return this.postJson<{ nonce: string; expires_at: number }>(
      "/api/v1/auth/challenge",
      { wallet },
    );
  }
  authVerify(payload: { wallet: string; nonce: string; signature: string }) {
    return this.postJson<{ jwt: string; refresh: string; expires_at: number }>(
      "/api/v1/auth/verify",
      payload,
    );
  }
  authRefresh() {
    return this.postJson<{ jwt: string; expires_at: number }>(
      "/api/v1/auth/refresh",
      {},
    );
  }

  // ─── Internals ─────────────────────────────────────────────────────
  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.jwt) h.Authorization = `Bearer ${this.jwt}`;
    return h;
  }
}

export class SdkError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "SdkError";
  }
}

/**
 * Server-component cached SDK factory. `cache()` deduplicates parallel
 * RSC calls within a single request render.
 */
export const getServerClient = cache((jwt?: string): AtlasClient => {
  const baseUrl =
    process.env.ATLAS_API_BASE_URL
    ?? process.env.NEXT_PUBLIC_ATLAS_API_BASE_URL
    ?? "https://atlas.example";
  return new AtlasClient({ baseUrl, jwt });
});
