// Client-side SDK access (Phase 21 §1, §7).
//
// `useAtlas()` returns the singleton AtlasClient pinned to the
// session JWT. The actual JWT lives in an httpOnly cookie (Phase 21
// §5.1) — this hook reads the in-memory mirror published by the
// auth provider, never localStorage.

"use client";

import { useMemo } from "react";
import { AtlasClient } from "./client";
import { useSession } from "../auth/useSession";

export function useAtlas(): AtlasClient {
  const { jwt } = useSession();
  return useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_ATLAS_API_BASE_URL
      ?? (typeof window !== "undefined" ? window.location.origin : "https://atlas.example");
    return new AtlasClient({ baseUrl, jwt });
  }, [jwt]);
}
