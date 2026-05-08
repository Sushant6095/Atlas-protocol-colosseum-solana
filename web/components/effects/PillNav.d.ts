// Type shim for the verbatim React Bits PillNav `.jsx`.

import type { CSSProperties } from "react";

export interface PillNavItem {
  label: string;
  href: string;
  ariaLabel?: string;
}

export interface PillNavProps {
  logo: string;
  logoAlt?: string;
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  onMobileMenuClick?: () => void;
  initialLoadAnimation?: boolean;
  style?: CSSProperties;
}

declare const PillNav: (props: PillNavProps) => JSX.Element;
export default PillNav;
