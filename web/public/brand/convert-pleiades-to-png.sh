#!/usr/bin/env bash
# Convert atlas-pleiades.svg → PNG at every size Atlas needs.
# One run, all sizes, transparency preserved.
#
# Usage:
#   chmod +x convert-pleiades-to-png.sh
#   ./convert-pleiades-to-png.sh
#
# Requires: rsvg-convert (install via `brew install librsvg`)

set -euo pipefail

SRC="atlas-pleiades.svg"
OUT_DIR="png"

if [[ ! -f "$SRC" ]]; then
  echo "✗ source SVG not found: $SRC"
  echo "  cd to the brand directory first: cd web/public/brand"
  exit 1
fi

if ! command -v rsvg-convert &>/dev/null; then
  echo "✗ rsvg-convert not found"
  echo "  install via: brew install librsvg"
  exit 1
fi

mkdir -p "$OUT_DIR"

# size_label : pixel_width
SIZES=(
  "favicon-16:16"
  "favicon-32:32"
  "favicon-48:48"
  "favicon-64:64"
  "favicon-128:128"
  "apple-touch-180:180"
  "android-192:192"
  "x-profile-400:400"
  "android-512:512"
  "app-icon-1024:1024"
  "hero-2048:2048"
)

echo "→ converting $SRC at ${#SIZES[@]} sizes..."
echo

for entry in "${SIZES[@]}"; do
  label="${entry%%:*}"
  size="${entry##*:}"
  output="$OUT_DIR/atlas-pleiades-${label}.png"
  rsvg-convert -w "$size" -h "$size" -o "$output" "$SRC"
  echo "  ✓ $output (${size}×${size})"
done

# OG image (1200×630, NOT square — center the mark on a transparent canvas)
OG="$OUT_DIR/atlas-pleiades-og-1200x630.png"
rsvg-convert -w 630 -h 630 -o /tmp/atlas-pleiades-og-square.png "$SRC"
# Pad to 1200x630 with transparent background using sips (built into macOS)
sips -p 630 1200 --padColor 00000000 /tmp/atlas-pleiades-og-square.png --out "$OG" >/dev/null 2>&1 || {
  # fallback: just emit the square version named for OG; you'll center it manually in Figma
  cp /tmp/atlas-pleiades-og-square.png "$OG"
  echo "  ⚠ OG padding skipped (sips unavailable). Center manually in Figma."
}
echo "  ✓ $OG (1200×630)"

# X banner (1500×500, centered)
BANNER="$OUT_DIR/atlas-pleiades-banner-1500x500.png"
rsvg-convert -w 500 -h 500 -o /tmp/atlas-pleiades-banner-square.png "$SRC"
sips -p 500 1500 --padColor 00000000 /tmp/atlas-pleiades-banner-square.png --out "$BANNER" >/dev/null 2>&1 || {
  cp /tmp/atlas-pleiades-banner-square.png "$BANNER"
  echo "  ⚠ banner padding skipped. Center manually in Figma."
}
echo "  ✓ $BANNER (1500×500)"

# Cleanup temp files
rm -f /tmp/atlas-pleiades-og-square.png /tmp/atlas-pleiades-banner-square.png

echo
echo "→ done. ${#SIZES[@]} square PNGs + 2 padded ones in $OUT_DIR/"
echo
echo "next steps:"
echo "  • favicon kit  → upload favicon-* files to https://realfavicongenerator.net"
echo "  • X profile    → upload atlas-pleiades-x-profile-400.png"
echo "  • app icons    → upload atlas-pleiades-app-icon-1024.png to https://icon.kitchen"
echo "  • OG image     → atlas-pleiades-og-1200x630.png (verify on metatags.io)"
echo "  • landing hero → atlas-pleiades-hero-2048.png"
