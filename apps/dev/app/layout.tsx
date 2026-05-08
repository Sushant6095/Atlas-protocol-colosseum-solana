import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ClusterPill } from "@/components/ClusterPill";
import { auth, isOAuthConfigured, signIn } from "@/auth";

export const metadata: Metadata = {
  title: "Atlas — Developer Console",
  description: "dev.atlasfi.in — keys, webhooks, observability.",
  metadataBase: new URL("https://dev.atlasfi.in"),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {user ? (
          <div className="flex min-h-screen">
            <Sidebar user={user} />
            <div className="flex-1 min-w-0">
              <header
                className="sticky top-0 z-20 flex items-center gap-4 px-8 h-12 border-b backdrop-blur-xl"
                style={{
                  borderColor: "var(--color-line-soft)",
                  background: "color-mix(in oklab, var(--color-surface-base) 80%, transparent)",
                }}
              >
                <ClusterPill />
                <div className="flex-1" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em]"
                      style={{ color: "var(--color-ink-tertiary)" }}>
                  v0.1 · alpha
                </span>
              </header>
              <main>{children}</main>
            </div>
          </div>
        ) : (
          <SignInGate oauthConfigured={isOAuthConfigured} />
        )}
      </body>
    </html>
  );
}

function SignInGate({ oauthConfigured }: { oauthConfigured: boolean }): JSX.Element {
  async function doSignIn(): Promise<void> {
    "use server";
    await signIn("github", { redirectTo: "/projects" });
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <section className="text-center max-w-md">
        <h1
          className="font-display font-medium tracking-[-0.02em] leading-[0.95]"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", color: "var(--color-ink-primary)" }}
        >
          Atlas Developer<br />
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>Console</span>
        </h1>
        <p className="mt-6 font-body text-base"
           style={{ color: "var(--color-ink-secondary)" }}>
          Manage API keys, webhooks, and request-inspector access for your
          Atlas integrations. Sign in with GitHub to get started.
        </p>
        {oauthConfigured ? (
          <form action={doSignIn} className="mt-10 inline-block">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 h-11 rounded-[var(--radius-md)] font-medium text-sm border"
              style={{
                color: "var(--color-ink-primary)",
                background: "linear-gradient(135deg, #3F8CFF 0%, #5B8CFF 60%, #A682FF 100%)",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 24px -8px rgba(63,140,255,0.45)",
              }}
            >
              Sign in with GitHub →
            </button>
          </form>
        ) : (
          <p className="mt-10 font-mono text-xs px-4 py-3 rounded-[var(--radius-md)] border inline-block max-w-[28rem]"
             style={{
               color: "var(--color-accent-warn)",
               background: "color-mix(in oklab, var(--color-accent-warn) 8%, var(--color-surface-base))",
               borderColor: "color-mix(in oklab, var(--color-accent-warn) 30%, transparent)",
             }}>
            GitHub OAuth not configured. Set <code>AUTH_SECRET</code>,
            <code> AUTH_GITHUB_ID</code>, <code>AUTH_GITHUB_SECRET</code>{" "}
            in <code>apps/dev/.env.local</code> to enable sign-in.
          </p>
        )}
      </section>
    </main>
  );
}
