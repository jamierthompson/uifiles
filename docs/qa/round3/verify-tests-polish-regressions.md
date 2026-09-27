# verify-tests-polish-regressions

refuted: true

Lens: regressions and side effects on neighbours. HEAD `5643605`, checkpoint `9019bdf`. Evidence scripts and logs: `qa/round3/verify-tp/` (`origin-table.mjs`, `scan-compare.mjs`, `static.log`, `browser.log`, `unit.log`, `chat-submit-name.log`, byte backups). Every mutation I made was restored from my own copy and sha256-verified (`RESTORED-OK` in each log); `git diff --stat` on those files is empty. Other verifiers' live mutations were present in the tree during my runs (`registry/ai/prompt-input.tsx`, `registry/blocks/chat/components/blocks/chat.tsx`, `registry/blocks/registry.json`): the tree was clean at my first `git status`, and every run below is annotated with the dirty set at the time.

Refuted on one demonstrable (latent) coverage regression and one doc drift; every other claim held.

## Problems

1. **`tests/unit/test-setup.test.ts:539` — the `import type` strip swallows following value imports (coverage regression vs `9019bdf`).**
   `const typeOnly = /^(?:import|export)\s+type\s[^"]*"[^"]*"/gm`: `[^"]*` crosses newlines, so any line starting `import type`/`export type` that has no quote on it removes everything up to the next quoted string in the file. Today that produces 92 multi-line matches in the reached files (`registry/ai/branch.tsx` 84 lines, `registry/ai/prompt-input.tsx` 75, `registry/ai/reasoning.tsx` 70, `tests/console-guard.ts` 30; `scan-compare.mjs` output). No current file loses a specifier (old spec set == new spec set, 37/37, gap `[]` both ways), so nothing fails now, but a bare value import placed after such a line is invisible, which the checkpoint's regex saw. Demonstration on `app/preview/reasoning/page.tsx` (a file the walk reaches; restored, sha `312aa0f8…` before and after):
   - T1: `export type Dummy = { a: number }` then `import { jsx } from "react/jsx-runtime"` (not in `optimizeDeps.include`) → `Tests 26 passed (26)` (survived).
   - T2 (control): the same two lines in the other order → `AssertionError: expected [ 'react/jsx-runtime' ] to deeply equal []` (caught).
   - The `9019bdf` regex on the T1 text: `old scan sees: [ 'react/jsx-runtime', 'react' ]`; the HEAD regex: `new scan sees: [ 'react' ]`.
   Fix: strip only real type-only from-statements, e.g. `/^(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+"[^"]*"/gm` (multi-line `import type {\n…\n} from "x"` still matches; a type alias never does).

