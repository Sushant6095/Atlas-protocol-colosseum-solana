# Atlas Frontend — Part 1: Spine (design + motion + perf)

> The Atlas frontend has one job: make a hostile, first-time visitor
> feel within five seconds that they are looking at institutional
> infrastructure, not a hackathon dashboard. That feeling comes from
> the discipline of two systems together — design language and
> performance architecture — specified as one stack.

Phase 20 lands the spine. Parts 2–5 (Phases 21–24) layer routing +
state, intelligence surfaces, operator surfaces, and viz / realtime
distribution on top, reusing every token and budget below.

## What Phase 20 ships

| Layer | Code |
|---|---|
| Design tokens (color / type / space / radius / motion / budgets) | [web/lib/tokens.ts](web/lib/tokens.ts) |
| CSS variable bridge + reduced-motion contract | [web/app/globals.css](web/app/globals.css) |
| Motion library (framer-motion variants tokenised) | [web/lib/motion.ts](web/lib/motion.ts) |
| Realtime transport — single multiplexed WebSocket | [web/lib/realtime/transport.ts](web/lib/realtime/transport.ts) |
| Realtime store — RAF-batched, dedup'd, backpressured | [web/lib/realtime/store.ts](web/lib/realtime/store.ts) + [hooks.ts](web/lib/realtime/hooks.ts) |
| 3D scene supervisor — viewport mount + adaptive FPS + LOD + low-end freeze | [web/lib/three/supervisor.ts](web/lib/three/supervisor.ts) |
| Perf telemetry — Web Vitals + long-task + memory + render counter | [web/lib/perf/](web/lib/perf/) |
| State contract — TanStack Query defaults + Zustand UI registry | [web/lib/state/](web/lib/state/) |
| Primitive components (memoised) — Panel, Button, IdentifierMono, AlertPill, Tile | [web/components/primitives/](web/components/primitives/) |
| ESLint guard — block raw hex, banned state libs, framer-motion sub-paths | [web/eslint.config.mjs](web/eslint.config.mjs) |

## The design system

### Five accent colors. That's it.

| Token | Use |
|---|---|
| `electric` (`#3F8CFF`) | primary action, focus rings |
| `zk` (`#A682FF`) | proof / zk surfaces |
| `proof` (`#F478C6`) | proof events |
| `execute` (`#3CE39A`) | execution success, "good" SLO |
| `warn` (`#F7B955`) / `danger` (`#FF6166`) | warning / error states |

Adding a sixth requires a written rationale and a `tokens.ts` PR.
ESLint rejects any raw hex outside [tokens.ts](web/lib/tokens.ts).

### Three font families. Three only.

`Cabinet Grotesk` (display) · `Geist` (body) · `IBM Plex Mono`
(identifiers, hashes, addresses, basis-point figures, code).

Self-hosted. No Google Fonts CDN. ESLint blocks `**/google-fonts/**`
imports.

### 4px grid. Three densities.

`dense` (16/24) for terminals + tables. `default` (24/40) for
intelligence + content. `cinematic` (80/120) for landing.

### Four easings. Five durations.

`glide` / `precise` / `expressive` / `inertial` ×
`instant` (60ms) / `quick` (140ms) / `medium` (220ms) / `slow` (340ms) /
`cinema` (720ms). Anything > 400ms is reviewed in PR.

## The performance architecture

### Render budgets

| Surface class | LCP | INP | CLS |
|---|---|---|---|
| Marketing | ≤ 1.8s | ≤ 200ms | ≤ 0.05 |
| Intelligence | ≤ 2.4s | ≤ 200ms | ≤ 0.05 |
| Operator | ≤ 2.8s | ≤ 200ms | ≤ 0.02 |

Bundles (gzip): initial ≤ 220 KB · per-route split ≤ 120 KB · 3D
import ≤ 380 KB · first interaction ≤ 600 KB.

### Realtime contract

