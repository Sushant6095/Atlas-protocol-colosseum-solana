export default function Page() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-display text-[32px]">Playground</h1>
      <p className="text-[14px] text-[color:var(--color-ink-secondary)]">
        Interactive console over <code className="text-mono">/api/v1/*</code> +
        live WebSocket subscriptions. Try the request → response loop without
        a build step.
      </p>
    </article>
  );
}
