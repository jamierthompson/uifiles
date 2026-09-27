# meta — QA round 2

## Summary

Attacked everything that is not a component: the seven source manifests and the built `public/r`
(through the CLI's own zod schemas), the directory entry (through the upstream
`registry-directory.ts` schema), both workflows and Dependabot (line by line, every pinned SHA
resolved with `git ls-remote`, every `action.yml` fetched at its SHA), the three scripts (with a
stubbed `fetch`), the site shell on the running production server, the test infrastructure
(config, setup, helpers, Playwright config, e2e specs), every unit test, and every claim in the
docs and OSS files. I ran the one allowed `pnpm test:coverage`, a second full browser run, two
cold-cache runs with the optimizer's debug log, and 23 in-place mutations against the unit
suite.

Findings: 0 blocker, 0 high, 3 medium, 7 low, 5 nit. The directory-facing surface is clean:
index and all 83 items pass `registrySchema`/`registryItemSchema`, the index carries no file
content, names are unique and flat, `public/r` is byte-identical to the source tree, the
directory entry validates, every registry dependency resolves, every bare import is declared,
`tsc` is clean, and the tracked tree lints and formats. The single worst thing: **the one full
`pnpm test:coverage` run I did (the CI gate step) was red** — two browser files were lost to a
mid-run Vite re-bundle on a stale warm cache (the exact hazard `optimizeDeps.include` exists to
prevent; it omits the `react-dom/client|server` subpaths the leaves fixer asked for and the
guard test exempts them), and one `prompt-input` test asserts wall-clock time. A cold full run
(what CI does) scanned every entry, did not re-bundle, and every canonical file passed, so CI is
probably green, but it is not demonstrated, and a flake anywhere in the browser suite also
turns into a per-file coverage threshold failure. Second: the two built-output schema checks in
`registry.test.ts` are `skipIf(!built)` and CI runs `pnpm test:coverage` before `pnpm build`, so
in CI they are always skipped and green. Third: nothing guards `NEXT_PUBLIC_BASE_URL` in
`ci.yml`; deleting it survives every test and silently disables the e2e "no localhost"
assertions.

Verdict: **not yet — one small PR away.** Nothing here breaks install, build or the directory
listing; the three mediums are CI-wiring fixes of a few lines each. Ship after them and the
release checklist at the end.

Server note: the coordinator reported that the production server on :3000 had been stale
(started before the last rebuild, main stylesheet 500) during my first probes. After the restart
I redid every server-based check: both stylesheets 200 (152 869 and 3 701 bytes, 393 `.katex`
rules present), `/nope` and `/preview/nope` 404 with one `<main>` and `<h1>Page not found</h1>`
and a link home, `/robots.txt` 200, `/llms.txt` 200 `text/plain` with 86 catalog lines (85
localhost links, expected for a build without `NEXT_PUBLIC_BASE_URL`), `/r/registry.json`
`application/json; charset=UTF-8`, `/r/nope.json` 404, `<title>` "uifiles" on `/` and every
preview, "Previews · uifiles" on `/preview`, `og:url` set, the toggle server-rendered as "Toggle
theme" with `aria-keyshortcuts="D"`, 126 alias badges (63 × HTML + RSC) and none on `base`.
Every server observation below is from the restarted server; nothing changed.

Working-tree note: the tree was never clean while I worked. Other lenses were mutating
`registry/ai/{reasoning,code-block,prompt-input,tool,model-selector,sources,image}.tsx` in
place (each later restored) and adding `tests/browser/qa-round2/*` and
`tests/unit/qa-round2-leaves-tokens.test.ts`. The `pnpm lint`, `pnpm format:check` and `tsc`
failures I saw all sit in those untracked files; the tracked tree is clean for all three. My
only writes under the repo are `tests/unit/qa-round2-meta.test.ts` (15 tests: 3 fail on real
findings, 12 pin untested behaviour; Prettier, Biome and `tsc` clean; identical 3/3 runs).

## Fix verification

