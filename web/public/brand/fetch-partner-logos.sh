#!/usr/bin/env bash
# Pull real partner logos using public favicon/asset endpoints.
# Run from atlas/web:  bash public/brand/fetch-partner-logos.sh
#
# Source chain per partner (first hit wins, ≥3 KB):
#   1. https://{domain}/favicon.svg
#   2. https://{domain}/logo.svg
#   3. https://{domain}/apple-touch-icon.png         (180×180 PNG, near-universal)
#   4. https://{domain}/apple-touch-icon-precomposed.png
#   5. https://icon.horse/icon/{domain}?size=large   (best-effort scrape)
#   6. https://www.google.com/s2/favicons?domain={domain}&sz=256
#
# Anything that 404s, 403s, or returns < 3 KB is logged so you can hand-source.
# We do NOT delete pre-existing files for a slug — manual overrides win.

set -euo pipefail

OUT="$(cd "$(dirname "$0")" && pwd)/protocols"
mkdir -p "$OUT"
LOG="$OUT/_fetch.log"
: > "$LOG"

UA="Mozilla/5.0 (atlas-build, +https://atlasfi.in)"
MIN_BYTES=3000

try_url() {
  local url="$1"
  local out_tmp="$2"
  local code
  code=$(curl -fsSL --max-time 10 -o "$out_tmp" \
    -w "%{http_code}|%{content_type}" \
    -H "User-Agent: $UA" \
    -H "Accept: image/svg+xml,image/*;q=0.9,*/*;q=0.5" \
    "$url" 2>/dev/null || echo "000|")
  echo "$code"
}

ext_from_ct() {
  case "$1" in
    *svg*)  echo "svg" ;;
    *png*)  echo "png" ;;
    *webp*) echo "webp" ;;
    *jpeg*|*jpg*) echo "jpg" ;;
    *) echo "" ;;
  esac
}

fetch_one() {
  local slug="$1"
  local domain="$2"

  # if we already have a manual override (any ext), skip
  for ext in svg png webp jpg; do
    if [[ -s "$OUT/$slug.$ext" ]]; then
      local sz
      sz=$(wc -c < "$OUT/$slug.$ext" | tr -d ' ')
      if [[ "$sz" -ge "$MIN_BYTES" ]]; then
        echo "[SKIP]  $slug  has-existing=$slug.$ext bytes=$sz" | tee -a "$LOG"
        return
      fi
    fi
  done

  local sources=(
    "https://${domain}/favicon.svg"
    "https://${domain}/logo.svg"
    "https://${domain}/apple-touch-icon.png"
    "https://${domain}/apple-touch-icon-precomposed.png"
    "https://icon.horse/icon/${domain}?size=large"
    "https://www.google.com/s2/favicons?domain=${domain}&sz=256"
  )

  local tmp
  tmp="$(mktemp)"

  for url in "${sources[@]}"; do
    local code http ct ext sz
    code=$(try_url "$url" "$tmp")
    http="${code%%|*}"
    ct="${code##*|}"

    if [[ "$http" != "200" ]]; then
      continue
    fi
    sz=$(wc -c < "$tmp" | tr -d ' ')
    if [[ "$sz" -lt "$MIN_BYTES" ]]; then
      continue
    fi
    ext=$(ext_from_ct "$ct")
    if [[ -z "$ext" ]]; then
      # last-ditch: sniff magic bytes
      if head -c 4 "$tmp" | grep -q "<svg\|<?xm"; then ext="svg"
      elif head -c 8 "$tmp" | grep -q $'\x89PNG'; then ext="png"
      else continue
      fi
    fi
    rm -f "$OUT/$slug.svg" "$OUT/$slug.png" "$OUT/$slug.webp" "$OUT/$slug.jpg" "$OUT/$slug.ico"
    mv "$tmp" "$OUT/$slug.$ext"
    echo "[OK]    $slug  ext=$ext  bytes=$sz  src=$url" | tee -a "$LOG"
    return
  done

  rm -f "$tmp"
  echo "[FAIL]  $slug  domain=$domain — no usable source. Hand-place $OUT/$slug.svg" | tee -a "$LOG"
}

# slug,domain — keep aligned with PoweredByMarquee.data.ts
PAIRS=(
  "solana solana.com"
  "succinct succinct.xyz"
  "anchor anchor-lang.com"
  "light-protocol lightprotocol.com"
  "helius helius.dev"
  "triton triton.one"
  "quicknode quicknode.com"
  "rpc-fast rpcfast.com"
  "pyth pyth.network"
  "switchboard switchboard.xyz"
  "birdeye birdeye.so"
  "dune dune.com"
  "kamino kamino.finance"
  "drift drift.trade"
  "jupiter jup.ag"
  "marginfi marginfi.com"
  "jito jito.network"
  "dflow dflow.net"
  "dodo dodopayments.com"
  "pusd paxos.com"
  "squads squads.so"
  "solflare solflare.com"
  "magicblock magicblock.gg"
  "tether tether.to"
  "bubblegum metaplex.com"
)

# slugs with no public domain — text-mark fallback in BrandLogo.tsx will handle these
SKIP=("pinocchio" "cloak")

echo "Fetching ${#PAIRS[@]} partner logos to $OUT" | tee -a "$LOG"
for pair in "${PAIRS[@]}"; do
  slug="${pair%% *}"
  domain="${pair#* }"
  fetch_one "$slug" "$domain"
done

echo "Skipped (no domain): ${SKIP[*]}" | tee -a "$LOG"
echo
echo "Done. Log: $LOG"
echo "FAIL entries above need a hand-placed SVG/PNG at $OUT/{slug}.svg"
