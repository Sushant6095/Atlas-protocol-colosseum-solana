# Atlas — Hero Image Generation Prompts

> Use these prompts in **Midjourney v7**, **Flux Pro 1.1 Ultra**, **Imagen 4**, or
> **Sora-image** to produce the cinematic photoreal hero illustration for:
> - landing page hero (`/` on atlasfi.in)
> - OG image for social shares (1200 × 630)
> - Twitter banner (1500 × 500)
> - pitch deck cover slide
> - submission video end card

The vector logo ([`atlas-titan-cinematic.svg`](atlas-titan-cinematic.svg)) covers
favicon / app-icon / in-app uses. **The image-generation prompts below are for
the marketing-grade cinematic art**, not for the logo itself. Do not use AI-generated
imagery as the actual product logo — vector mark only.

---

## 1. Recommended — Midjourney v7

```
Cinematic concept art of Atlas the Greek titan kneeling under the cosmic weight,
muscular sculpted marble body with luminous cyan and violet circuit-vein patterns
glowing along the skin, holding aloft a translucent digital wireframe globe of
Earth made of glowing Solana-purple-blue-green grid lines and bright network
nodes connected by neon edges, multiple thin orbital rings around the globe like
a decentralized network, head bowed forward in stoic strain, classical Hellenistic
sculpture proportions with hyperreal anatomy, marble surface with subtle veining,
dramatic chiaroscuro rim lighting from above bathing the figure in cool blue glow,
deep cosmic space background with scattered stars, volumetric atmosphere,
ultra-detailed, octane render, 8k, dark navy and electric blue color grading
with magenta and emerald accent highlights, centered composition, isolated
silhouette, clean negative space around figure, minimal cinematic palette,
Apple keynote stage aesthetic, OpenAI brand vibe, ENPHASIS on cinematic mood
and structural strength --ar 3:4 --style raw --v 7 --stylize 250
```

**Why these parameters:**
- `--ar 3:4` is the master aspect for the hero. Re-roll at `--ar 16:9` for the Twitter banner, `--ar 1.91:1` for OG image, `--ar 16:10` for the deck cover.
- `--style raw` strips Midjourney's house-style overlay so the marble-realism reads correctly.
- `--v 7` is current; do **not** fall back to v6 (cyber-aesthetic on v6 is dated).
- `--stylize 250` gives controlled artistry — pushing higher (450+) breaks the marble realism toward concept-art-poster.

---

## 2. Alternate — Flux Pro 1.1 Ultra (sharper edges, more photographic)

```
A photoreal cinematic portrait of Atlas the Greek Titan, kneeling, both arms raised
overhead supporting a translucent holographic Earth made entirely of glowing
neon wireframe — purple, electric blue, and emerald gradient grid lines, with
white network node points connected by thin luminous edges, three orbital rings
around the globe at different tilts. The titan is hyperrealistic: sculpted marble
musculature with pale ivory skin, subtle blue veins glowing softly along the
shoulders, biceps, chest, and thighs, head bowed under the weight, classical
Greek sculpture proportions, intense controlled posture, no facial expression
visible. Lighting: dramatic top-down rim light from the globe casting the figure
in cool blue luminance, deep purple shadows, volumetric god-rays piercing the
darkness behind. Background: deep cosmic black with faint stars and a subtle
nebula gradient (#9945FF to #19B5FE to #14F195 atmospheric haze), no other
objects. Centered composition, isolated subject, generous negative space,
ultra-sharp, 8K, hyperdetailed.
```

**Settings:**
- Steps: 50
- Guidance: 3.5
- Output: 2048 × 2730 (3:4 ratio for hero)
- Re-render at 2048 × 1080 (≈ 16:9) for the banner

---

## 3. Alternate — Imagen 4 / Gemini 2.5 Image

```
Cinematic, photoreal, hyperdetailed: Atlas, the Greek Titan, kneeling in
classical Hellenistic sculpture pose, muscular marble body with subtle glowing
neon-blue circuit-vein patterns running along the major muscle groups, both
hands raised overhead, supporting a luminous translucent digital globe of Earth.
The globe is made of Solana-brand gradient wireframe grid (purple #9945FF →
blue #19B5FE → green #14F195), with bright white blockchain network node
points connected by thin neon edges, surrounded by three thin orbital rings at
different inclinations. Head bowed under the load. Setting: deep cosmic space,
scattered distant stars, very subtle nebula. Lighting: dramatic chiaroscuro,
cool rim light cascading from the globe down onto the figure, deep navy and
violet shadows. Centered composition, generous negative space, isolated subject.
Apple keynote / Stripe / OpenAI level minimalism. No text. No watermark. No
extra figures. 8K, ultra-sharp, cinematic color grade.
```

