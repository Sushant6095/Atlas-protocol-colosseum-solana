import Link from "next/link";
import { Github, Twitter, MessageCircle, Send } from "lucide-react";
import { FOOTER_COLUMNS, SOCIAL_LINKS, LEGAL_LINKS } from "./Footer.data";

const SOCIAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  github:   Github,
  twitter:  Twitter,
  discord:  MessageCircle,
  telegram: Send,
};

export function Footer() {
  return (
    <footer className="border-t border-line-medium bg-surface-base">
      {/* Top section — columns */}
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-12">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 lg:grid-cols-7">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="space-y-4">
              <h3 className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-ink-tertiary">
                {col.title}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body text-sm text-ink-secondary transition-colors hover:text-ink-primary"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="font-body text-sm text-ink-secondary transition-colors hover:text-ink-primary"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Brand block — sits below the columns */}
        <div className="mt-20 flex flex-col items-start gap-8 border-t border-line-soft pt-12 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent-electric via-accent-zk to-accent-proof" />
              <span className="font-display text-xl font-semibold text-ink-primary">
                Atlas
              </span>
            </Link>
            <p className="max-w-md font-body text-sm text-ink-tertiary">
              Autonomous, zk-verified treasury infrastructure for stablecoin
              capital on Solana. Trust the math, not the team.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => {
              const Icon = SOCIAL_ICON[social.icon] ?? Github;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-line-medium bg-surface-raised text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-line-soft">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-12">
          <p className="font-mono text-xs text-ink-tertiary">
            © 2026 Atlas. Open source under Apache-2.0.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            {LEGAL_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-ink-tertiary transition-colors hover:text-ink-secondary"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="font-mono text-xs text-ink-tertiary transition-colors hover:text-ink-secondary"
                >
                  {link.label}
                </Link>
              )
            )}
            <span className="font-mono text-xs text-ink-tertiary">
              Frontier 2026 · Colosseum
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
