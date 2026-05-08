// Type shim for the verbatim React Bits ElectricBorder `.jsx`.

import type { CSSProperties, ReactNode } from "react";

export interface ElectricBorderProps {
  children?: ReactNode;
  color?: string;
  speed?: number;
  chaos?: number;
  thickness?: number;
  borderRadius?: number;
  className?: string;
  style?: CSSProperties;
}

declare const ElectricBorder: (props: ElectricBorderProps) => JSX.Element;
export default ElectricBorder;
