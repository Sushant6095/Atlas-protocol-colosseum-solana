"use client";

import { MARQUEE_ITEMS, type MarqueeItem } from "./PartnerMarquee.data";

const STATUS_DOT: Record<MarqueeItem["status"], string> = {
  live:   "bg-accent-execute",
  paused: "bg-ink-tertiary",
  warn:   "bg-accent-warn",
};

function MarqueeRow() {
  return (
    <div className="flex items-center gap-12 px-8">
      {MARQUEE_ITEMS.map((item, i) => (
        <div
          key={`${item.name}-${i}`}
          className="flex flex-shrink-0 items-center gap-3"
        >
          <span className="font-mono text-sm font-semibold text-ink-primary tabular-nums">
            {item.apy}
          </span>
          <span className={`relative inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[item.status]}`}>
            <span className={`absolute inset-0 rounded-full ${STATUS_DOT[item.status]} animate-ping opacity-75`} />
          </span>
          <span className="font-body text-xs text-ink-tertiary lowercase">
            {item.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PartnerMarquee() {
  return (
    <div
      className="relative w-full overflow-hidden border-b border-line-soft bg-surface-base/95 backdrop-blur"
      role="marquee"
      aria-label="Atlas partner protocols and live yields"
    >
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-surface-base to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-surface-base to-transparent" />

      <div className="group flex h-14 items-center">
        <div className="flex animate-marquee items-center [animation-duration:60s] motion-reduce:animate-none group-hover:[animation-play-state:paused]">
          <MarqueeRow />
          <MarqueeRow />
        </div>
      </div>
    </div>
  );
}
