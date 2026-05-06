// useSession — read session claims + JWT mirror (Phase 21 §5).

"use client";

import { useShallow } from "zustand/react/shallow";
import { useSessionStore } from "./session-store";
import {
  isConnected,
  isAuditor,
  isDeveloper,
  isVaultMember,
  treasuryRole,
  treasuryRoleAtLeast,
  type SessionClaims,
  type TreasuryRole,
} from "./scopes";

export interface UseSessionReturn extends SessionClaims {
  jwt: string | null;
  status: "boot" | "anonymous" | "connected" | "refreshing";
  isConnected: boolean;
  isAuditor(policyId?: string): boolean;
  isDeveloper: boolean;
  isVaultMember(vaultId: string): boolean;
  treasuryRole(treasuryId: string): TreasuryRole | null;
  treasuryRoleAtLeast(treasuryId: string, minimum: TreasuryRole): boolean;
}

export function useSession(): UseSessionReturn {
  const s = useSessionStore(
    useShallow((s) => ({
      wallet: s.wallet,
      scopes: s.scopes,
      expires_at: s.expires_at,
      jwt: s.jwt,
      status: s.status,
    })),
  );
  const claims: SessionClaims = {
    wallet: s.wallet,
    scopes: s.scopes,
    expires_at: s.expires_at,
  };
  return {
    ...s,
    isConnected: isConnected(claims),
    isAuditor: (policyId) => isAuditor(claims, policyId),
    isDeveloper: isDeveloper(claims),
    isVaultMember: (id) => isVaultMember(claims, id),
    treasuryRole: (id) => treasuryRole(claims, id),
    treasuryRoleAtLeast: (id, min) => treasuryRoleAtLeast(claims, id, min),
  };
}