2. **`.claude/rules/registry.md:18-19` is stale**: "a declared package that none of its files imports and no `@import` key of its `css` loads". `AGENTS.md:80-81`, `docs/architecture.md:271` and `tests/unit/registry.test.ts:75-112` now count `@plugin` too. (Not in the coder's owned list, but the task asks the four docs to agree.)

## Evidence by task item

### (1) `e2e/origin.ts`
Full before/after table (`node origin-table.mjs`, 21 inputs × 5 calls) — every row that changed is a value `URL.canParse` rejects; every parseable input is byte-identical in behaviour:

| input | fn | before (9019bdf) | after (HEAD) |
|---|---|---|---|
| unset | isLocal / expects / expectsCI / origin / originCI | n/a / false / true / "http://localhost:3000" / THROW "not set" | same |
| empty, whitespace | isLocal | THROW TypeError Invalid URL | false (never reached by callers: `expectsPublicOrigin` short-circuits) |
| empty, whitespace | expects / origin | false / "http://localhost:3000" | same |
| http://localhost:3000 (and /), http://localhost, http://127.0.0.1:3000, http://[::1]:3000, http://app.localhost:3000 | isLocal / expects / origin | true / false / value without slash | same |
| http://localhost.evil.test, http://0.0.0.0:3000, https://uifiles.dev (and /), mailto:x@y | isLocal / expects / origin | false / true / value | same |
| uifiles.dev, //uifiles.dev, https://, localhost, "not a url", "garbage ::: " | isLocal | THROW TypeError | false |
| same | expects | THROW TypeError | true |
| same | expectsCI | true | true |
| same | origin / originCI | returned the garbage verbatim ("uifiles.dev", "https:/", …) | THROW `NEXT_PUBLIC_BASE_URL must be an absolute URL such as https://uifiles.dev; got "…"` (identical to `baseUrl()`, asserted at `tooling.test.ts:165`) |
| localhost:3000 (bare host:port) | all | parses as scheme `localhost:` → isLocal false, expects true, origin "localhost:3000" | same (unchanged; `baseUrl()` returns "null3000" for it — pre-existing, out of scope; the "same message" claim holds only for `canParse`-rejected values) |

Callers: `e2e/helpers.ts:37` `isLocalRequest(url.href)` (always parsed → unchanged; re-exports `expectsPublicOrigin`, `publicOrigin`); `e2e/registry.spec.ts:43,49,96,115` (`publicOrigin(baseURL)`, `expectsPublicOrigin()`); `e2e/chat-keyboard.spec.ts` and `e2e/previews.spec.ts` import neither; `playwright.config.ts` does not import origin.ts. CI (`https://uifiles.dev`) and local (unset or the `.env.example` localhost) paths are unchanged; only a scheme-less local override changes from `TypeError: Invalid URL` to the build's message. `tooling.test.ts:156-173` covers the boolean answers for `uifiles.dev`, `localhost`, `not a url`, `""` and the throw for `uifiles.dev`, `//uifiles.dev`, `https://`; `:120-147,175-192` keep the loopback table. `git diff 9019bdf --stat` on `e2e/chat-keyboard.spec.ts e2e/registry.spec.ts e2e/helpers.ts playwright.config.ts vitest.config.ts lib/registry.ts` is empty.

### (2) `tests/unit/test-setup.test.ts` scan
- Reach: 73 files at the checkpoint → 81 (extra: `app/preview/model-selector/{logos.ts,model-selector-demo.tsx}`, `app/preview/{reasoning,response}/page.tsx`, `tests/{a11y,axe-tags,console-guard,setup}.ts`), 37 bare specs both ways, unresolved `[]`, gap `[]`.
- Time: scan alone 5 ms → 14 ms; the whole file `1.78s/1.65s` (HEAD) vs `1.72s/1.96s` (9019bdf, byte-restored swap, `RESTORED-OK`). No measurable impact.
- Determinism: `readdirSync` order only affects the traversal; the asserted sets are sorted (`gap`) or expected empty (`unresolved`).
- Future imports: `next/*` from a reached file → gap (T2 above, and the coder's A1); `.css`/`.json` side-effect or default imports → resolved by `""` suffix, not followed, not flagged; `#pkg` imports → treated as bare → gap (no `imports` field in `package.json`, so correct); `./x.js`-style specifiers → `unresolved` (repo convention is extensionless); `import { type X, y } from "pkg"` → counted (conservative, as before).
- Original invariant for `registry/**`, `components/**`, `tests/browser/**`: still enforced today (old set == new set), with the order-dependent hole in Problem 1. No dynamic `import("…")` of a bare spec exists in the scanned dirs (neither scan ever counted those).

### (3) `tests/unit/registry.test.ts`
- Real manifests: only `response` (`@import`×2, `@layer base > .katex-display`) and `base` ship `css`; nothing depends on `@uifiles/base`. In every run the single real-manifest failure was `chat repeats \`.katex-display\`, which @uifiles/response ships as \`@layer base > .katex-display\``, produced by another verifier's live mutation of `registry/blocks/registry.json` (`git diff HEAD` shows `+ "css": { ".katex-display": { "overflow": "visible" } }`; `git show HEAD:registry/blocks/registry.json | grep -c '"css"'` = 0). At HEAD `chat` has no `css` (`own.size === 0` → skipped), so the test passes by construction; it is also the M3 catch demonstrated live.
- Mutations of `registry/ai/registry.json` (`reasoning`; restored, sha `86332852…`): `@media print > .katex-display` → no new problem (a media override is allowed); `@layer components > .katex-display` → caught, transitively too (`reasoning repeats … as @layer base > .katex-display`, `chat repeats … which @uifiles/reasoning ships as @layer components > …`); `@plugin "@tailwindcss/typography"` declared but not installed → caught by "every declared dependency is installed here" (`not in package.json`); `@plugin` key without a declaration → not flagged, same as an undeclared `@import` at the checkpoint (that direction never existed for `css` keys), so `@plugin` only adds a legitimate use and does not weaken the stale-dependency check. `cssImportedPackages` still skips relative/absolute and URL specs.

### (4) `tests/browser/ai/code-block.test.tsx:801` (N9)
Uses the main module; `haskell` appears only in this test (grep over `tests/browser`, `registry`, `app/preview`), so the grammar is cold in any order. State after the test: `languageLoads` holds a successful haskell load, `tokensCache` one haskell entry, `subscribers`/`pending` empty (the `.catch` deletes the key; asserted by `failed` never called), `shiki.failNext` consumed, `errors` spy restored (plus `afterEach` `vi.restoreAllMocks()`), `allowConsole` per test. Runs: `--sequence.shuffle` seed `1790509923260` → `55 passed (55)`; seed `424242` → `55 passed (55)`; `code-block.test.tsx` + `tool.test.tsx` together → `Test Files 2 passed, Tests 91 passed (91)`.

### (5) `e2e/previews.spec.ts`
`playwright test --list`: `Total: 98 tests in 3 files`; JSON listing has 98 entries, duplicates `[]`; the two new titles are `preview/response in {light,dark} mode scrolls its wide formula in its own box instead of widening the page` under both projects (the `test.use({ viewport })` duplication with `chromium-mobile` is pre-existing). Same fixture and assertions as before plus `collectPageProblems` before `emulateMedia`/navigation, the `html` class check and `expect(problems).toEqual([])`, mirroring the per-preview loop. `tsc --noEmit` exit 0 (tsconfig `include` has `**/*.ts`, so e2e is covered). `e2e/chat-keyboard.spec.ts` and `e2e/registry.spec.ts` untouched (empty diff vs 9019bdf).

### (6) `chat.test.tsx`, `suggestion.test.tsx`
`git diff -w 9019bdf`: suggestion `+ await expectNoViolations()` (`:243`); chat `+ await expect.element(screen.getByText("Parameters")).toBeVisible()` and `+ await expectNoViolations()` (`:1382-1384`), and `"Stop"` → `"Submit"` with a two-line comment (`:1707-1709`). The `Parameters` wait is an extra line beyond "the two axe additions", disclosed in the coder's report. HEAD's `registry/ai/prompt-input.tsx:1569` is `aria-label={canStop ? "Stop" : "Submit"}` (checkpoint: `isGenerating ? …`), so the rename holds at HEAD; the test passed alone twice (`1 passed | 66 skipped`), both times with other verifiers' mutations live in `prompt-input.tsx`.

### (7) Docs
`AGENTS.md:80-81, 103-104, 185-189, 214-219` and `docs/architecture.md:271-275, 287-289` match the code (`registry.test.ts:75-178`, `test-setup.test.ts:514-556`, `origin.ts:24-58`, `previews.spec.ts:61-107`) and each other; the `pnpm test:e2e` command-table row (`AGENTS.md:33`) is still accurate. `CHANGELOG.md`'s diff carries only the other group's lines (test/tooling changes are not user-visible, so none is required). No doc quotes a test count. `.claude/rules/registry.md:18-19` is stale (Problem 2).

### (8) Static and runs
`pnpm lint` (biome, 151 files) exit 0; `pnpm format:check` exit 0; `pnpm exec tsc --noEmit` exit 0. Unit project ×2: `Test Files 1 failed | 7 passed (8)`, `Tests 1 failed | 337 passed (338)` both times, the one failure being the live `registry/blocks/registry.json` mutation above (dirty set before and after each run: `registry/ai/prompt-input.tsx`, `registry/blocks/registry.json`); `tests/unit/{test-setup,tooling,site}.test.ts` and the rest all pass. Browser runs as in (4).

## Verdict
The change set does what the report says, the neighbours listed in the brief are byte-identical to the checkpoint, and the static gate is green. Refuted on Problem 1: the new `typeOnly` strip introduces an order-dependent blind spot that the checkpoint's scan did not have (demonstrated T1/T2), even though no current file triggers it; one-regex fix. Problem 2 is a one-line doc fix.
