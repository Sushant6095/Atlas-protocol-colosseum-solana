// Partners orbiting the hero globe.
//
// Each entry binds one partner brand to:
//   - the SVG asset rendered as a billboarded sprite
//   - the orbit it travels on (radius + tilt)
//   - its starting angle, period, and direction
//   - the docs route opened when a viewer clicks the sprite
//
// Heads up — the SVG files in `public/brand/partners/` are
// PLACEHOLDER LETTER-MARKS. They are NOT the partner's real
// trademarked brand assets. Replace each one with the official
// monochrome white-on-transparent variant from the partner's brand
// kit before shipping marketing externally:
//
//   solana.svg    — https://solana.com/branding
//   succinct.svg  — https://succinct.xyz/brand
//   kamino.svg    — https://kamino.finance/brand
//   jupiter.svg   — https://jup.ag/brand
//   drift.svg     — https://drift.trade/brand
//
// Each replacement should be a square viewBox SVG with a white
// or coloured fill and a transparent background. Strokes set to
// `black` or fills set to `black` won't render on the dark globe.

export type OrbitDirection = "cw" | "ccw";

export interface GlobePartner {
  id: "solana" | "succinct" | "kamino" | "jupiter" | "drift";
  label: string;
  /** Asset path relative to the public/ root. */
  asset: string;
  /** Doc route opened when the sprite is clicked. */
  href: string;
  /** Orbit radius, world units. */
  radius: number;
  /** Tilt of the orbit plane, radians: [x, y, z] euler. */
  tilt: [number, number, number];
  /** Starting angle in degrees around the orbit. */
  startDeg: number;
  /** Seconds per full revolution. */
  periodSec: number;
  /** Travel direction. */
  direction: OrbitDirection;
}

export const GLOBE_PARTNERS: ReadonlyArray<GlobePartner> = [
  {
    id: "solana",
    label: "Solana",
    asset: "/brand/partners/solana.svg",
    href: "/docs/integrations/solana",
    radius: 1.5,
    tilt: [0.2, 0, 0],
    startDeg: 0,
    periodSec: 30,
    direction: "cw",
  },
  {
    id: "succinct",
    label: "Succinct",
    asset: "/brand/partners/succinct.svg",
    href: "/docs/integrations/succinct-sp1",
    radius: 1.7,
    tilt: [-0.2, 0.4, 0.3],
    startDeg: 72,
    periodSec: 25,
    direction: "ccw",
  },
  {
    id: "kamino",
    label: "Kamino",
    asset: "/brand/partners/kamino.svg",
    href: "/docs/integrations/kamino",
    radius: 1.85,
    tilt: [-0.4, 0.6, 0],
    startDeg: 144,
    periodSec: 22,
    direction: "ccw",
  },
  {
    id: "jupiter",
    label: "Jupiter",
    asset: "/brand/partners/jupiter.svg",
    href: "/docs/integrations/jupiter",
    radius: 2.0,
    tilt: [0.4, -0.2, -0.4],
    startDeg: 216,
    periodSec: 35,
    direction: "cw",
  },
  {
    id: "drift",
    label: "Drift",
    asset: "/brand/partners/drift.svg",
    href: "/docs/integrations/drift",
    radius: 2.2,
    tilt: [0.6, -0.3, 0.2],
    startDeg: 288,
    periodSec: 18,
    direction: "cw",
  },
];

/** Visible torus rings — orbits 1, 2, 3. Orbits 4 and 5 are
 *  invisible tracks that still carry sprites. */
export const VISIBLE_ORBIT_INDICES = [0, 2, 4] as const;
