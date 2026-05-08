// /projects — Lulo-style projects landing.
//
// One row per project showing the masked API key with eye / clipboard
// affordances. Click "+ Create Project" to spin a new entry. Persisted
// to localStorage today; PR 7 swaps in Vercel Postgres or Neon.

"use client";

import { useEffect, useId, useState } from "react";
import { Check, Copy, Eye, EyeOff, Plus } from "lucide-react";
import { clsx } from "clsx";

interface Project {
  id: string;
  name: string;
  environment: "devnet" | "mainnet";
  origins: string[];
  webhookUrl?: string;
  apiKey: string;
  createdAt: number;
}

const STORAGE_KEY = "atlas.dev.projects.v1";
const REVEAL_TIMEOUT_MS = 30_000;

function randomKey(env: "devnet" | "mainnet"): string {
  const prefix = env === "mainnet" ? "atl_live_" : "atl_test_";
  let s = "";
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < 32; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return prefix + s;
}

export default function Page(): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setProjects(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function persist(next: Project[]): void {
    setProjects(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function handleCreate(p: Omit<Project, "id" | "apiKey" | "createdAt">): void {
    const fresh: Project = {
      ...p,
      id: `proj_${Math.random().toString(36).slice(2, 10)}`,
      apiKey: randomKey(p.environment),
      createdAt: Date.now(),
    };
    persist([fresh, ...projects]);
    setModalOpen(false);
  }

  return (
    <section className="px-8 md:px-12 py-12 max-w-[1100px] mx-auto">
      <header className="flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <h1
            className="font-display font-semibold tracking-[-0.015em]"
            style={{ fontSize: "2rem", color: "var(--color-ink-primary)" }}
          >
            Projects
          </h1>
          <p className="mt-2 font-body text-sm" style={{ color: "var(--color-ink-tertiary)" }}>
            One project per integration. Each project has its own API key,
            origin allowlist, and optional webhook destination.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-[var(--radius-md)] font-medium text-sm border"
          style={{
            color: "var(--color-ink-primary)",
            background: "linear-gradient(135deg, #3F8CFF 0%, #5B8CFF 60%, #A682FF 100%)",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 24px -8px rgba(63,140,255,0.45)",
          }}
        >
          <Plus className="h-4 w-4" />
          Create project
        </button>
      </header>

      <div className="mt-10 space-y-4">
        {projects.length === 0 ? (
          <EmptyState onCreate={() => setModalOpen(true)} />
        ) : (
          projects.map((p) => <ProjectCard key={p.id} project={p} />)
        )}
      </div>

      {modalOpen && <CreateModal onClose={() => setModalOpen(false)} onSubmit={handleCreate} />}
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }): JSX.Element {
  return (
    <div
      className="rounded-[var(--radius-lg)] border-dashed border px-8 py-16 text-center"
      style={{ borderColor: "var(--color-line-medium)", background: "var(--color-surface-raised)" }}
    >
      <p
        className="font-display font-medium text-xl"
        style={{ color: "var(--color-ink-primary)" }}
      >
        No projects yet.
      </p>
      <p className="mt-2 font-body text-sm" style={{ color: "var(--color-ink-secondary)" }}>
        Spin one up and start signing requests.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 px-4 h-9 rounded-[var(--radius-sm)] font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{
          color: "var(--color-accent-electric)",
          border: "1px solid color-mix(in oklab, var(--color-accent-electric) 35%, transparent)",
          background: "color-mix(in oklab, var(--color-accent-electric) 8%, var(--color-surface-base))",
        }}
      >
        <Plus className="h-3 w-3" /> create project
      </button>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }): JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [revealed]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(project.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard denied */ }
  }

  const masked = "•".repeat(project.apiKey.length);

  return (
    <article
      className="rounded-[var(--radius-lg)] border px-6 py-5"
      style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-line-medium)" }}
    >
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display font-medium text-lg" style={{ color: "var(--color-ink-primary)" }}>
            {project.name}
          </h2>
          <p className="mt-1 font-body text-xs" style={{ color: "var(--color-ink-tertiary)" }}>
            Your secret API key for authentication
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            color: project.environment === "mainnet" ? "var(--color-accent-execute)" : "var(--color-accent-warn)",
            border: project.environment === "mainnet"
              ? "1px solid color-mix(in oklab, var(--color-accent-execute) 35%, transparent)"
              : "1px solid color-mix(in oklab, var(--color-accent-warn) 35%, transparent)",
            background: project.environment === "mainnet"
              ? "color-mix(in oklab, var(--color-accent-execute) 8%, var(--color-surface-base))"
              : "color-mix(in oklab, var(--color-accent-warn) 8%, var(--color-surface-base))",
          }}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full"
            style={{ background: project.environment === "mainnet" ? "var(--color-accent-execute)" : "var(--color-accent-warn)" }} />
          {project.environment.toUpperCase()}
        </span>
      </header>

      <div
        className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 max-w-full"
        style={{ background: "var(--color-surface-sunken)", borderColor: "var(--color-line-soft)" }}
      >
        <span className="font-mono text-[12px] tabular-nums truncate flex-1"
              style={{ color: revealed ? "var(--color-ink-primary)" : "var(--color-ink-tertiary)" }}>
          {revealed ? project.apiKey : masked}
        </span>
        <button
          type="button"
          aria-label={revealed ? "Hide key" : "Reveal key"}
          onClick={() => setRevealed((v) => !v)}
          className="grid place-items-center h-6 w-6 rounded transition-colors hover:text-[color:var(--color-ink-primary)]"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy"}
          onClick={() => void copy()}
          className="grid place-items-center h-6 w-6 rounded transition-colors hover:text-[color:var(--color-ink-primary)]"
          style={{ color: copied ? "var(--color-accent-execute)" : "var(--color-ink-tertiary)" }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      <p className="mt-4 font-body text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
        Keep this key secure. Do not share it in public repositories or
        client-side code. Reveal auto-hides after 30s.
      </p>

      {project.origins.length > 0 && (
        <p className="mt-3 font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          allowed origins: <span style={{ color: "var(--color-ink-secondary)" }}>{project.origins.join(", ")}</span>
        </p>
      )}
      {project.webhookUrl && (
        <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          webhook: <span style={{ color: "var(--color-accent-electric)" }}>{project.webhookUrl}</span>
        </p>
      )}
    </article>
  );
}

