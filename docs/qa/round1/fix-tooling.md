# fix-tooling

Lens: tooling. Files touched are listed under "Commands run › files". The lead's WIP checkpoint
`3c53816` already holds most of this slice; the later deltas are `tests/setup.ts` (singleton guard),
`tests/browser/a11y-helper.test.tsx` (selector regex), `tests/unit/workflows.test.ts` +
`tests/unit/tooling.test.ts` (new), `vitest.config.ts` (`reportOnFailure`), `package.json` +
`pnpm-lock.yaml` (`^5.0.2` for coverage-v8, `katex`), `registry/ai/registry.json` (`cmdk@^1` on
model-selector), `components/ui/scroll-area.tsx` (one import).

Misrouted coordinator notes: I did not edit `app/globals.css`, `docs/architecture.md` or
`CHANGELOG.md`. The only thing I did on the KaTeX note was add `katex@^0.16` to `package.json`
(mine): `katex` is not hoisted from pnpm's store (`node_modules/katex` did not exist), so the
tokens fixer's `@import "katex/dist/katex.min.css"` cannot resolve without it. It now does. If that
import never lands, `pnpm remove katex` reverts it.

## Fixed

- registry-contract:F1 — every item whose file imports `"cn"` declares it (18 `registry/ai` items,
  `chat` block; inserted at the sorted position among unscoped names) — `registry/ai/registry.json`,
  `registry/blocks/registry.json` — test: `tests/unit/registry.test.ts` › "every bare package a
  registry file imports is declared in the item's dependencies" (failed before: `expected [ 19 ×
  '<item> imports "cn"' ] to deeply equal []`; passes after; `pnpm registry:validate` → "Registry is
  valid. Checked 8 registry files and 83 items"). Same test caught that the model-selector fixer now
  imports `defaultFilter` from `cmdk` (`registry/ai/model-selector.tsx:56`): I added `"cmdk@^1"` to
  that item (package.json has `cmdk@^1.1.1`); see "Registry entry changes".
- registry-contract:F4 / app-tooling-oss:F3+F6 — `registry/ai/upstream.lock.json` keys exactly the
  18 shipped items: dropped `conversation`, `shimmer`, `message`; added `branch` and `response`
  with `source` = upstream `message.json` and the former `message` sha, plus an `"upstream":
  "message"` field naming the file they were extracted from. `scripts/sync-upstream.ts` documents
  that structure in its header, fetches each distinct `source` once (17 fetches for 18 entries),
  and exits 0 unchanged / 1 changed / 2 missing-or-unreachable (404 vs other status vs thrown
  `fetch`, each listed under its own heading). `.github/workflows/upstream-diff.yml`: `shell:
  bash`, `set +e` + `code=$?` (no pipe), report to `$GITHUB_STEP_SUMMARY`, issue step only on
  `code == '1'`, `getLabel`→`createLabel` when the `upstream` label is missing, `listForRepo`
  (open, label) → `createComment`, else `issues.create`; `permissions: contents: read, issues:
  write`; concurrency; timeout; SHA-pinned actions. — tests: `tests/unit/registry.test.ts` › "keys
  exactly the shipped registry/ai items" (failed before: `+conversation,message,shimmer /
  -branch,response`; passes after) and › "records the upstream source, its sha256 and a fetch date;
  extracted items name their upstream file"; `tests/unit/workflows.test.ts` › "runs the script
  under bash and captures its exit code without a pipe", › "files a report only when a source
  changed (exit 1)…", › "comments on an open `upstream` issue before creating one, and creates the
  label when missing" (the old QA file's two upstream-diff tests failed before; these pass after).
  Script exit codes proven with a stubbed `fetch` (`MODE=match` → `Upstream unchanged.` exit 0;
  `changed` → exit 1; `missing` → 404 list, exit 2; `error` → "Upstream unreachable", exit 2;
  `mixed` → `ai/tool` changed + `ai/task (404)` + `ai/plan (fetch failed)`, exit 1). `node
  scripts/sync-upstream.ts` runs under Node 24 type stripping (only erasable syntax).
- registry-contract:F8 — the four guarded invariants plus F7's, all in `tests/unit/registry.test.ts`:
  every `@uifiles/<name>` names an item; every bare dependency is one of the `registry:ui` names
  (derived from `registry/ui/registry.json`) or `utils`/`font-*`; no two items share a `target`;
  every declared npm dependency is in package.json at the same major (and ≥ minor when pinned);
  cross-item `@/registry/ai/<x>` imports resolve to a declared `@uifiles` dependency (models the
  CLI's basename repair). The bare-vs-fork rule is now non-vacuous: the rule is a function tested
  on the real registry (0 violations) and on a clone with `button` forked (≥ 8 violations incl.
  `branch -> button`).
- registry-contract:F9 — `scripts/generate-aliases.ts` keeps upstream `title` and falls back to
  `titleCase()` with a `TITLES` override map (`input-otp` → "Input OTP"); `registry/ui/registry.json`
  title fixed by hand (one-line diff). Proven with a stubbed upstream index: `button -> "Button"`
  (upstream title kept), `hover-card -> "Hover Card"`, `input-otp -> "Input OTP"`; with the
  override deleted the same run prints `Input Otp` (mutation M4).
- test-quality:F4 — `playwright.config.ts` reporter is `[["github"], ["html", { open: "never" }]]`
  in CI; CI uploads `playwright-report`, `test-results` (traces) and `.vitest/attachments` on
  failure with `if-no-files-found: ignore` and an attempt-suffixed artifact name (v4 rejects
  duplicate names on re-runs) — tests: `tests/unit/tooling.test.ts` › "serves the production build
  with the github and html reporters…", `tests/unit/workflows.test.ts` › "uploads the Playwright
  HTML report and traces when a step fails".
- test-quality:F5 / app-tooling-oss:F10.4 — `webServer.command` is `pnpm start` in CI (after
  `pnpm build`) and `pnpm registry:build && pnpm dev` locally; `reuseExistingServer: !CI` —
  test: `tests/unit/tooling.test.ts` (both branches, module re-imported with `CI` stubbed/unset).
- test-quality:F9 — `networkidle` replaced by `gotoHydrated()` in `e2e/helpers.ts`: `load` →
  `main` visible → `waitForFunction` for React's `__reactFiber$…` key on `<main>` (React attaches
  it to a host node when it hydrates it; the App Router records no `Next.js-hydration`
  performance measure, that mark lives only in the pages-router client
  `node_modules/next/dist/client/index.js:329`) → `document.fonts.ready` → finite animations
  finished. `workers: 2` and `retries: 1` in CI. Probed on the running dev server: the fiber key
  appears ~100 ms after `load` on `/preview/tool`.
- test-quality:F6 (e2e half) — every preview and the home page run in light and dark
  (`page.emulateMedia({ colorScheme })`, asserted via next-themes' `html.dark`/`html.light` class)
  with `AxeBuilder.options({ rules: { "target-size": { enabled: true } } }).withTags(AXE_TAGS)`
  (`options()` replaces the whole option object, so it precedes `withTags()`:
  `@axe-core/playwright/dist/index.mjs:135,160`); console `error`/`warning` and `pageerror` are
  collected from before navigation and asserted empty, nothing allow-listed. `AXE_TAGS` moved to
  `tests/axe-tags.ts` (no runner imports) and re-exported from `tests/a11y.ts`, whose API is
  unchanged. 44 e2e tests collect (`playwright test --list`).
- test-quality Coverage plan 12 — `e2e/chat-keyboard.spec.ts`: Tab to the composer, type, Enter,
  wait for the stream (`waitForIdle`: `[aria-busy="true"]` gone, then 1.1 s for Reasoning's
  auto-close, then animations), Shift+Tab to the `readFile` tool header, Enter → `aria-expanded`
  true and "Parameters" visible; zero console problems. Walked step by step on the dev server with
  a standalone Playwright script: 10 Tabs reach the textbox, the value clears on Enter, 3
  Shift+Tabs reach the header, `aria-expanded` flips, `problems: []`.
- test-quality:F7 — `tsconfig.json` enables `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noUnusedLocals`; my files are clean (`scripts/generate-aliases.ts` destructures `matchAll`
  results and uses `charAt(0)`); remaining errors are listed under "Strict-flag typecheck".
  `components/ui/scroll-area.tsx:5` (vendored) had an unused `import * as React`: removed, as the
  coordinator allowed, and `noUnusedLocals` stays on because it is what surfaced
  `registry/ai/reasoning.tsx:143 'timer' is declared but never read` in a file consumers copy;
  Biome's `noUnusedImports` is off for `components/ui/**` and cannot see unused locals at all.
- test-quality:F12 / app-tooling-oss:F10 — `.github/workflows/ci.yml`: `permissions: contents:
  read`, `concurrency: ci-${{ github.ref }}` + cancel-in-progress, `timeout-minutes: 30`, every
  action pinned to a 40-hex SHA with `# vN` (verified with `git ls-remote`; note
  `pnpm/action-setup@v4` is an annotated tag: the QA report's `f40ffcd9…` is the tag object, the
  commit is `b906affc…`, which is what `uses:` needs), `pnpm audit --prod --audit-level=high`,
  Playwright browsers cached on `~/.cache/ms-playwright` keyed by `playwright/package.json`
  version (`install --with-deps` on miss, `install-deps` on hit), `pnpm test:coverage`, `pnpm
  build`, `git diff --exit-code -- registry` (fails when `sync-tokens` had to rewrite
  `registry/base/registry.json`), `pnpm test:e2e` against the build, `env: CI: "true"` and
  `NEXT_PUBLIC_BASE_URL: https://uifiles.dev` (so the build matches production and the e2e
  "no localhost" assertions are live) — tests: `tests/unit/workflows.test.ts` (6 for ci.yml; the
  old QA "least-privilege permissions and a timeout" test failed before). `.github/dependabot.yml`:
  weekly `github-actions` and `npm`, npm minor+patch grouped (`update-types: ["minor", "patch"]`
  is the schema's enum) — test › "updates GitHub Actions and npm weekly…".
- test-quality Coverage plan 7 — `tests/setup.ts` (browser `setupFiles`): wraps `console.error`/
  `console.warn` per test and throws at the end with the messages; `allowConsole(...levels)` opts
  one test out. One guard lives on `globalThis` because Vitest loads the setup file twice in the
  browser (as setup file and via a test's `@/tests/setup` import) — that was the cause of the
  first run's failure of my own opt-out test. — tests: `tests/unit/test-setup.test.ts` (5, on a
  fake console), `tests/browser/a11y-helper.test.tsx` › "allowConsole() lets a test that asserts a
  warning log it"; a throwaway browser file calling `console.error("boom")` failed with `Console
  output during the test … console.error: boom from the probe` while its silent sibling passed (M6).
- test-quality:F3/F6 (helper behaviour) — `tests/browser/a11y-helper.test.tsx` (11): `settle()`
  resolves in < 1.5 s with a spinner on the page and waits for a finite `animate-in`; `runAxe()`
  reports `target-size` on two 10 px buttons where plain `axe.run()` does not, `describeViolations`
  formats it, `expectNoViolations()` rejects with it and passes a clean landmark; `withDark()`
  adds/removes the class, also when `fn` throws; cleanup removes a portaled hover-card popup
  synchronously; a whole-body axe run passes right after a hover test once the pointer leaves the
  trigger (`userEvent.unhover`, the F10 flake cause); locator `exact` default pinned. Note from the
  mutation check: with `runOnly` by tag axe runs `target-size` because it carries `wcag22aa`
  regardless of its default `enabled: false` (`node_modules/axe-core/axe.js:20569-20580`,
  `ruleShouldRun`); the explicit `rules` entry in `runAxe`/`expectNoAxeViolations` is a safeguard,
  and removing both fails the tests (M5b).
- test-quality Coverage plan 5 — `@vitest/coverage-v8@^5.0.2` (same spec as `vitest`),
  `coverage: { provider: "v8", include: ["registry/**/*.{ts,tsx}", "lib/**/*.ts"], exclude:
  ["registry/**/page.tsx"], reporter: ["text", "json-summary"], reportOnFailure: true, thresholds:
  { perFile: true, … } }`, script `test:coverage`, run in CI. Numbers and the threshold decision
  are under "Coverage numbers".
- app-tooling-oss:F12 (config part) — `next-themes` and every other bare package
  `registry/**`, `components/**` and `tests/browser/**` import are in `optimizeDeps.include`
  (`cn`, `class-variance-authority`, `lucide-react`, `ai`, the Base UI `button`/`input`/
  `merge-props`/`separator`/`use-render` subpaths) — test: `tests/unit/test-setup.test.ts` ›
  "lists every other bare package …" (fails the moment a new import is added without listing it)
  and › "names only installed packages".
- app-tooling-oss:F16 — `package.json`: `version 0.1.0`, `description`, `license: MIT`, `author`,
  `homepage`, `repository` (`git+https://github.com/jamierthompson/uifiles.git`), `bugs`; `shadcn`
  moved to `devDependencies` (`pnpm registry:validate` still works via `pnpm exec`); `.npmrc`
  `engine-strict=true` — test: `tests/unit/tooling.test.ts` (3).
- test-quality Coverage plan 8/14 — `tests/unit/ssr.test.ts` (21): every `registry/ai` export set
  and the chat block `renderToString` in node without `window`, plus the prompt-input header/
  `"use client"` and composer SSR pins; `tests/unit/registry.test.ts` also keeps: every
  `registry/ai/*.tsx` has a browser test and a preview; every item with files has a preview; every
  preview is an item; built `public/r/registry.json` validates with `registrySchema`, carries no
  file `content` and lists exactly `loadRegistry()`; every `public/r/<name>.json` validates with
  `registryItemSchema`, matches its name and carries content; `/llms.txt` (route `GET()` called
  directly) lists every item's link and description; descriptions are sentences ≥ 40 chars.

## Not fixed and why

- registry-contract:F6 (say "Base UI only" in the directory description / item docs; `toast`
  alias is Base-only upstream) — description text is the lead's/registry owner's call; the
  directory entry below keeps the QA wording, which already says "on Base UI". Recommend adding
  "Base UI only" to every `registry/ai` item's `docs` (component fixers report those).
- registry-contract:F2 / app-tooling-oss:F5 (README `#v1.0.0` pin, no tag) — README not mine.
  Recommend tagging `v0.1.0` (package.json now says 0.1.0) and using `#v0.1.0` in the example.
- test-quality:F8 (docs promise tooling) — `docs/**`, `AGENTS.md` not mine; needs listed under
  "Requests for other owners".
- test-quality Coverage plan 10, `toHaveScreenshot` per preview — not added. Baselines would be
  generated on this container's Chromium/Linux text rasteriser and compared on GitHub's
  `ubuntu-latest`; even with self-hosted Geist (deterministic), subpixel antialiasing and
  hinting differ across distros/GPUs, so the first CI run would fail on every snapshot. Add it
  only with baselines generated in CI (`--update-snapshots` in a workflow) or with a Docker
  runner both sides.
- test-quality Coverage plan 11, second browser instance at 1280×800 — not added. Measured once
  under the new config: the whole browser suite as it stands (27 files, 739 tests, including the
  four other lenses' `tests/browser/qa-round1/*.tsx` still being migrated) took 532 s and is red
  (67 failures in other fixers' in-progress files). Doubling that is not "reasonable time" today;
  when the suite is green and the qa-round1 files are gone, add
  `{ browser: "chromium", viewport: { width: 1280, height: 800 } }` as a second instance and
  re-measure (see "Coverage numbers" for the canonical-suite duration).
- test-quality:F10 (context.test.tsx scoping) — the file belongs to the context fixer; the helper
  test proves the whole-body run is fine after `userEvent.unhover`.
- test-quality:F13/F14, F1/F2 (component tests) — component fixers.

## Tests

- `tests/unit/registry.test.ts`: 4 tests before → 22 after (13 migrated from
  `qa-round1-registry-contract`, 8 from `qa-round1-test-quality`, F11 strengthening).
- `tests/unit/ssr.test.ts` (new): 21 (19 from `qa-round1-test-quality`, 2 from
  `qa-round1-prompt-input`).
- `tests/unit/test-setup.test.ts` (new): 7. `tests/unit/workflows.test.ts` (new): 11 (3 ported from
  `qa-round1-app-tooling-oss`, strengthened). `tests/unit/tooling.test.ts` (new): 5.
- `tests/browser/a11y-helper.test.tsx` (new): 11 (4 migrated from `qa-round1/test-quality`: settle,
  cleanup ×2, locator; its 2 dark-mode component pins skipped for the component fixers; 7 new).
- Deleted: `tests/unit/qa-round1-registry-contract.test.ts`, `tests/unit/qa-round1-test-quality.test.ts`,
  `tests/unit/qa-round1-prompt-input.test.ts`, `tests/browser/qa-round1/test-quality.test.tsx`.
- `e2e/`: 5 tests before → 44 after (`playwright test --list`), not run here (forbidden); validated
  by `--list`, by `tsc`, and by a standalone Playwright probe against the running dev server.
- Upstream tests ported: n/a (no component ownership).
- Mutation checks (fix → test that caught it):
  - M1 drop `cn` from `image` → registry.test.ts › "every bare package…": `expected [ 'image imports
    "cn"' ] to deeply equal []`.
  - M2 add a `shimmer` key to the lock → › "keys exactly the shipped registry/ai items" fails.
  - M3 `guard.stop()` never throws → test-setup.test.ts: 3 failures.
  - M4 delete the `input-otp` override → stubbed generate-aliases prints `Input Otp`.
  - M5 drop only the explicit `target-size` enable → helper tests still pass (tag `wcag22aa` runs
    it; see axe `ruleShouldRun`). M5b drop `wcag22aa` and the enable → 2 helper tests fail
    (`expected [] to include 'target-size'`).
  - M6 throwaway browser test with an unallowed `console.error` → fails through `tests/setup.ts`.
  All mutations restored byte-identical (`cmp` against backups).
- Three consecutive runs of `tests/browser/a11y-helper.test.tsx` (after the singleton fix):
  `Test Files 1 passed (1) / Tests 11 passed (11)` ×3 (6.98 s, 3.21 s, 4.70 s).
- Unit project: `pnpm exec vitest run --project unit` → 7 files, all green (mine: 66 tests;
  others' `site.test.ts`, `tokens.test.ts` also pass with my changes).

## Registry entry changes (applied, since the `cn` change is mine and F1's test must pass)

- every `registry/ai` item › dependencies: `"cn"` added (see the diff; arrays keep their order).
- chat › dependencies: `["ai@^7", "@ai-sdk/react@^4", "@shadcn/helpers@^0.2", "cn", "lucide-react"]`.
- model-selector › dependencies: `["cmdk@^1", "cn"]` — `cmdk@^1` added because
  `registry/ai/model-selector.tsx` now imports `defaultFilter` from `cmdk`; the model-selector
  fixer's report should carry the same line.
- input-otp (registry/ui) › title: `"Input OTP"`.

## Requests for other owners

- `tests/browser/blocks/chat.test.tsx` (chat fixer): under the console guard these fail with
  React's `console.error` "You seem to have overlapping act() calls": › "ChatComposer > disables
  nothing inside the input group in any status" and › "ChatToolPart > renders every state with its
  label for static and dynamic tools while streaming" — await each `render`/`rerender` before the
  next. Also 7 strict-tsc errors (`chat.test.tsx:1105,1122,1129,1137,1198,1546,1553`: a `RegExp`
  passed where `string | number` is expected).
- `tests/browser/qa-round1/code-context-model-citation.test.tsx` (code-block fixer): › "code-block >
  an unknown language falls back to plain text and reports the error" logs the error it asserts;
  call `allowConsole("error")` from `@/tests/setup` at the top of that test (or assert via
  `onError` without logging).
- `tests/browser/qa-round1/chat-block-and-leaves.test.tsx` (chat/leaves fixer): 3 strict-tsc
  errors (`:1169`, `:1177` `{ name: string | undefined }`; `:1219` `alt` missing on Image).
- `app/globals.css` (tokens fixer): `katex@^0.16` is a direct dependency now, so
  `@import "katex/dist/katex.min.css"` resolves.
- `AGENTS.md` / `docs/porting-ai-elements.md` / `docs/architecture.md` (docs owner): document
  `pnpm test:coverage` (thresholds per file), `tests/a11y.ts` (`expectNoViolations`, `runAxe`,
  `settle`, `withDark`) and `tests/setup.ts` (`allowConsole`) as the only way to assert a11y and
  the console policy; the lock structure (`upstream` field for extracted items) and the
  sync-upstream exit codes 0/1/2; `e2e/helpers.ts` (`gotoHydrated`, `waitForIdle`,
  `expectNoAxeViolations`, `collectPageProblems`) as the way to write e2e; CI sets
  `NEXT_PUBLIC_BASE_URL=https://uifiles.dev`; `pnpm gate` does not run e2e, CI does; a
  `CHANGELOG.md` bullet for 0.1.0 tooling (coverage, console guard, dark-mode e2e, hardened CI).
- Lead / repo settings: after the first green run, protect `main` on the `gate` job; the
  `upstream` label is created by the workflow itself on first drift.

## Strict-flag typecheck

- Errors remaining in files I own: none (`pnpm exec tsc --noEmit` with the three flags now in
  `tsconfig.json`).
- Errors in files I do not own: none at my final check (`pnpm exec tsc --noEmit` exit 0). At the
  start of my run there were 16 outside the qa files; `components/ui/scroll-area.tsx:5` was
  fixed by me (the single vendored edit), and the last 10 (`tests/browser/blocks/chat.test.tsx`
  ×7, `tests/browser/qa-round1/chat-block-and-leaves.test.tsx` ×3) were fixed by their owners
  while I worked. Re-run `pnpm typecheck` at gate time, since other slices are still moving.
- `pnpm lint` (biome, whole repo): clean at the time of writing.

## Directory entry

For `apps/v4/registry/directory.json` in shadcn-ui/ui (alphabetical; validated by the QA lens
against `registryDirectoryEntrySchema`: strict object, `url` must contain `{name}`, `logo` inline
SVG using `var(--foreground)`). Replace the placeholder logo before submitting.

```json
{
  "name": "@uifiles",
  "homepage": "https://uifiles.dev",
  "url": "https://uifiles.dev/r/{name}.json",
  "description": "A shadcn/ui registry on Base UI: every shadcn/ui primitive under one namespace, AI chat and agent components ported from Vercel AI Elements, and a registry:base design system with the uifiles tokens.",
  "author": "Jamie Thompson",
  "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='var(--foreground)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><path d='M14 2v6h6'/><path d='M9 13v4'/><path d='M12 11v6'/><path d='M15 15v2'/></svg>"
}
```

Prerequisites (from registry-contract): deploy with the public origin set (now derived on Vercel
by the site fixer), public repo, `cn` declared (done), optionally "Base UI only" in the description.

## Workflow YAML validation (e2e/CI not run here)

- `actionlint` 2.0.6 (the npm package ships the linter as WASM with a Node API; the GitHub
  release binary is unreachable through the proxy): `ci.yml` 0 problems, `upstream-diff.yml` 0
  problems.
- SchemaStore `github-workflow.json` and `dependabot-2.0.json` (fetched from
  raw.githubusercontent.com) through `ajv`: all three files VALID.
- GitHub docs `workflow-syntax.md` fetched for the `shell: bash` → `-eo pipefail` rule and
  `timeout-minutes`; each pinned action's `action.yml` fetched to record the runtime
  (`checkout@v5`, `setup-node@v5`, `github-script@v8` = node24; `cache@v4`, `upload-artifact@v4`,
  `pnpm/action-setup@v4` = node20) and `upload-artifact`'s `if-no-files-found` default.
- `git ls-remote` for every SHA (listed in the YAML comments).

## Remaining tsc errors by file

- None at the final check (`pnpm exec tsc --noEmit` → exit 0, 0 `error TS` lines). Earlier in the
  round: `tests/browser/blocks/chat.test.tsx` (7) and
  `tests/browser/qa-round1/chat-block-and-leaves.test.tsx` (3), since fixed by their owners.

## Coverage numbers

`pnpm exec vitest run --coverage tests/unit tests/browser/ai tests/browser/blocks tests/browser/a11y-helper.test.tsx tests/browser/button.test.tsx`
(the canonical suite: the four other lenses' `tests/browser/qa-round1/*.tsx` excluded because they
are being migrated and deleted). 28 files, 965 tests, 178 s; 45 failures in 8 other fixers'
in-progress files (`reportOnFailure: true` so the report is still written). v8, `include:
registry/**/*.{ts,tsx}, lib/**/*.ts`, `exclude: registry/**/page.tsx`:

| file | lines | functions | branches |
| --- | ---: | ---: | ---: |
| registry/blocks/chat/components/blocks/chat.tsx | 94.04 | 97.05 | 92.74 |
| registry/ai/sources.tsx | 94.73 | 100 | 95.45 |
| registry/ai/prompt-input.tsx | 98.06 | 96.80 | 91.80 |
| lib/registry.ts | 100 | 100 | 83.78 |
| registry/ai/branch.tsx | 100 | 86.36 | 71.79 |
| registry/ai/code-block.tsx | 100 | 98.24 | 87.09 |
| registry/ai/response.tsx | 100 | 100 | 88.88 |
| registry/ai/inline-citation.tsx | 100 | 100 | 94.59 |
| registry/ai/context.tsx | 100 | 100 | 95.45 |
| registry/ai/reasoning.tsx | 100 | 100 | 97.43 |
| 12 other files (chain-of-thought, checkpoint, confirmation, image, model-selector, plan, queue, suggestion, task, tool, demo-conversation.ts, lib/utils.ts) | 100 | 100 | 100 |
| **total** | **98.89** | **97.76** | **91.84** |

Per-file minima: lines 94.04, functions 86.36, branches 71.79 → the requested thresholds
(`perFile: true`, lines 80, functions 80, branches 70) are cleared by every file and are set as
such in `vitest.config.ts`. Closest to the floor: `branch.tsx` branches (71.79) and functions
(86.36). CI runs `pnpm test:coverage`, so a drop below fails the gate.

Timing for the viewport decision: canonical suite with coverage 181 s wall clock (browser files
dominate); the full tree including the qa-round1 files 532 s without coverage. A second
`chromium` instance at 1280×800 roughly doubles the browser part; add
`instances: [{ browser: "chromium" }, { browser: "chromium", viewport: { width: 1280, height: 800 } }]`
once the suite is green and the qa-round1 files are gone, and re-measure.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
S=<scratchpad>/

# baselines
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals | grep "error TS"   # 56 before (16 outside qa files)
pnpm exec vitest run --project unit --reporter=verbose                                                              # 20 failed before
pnpm audit --prod --audit-level=high                                                                                # clean
for r in actions/checkout@v5 pnpm/action-setup@v4 actions/setup-node@v5 actions/upload-artifact@v4 actions/cache@v4 actions/github-script@v8; do git ls-remote https://github.com/${r%@*} "refs/tags/${r#*@}" "refs/tags/${r#*@}^{}"; done

# dependencies (allowed): coverage provider matching vitest, shadcn -> devDependencies, katex for the tokens fixer's CSS import
pnpm add -D @vitest/coverage-v8@5.0.2 ; pnpm add katex@^0.16 ; pnpm install      # ^5.0.2 spec afterwards

# registry
node <inline> (add "cn" at the sorted unscoped position; cmdk@^1 on model-selector) && pnpm exec prettier --write registry/ai/registry.json registry/blocks/registry.json
sed -i 's/"title": "Input Otp"/"title": "Input OTP"/' registry/ui/registry.json
pnpm registry:validate                                       # Registry is valid. Checked 8 registry files and 83 items.

# tests
pnpm exec vitest run --project unit                          # 7 files green (66 mine)
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/a11y-helper.test.tsx; done   # 11/11 x3
pnpm exec vitest run --project browser > $S/browser-run-1.log                                       # 532 s, 27 files / 739 tests, 67 failed (others')
pnpm exec vitest run --coverage tests/unit tests/browser/ai tests/browser/blocks tests/browser/a11y-helper.test.tsx tests/browser/button.test.tsx   # 181 s; coverage/coverage-summary.json
pnpm exec playwright test --list                             # 44 tests in 3 files; no server started
node $S/probe-hydration.mjs ; node $S/probe-e2e.mjs          # standalone Playwright against the running dev server (fiber key, dark class, keyboard flow, console)

# scripts, with fetch stubbed (hosts are blocked)
for m in match changed missing error mixed; do MODE=$m node --import $S/stub-fetch-upstream.mjs scripts/sync-upstream.ts; echo exit=$?; done   # 0 / 1 / 2 / 2 / 1
(cd $S/actionlint-probe/aliases && node --import $S/stub-fetch-aliases.mjs /scripts/generate-aliases.ts)               # Input OTP, Button, Hover Card

# workflow YAML
(cd $S/actionlint-probe && node lint.mjs .github/workflows/ci.yml .github/workflows/upstream-diff.yml)   # actionlint 2.0.6 (wasm): 0 problems
(cd $S/actionlint-probe && node schema-check.mjs)                                                        # SchemaStore github-workflow.json + dependabot-2.0.json via ajv: VALID x3
curl raw.githubusercontent.com/github/docs/.../workflow-syntax.md ; curl .../<action>/action.yml         # pipefail rule, runtimes, if-no-files-found

# mutation checks (each restored, cmp-verified)
M1 drop cn from image | M2 add shimmer to lock | M3 guard.stop never throws | M4 drop TITLES override | M5/M5b target-size | M6 console.error probe file

# style, types
pnpm exec prettier --write <my files> ; pnpm exec biome check <my files> ; pnpm exec tsc --noEmit ; pnpm lint

# files (mine): package.json pnpm-lock.yaml .npmrc tsconfig.json vitest.config.ts playwright.config.ts
#   tests/a11y.ts tests/axe-tags.ts tests/setup.ts tests/browser/a11y-helper.test.tsx
#   tests/unit/{registry,ssr,test-setup,workflows,tooling}.test.ts (deleted: tests/unit/qa-round1-{registry-contract,test-quality,prompt-input}.test.ts, tests/browser/qa-round1/test-quality.test.tsx)
#   e2e/{helpers,previews.spec,registry.spec,chat-keyboard.spec}.ts scripts/{sync-upstream,generate-aliases}.ts
#   registry/ai/upstream.lock.json registry/{ai,blocks,ui}/registry.json .github/workflows/{ci,upstream-diff}.yml .github/dependabot.yml
#   components/ui/scroll-area.tsx (single vendored edit: unused React import)
```
