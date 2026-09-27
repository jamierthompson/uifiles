# Fix round 3: common brief

Read, in order: `/docs/qa/round1/BRIEF-fix-common.md` (rules: file ownership, engineering, tests, do-not, report format) and `/docs/qa/round2/BRIEF-fix-common.md` (round-2 updates). Both apply. Round-3 specifics:

- The tree is green: 1,145 Vitest tests, 88 Playwright e2e (desktop + mobile), `pnpm typecheck`/`lint`/`format:check`/`registry:validate` clean, `pnpm build` passes. Keep every command you run on your files green.
- Round-3 QA reports: `/docs/qa/round3/{components-a,components-b,meta,rendered-surface}.md`. Reproducers: `tests/browser/qa-round3/{components-a,components-b}.test.tsx`, `tests/unit/qa-round3-{components-b,meta}.test.ts` (committed at `ca6f2fd`).
- A PRODUCTION server runs on :3000 (current build minus this round's changes); use it only for reading served HTML/CSS; do not start or stop servers; do not run build/dev/e2e/gate.
- Console guard: `tests/setup.ts` + `tests/console-guard.ts`; `allowConsole()` only in a test that asserts the console call; never `vi.spyOn(console, …).mockImplementation`.
- Registry manifests are off-limits to component fixers this round too; put exact `docs`/`description` replacement strings under `## Registry entry changes` in your report; a manifest stage applies them after all groups finish.
- Prove each fix with a test that failed first; mutation-check; run each changed test file three times; migrate the round-3 reproducers for your files into the canonical files (rename by behaviour) and delete the round-3 file when your prompt says you own it.
- Report to `/docs/qa/round3/fix-<lens>.md`.
