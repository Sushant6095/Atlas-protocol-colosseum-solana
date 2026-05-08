// Playwright config — Phase 24 §8.2.
//
// Two projects: `e2e` (golden-path smoke + a11y assertions) and
// `perf` (long-running scenarios that ship metrics to the perf gate).
// Both run against `pnpm dev` for hackathon scope; CI swaps to a
// production preview deploy.

import { defineConfig, devices } from "@playwright/test";

const isCi = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "e2e",  use: { ...devices["Desktop Chrome"] } },
    { name: "perf", use: { ...devices["Desktop Chrome"] }, testMatch: /.*\.perf\.spec\.ts/ },
    { name: "mobile", use: { ...devices["iPhone 14"] }, testMatch: /.*\.mobile\.spec\.ts/ },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
  expect: { timeout: 10_000 },
});