---

## 4. Negative prompts (apply to all of the above)

Add these to suppress the most common failure modes for "Greek god + cyberpunk + globe" prompts:

```
NEGATIVE: cartoonish, anime, chibi, child-like, lowpoly, blurry, soft focus,
oversaturated, neon-overload, multiple figures, crowd, deformed anatomy,
extra limbs, extra fingers, broken hands, jewelry, helmet, weapon, sword,
shield, beard exaggeration, hair flowing dramatically, robe, toga, fabric,
clothing, watermark, signature, text, logo, letters, words, frame, border,
collage, split screen, photoshop bevel, plastic skin, video-game render,
3d-printed look, low quality, jpeg artifacts, washed out, busy background,
clutter, particles, smoke, mist obscuring figure
```

---

## 5. Recommended file outputs and sizes

| Use | Aspect | Size | Generated by |
|---|---|---|---|
| Landing hero (above-the-fold) | 3:4 | 2048 × 2730 | hero prompt |
| OG image (social shares) | 1.91:1 | 1200 × 630 | re-roll with `--ar 1.91:1` |
| Twitter / X banner | 3:1 | 1500 × 500 | re-roll with `--ar 3:1`, crop tight |
| Pitch deck cover | 16:10 | 2560 × 1600 | re-roll with `--ar 16:10` |
| YouTube thumbnail | 16:9 | 1920 × 1080 | re-roll with `--ar 16:9` |
| Submission-video end card | 16:9 | 1920 × 1080 | same as YouTube |
| Apple App Store screenshot poster | 9:19.5 | 1290 × 2796 | re-roll with `--ar 9:19.5` |

Save each output to `web/public/brand/hero/` with descriptive names:

```
hero/
  atlas-hero-3x4.webp        ← landing
  atlas-hero-og-1200x630.webp
  atlas-hero-banner-1500x500.webp
  atlas-hero-deck-2560x1600.webp
  atlas-hero-yt-1920x1080.webp
  atlas-hero-ios-1290x2796.webp
```

WebP at quality 85 — good fidelity, ~70% smaller than PNG. AVIF is even smaller
but still has compatibility gaps; use WebP for now and let `next/image` serve
AVIF where supported.

---

## 6. Post-generation polish (every run)

After generation, do **three** edits before shipping the asset:

1. **Color grade** in Photoshop / Affinity Photo to lock the Solana gradient.
   Adjust hue → push purple toward `#9945FF`, blue toward `#19B5FE`, green
   toward `#14F195`. AI tools drift these colors; lock them by hand.

2. **Remove text artifacts.** Diffusion models occasionally hallucinate logos,
   words, or symbols on the globe. Erase them. Atlas's globe is purely
   geometric grid + nodes.

3. **Background cleanup.** Deepen blacks past `#0A0F2A`. Diffusion models
   often produce a slight blue cast in deep space — pull it down so the figure
   has clean negative space behind it. The figure must read against any
   dark surface in the product.

---

## 7. What this image is not

- **Not the logo.** Do not use the generated raster as a favicon, app icon, or
  inline mark. Those uses get the [vector mark](atlas-titan.svg) /
  [pictogram](atlas-pleiades.svg) only.
- **Not modifiable across surfaces.** Generate once, polish once, ship the
  six sizes. Do not re-generate weekly. The hero image is brand-stable.
- **Not used inside the operator UI.** Operator surfaces (Phase 23) use the
  vector mark and the [`@atlas/viz`](../../../docs/prompts/24-frontend-part-5-viz-realtime-distribution.md)
  components, never marketing illustration.

---

## 8. Image-prompt iteration log

Track outputs per prompt run so the best seed is reproducible:

```
runs/
  2026-05-07_mj7_run01.md     prompt + seed + ar + which size
  2026-05-07_mj7_run02.md     ...
```

When a winning render is locked, copy its prompt + seed + version into
`HERO-LOCKED.md` so it can be regenerated identically for variants.
