// /playground — Interactive API console (Phase 22 §12.2).

"use client";

import { useState } from "react";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { AlertPill } from "@/components/primitives/AlertPill";
import { useAtlas } from "@/lib/sdk";
import { cn } from "@/components/primitives";

interface ApiCall {
  id: string;
  method: "GET" | "POST";
  path: string;
  group: "infra" | "vaults" | "treasury" | "intel" | "per" | "decision";
  description: string;
  exampleParam?: string;
}

const CATALOG: ApiCall[] = [
  { id: "infra",       method: "GET", path: "/api/v1/infra",                   group: "infra",   description: "12-panel observatory snapshot" },
  { id: "infra-attr",  method: "GET", path: "/api/v1/infra/attribution",       group: "infra",   description: "slot-drift attribution heatmap" },
  { id: "freshness",   method: "GET", path: "/api/v1/freshness",               group: "infra",   description: "all-vault freshness budgets" },
  { id: "vaults",      method: "GET", path: "/api/v1/vaults",                  group: "vaults",  description: "vault list" },
  { id: "vault",       method: "GET", path: "/api/v1/vaults/{id}",             group: "vaults",  description: "single vault state",       exampleParam: "0x" + "ab".repeat(32) },
  { id: "rebalances",  method: "GET", path: "/api/v1/vaults/{id}/rebalances",  group: "vaults",  description: "paginated rebalance list", exampleParam: "0x" + "ab".repeat(32) },
  { id: "rebalance",   method: "GET", path: "/api/v1/rebalance/{hash}",        group: "vaults",  description: "black-box record",         exampleParam: "0x" + "a1".repeat(32) },
  { id: "proof",       method: "GET", path: "/api/v1/rebalance/{hash}/proof",  group: "vaults",  description: "Groth16 + Bubblegum path", exampleParam: "0x" + "a1".repeat(32) },
  { id: "treasury",    method: "GET", path: "/api/v1/treasury/{id}",           group: "treasury",description: "treasury entity",          exampleParam: "0x" + "00".repeat(32) },
  { id: "intel-wallet",method: "GET", path: "/api/v1/wallet-intel/{wallet}",   group: "intel",   description: "wallet report",            exampleParam: "9P3...x1Ka" },
  { id: "agents",      method: "GET", path: "/api/v1/agents",                  group: "decision",description: "four-persona agent cards" },
  { id: "per",         method: "GET", path: "/api/v1/per/sessions",            group: "per",     description: "active + recent PER sessions" },
];

type Lang = "ts" | "rust" | "curl";

