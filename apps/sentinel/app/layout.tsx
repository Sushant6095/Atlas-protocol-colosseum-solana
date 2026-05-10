import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas Sentinel — yield + portfolio watcher",
  description:
    "Personal yield and portfolio command center for Solana DeFi. Kamino positions, Birdeye intelligence, Solflare-native. Companion to atlasfi.in.",
  openGraph: {
    title: "Atlas Sentinel",
    description: "Yield + portfolio watcher · Solana mainnet · Phase 0",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
