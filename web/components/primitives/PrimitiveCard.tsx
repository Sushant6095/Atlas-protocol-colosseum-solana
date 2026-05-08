import type { ReactNode } from "react";
import { WobbleCard } from "@/components/ui/wobble-card";

type Accent = "electric" | "zk" | "proof" | "execute" | "warn" | "danger";

const TOP_LINE: Record<Accent, string> = {
  electric: "via-accent-electric/60",
  zk:       "via-accent-zk/60",
  proof:    "via-accent-proof/60",
  execute:  "via-accent-execute/60",
  warn:     "via-accent-warn/60",
  danger:   "via-accent-danger/60",
};

const ICON_BG: Record<Accent, string> = {
  electric: "bg-accent-electric/10 text-accent-electric",
  zk:       "bg-accent-zk/10 text-accent-zk",
  proof:    "bg-accent-proof/10 text-accent-proof",
  execute:  "bg-accent-execute/10 text-accent-execute",
  warn:     "bg-accent-warn/10 text-accent-warn",
  danger:   "bg-accent-danger/10 text-accent-danger",
};

export function PrimitiveCard({
  title,
  description,
  accent,
  children,
}: {
  title: string;
  description: string;
  accent: Accent;
  children: ReactNode;
}) {
  return (
    // Aceternity WobbleCard wraps the article so cards drift toward
    // the cursor on hover. We override its default indigo bg + 20vh
    // padding via containerClassName/className to keep the existing
    // surface-base + 8px padding.
    <WobbleCard
      containerClassName="group bg-surface-base hover:bg-surface-raised border-r border-b border-line-medium rounded-none transition-colors"
      className="px-0 py-0"
    >
      <div className="relative flex h-full flex-col p-8">
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${TOP_LINE[accent]} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

        {/* anim canvas */}
        <div className="relative flex h-48 w-full items-center justify-center overflow-hidden">
          {children}
        </div>

        {/* divider */}
        <div className="my-6 h-px w-full bg-line-soft" />

        {/* footer */}
        <div className="flex items-start gap-3">
          <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${ICON_BG[accent]}`}>
            <span className="h-2 w-2 rounded-full bg-current" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-primary">
              {title}
            </h3>
            <p className="mt-2 font-body text-sm leading-relaxed text-ink-secondary">
              {description}
            </p>
          </div>
        </div>
      </div>
    </WobbleCard>
  );
}
