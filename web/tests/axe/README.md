# axe-core CI gate

WCAG 2.2 AA compliance is a Phase 24 §8 ship discipline. We don't
maintain a separate axe runner — the `e2e` Playwright project is the
gate. Every route added to `tests/playwright/golden-path.spec.ts`
gets:

- a title assertion (catches accidental layout breakage),
- an `AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()`
  scan that fails the build on any violation.

Adding a new public route? Append it to the `ROUTES` array in
`golden-path.spec.ts`. Operator surfaces (auth-gated) live in their
own spec files alongside the auth helper so a logged-in scan runs.

To run locally:

```bash
pnpm exec playwright test --project=e2e
```

Open `playwright-report/index.html` for an interactive trace if a
violation is reported.

## Manual checklist (axe doesn't catch)

- Focus order in the operator dashboard (tab through every shell).
- Live-region announcements on alert ingestion (verify with VoiceOver).
- Reduced-motion fallback for ZkLattice + Globe (toggle the OS
  preference, refresh the landing page; both should freeze).