export default function Page() {
  const atlas = useAtlas();
  const [selected, setSelected] = useState<ApiCall>(CATALOG[0]);
  const [param, setParam] = useState<string>(selected.exampleParam ?? "");
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [replaySlot, setReplaySlot] = useState<string>("245000000");
  const [lang, setLang] = useState<Lang>("ts");

  const concrete = selected.path
    .replace("{id}", param || "<vault-id>")
    .replace("{hash}", param || "<hash>")
    .replace("{wallet}", param || "<wallet>")
    + (replayMode ? `?as_of_slot=${replaySlot}` : "");

  const choose = (c: ApiCall) => {
    setSelected(c);
    setParam(c.exampleParam ?? "");
    setResponse(null);
    setError(null);
  };

  const run = async () => {
    setPending(true);
    setResponse(null);
    setError(null);
    try {
      const data = await atlas.getJson(concrete);
      setResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 -mx-8 -my-10 p-8 not-prose">
      <Panel surface="raised" density="dense" className="col-span-3">
        <header className="mb-3"><span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">endpoint catalog</span></header>
        <ul className="flex flex-col gap-0.5">
          {CATALOG.map((c) => {
            const active = c.id === selected.id;
            return (
              <li key={c.id}>
                <button
                  onClick={() => choose(c)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-[var(--radius-sm)] text-[12px]",
                    active
                      ? "bg-[color:var(--color-line-soft)] text-[color:var(--color-ink-primary)]"
                      : "text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-line-soft)]",
                  )}
                >
                  <span className="font-mono text-[10px] mr-2 text-[color:var(--color-accent-electric)]">{c.method}</span>
                  <span className="font-mono">{c.path}</span>
                  <p className="text-[10px] text-[color:var(--color-ink-tertiary)] mt-0.5 normal-case">{c.description}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-5">
        <header className="mb-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">request</span>
          <label className="inline-flex items-center gap-2 text-[11px] text-[color:var(--color-ink-secondary)]">
            <input
              type="checkbox" checked={replayMode}
              onChange={(e) => setReplayMode(e.target.checked)}
              className="accent-[color:var(--color-accent-zk)]"
            />
            replay mode
          </label>
        </header>
        <p className="font-mono text-[12px] text-[color:var(--color-ink-primary)] break-all">
          <span className="text-[color:var(--color-accent-electric)]">{selected.method}</span>{" "}
          {concrete}
        </p>

        {selected.path.includes("{") ? (
          <label className="block mt-4">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">param</span>
            <input
              type="text"
              value={param}
              onChange={(e) => setParam(e.target.value)}
              className="mt-1 w-full h-9 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-3 font-mono text-[12px]"
            />
          </label>
        ) : null}

        {replayMode ? (
          <label className="block mt-3">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">as_of_slot</span>
            <input
              type="text" value={replaySlot} onChange={(e) => setReplaySlot(e.target.value)}
              className="mt-1 w-full h-9 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-3 font-mono text-[12px]"
            />
          </label>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" size="sm" disabled={pending} onClick={run}>
            {pending ? "Running…" : "Run"}
          </Button>
          {(["ts", "rust", "curl"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "px-2 h-7 rounded-[var(--radius-xs)] font-mono text-[10px] uppercase",
                lang === l
                  ? "bg-[color:var(--color-line-soft)] text-[color:var(--color-ink-primary)]"
                  : "text-[color:var(--color-ink-tertiary)] hover:bg-[color:var(--color-line-soft)]",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <pre className="mt-4 font-mono text-[11px] leading-[18px] p-3 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunken)] border border-[color:var(--color-line-soft)] overflow-auto scroll-area text-[color:var(--color-ink-secondary)]">
          <code>{snippet(selected, concrete, lang)}</code>
        </pre>
      </Panel>

      <Panel surface="raised" density="dense" className="col-span-4">
        <header className="mb-3 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">response</span>
          {error ? <AlertPill severity="danger">error</AlertPill> :
           response ? <AlertPill severity="ok">ok</AlertPill> : null}
        </header>
        <pre className="font-mono text-[10px] leading-[16px] max-h-[60vh] overflow-auto scroll-area text-[color:var(--color-ink-secondary)]">
          <code>
            {error
              ? error
              : response
              ? JSON.stringify(response, null, 2)
              : "// click Run to see the response"}
          </code>
        </pre>
        <p className="mt-3 text-[10px] text-[color:var(--color-ink-tertiary)]">
          {replayMode
            ? "replay mode pins the request to as_of_slot via the warehouse — Phase 23 wires the live replay path."
            : "live request hits production reads via the @atlas/sdk client. No mocking on this surface."}
        </p>
      </Panel>
    </div>
  );
}

function snippet(c: ApiCall, concrete: string, lang: Lang): string {
  if (lang === "curl") return `curl -s "${concrete}" \\\n  -H "Accept: application/json"`;
  if (lang === "rust")
    return `let client = AtlasClient::new(transport);
let res = client.get_json::<serde_json::Value>("${concrete}").await?;
println!("{:#?}", res);`;
  return `import { AtlasPlatform } from "@atlas/sdk";
const atlas = new AtlasPlatform({ baseUrl: "https://atlas.fyi" });
const res = await atlas.getJson("${concrete}");
console.log(res);`;
}
