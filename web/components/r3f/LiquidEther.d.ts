// Type shim for the verbatim React Bits `.jsx` component. Lets
// TypeScript imports resolve without converting the source.

import type { CSSProperties, ReactNode } from "react";

export interface LiquidEtherProps {
  mouseForce?: number;
  cursorSize?: number;
  isViscous?: boolean;
  viscous?: number;
  iterationsViscous?: number;
  iterationsPoisson?: number;
  dt?: number;
  BFECC?: boolean;
  resolution?: number;
  isBounce?: boolean;
  colors?: string[];
  style?: CSSProperties;
  className?: string;
  autoDemo?: boolean;
  autoSpeed?: number;
  autoIntensity?: number;
  takeoverDuration?: number;
  autoResumeDelay?: number;
  autoRampDuration?: number;
  children?: ReactNode;
}

declare const LiquidEther: (props: LiquidEtherProps) => JSX.Element;
export default LiquidEther;