function CreateModal({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (p: Omit<Project, "id" | "apiKey" | "createdAt">) => void;
}): JSX.Element {
  const id = useId();
  const [name, setName] = useState("");
  const [env, setEnv] = useState<"devnet" | "mainnet">("devnet");
  const [origins, setOrigins] = useState("");
  const [webhook, setWebhook] = useState("");

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      environment: env,
      origins: origins.split(",").map((s) => s.trim()).filter(Boolean),
      webhookUrl: webhook.trim() || undefined,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[var(--radius-lg)] border p-6"
        style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-line-medium)" }}
      >
        <h2 id={`${id}-title`} className="font-display font-semibold text-xl"
            style={{ color: "var(--color-ink-primary)" }}>
          Create a project
        </h2>
        <p className="mt-2 font-body text-sm" style={{ color: "var(--color-ink-tertiary)" }}>
          You can rotate this project's API key any time later.
        </p>

        <label className="block mt-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Project name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Atlas integration"
            className="mt-2 w-full px-3 h-10 rounded-[var(--radius-sm)] border bg-transparent font-body text-sm outline-none focus:border-[color:var(--color-line-strong)]"
            style={{ color: "var(--color-ink-primary)", borderColor: "var(--color-line-soft)" }}
          />
        </label>

        <fieldset className="block mt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Environment
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["devnet", "mainnet"] as const).map((e) => {
              const on = env === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnv(e)}
                  className="px-3 h-9 rounded-[var(--radius-sm)] border font-mono text-[11px] uppercase tracking-[0.18em]"
                  style={{
                    color: on ? (e === "mainnet" ? "var(--color-accent-execute)" : "var(--color-accent-warn)") : "var(--color-ink-tertiary)",
                    borderColor: on
                      ? (e === "mainnet"
                          ? "color-mix(in oklab, var(--color-accent-execute) 40%, transparent)"
                          : "color-mix(in oklab, var(--color-accent-warn) 40%, transparent)")
                      : "var(--color-line-soft)",
                    background: on
                      ? (e === "mainnet"
                          ? "color-mix(in oklab, var(--color-accent-execute) 10%, var(--color-surface-base))"
                          : "color-mix(in oklab, var(--color-accent-warn) 10%, var(--color-surface-base))")
                      : "transparent",
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block mt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Allowed origins (CSV)
          </span>
          <input
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            placeholder="https://yoursite.com, https://staging.yoursite.com"
            className="mt-2 w-full px-3 h-10 rounded-[var(--radius-sm)] border bg-transparent font-mono text-[12px] outline-none"
            style={{ color: "var(--color-ink-primary)", borderColor: "var(--color-line-soft)" }}
          />
        </label>

        <label className="block mt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Webhook URL (optional)
          </span>
          <input
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="https://yoursite.com/webhooks/atlas"
            className="mt-2 w-full px-3 h-10 rounded-[var(--radius-sm)] border bg-transparent font-mono text-[12px] outline-none"
            style={{ color: "var(--color-ink-primary)", borderColor: "var(--color-line-soft)" }}
          />
        </label>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-9 rounded-[var(--radius-sm)] font-medium text-sm"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-[var(--radius-md)] font-medium text-sm border disabled:opacity-40"
            style={{
              color: "var(--color-ink-primary)",
              background: "linear-gradient(135deg, #3F8CFF 0%, #5B8CFF 60%, #A682FF 100%)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 24px -8px rgba(63,140,255,0.45)",
            }}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
