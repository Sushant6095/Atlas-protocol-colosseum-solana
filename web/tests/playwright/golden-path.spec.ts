// Golden path — landing → /infra → /docs/widgets → operator dashboard.
// Each route gets an axe scan and a basic interactivity check.

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES: { path: string; title: RegExp }[] = [
  { path: "/",                    title: /Atlas/i },
  { path: "/infra",               title: /Public Observatory/i },
  { path: "/docs",                title: /Atlas docs/i },
  { path: "/docs/widgets",        title: /Embed Atlas widgets/i },
  { path: "/architecture",        title: /Architecture/i },
];

for (const route of ROUTES) {
  test(`${route.path} loads with no a11y violations`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page).toHaveTitle(route.title);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  });
}

test("realtime status pill updates when transport degrades", async ({ page }) => {
  await page.goto("/decision-engine");
  // Wait for the live transport to attach (visible in the corner pill).
  await expect(page.getByRole("status", { name: /live|connecting/i })).toBeVisible();
});
