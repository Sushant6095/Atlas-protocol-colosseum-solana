// <PhonePreview> — floating "iPhone" frame for the hero corner.
//
// Mirrors Lulo's product-shot floating phone in the right column of
// the landing hero. Pure CSS frame (rounded corners, notch, glass
// border). Children render inside a clipped 320×640 inner viewport
// so screenshots / live previews drop in without size math.

"use client";

import { memo, type ReactNode } from "react";
import { cn } from "./cn";

export interface PhonePreviewProps {
  children: ReactNode;
  scale?: number;
  className?: string;
}

function PhonePreviewImpl({ children, scale = 1, className }: PhonePreviewProps): JSX.Element {
  return (
    <div
      className={cn("relative", className)}
      style={{ transform: `scale(${scale})`, transformOrigin: "top right" }}
    >
      <div
        className="relative w-[320px] h-[640px] rounded-[44px] border-2 overflow-hidden"
        style={{
          background: "var(--color-surface-sunken)",
          borderColor: "var(--color-line-strong)",
          boxShadow: "0 32px 96px rgba(0,0,0,0.55), inset 0 0 0 6px var(--color-surface-base)",
        }}
      >
        <div
          aria-hidden
          className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-[110px] rounded-full"
          style={{ background: "var(--color-surface-base)" }}
        />
        <div className="absolute inset-3 rounded-[36px] overflow-hidden" style={{ background: "var(--color-surface-base)" }}>
          {children}
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[60px] blur-2xl"
        style={{ background: "color-mix(in oklab, var(--color-accent-electric) 8%, transparent)" }}
      />
    </div>
  );
}

export const PhonePreview = memo(PhonePreviewImpl);