| round-1 finding | claimed fix | verified? | evidence |
| --- | --- | --- | --- |
| registry-contract F1: `cn` undeclared in 19 items | `"cn"` in every item's `dependencies`; unit test | yes | manifest dump: every ai item and `chat` list `cn`; M1 (undeclared `left-pad` in `image.tsx`) caught |
| registry-contract F2 / app-tooling F5: README `#v1.0.0`, GitHub path for `tool`/`chat` | `response#v0.1.0` example + caveat; tag is the lead's | partial | README correct; items with `@uifiles/*` deps are exactly `chat`, `tool` (my pin test); `git tag` still empty, CHANGELOG links `v0.1.0` |
| registry-contract F3 / app-tooling F1 / rendered F10: localhost baked into `/`, `/llms.txt` | `baseUrl()` Vercel fallback + production throw; CI env | yes | `site.test.ts` (10 cases) + my 3 edge-case pins; M5 caught; prod server here still prints localhost (built without env, expected) |
| registry-contract F4 / app-tooling F3+F6: lock set, `\| tee`, no dedupe, no label | lock = 18 shipped items with `upstream`; script exit 0/1/2; workflow `set +e`, `$GITHUB_OUTPUT`, label create, comment-or-create | yes | stubbed `fetch`: match→0 (17 fetches for 18 entries), changed→1, missing→2, error→2, 500→2, mixed→1; yml parses; `issues: write` covers `createLabel`; M3, M8, M8b caught |
| registry-contract F5: `sync-tokens` drops tokens on comments/nesting | tokenizer with brace matching, invariants, exit 1 | yes | `tokens.test.ts` parser suite; M9 (cssVars drift) and M18 (comment stripping off) caught |
| registry-contract F6: "Base UI only" | sentence in every ai/block `docs` | yes | 19/19 `docs` start with "Built for the Base UI styles" |
| registry-contract F7/F8: basename fallback, four invariants | `registry.test.ts` (22 tests) | yes | M13 (`@uifiles/code-blok`) caught by two tests; bare-name rule non-vacuous (clone-forked button) |
| registry-contract F9: "Input Otp" | `TITLES` override | yes | manifest title "Input OTP"; my `generate-aliases` pin exercises the override, fork preservation and the missing-description throw |
| registry-contract F10: `shadcn` in base devDependencies | removed | yes | `registry/base/registry.json` `devDependencies: ["tw-animate-css"]` |
| app-tooling F2 / F9: LICENSE "Other", NOTICE dirs, `LICENSE-ai-elements` | pristine MIT; `licenses/APACHE-2.0-ai-elements.txt`; NOTICE lists `components/ui`, `registry/ai`, each skill | yes | LICENSE == SPDX MIT text; Apache body byte-identical to the `ai` package's LICENSE; only one root `LICENSE*`; M12 caught |
| app-tooling F4: alias badge on `base` | `isUpstreamAlias()` | yes | M6 caught by two tests |
| app-tooling F7/F8: fences, `references/` | fixed | yes | fence tracker passes; `grep references/` empty |
| app-tooling F10 / test-quality F4, F5, F12: CI hardening | permissions, concurrency, timeout, SHA pins, audit, cache, coverage, diff check, e2e vs `pnpm start`, artifacts | yes | all six SHAs match their tags (`pnpm/action-setup@v4` is annotated: tag `f40ffcd9…` → commit `b906affc…`, the YAML uses the commit); every `with:` key exists in the `action.yml` at that SHA; runtimes node24/node20; M2, M16, M20, M21 caught |
| app-tooling F11: `docs/plan.md` memo | deleted, `docs/architecture.md` | yes, one leftover | no doc refers to it; `tests/unit/tokens.test.ts:531` still cites "docs/plan.md §5" (F6 below) |
| app-tooling F12 / rendered F22: theme hotkey | visible toggle, `closest()` exclusions | yes | `theme.test.tsx` 8 tests; hydration-safe neutral label before mount |
| app-tooling F13 / test-quality F8: "gate = everything CI runs" | README/AGENTS/CONTRIBUTING name the CI-only steps | yes | `site.test.ts` computes CI-only scripts from `ci.yml` |
| app-tooling F14 / F16: `.env.example`, package.json metadata, `.npmrc`, `.mcp.json`, `.gitkeep`s | done | yes | M10 (`engine-strict=false`) caught; `shadcn@4` pinned; `version 0.1.0` |
| app-tooling F15 / rendered F14: metadata, 404, robots | `metadataBase`, title template, OG; `not-found.tsx`; `robots.ts` | yes, partial on titles | prod server: `/nope` → 404 with one `<main>`, `<h1>Page not found</h1>`, link home; `/robots.txt` served; every `/preview/<name>` `<title>` is still "uifiles" (F8 below) |
| test-quality F3/F6: five `settle`s, no WCAG 2.2, no dark | `tests/a11y.ts`, `AXE_TAGS`, `withDark`, e2e light+dark | yes | helper test 11 cases; e2e 44 tests collect (`--list`) |
| test-quality F7: strict TS flags | on in `tsconfig.json` | yes | `tsc --noEmit` exit 0 on the tracked tree |
| test-quality F9: `networkidle` | `gotoHydrated` on React's fiber key | yes | `e2e/helpers.ts`; key stable since React 17 |
| test-quality F11: `registry.test.ts` vacuous | descriptions ≥ 40 chars and a sentence; fork rule tested on a clone | yes | M14 caught |
| fix-leaves request: `react-dom/server` in `optimizeDeps.include` | — | **no** | F2 below |
| fix-app-docs request: `metadata` on 11 server preview pages | — | **no** | 0 of 19 preview pages export metadata |
| fix-code-block request: e2e axe at 375 px | — | no | `playwright.config.ts` has only Desktop Chrome |
| fix-tooling request: docs owner documents coverage, helpers, lock, exit codes, e2e helpers, CI env | — | yes | present in AGENTS.md, `docs/architecture.md` §5, `docs/porting-ai-elements.md` §0/§4/§5 |

## Findings

### F1. The built-output schema checks are skipped in CI and report green — severity: medium

- Where: `tests/unit/registry.test.ts` › `describe("built output (public/r)")`, two `it.skipIf(!built)`; `.github/workflows/ci.yml` steps `pnpm test:coverage` (line 46) before `pnpm build` (line 47).
- What: `public/r` is gitignored and only `pnpm build`/`registry:build` creates it. CI runs the tests first, so the two checks that validate the index and every item with the CLI's zod schemas (directory requirement 4, unique names, name match, `content` present) never run in CI. The e2e spec covers content-type, `content` presence and name match against the served files, but not the schemas.
- Evidence: mutation M15b: with `public/r` moved away, `registry.test.ts` reports `20 passed | 2 skipped`; with it present, injecting `"content"` into the index (M15) fails the test as intended.
- Why it matters: the test that names directory requirement 4 is the one a reviewer would trust; it is green in CI by omission.
- Proposed fix: add `- run: pnpm registry:build` before `pnpm test:coverage` in `ci.yml` (sync-tokens + validate + build, seconds) and turn the `skipIf` into a hard failure with a message ("run pnpm registry:build first"); or move the two checks into `e2e/registry.spec.ts` where the served JSON is already fetched.
- Test written: `tests/unit/qa-round2-meta.test.ts` › "validates the built registry: public/r exists before pnpm test:coverage, or the checks fail without it" (FAIL now).

### F2. The one full `pnpm test:coverage` run was red: a warm-cache re-bundle lost two files, and a wall-clock assertion failed — severity: medium

