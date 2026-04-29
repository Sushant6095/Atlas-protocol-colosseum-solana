import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Navbar } from "@/components/Navbar";
import { TxToastHost } from "@/components/TxToast";

export const metadata: Metadata = {
  title: "Atlas — Verifiable AI DeFi for Solana",
  description:
    "Deposit USDC. AI rebalances across Kamino, Drift, Jupiter. Every move proven onchain via SP1 zkVM.",
  metadataBase: new URL("https://atlas.fyi"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <AmbientBackground />
          <Navbar />
          {children}
          <TxToastHost />
        </Providers>
      </body>
    </html>
  );
}
