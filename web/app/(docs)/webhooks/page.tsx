export default function Page() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-display text-[32px]">Webhooks</h1>
      <p className="text-[14px] text-[color:var(--color-ink-secondary)]">
        Atlas signs every webhook payload (HMAC + replay window). Phase 23
        wires the management UI; for now, see <a href="/docs/api">/docs/api</a>.
      </p>
    </article>
  );
}
