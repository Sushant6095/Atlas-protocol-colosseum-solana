export function Footer() {
  return (
    <footer
      className="border-t mt-16"
      style={{ borderColor: "var(--color-line-soft)" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
        <p
          className="font-mono text-xs"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          ©  2026 Atlas. Sentinel companion. Apache-2.0.
        </p>
        <div className="flex flex-wrap items-center gap-5 font-mono text-xs">
          <a
            href="https://atlasfi.in"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80"
            style={{ color: "var(--color-accent-zk)" }}
          >
            atlasfi.in ↗
          </a>
          <a
            href="https://eitherway.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            Built on Eitherway ↗
          </a>
          <span style={{ color: "var(--color-ink-tertiary)" }}>
            Frontier 2026 · Colosseum
          </span>
        </div>
      </div>
    </footer>
  );
}
