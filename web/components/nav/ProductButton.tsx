// Thin re-export — the new MegaMenu is self-contained (renders its
// own trigger + panel + state). HeaderBar already imports
// ProductButton, so we keep the import path stable while delegating
// to MegaMenu directly. No state, no props.

"use client";

import { MegaMenu } from "./MegaMenu";

export function ProductButton(): JSX.Element {
  return <MegaMenu />;
}
