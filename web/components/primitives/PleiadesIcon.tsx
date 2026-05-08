// PleiadesIcon — Atlas's brand glyph rendered inline at 28px target.
//
// The constellation is the seven-stars-in-an-A motif: each star
// stands for one of the seven Atlas agents; the central halo is
// consensus; the apex is the verification point. Inline SVG keeps
// the mark crisp at any size and pulls fewer bytes than the
// `/brand/atlas-pleiades.svg` asset (which uses thinner 1.4
// strokes tuned for ≥48px display).
//
// Stroke-width is hand-tuned to 1.6 in a 32 viewBox for crisp
// rendering at the 28-32px header size. For larger displays the
// SVG remains vector-clean.

"use client";

import { memo } from "react";
import { cn } from "./cn";

export interface PleiadesIconProps {
  className?: string;
  /** Optional title for assistive tech. */
  title?: string;
}

function PleiadesIconImpl({ className, title = "Atlas" }: PleiadesIconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cn("flex-none", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      <defs>
        <linearGradient id="atlasPleiadesLine" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A682FF" />
          <stop offset="0.55" stopColor="#5B8CFF" />
          <stop offset="1" stopColor="#3F8CFF" />
        </linearGradient>
        <radialGradient id="atlasPleiadesConsensus" cx="16" cy="19" r="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#3F8CFF" />
          <stop offset="1" stopColor="#A682FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="atlasPleiadesApex" cx="16" cy="4" r="2.4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#3F8CFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* constellation skeleton — 1.6 stroke for crisp 28px rendering */}
      <g
        stroke="url(#atlasPleiadesLine)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      >
        {/* left leg: apex → upper-left → lower-left */}
        <line x1="16" y1="4"  x2="11" y2="14" />
        <line x1="11" y1="14" x2="6"  y2="26" />
        {/* right leg: apex → upper-right → lower-right */}
        <line x1="16" y1="4"  x2="21" y2="14" />
        <line x1="21" y1="14" x2="26" y2="26" />
        {/* crossbar through consensus star */}
        <line x1="11" y1="14" x2="16" y2="19" />
        <line x1="16" y1="19" x2="21" y2="14" />
      </g>

      {/* consensus halo (center of constellation) */}
      <circle cx="16" cy="19" r="5" fill="url(#atlasPleiadesConsensus)" />

      {/* apex halo (verification point) */}
      <circle cx="16" cy="4" r="2" fill="url(#atlasPleiadesApex)" />

      {/* seven stars — apex, two upper-mid, consensus, two lower-mid (mid-leg), base point */}
      <g fill="#E6EAF2">
        <circle cx="16" cy="4"  r="1.4" />
        <circle cx="11" cy="14" r="1.2" />
        <circle cx="21" cy="14" r="1.2" />
        <circle cx="16" cy="19" r="1.6" />
        <circle cx="6"  cy="26" r="1.2" />
        <circle cx="26" cy="26" r="1.2" />
        <circle cx="16" cy="26" r="1.0" opacity="0.55" />
      </g>
    </svg>
  );
}

export const PleiadesIcon = memo(PleiadesIconImpl);
PleiadesIcon.displayName = "PleiadesIcon";
