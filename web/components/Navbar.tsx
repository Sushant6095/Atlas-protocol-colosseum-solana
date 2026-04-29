"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-4 z-50 mx-auto max-w-6xl px-4"
    >
      <div className="glass rounded-2xl px-5 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#29d3ff] glow-accent">
            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#29d3ff] blur-md opacity-50" />
            <span className="relative font-bold text-white">A</span>
          </span>
          <span className="text-gradient-subtle">Atlas</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/vaults">Vaults</NavLink>
          <NavLink href="/markets">Markets</NavLink>
          <NavLink href="/how-it-works">How it works</NavLink>
          <NavLink href="/proofs">Proofs</NavLink>
          <Link
            href="/vault"
            className="ml-3 rounded-lg bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] px-4 py-2 text-white text-sm font-medium hover:opacity-90 transition"
          >
            Launch app
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-[color:var(--color-muted)] hover:text-white hover:bg-white/5 transition"
    >
      {children}
    </Link>
  );
}
