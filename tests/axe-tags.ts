/**
 * The axe rule tags every accessibility assertion in this repo runs: WCAG 2.0,
 * 2.1 and 2.2 at level AA plus axe's best-practice rules. Shared by the Vitest
 * browser helper (tests/a11y.ts) and the Playwright suite (e2e/), so it must
 * not import from either runner.
 */
export const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
]
