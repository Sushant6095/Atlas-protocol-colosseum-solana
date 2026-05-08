// Allowlist editor (Phase 24 §4.6).
//
// Per-origin toggle for the pre-sign overlay. Atlas defaults to
// silent on every site — the user opts in to inspection per origin.

import { useEffect, useState } from "react";
import {
  getAllowlist, setAllowlist,
  type AllowlistEntry,
} from "../lib/storage";

export function AllowlistEditor(): JSX.Element {
  const [list, setList] = useState<AllowlistEntry[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => { void getAllowlist().then(setList); }, []);

  async function add(): Promise<void> {
    const origin = normaliseOrigin(draft);
    if (!origin) return;
    if (list.some((e) => e.origin === origin)) return;
    const next: AllowlistEntry[] = [
      ...list,
      { origin, addedAt: new Date().toISOString(), preSign: true },
    ];
    setList(next);
    setDraft("");
    await setAllowlist(next);
  }

  async function remove(origin: string): Promise<void> {
    const next = list.filter((e) => e.origin !== origin);
    setList(next);
    await setAllowlist(next);
  }

  async function togglePreSign(origin: string): Promise<void> {
    const next = list.map((e) => e.origin === origin ? { ...e, preSign: !e.preSign } : e);
    setList(next);
    await setAllowlist(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 10, color: "#8893a8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          allowed origins
        </div>
        <p style={{ margin: 0, color: "#8893a8", fontSize: 12 }}>
          Atlas inspects pre-sign payloads only on the origins listed below. No interception happens elsewhere.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void add(); }}
            style={{ display: "flex", gap: 6 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://app.example.com"
          style={{
            flex: 1, background: "#0e121a", color: "#e7eaf0",
            border: "1px solid #1d2230", borderRadius: 4, padding: "6px 8px",
            font: "12px ui-monospace, Menlo, monospace",
          }}
        />
        <button type="submit" style={btn("primary")}>Add</button>
      </form>

      {list.length === 0 ? (
        <div style={{ color: "#8893a8" }}>No origins yet.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map((e) => (
            <li key={e.origin} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto",
              gap: 8, alignItems: "center",
              border: "1px solid #1d2230", borderRadius: 4, padding: "8px 10px",
            }}>
              <span style={{ font: "12px ui-monospace, Menlo, monospace" }}>{e.origin}</span>
              <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, color: "#c8d0dd" }}>
                <input type="checkbox" checked={e.preSign}
                       onChange={() => void togglePreSign(e.origin)} />
                pre-sign
              </label>
              <button onClick={() => void remove(e.origin)} style={btn("ghost")}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function normaliseOrigin(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function btn(kind: "primary" | "ghost"): React.CSSProperties {
  return {
    border: "1px solid " + (kind === "primary" ? "#6aa6ff" : "#1d2230"),
    background: kind === "primary" ? "#143052" : "transparent",
    color: kind === "primary" ? "#e7eaf0" : "#c8d0dd",
    borderRadius: 4, padding: "6px 10px",
    font: "12px -apple-system, system-ui, sans-serif", cursor: "pointer",
  };
}