One WebSocket per session, multiplexed by topic. Topics auto-pause
within 1.5s of leaving the viewport. Events deduped via a
4096-entry LRU on `event_id = blake3(canonical_bytes)`. Out-of-order
tolerated up to 32-deep. The store flushes on
`requestAnimationFrame`, not per-event — a 200-tick burst becomes
one render.

Backpressure: at 1024 buffered events the store drops oldest
*non-critical* ticks; alerts, rebalance events, and PER session
events are never dropped. After three reconnect failures the UI
surfaces a non-blocking "live updates paused" pill in the corner.

```ts
import { initRealtime, useRealtimeSnapshot, useRealtimeStream } from "@/lib/realtime";

initRealtime({ url: "wss://atlas.example/api/v1/stream", token });

const tps = useRealtimeSnapshot<TpsTick>("stream.infra.tps"); // RAF-flushed snapshot
useRealtimeStream<RebalanceEvent>("stream.vault.0xab12.rebalance", (e) => {
  // hot path — no rerender of the calling component
});
```

### 3D scene supervisor

```ts
const sceneRef = useRef<HTMLDivElement>(null);
const { mounted, updateMultiplier, lod, freeze } = useSceneSupervisor(sceneRef, { surface: "landing" });
```

- `mounted` flips on viewport intersection (rootMargin 200px).
- `updateMultiplier` drops from 1 → 0.5 when frame time exceeds
  22ms for > 1s, returns to 1 when comfortably under 18ms for > 1s.
- `lod` returns `tier1 / tier2 / tier3` based on canvas pixel count.
- `freeze` is true under `prefers-reduced-motion: reduce` or
  low-end devices (< 4 cores or < 4 GB memory). Render the first
  frame and stop.

Operator surfaces are forced to `mounted = false` — the budget is
too tight for 3D in a terminal.

### State stores — three, no more

1. **Server cache** — TanStack Query (live `staleTime: 5_000`,
   archival `staleTime: 60_000`). Vault-scoped query keys via
   `vaultKey(id, …rest)` so invalidation is explicit.
2. **Realtime cache** — Zustand slice fed by the WebSocket
   multiplexer. Components subscribe via per-topic selectors.
3. **UI state** — Zustand slices per feature. The registry at
   [registry.ts](web/lib/state/registry.ts) is documentation;
   ESLint blocks Redux / Recoil / Jotai imports.

### Memory + lifecycle hygiene

Every WebSocket subscription returns an unsubscribe. Every RAF
registration is cancelled on unmount. IntersectionObserver /
ResizeObserver / MutationObserver disconnected on unmount. r3f
scenes call `.dispose()` on geometries / materials / textures /
renderers when the root unmounts. The dev-only memory inspector
warns on monotonic heap growth across navigations.

## What's deliberately not here

- A sixth accent color "for one screen". The palette is fixed.
- A new font family "for marketing". Three families.
- Auto-playing 3D scenes outside the viewport.
- A component that subscribes to a WebSocket AND renders a 3D
  scene AND mutates global state. Split it.
- An animation library imported globally just to use one easing
  curve. Use [tokens.ts](web/lib/tokens.ts).
- Server components that import client-only modules. The boundary
  is enforced.
- Dropping motion accessibility because "the demo needs to look
  cool". `prefers-reduced-motion` collapses every transition above
  `quick` to instant.

## What's next

| Phase | Adds |
|---|---|
| 21 | Routing + provider tree + page suspense scaffolds + persistence layer |
| 22 | Intelligence surfaces (capital flow heatmap, /infra observatory, exposure graph) |
| 23 | Operator surfaces (vault terminal, command palette, pending queue, agent dashboard) |
| 24 | 3D + viz + distribution (landing globe, zk-proof geometry, force-directed exposure graph, embedded widgets) |

Every one of those parts will reuse Phase 20's tokens and budgets
without exception. A surface that violates Phase 20 is a surface
that does not ship.