- Where: `vitest.config.ts` `optimizeDeps.include` (no `react-dom/client`, `react-dom/server`); `tests/unit/test-setup.test.ts` › "lists every other bare package…" (`served` regex exempts `react-dom/*`); `tests/browser/ai/response.test.tsx` (imports both subpaths); `tests/browser/ai/prompt-input.test.tsx:2459` and `:2433` (`expect(performance.now() - start).toBeLessThan(300)`); CI step `pnpm test:coverage`.
- What: the run (`coverage-run.log`, 23:49:08, 49.6 s) ended `Test Files 3 failed | 27 passed`, `Tests 1 failed | 930 passed`, then `Coverage for lines (72.72%) … registry/ai/context.tsx` (and functions 57.14 %, branches 31.81 %) → exit 1. (a) `context.test.tsx` and `response.test.tsx` failed at collection with `Failed to fetch dynamically imported module`; the cache dir for the current config hash (`node_modules/.vite/vitest/ef98362b…/deps`) had all 1 583 files rewritten at 23:49:47, 39 s into the run, i.e. Vite re-bundled mid-run and invalidated the two in-flight imports. Its final `optimized` set (50) includes `react-dom`, `react-dom/client`, `react-dom/server`, which the older dirs (`ffdf8c66…`, `5b2d4dfd…`) lack and which no `include` entry names; the fix-leaves report saw the same "Vite unexpectedly reloaded a test" on its cold run and asked for `react-dom/server` in `include`. Both files pass in isolation (45 and 16 tests). (b) `PromptInputHoverCard › delays opening by openDelay…` failed with `expected 498.69… to be less than 300` under load; it passed in the two later full runs.
- What it is not: a cold full run with `DEBUG=vite:deps` (scratch `cacheDir`, all 27 files as entries) logged "using post-scan optimizer result, the scanner found every used dependency", bundled once, and every canonical file passed (the 18 failures were all in other lenses' `tests/browser/qa-round2/*` reproducers, some failing by design, plus their in-flight component mutations). So a fresh CI runner should not re-bundle; a developer's warm cache built by an earlier partial run will.
- Why it matters: `pnpm test:coverage` is the gate; with `perFile` thresholds, any file that fails to collect also fails coverage for the component it covers, so every browser flake is amplified into a threshold failure. The config comment promises the `include` list prevents exactly this and the unit guard cannot see the gap.
- Proposed fix: add `"react-dom/client"` and `"react-dom/server"` to `optimizeDeps.include`; in `test-setup.test.ts` narrow `served` to `/^(react|react-dom|next|vitest|vitest-browser-react|axe-core)$/` so subpaths must be listed; in `prompt-input.test.tsx` replace the two `< 300 ms` wall-clock assertions with fake timers (advance 0 ms vs 500 ms) or assert only ordering (opens before the 500 ms delay elapses using a controlled clock). Consider `coverage.thresholds` without `perFile` for browser-collected files, or make collection failures fail the run before coverage is computed (they do, but the message points at coverage).
- Test written: `tests/unit/qa-round2-meta.test.ts` › "names every react-dom subpath a browser test imports" (FAIL now: `react-dom/client`, `react-dom/server`).

### F3. `NEXT_PUBLIC_BASE_URL` in `ci.yml` is unguarded, and its absence silently disables the e2e "no localhost" assertions — severity: medium

- Where: `.github/workflows/ci.yml` `env:` block; `tests/unit/workflows.test.ts` (asserts only `CI: "true"`); `e2e/registry.spec.ts:45-47, 116-118` (`if (process.env.NEXT_PUBLIC_BASE_URL) … not.toContain("localhost")`).
- What: the variable is set at workflow scope, so the build and the e2e step share it (verified: `pnpm build` bakes `https://uifiles.dev` and `publicOrigin()` returns the same, so the origin assertions are consistent). But deleting the line survives `workflows.test.ts` (11 passed) and `site.test.ts` (32 passed) (M4, M4b), and the e2e assertions are conditional on the same variable, so a removal turns them into no-ops and a localhost build passes CI. AGENTS.md states the variable as a CI fact.
- Why it matters: this is the only guard against shipping the localhost home page the round-1 lenses flagged three times.
- Proposed fix: assert the `env:` value in `workflows.test.ts`; in e2e, key the localhost assertions on `process.env.CI` instead (or always assert `not.toContain("localhost")` when `baseURL` is not localhost).
- Test written: `tests/unit/qa-round2-meta.test.ts` › "sets NEXT_PUBLIC_BASE_URL for the whole job, which the e2e no-localhost assertions key on" (PASS; pins).

### F4. e2e depends on `https://models.dev` being fast and up — severity: low

- Where: `app/preview/model-selector/page.tsx:84,111,127-129` (`ModelSelectorLogo` → `https://models.dev/logos/<provider>.svg`); `e2e/helpers.ts` `gotoHydrated` (`waitForLoadState("load")`, which waits for images) and `collectPageProblems` (every console error fails the test, nothing allow-listed); `e2e/previews.spec.ts` (runs it twice, light and dark).
- What: the component now hides a failed logo (`onError` → `hidden`), but Chromium still logs `Failed to load resource: net::ERR_…` as a console error (round-1 saw exactly that ×3 on this page), and a slow host delays `load` up to the navigation timeout. On a GitHub runner the host is reachable, so this passes today; it is a third-party dependency in the gate.
- Design position (the coordinator asked, and the code-context reviewer reports the check fails where the host is blocked): do **not** allow-list third-party resource failures in `collectPageProblems`. The "logs nothing" assertion is the only thing that caught the hydration and key warnings in round 1, and an allow-list keyed on a host is a hole every future external asset walks through. Make the preview hermetic instead: `ModelSelectorLogo` already accepts `src`-like control through `provider`; give `app/preview/model-selector/page.tsx` local logos (a few inline SVGs or files under `public/`, passed as the image source) so the page under test has no network dependency, which is also what the docs site should do for visitors on locked-down networks. Keep the component's default `https://models.dev` URL, since that is upstream's contract, and document it in the item's `docs` (it is). As belt and braces for any future external asset, `gotoHydrated` can install a catch-all `page.route` that fulfils non-`localhost` requests with an empty 200 response, so a slow or blocked host can neither delay `load` nor log an error.
- Proposed fix: local logos in the preview (recommended); plus, in `e2e/helpers.ts`, `await page.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }))` before navigation.
- Test written: none (needs Playwright).

### F5. The console guard attributes unmount-time console output to the next test — severity: low

- Where: `tests/setup.ts` (`beforeEach(() => shared.guard.start())`, `afterEach(() => shared.guard.stop())`); `node_modules/vitest-browser-react/dist/index.js:11-13` (`beforeEach(async () => { await cleanup() })`).
- What: setup files load before the test file, so the guard's `beforeEach` is registered first and runs first (Vitest runs `beforeEach` in registration order and `afterEach` in reverse, per `config.d.ts:2135,2153`). Test B therefore begins with `start()`, then vitest-browser-react unmounts test A's tree; anything A's tree logs on unmount is recorded against B. Attribution only; nothing is lost.
- Proposed fix: in `tests/setup.ts` import `cleanup` from `vitest-browser-react` and call it in the guard's own `afterEach` before `stop()`, so a test's teardown output is charged to that test.
- Test written: none (browser; reasoned from the hook order).

### F6. A test comment still cites the retired `docs/plan.md` — severity: low

- Where: `tests/unit/tokens.test.ts:531` ("decision recorded in docs/plan.md §5"); `tests/unit/site.test.ts` › "nothing refers to the retired docs/plan.md" scans only seven doc files.
- Proposed fix: point the comment at `docs/architecture.md` §4; extend the site test's scan to `tests/`, `scripts/`, `app/`, `lib/`, `components/`.
- Test written: `tests/unit/qa-round2-meta.test.ts` › "no test, script or app source refers to the retired docs/plan.md" (FAIL now).

### F7. `waitForIdle` sleeps a fixed 1 100 ms — severity: low

- Where: `e2e/helpers.ts:83` (`if (wasBusy) await page.waitForTimeout(1100)`), used by every preview test and the keyboard walk.
- What: it outwaits Reasoning's 1 s auto-close by a fixed margin (36 sleeps across the preview matrix). A poll on the reasoning trigger's `aria-expanded="false"` (or `[data-open]` absence) would be deterministic and faster.
- Proposed fix: `await expect(page.getByRole("button", { name: /Thought for/ })).toHaveAttribute("aria-expanded", "false")` when a reasoning trigger exists, then `settle()`.

### F8. Every preview tab is titled "uifiles" — severity: low

- Where: `app/preview/*/page.tsx` (0 of 19 export `metadata`); `app/layout.tsx` `title.template: "%s · uifiles"`.
- Evidence: `curl localhost:3000/preview/tool | grep title` → `<title>uifiles</title>`; same for `/preview/chat`. The app-docs fixer asked component owners to add `export const metadata` to the 11 server pages; none did.
- Proposed fix: add `export const metadata: Metadata = { title: "<Name>" }` to the 11 server pages; for the 8 `"use client"` pages, a `app/preview/[name]`-style layout with `generateMetadata` would cover all at once if the previews ever move to a dynamic segment.

### F9. `pnpm audit` as the first hard gate step — severity: low (judgement)

- Where: `.github/workflows/ci.yml:31` (`pnpm audit --prod --audit-level=high`, clean today).
- What: a new advisory on any production transitive dependency turns every PR red until someone bumps a lockfile entry unrelated to the PR. Reasonable for a registry that ships source to consumers; note it so the first unrelated red run is understood.
- Proposed fix: keep it, or give the step `continue-on-error: true` and a `::warning::`, with Dependabot doing the bump.

### F10. `workflows.test.ts` asserts YAML by exact text layout — severity: low

- Where: `tests/unit/workflows.test.ts` (e.g. `/^permissions:\n {2}contents: read\n\n/m`, `/^env:\n {2}CI: "true"/m`, `uses:` regex with a mandatory `# vN` comment).
- What: the assertions are load-bearing (M2, M3, M16, M21 all caught) but coupled to blank lines, key order and comment placement; an equivalent reflow fails them and an unrelated key between `env:` and `CI:` passes or fails by accident. I parsed all six `.github` YAML files with js-yaml (transitively installed only) and they are structurally what the tests mean.
- Proposed fix: add `yaml` as a devDependency and assert on the parsed object (`permissions`, `concurrency`, `jobs.gate.steps[i].run`, `env.NEXT_PUBLIC_BASE_URL`), keeping one regex for the SHA-pin shape.

### F11. `demo-conversation.ts` is typed `registry:component` — severity: nit

- Where: `registry/blocks/registry.json` files[1] (`type: "registry:component"`, `target: "lib/demo-conversation.ts"`).
- What: the explicit target places it correctly (verified by round 1's real CLI run), so this is cosmetic; `registry:lib` is the honest type and what the MCP `view` output will show.

### F12. `docs/architecture.md` appendix says AI Elements has 48 components — severity: nit

- Upstream `packages/elements/src/` has 49 `.tsx` files; `question.tsx` is missing from the §3 resolution table.

### F13. `robots.txt` `Host:` carries a full origin — severity: nit

- `app/robots.ts` sets `host: baseUrl()` → `Host: http://localhost:3000` locally, `https://uifiles.dev` in production. The directive is defined as a bare hostname; Next passes the string through. Harmless; drop `host` or pass `new URL(baseUrl()).host`.

### F14. README says `pnpm test:e2e` "needs the built site" — severity: nit

- `README.md:44`. Locally `playwright.config.ts` runs `pnpm registry:build && pnpm dev` itself (or reuses a running server); only CI runs against `pnpm start`. AGENTS.md and CONTRIBUTING.md say this correctly.

### F15. Two of the three CI step exemptions in `registry.test.ts`'s import scanner are broader than needed — severity: nit

- `tests/unit/registry.test.ts:216` exempts `react`, `react-dom`, `next` from the declared-dependency check. `next` is only imported by the block page (fine for a `registry:page`), but the exemption would also hide a `next/*` import in a `registry:component` that Vite consumers cannot resolve. The regex itself is sound for this codebase: `export * from`, `export type … from`, multi-line and `import type` are caught; `require()` and template-literal dynamic imports are not (none used); prose containing `from "x"` after an `export` line (JSX text, comments) yields false positives, never false negatives.

## Mutation log

| # | behaviour | mutation | test file | caught? |
| --- | --- | --- | --- | --- |
| M1 | undeclared bare import | `registry/ai/image.tsx` imports `left-pad` | `registry.test.ts` | yes ("every bare package… is declared") |
| M2 | least-privilege token | `permissions:` block removed from `ci.yml` | `workflows.test.ts` | yes |
| M3 | drift issue only on exit 1 | `upstream-diff.yml` `code == '1'` → `code != '0'` | `workflows.test.ts` | yes |
| M4 | CI bakes the public origin | `NEXT_PUBLIC_BASE_URL` line removed from `ci.yml` | `workflows.test.ts` | **survived** (11 passed) |
| M4b | same | same | `site.test.ts` | **survived** (32 passed) |
| M5 | Vercel production fallback | `fromVercelHost(VERCEL_PROJECT_PRODUCTION_URL)` removed | `site.test.ts` | yes |
| M6 | alias badge predicate | `isUpstreamAlias` ignores `type` | `site.test.ts` | yes (2 tests) |
| M7 | pre-bundle list complete | `"next-themes"` removed from `optimizeDeps.include` | `test-setup.test.ts` | yes |
| M8 | lock `upstream` names another file | `branch.upstream` → `"branch"` | `registry.test.ts` | yes |
| M8b | lock entry complete | `tool.fetchedAt` removed | `registry.test.ts` | yes |
| M9 | base cssVars = globals.css | dark `--ring` changed in `registry/base/registry.json` | `tokens.test.ts` | yes (3 tests) |
| M10 | engine enforcement | `.npmrc` `engine-strict=false` | `tooling.test.ts` | yes |
| M11 | components render on the server | `task.tsx` reads `window` at module scope | `ssr.test.ts` | yes |
| M12 | pristine MIT | paragraph appended to `LICENSE` | `site.test.ts` | yes |
| M13 | namespaced deps resolve | `tool` → `@uifiles/code-blok` | `registry.test.ts` | yes (2 tests) |
| M14 | retrieval-quality descriptions | `tool` description → "Short." | `registry.test.ts` | yes |
| M15 | index carries no content | `"content"` injected into `public/r/registry.json` (untracked build output) | `registry.test.ts` | yes |
| M15b | same, as CI sees it | `public/r` absent | `registry.test.ts` | **skipped** (20 passed, 2 skipped) → F1 |
| M16 | generated-files check after build | diff step moved before `pnpm build` | `workflows.test.ts` | yes |
| M17 | console guard throws | `stop()` returns when `failures.length >= 0` | `test-setup.test.ts` | yes (3 tests) |
| M18 | sync-tokens strips comments | comment branch → `if (false)` | `tokens.test.ts` | yes (3 tests) |
| M19 | llms.txt links carry the origin | `${origin}` dropped from item links | `site.test.ts` | yes |
| M20 | e2e against the build in CI | `command: CI ? "pnpm dev"` | `tooling.test.ts` | yes |
| M21 | audit level | `--audit-level=critical` | `workflows.test.ts` | yes |

Every mutated file was restored from a byte copy and `cmp`-verified; `git diff --stat` for each was empty afterwards (the ` M registry/ai/*.tsx` entries that appeared in `git status` during the series belong to other lenses' concurrent mutation runs and rotated through `reasoning`, `code-block`, `prompt-input`, `tool`, `model-selector`, `sources`, `image`).

## Test-quality issues (file › test name → problem)

- `tests/browser/ai/prompt-input.test.tsx` › "delays opening by openDelay and lets a trigger delay override it" and › the sibling "opens immediately" test → wall-clock `toBeLessThan(300)` on `performance.now()`; failed at 498 ms in the full run, passed twice later. Also `sleep(50…250)` at lines 513-699 and `inline-citation.test.tsx:569` (`setTimeout 150`) where `expect.poll`/fake timers would do.
- `tests/unit/registry.test.ts` › "the index validates…" and "every item file validates…" → `it.skipIf(!built)`; silently skipped in CI (F1).
- `tests/unit/test-setup.test.ts` › "lists every other bare package…" → `served` regex exempts every `react-dom/*` subpath, so the list it guards can omit what the tests import (F2).
- `tests/unit/workflows.test.ts` (all) → regex on YAML layout, not structure (F10); assertions are otherwise load-bearing (M2, M3, M16, M21).
- `e2e/helpers.ts` › `waitForIdle` → fixed 1 100 ms sleep (F7).
- `e2e/previews.spec.ts` → depends on `models.dev` (F4).
- `tests/unit/tokens.test.ts:531` → stale `docs/plan.md` reference in a comment (F6).
- `tests/browser/theme.test.tsx` › `beforeAll` warm-up → replaces `console.error` to swallow next-themes' one-time script-tag error and asserts it is the only message; sound, but it means the file cannot run its first test under the guard if next-themes ever logs a second message — acceptable, noted.
- Names: all reviewed files use behaviour names; no `skip`, `retry`, `BUG`/`QA`/round words in canonical files; `qa-round1` files are gone (`git ls-files` has none, no `.mutbak`, no `zz-probe`).
- Flakiness: `a11y-helper`, `theme`, `context`, `response` ran green in every run I did (full ×2 warm, ×1 cold, singles); `prompt-input` flaked once (above).

## Verified OK

- Built output: `public/r/registry.json` passes `registrySchema`; all 83 `public/r/<name>.json` pass `registryItemSchema`, `name` matches, every file carries `content`; index has zero `files[].content`; names unique, no `/`; no extra files; `name: uifiles`, `homepage: https://uifiles.dev`; `public/r` is byte-identical to the source tree in content and metadata (built 23:40, after the last manifest edit at 23:40:33).
- `registry:base`: `cssVars.{theme,light,dark}` (7/32/31), `css["@layer base"]` with the reduced-motion guard, `config` shape accepted by the schema; `registry:page` and `registry:component` are valid `registryItemTypeSchema` values.
- Source manifests: every `@uifiles/<x>` names an item with files; every bare dep is a `registry:ui` name or `utils`/`font-*`; no target collisions; every `@/components/ui/<x>` import has a bare `<x>` dependency and every bare dependency of an AI item is imported (my pin); items with `@uifiles/*` deps are exactly `chat`, `tool` (README caveat correct); declared ranges agree with `package.json` (majors, and minors where pinned); `model-selector` no longer declares `cmdk` and no longer imports it.
- Directory entry (fix-tooling.md) validates against `registryDirectoryEntrySchema` (strict, `{name}` present); no namespace or host clash in the 382 upstream entries; the upstream file is not alphabetical, so position is free (neighbours by sort: `@uiception`, `@uitripled`).
- `chat` block: `page.tsx` targets `app/chat/page.tsx` as `registry:page`, imports `@/registry/blocks/chat/components/blocks/chat` and `.../lib/demo-conversation` (the shapes the CLI's import rewrite maps to the components and lib aliases, verified by round 1 with the real CLI); `chat.tsx`'s `@/registry/ai/<x>` imports are covered by the basename-repair test.
- Upstream lock: 18 keys = shipped items; `branch`/`response` share `message.json` with the same sha and `upstream: "message"`; the script fetches 17 distinct sources for 18 entries.
- `scripts/sync-upstream.ts` exit codes 0/1/2 as documented (all five modes plus 500); runs under Node 24 type stripping; only `node:` builtins, so the workflow needs no install.
- `scripts/generate-aliases.ts`: keeps upstream `title`, `TITLES` override, preserves forks, filters non-`registry:ui`, sorts, throws "add it to EXTRA" on a missing description (my pins).
- `scripts/sync-tokens.ts`: no-op on the clean tree; parser survives comments, nested at-rules, multi-line values, strings; exits 1 without writing on drift.
- `ci.yml`: parses; `permissions: contents: read`; `concurrency` per ref with cancel; `timeout-minutes: 30`; every `uses:` is a 40-hex SHA matching its `# vN` tag; every `with:` input exists at that SHA; Playwright cache path is the Linux default (`PLAYWRIGHT_BROWSERS_PATH` unset) and `require('playwright/package.json')` resolves (exports map allows it, version 1.63.0); `pnpm audit --prod --audit-level=high` runs clean here; `NEXT_PUBLIC_BASE_URL` is workflow-scoped so `pnpm build` and e2e agree; `git diff --exit-code -- registry` sits after `pnpm build`, and `sync-tokens` formats with the same `pnpm exec prettier` devDependency CI installs (no `NODE_ENV=production`); `NODE_ENV` is not set anywhere in the workflow, so devDependencies (`shadcn`, `prettier`) are installed under `--frozen-lockfile`; upload step uses an attempt-suffixed name with `if-no-files-found: ignore`.
- `upstream-diff.yml`: `shell: bash`, `set +e` capture, no pipe, `$GITHUB_OUTPUT`/`$GITHUB_STEP_SUMMARY`, issue step gated on `== '1'`, `issues: write` (sufficient for `createLabel`), `github-script@v8` (node24) script is valid JS with `context.repo`, `core.notice`, `error.status`; cron Mondays 09:00 UTC; concurrency and timeout.
- `dependabot.yml`: valid v2; weekly `github-actions` and `npm`; `groups.minor-and-patch` with `applies-to: version-updates` (SHA pins will be bumped with their comments).
- Issue forms: both parse; only valid `type`s (`input`, `textarea`, `dropdown` with `options`); `validations.required` on the right fields; `config.yml` has `blank_issues_enabled: false` and two contact links; `labels: [bug]`/`[enhancement]` are GitHub defaults. PR template, CODEOWNERS (`* @jamierthompson`) present.
- Site shell on the production server: `/nope` and `/preview/nope` → 404, one `<main>`, `<h1>Page not found</h1>`, link home; `/robots.txt` 200; `/llms.txt` 200 `text/plain`, 86 catalog lines, one per item; `/r/registry.json` `application/json; charset=UTF-8`, `/r/nope.json` 404; `<title>uifiles</title>` on `/`, `og:url` present; `.next/prerender-manifest.json` lists 26 static routes and no dynamic routes, so the `node:fs` reads run at build only.
- `baseUrl()`: explicit > `VERCEL_PROJECT_PRODUCTION_URL` > `VERCEL_URL` > localhost; blank treated as unset; non-absolute rejected; trailing slashes stripped; path prefix kept, query/fragment dropped; every loopback spelling refused in production; scheme-bearing `VERCEL_URL` accepted (my pins).
- Theme toggle: renders a neutral icon and "Toggle theme" until mounted (no hydration mismatch), then an action label ("Switch to dark theme", a valid alternative to `aria-pressed`), `aria-keyshortcuts="D"`, `<Kbd aria-hidden>`, ≥ 24 px target; hotkey ignores `defaultPrevented`, `repeat`, `isComposing`, modifiers, and targets inside inputs, ARIA widgets, dialogs and open popup triggers (8 browser tests).
- Home page: `isUpstreamAlias` = `registry:ui` with no files; badge on `button`, not on `base`; header links `/preview`, `/r/registry.json`, `/llms.txt`, GitHub; one `<h1>`, one `<main>`.
- `tests/setup.ts`: `start()` resets `allowed` and `calls` per test (no leak of `allowConsole` across tests); a module-scope `allowConsole()` is a no-op by design; single guard on `globalThis` for the double load; `afterEach` runs last (reverse registration), so a test file's own `afterEach` output is still caught.
- `tests/a11y.ts`/`axe-tags.ts`: tags wcag2a/2aa/21a/21aa/22aa/best-practice, `target-size` enabled, `settle()` skips infinite and scroll-driven animations and swallows cancellation; `expectNoViolations` prints impact/rule/nodes; `withDark` restores on throw. `e2e/helpers.ts` uses the same tags (`options()` before `withTags()`).
- `playwright.config.ts`: `pnpm start` + `workers: 2` + `retries: 1` + github/html reporters in CI; dev server locally with reuse; Desktop Chrome only. `playwright test --list`: 44 tests in 3 files.
- `tsconfig.json`: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`; `.claude` and `public/r` excluded; `pnpm exec tsc --noEmit` exit 0 on the tracked tree; Biome clean on all 138 tracked source files; Prettier clean on the tracked tree.
- `package.json`: `version 0.1.0`, `license MIT`, `description`, `author`, `homepage`, `repository`, `bugs`, `packageManager pnpm@11.18.0`, `engines.node >=24` with `.npmrc engine-strict=true` and `.nvmrc 24`; `shadcn` in devDependencies; `@vitest/coverage-v8` spec equals `vitest`; `katex` direct so the CSS import resolves.
- `vitest.config.ts`: `include` names only installed packages; every bare import under `registry/**`, `components/**`, `tests/browser/**` is listed except the `react-dom` subpaths (F2); `app/**` is not imported by any browser test; coverage over `registry/**`, `lib/**` minus `page.tsx`, `perFile` 80/80/70, `reportOnFailure`.
- Coverage numbers from the run (all files but the two that failed to collect): total lines 97.19 %, functions 96.25 %, branches 89.31 %; only `context.tsx` (whose file failed to collect) was under threshold; the fix-tooling summary from a green run had it at 100/100/95.
- `ssr.test.ts`: 18 AI compositions + the `chat` block = 19 cases, matching the shipped items; plus two prompt-input server pins (M11 caught a module-scope `window`).
- `site.test.ts` env handling: `vi.stubEnv` + `vi.unstubAllEnvs()` in `afterEach`; `tooling.test.ts` deletes and unstubs `CI` and resets modules; nothing leaks between files (`isolate` default).
- Docs: README counts (63, 18) and commands match; AGENTS.md test-file inventory matches `tests/browser/` (`a11y-helper`, `button`, `theme`, `tokens`, `ai/*` ×18, `blocks/chat`); CI order in README/AGENTS/CONTRIBUTING/architecture §5 matches `ci.yml`; thresholds, exit codes, lock structure, `retries`/`workers`, SHA pins and cache facts all match; no `plan.md`, `LICENSE-ai-elements`, `#v1.0.0` or `references/` in any doc; CHANGELOG `[0.1.0] - 2026-09-26` with no round/agent jargon and link refs for `v0.1.0`; `LICENSE` equals the SPDX MIT text; `licenses/APACHE-2.0-ai-elements.txt` = upstream copyright line + pointer + the full Apache-2.0 text (byte-identical to the `ai` package's copy); `NOTICE` names `registry/ai/`, `components/ui/`, `.claude/skills/` and all four skill sources with licences; `CODE_OF_CONDUCT.md` is Contributor Covenant 2.1 verbatim (Prettier bullets) with the contact filled (GitHub profile URL rather than an email; acceptable); `SECURITY.md` links private advisories with a 7/30-day SLA; `skills/uifiles/SKILL.md` commands exist in the CLI source (`search -q`, `view`, `docs`, `info`), `allowed-tools` equals the shadcn skill's, `user-invocable: false`; `.claude/rules/registry.md` frontmatter `paths` present; `.mcp.json` pins `shadcn@4`; `.env.example` describes the real behaviour; `.gitignore` covers `public/r`, `.env*` (keeps the example), `.vitest`, reports, coverage.

## Could not reach

- GitHub Actions itself, `pnpm test:e2e`, `pnpm build` (forbidden); CI-green is inferred from a cold local run of the browser project plus the unit suite, not demonstrated.
- The exact dependency that triggered the 23:49:47 re-bundle: the pre-run cache dir was replaced atomically, so only its successor is observable; `react-dom/client|server` is the only candidate absent from `include` and imported by a test.
- `https://uifiles.dev` (proxy 403): homepage, content-type and TLS unverified; `registry.json` `homepage`, README, the skill and CI's env assume it.
- Vercel's rule that `NODE_ENV=production` in project env skips devDependencies (the Vercel docs tool returned no matching page); recorded as a checklist caution since `shadcn` and `prettier` are now devDependencies the build needs.
- Whether the `upstream` label can be created by `GITHUB_TOKEN` on a repo with restricted default permissions (the workflow requests `issues: write`, which is the documented requirement).
- Directory reviewers' behaviour on the description text; the entry only validates.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round2/meta

pnpm test:coverage > $S/coverage-run.log                    # the one allowed run: 3 files failed, context.tsx under threshold, exit 1
pnpm exec vitest run --project browser > $S/browser-run-2.log   # warm cache: 30 files, all green, 32 s
pnpm exec vitest run --project browser tests/browser/ai/context.test.tsx   # 45 passed (same for response: 16 passed)
DEBUG=vite:deps pnpm exec vitest run --root . --config $S/vitest.cold.config.ts --project browser [files…]   # scratch cacheDir; "scanner found every used dependency"; logs $S/debug-{nocov,cov,full}.log
node $S/vite-meta.cjs                                       # optimized deps per cache dir vs optimizeDeps.include
node $S/validate-built.mjs                                  # CLI zod schemas over public/r; base/chat shapes
node -e '<zod>' … $S/directory-entry.json registry-directory.json   # directory entry: PASS, no clashes
for r in …; do git ls-remote https://github.com/${r%@*} refs/tags/${r#*@} "refs/tags/${r#*@}^{}"; done   # SHAs vs tags
curl raw.githubusercontent.com/<owner>/<repo>/<sha>/action.yml   # inputs and runtimes of the six actions
MODE=… node --import $S/stub-fetch.mjs scripts/sync-upstream.ts          # changed/missing/error/500 → 1/2/2/2
(cd $S/sync-cwd && MODE=… node --import $S/stub-fetch2.mjs …/sync-upstream.ts)   # match/mixed/missing-only → 0/1/2
pnpm audit --prod --audit-level=high                        # No known vulnerabilities found
pnpm exec tsc --noEmit                                      # 0 errors on the tracked tree (2 in other lenses' untracked files)
pnpm lint; pnpm format:check                                # red only on tests/browser/qa-round2/* (other lenses); tracked files clean
pnpm exec playwright test --list                            # 44 tests in 3 files
node -e '<js-yaml>' …                                       # every .github YAML parses; issue forms structurally valid
curl -i localhost:3000/nope | /preview/nope | /robots.txt | /llms.txt | -I /r/registry.json | /preview/tool
$S/mutate.sh "<label>" <file> <test> '<perl -0pi expr>'     # 23 mutations (log above); backups in $S/bak, cmp-verified
pnpm exec prettier --write tests/unit/qa-round2-meta.test.ts; pnpm exec biome check …; pnpm exec tsc --noEmit
for i in 1 2 3; do pnpm exec vitest run --project unit tests/unit/qa-round2-meta.test.ts; done   # 3 failed | 12 passed ×3
```

Reproducer output (identical 3/3):

```
 × validates the built registry: public/r exists before pnpm test:coverage, or the checks fail without it   (F1)
 × names every react-dom subpath a browser test imports                                                      (F2: react-dom/client, react-dom/server)
 × no test, script or app source refers to the retired docs/plan.md                                          (F6: tests/unit/tokens.test.ts)
 ✓ 12 pins: NEXT_PUBLIC_BASE_URL job scope; @/components/ui imports declared; README GitHub-path caveat;
   sync-upstream exit 0/1/2 + one fetch per source (4); generate-aliases titles/forks/throw (2); baseUrl edge cases (3)
 Test Files  1 failed (1)   Tests  3 failed | 12 passed (15)
```

## Release checklist for the lead

1. **Fix the three CI-wiring mediums in the curated PR** (F1–F3): `pnpm registry:build` before `pnpm test:coverage` (and drop the `skipIf`), `react-dom/client` + `react-dom/server` in `optimizeDeps.include` with the guard regex narrowed, the two wall-clock assertions in `prompt-input.test.tsx` replaced, and a `workflows.test.ts` assertion on `NEXT_PUBLIC_BASE_URL`. Optional in the same PR: F4 (`page.route` for models.dev), F6, F7.
2. **Tag `v0.1.0`** on the curated commit (`git tag -a v0.1.0 -m "0.1.0"` + push). README's GitHub-path example, CHANGELOG's link refs and SECURITY's "latest tag" all point at it.
3. **Vercel project**: set `NEXT_PUBLIC_BASE_URL=https://uifiles.dev` (the build also falls back to `VERCEL_PROJECT_PRODUCTION_URL` once the domain is attached, and fails loudly on localhost in production); do **not** set `NODE_ENV=production` as a project variable — the build runs `shadcn` and `prettier` from devDependencies. After the first deploy: `curl -sI https://uifiles.dev/r/registry.json` → 200 `application/json`, `curl -s https://uifiles.dev/llms.txt | grep -c localhost` → 0, `/robots.txt` shows the public host.
4. **Directory PR** to `shadcn-ui/ui` `apps/v4/registry-directory.json`: the entry in `fix-tooling.md` validates (my re-check: `PASS`, no namespace/host clash; the upstream file is not alphabetical, so append or insert near `@uiception`). Replace the placeholder logo; keep `stroke='var(--foreground)'`; run upstream's `pnpm validate:registries`. Prerequisites: public repo (`raw.githubusercontent.com` already serves `registry.json`), item 3 live.
5. **Repo settings**: enable private vulnerability reporting (SECURITY.md and the issue-template contact link point at `security/advisories/new`); branch protection on `main` requiring the `gate` job; topics (`shadcn`, `shadcn-ui`, `base-ui`, `registry`, `ai-elements`, `nextjs`, `tailwindcss`). The `upstream` label is created by the workflow on first drift; `bug`/`enhancement` are GitHub defaults.
6. **Before opening the PR**: `git status` must show none of the other lenses' artefacts — `tests/browser/qa-round2/`, `tests/unit/qa-round2-*.test.ts` (including mine), and no leftover in-place mutation of `registry/ai/*.tsx` (they rotated through seven files while I ran; each was restored, but check once more at the end). Then `pnpm gate` and `pnpm test:e2e` on a clean clone, cold `node_modules/.vite`.
7. **Known judgement calls to confirm**: `pnpm audit` as a hard gate (F9); Desktop-only e2e (the mobile-only axe findings from round 1 were fixed in components but are not re-checked by CI); `CODE_OF_CONDUCT.md` contact as a GitHub profile URL; `robots.txt` `Host` value (F13).

## Verdict

**Not yet, by one small PR.** The registry, its build output, the directory entry, licensing and
docs are ready; `tsc`, Biome and Prettier are clean on the tracked tree; every round-1 finding
in this lens is fixed or is the lead's tag. What stands between this tree and a trustworthy
green gate is CI wiring: the built-output checks that silently skip in CI (F1), the pre-bundle
list and one wall-clock assertion that turned my only full coverage run red (F2), and the
unguarded public origin (F3). Fix those, tag, set the Vercel variable, and ship.
