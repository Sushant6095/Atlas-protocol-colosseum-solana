// Class-name combiner. Re-exports `clsx` so component code never
// hits the import path directly — keeps a single shape for the lint
// rule that bans inline className concatenation.

import { clsx, type ClassValue } from "clsx";
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
