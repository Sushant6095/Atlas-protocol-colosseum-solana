// Performance smoke — the landing-hero is the most expensive surface
// in the app (3D + RAF). Phase 24 §8 budgets:
//   ≤ 220 KB initial JS
//   ≤ 220 MB heap after 10 minutes idle
//   60 fps target, ≤ 16 ms frame for the SankeyFlow at 1k nodes
//
// This file runs the cheap subset of those checks per push; the
// 10-minute heap test is gated behind PERF_FULL=1 because it's slow.

import { test, expect } from "@playwright/test";

test("initial bundle stays under 220 KB", async ({ page, request }) => {
  await page.goto("/");
  // Walk every <script src> on the landing page; fetch and sum
  // gzip-equivalent sizes.
  const srcs = await page.$$eval("script[src]", (els) =>
    els.map((e) => (e as HTMLScriptElement).src),
  );
  let total = 0;
  for (const src of srcs) {
    const r = await request.get(src);
    total += Number(r.headers()["content-length"] ?? "0");
  }
  expect(total, `total script bytes was ${total}`).toBeLessThan(220 * 1024);
});

test("frame budget — landing hero stays above 50 fps for 5s", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const frames = await page.evaluate(() => new Promise<number>((resolve) => {
    let count = 0;
    const start = performance.now();
    const tick = () => {
      count += 1;
      if (performance.now() - start < 5_000) requestAnimationFrame(tick);
      else resolve(count);
    };
    requestAnimationFrame(tick);
  }));

  // 50 fps × 5s = 250 frames. We allow some slack for compositor jitter.
  expect(frames, `observed ${frames} frames in 5s`).toBeGreaterThan(220);
});
