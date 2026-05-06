// Atlas auth scopes (Phase 21 §5.2).
//
// JWT carries scopes derived from the wallet's relationships. The
// app shell renders nav + features based on scopes; the server
// enforces. A surface that calls `requireScope(scope)` either
// receives the matching grant or sees the route's not-authorised
// fallback.

export type Scope =
  | "anonymous"
  | "connected"
  | `vault_member:${string}`
  | `treasury_member:${string}:${TreasuryRole}`
  | `auditor:${string}`
  | "developer";

export type TreasuryRole =
  | "Operator"
  | "FinanceAdmin"
  | "CFO"
  | "CEO"
  | "ReadOnly";

export interface SessionClaims {
  /** Wallet pubkey (base58). */
  wallet: string | null;
  /** All grants the JWT carries. */
  scopes: Scope[];
  /** Unix seconds. */
  expires_at: number;
}

export const ANON_SESSION: SessionClaims = {
  wallet: null,
  scopes: ["anonymous"],
  expires_at: 0,
};

// ─── Scope checks ─────────────────────────────────────────────────────

export function isConnected(claims: SessionClaims): boolean {
  return claims.scopes.includes("connected");
}

export function isVaultMember(claims: SessionClaims, vaultId: string): boolean {
  return claims.scopes.includes(`vault_member:${vaultId}`);
}

export function treasuryRole(
  claims: SessionClaims,
  treasuryId: string,
): TreasuryRole | null {
  for (const s of claims.scopes) {
    if (s.startsWith(`treasury_member:${treasuryId}:`)) {
      return s.split(":")[2] as TreasuryRole;
    }
  }
  return null;
}

export function isAuditor(claims: SessionClaims, policyId?: string): boolean {
  if (policyId) return claims.scopes.includes(`auditor:${policyId}`);
  return claims.scopes.some((s) => s.startsWith("auditor:"));
}

export function isDeveloper(claims: SessionClaims): boolean {
  return claims.scopes.includes("developer");
}

/** Highest treasury role (CEO > CFO > FinanceAdmin > Operator > ReadOnly). */
export function rankTreasuryRole(role: TreasuryRole): number {
  switch (role) {
    case "CEO":          return 5;
    case "CFO":          return 4;
    case "FinanceAdmin": return 3;
    case "Operator":     return 2;
    case "ReadOnly":     return 1;
  }
}

/** True iff the holder's role is at least the required role. */
export function treasuryRoleAtLeast(
  claims: SessionClaims,
  treasuryId: string,
  minimum: TreasuryRole,
): boolean {
  const role = treasuryRole(claims, treasuryId);
  if (!role) return false;
  return rankTreasuryRole(role) >= rankTreasuryRole(minimum);
}
