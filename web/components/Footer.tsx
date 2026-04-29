export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-16 mt-32">
      <div className="glass rounded-2xl p-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="font-semibold mb-3">Atlas</div>
          <p className="text-[color:var(--color-muted)] leading-relaxed">
            Verifiable AI DeFi for Solana. Built for Frontier hackathon 2026.
          </p>
        </div>
        <Col title="Product" links={[
          { href: "/vaults", label: "Vaults" },
          { href: "/markets", label: "Markets" },
          { href: "/proofs", label: "Proof feed" },
          { href: "/how-it-works", label: "How it works" },
        ]} />
        <Col title="Developers" links={[
          { href: "https://github.com", label: "GitHub" },
          { href: "/docs", label: "Docs" },
          { href: "/api/actions/deposit", label: "Blinks API" },
        ]} />
        <Col title="Built on" links={[
          { href: "https://succinct.xyz", label: "SP1 zkVM" },
          { href: "https://solana.com", label: "Solana" },
          { href: "https://kamino.finance", label: "Kamino" },
        ]} />
      </div>
      <div className="text-center text-xs text-[color:var(--color-muted)] mt-8">
        © Atlas · Apache-2.0 · Frontier hackathon submission
      </div>
    </footer>
  );
}

function Col({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <div className="font-semibold mb-3">{title}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="text-[color:var(--color-muted)] hover:text-white transition">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
