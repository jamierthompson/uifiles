# verify-extras-regressions

refuted: false

Lens: regressions and side effects on neighbours. Tree at HEAD `5f37284` (the checkpoint that bundles the group's work); every hunk of the eight owned files plus `docs/architecture.md` was diffed against `c282003` and accounted for below. No tracked file edited; `git status --porcelain` is empty at the end (only the ignored `.vitest/`). Two concurrent verifiers mutated `registry/ai/reasoning.tsx` and `registry/ai/code-block.tsx` during my runs (seen in `git status`, not touched by me); where a run was confounded by that it is said so and was re-run on a pristine tree. Logs: `qa/round3/verify-extras-regressions/*.log`.

## Problems

None that refute. Notes, in decreasing weight:

1. `tests/unit/registry.test.ts:80-89` (`cssImportedPackages`) counts only `@import` keys of `css` as a use. A future item that declares a package it loads through a `css` `@plugin "<pkg>"` key, or a peer dependency of a plugin it imports that none of its files import, would be reported stale by `:458`. No current item is affected: `streamdown`, `@streamdown/{cjk,code,math,mermaid}` list `katex`, `shiki`, `mermaid` as regular `dependencies` (not peers), and `response` declares `katex@^0.16` for its `@import "katex/dist/katex.min.css"` key, which the regex matches. When the case arrives the regex at `:83` needs `@import|@plugin`. Type-only imports are counted as a use by `importedPackages` (`:49` matches `import type … from "pkg"`), so they cannot trigger a false stale report; a package named only in a `docs` string is (correctly) not a use.
2. `docs/architecture.md:272` (§5 Unit bullet, the lead's sentence) says "`dependencies` that match each item's imports in both directions" without the "item that ships files" qualifier that `AGENTS.md:78-82`, `.claude/rules/registry.md:15-19`, `CHANGELOG.md:50-52` and the test (`registry.test.ts:459-460`) carry. The file-less `base` item declares four packages it imports nowhere and is exempt.
3. Environment, for the lead, not the coder: concurrent Vitest browser processes on one checkout rewrite the shared `node_modules/.vite/vitest/ef98…/deps` (`_metadata.json` mtime 05:04:18 while another verifier's `vitest run … code-block.test.tsx` was in `ps`; the `?v=` browserHash changed ea06e2b7 → f7a985de between my runs). A test that lazily imports a deps chunk mid-run then fails with `Failed to fetch dynamically imported module: …/deps/ruby-BWGOp1bx.js` — this hit `code-block.test.tsx:765` (the pre-existing ruby grammar retry, not a restructured test) in my first two coverage runs; the third, after waiting for `registry/` to be pristine, passed 54/54. The cold-copy tests are no more exposed than that test.
4. Each `coldCodeBlock()` (`code-block.test.tsx:142-150`) creates a real Shiki highlighter through the mock: three per file now (main module + two copies). Shiki `console.warn`s at ten, which the console guard turns into a failure, so about seven more cold tests in this file would trip it. Not a current problem.
5. `tests/unit/test-setup.test.ts:519` scans `registry/**`, `components/**`, `tests/browser/**` for bare specifiers but not `app/**`; `reasoning.test.tsx:6` now imports `app/preview/reasoning/page.tsx` (bare imports: `react` only, listed). Same pattern as `response.test.tsx:7` and `model-selector.test.tsx:5`, so not a regression, but a preview page's future bare import reached by a browser test is a blind spot of the invariant.

## (1) Reasoning preview content

- Hunks: `app/preview/reasoning/page.tsx:19-42` adds `finishedText` (= `fullText` + a `ts` fence with one 82-char line, a four-column table, a `$$` display formula, a closing sentence); `:104` switches only the "Finished (duration supplied, opened by default)" demo to it. `StreamingReasoning` (`:48-73`) still streams `fullText`; `STREAM_DURATION_MS`/`TICK_MS` untouched; the third demo unchanged. Confirmed: streaming demo and its timing unchanged.
- Auto-open/close: `registry/ai/reasoning.tsx:94-148` — the finished demo has `defaultOpen` and never streams, so `hasEverStreamedRef` stays false and the auto-close timer never arms; the wide content is stable for axe and for the width check.
- Server render: `tests/unit/ssr.test.ts` renders `Reasoning`/`ReasoningContent` (`:321-328`), not the page; `tests/unit/site.test.ts:344-390` checks the layout title and the single `<h1>` against `byName("reasoning").title` = "Reasoning" — both unchanged. Unit project three runs: `335 passed (335)` each (`unit-run{1,2,3}.log`). The hydration path for a fence inside `MessageResponse` (`response.tsx` polls until React owns the scroller, `:158-171`) is already exercised in the e2e sweep by `/preview/branch` (the only other preview page with a ```` ``` ```` fence) and the chat block. e2e itself not run (forbidden).
- Keyboard walk: `grep -rn reasoning e2e/` matches only the `waitForIdle` comment (`helpers.ts:93`); `chat-keyboard.spec.ts` visits `/preview/chat` only. `waitForIdle` keys on `[aria-busy="true"]`, which nothing in `reasoning.tsx` sets, so on `/preview/reasoning` it returns at once as before; the mid-stream demo holds plain text.
- Links: `finishedText` has no `](`, no `http`, no `www.` (`sed -n '22,42p' … | grep` → none), so no link-safety button and no dialog during the axe sweep.
- Sideways scroll at 375 px: `reasoning.test.tsx:884-914` renders the page inside the layout's `<main>` classes at `page.viewport(375, 800)`, requires the code body, table scroller and `.katex-display` to be named groups (set only when they overflow, `response.tsx:83-95`, so the check is not vacuous), asserts `documentElement.scrollWidth <= clientWidth`, axe light and dark on the finished section. Passed in runs A, B, C. Desktop is bounded by `max-w-3xl`; the round-3 QA `rendered-surface/sweep.json` has 92 overflow entries, all null.

## (2) `e2e/previews.spec.ts`

- Hunks: `:30` test name gains "does not scroll sideways"; `:49-56` adds the `scrollWidth <= clientWidth` evaluation after `expectNoAxeViolations` and before `expect(problems).toEqual([])`. Inside the `for (name) for (scheme)` loop, so it runs in both projects (desktop and `chromium-mobile` 375×812, `playwright.config`) and both schemes. No existing assertion removed or loosened (title regexes `:44-47`, axe `:48`, console `:57`, branch HTML `:65-73`, response formula `:78-96` all intact).
- `pnpm exec playwright test --list` → `Total: 96 tests in 3 files`; the coder's HEAD capture (`fix-extras/mut/BEFORE-e2e-list.log`) also 96. No `test(` added.
- The old test name is referenced nowhere else (`grep "passes axe and logs"` → only `registry.spec.ts:19`, the home test). `tsconfig.json` includes `**/*.ts`, so `pnpm exec tsc --noEmit` (exit 0) covers the spec.

## (3) `tests/browser/ai/code-block.test.tsx`

- Hunks: `:125-126` `beforeEach` also clears `failNext`/`failStart`; `:135-150` `coldCodeBlock()` imports `registry/ai/code-block.tsx?copy=<uuid>` and asserts a different `CodeBlock` identity; the start-up test (`:152-184`) and the twelve-language test (`:186-243`) render the copy and assert deltas; `:169` asserts the injected failure was consumed; `:238-241` tightens the grammar set to exactly the twelve languages.
- Mock sharing: `vi.mock("shiki")` (`:38-72`) is keyed by the resolved module URL; the copy's `import "shiki"` is rewritten to the same pre-bundled URL, so it gets the same factory instance and the same hoisted `shiki` state. Proof in the tests themselves: `shiki.instances` increments only inside the mocked `createHighlighter`, and `expect(shiki.instances - before).toBe(1)` passes for both cold tests (a second mock or the real shiki would leave the delta at 0). Everything else the copy imports (`react`, `@/components/ui/button`, `@/components/ui/select`, `lucide-react`, `cn`) resolves to the same URLs as the main module: one React, one Base UI.
- Coverage: `pnpm exec vitest run --project browser --coverage --coverage.include=registry/ai/code-block.tsx tests/browser/ai/code-block.test.tsx` on a pristine tree → `54 passed`, one entry `/registry/ai/code-block.tsx`, 98.57 stmts / 86.27 branch / 96.72 funcs / 99.49 lines, uncovered 540 — identical to the coder's `cov-before` and `cov-after` summaries. No `?copy=` entry; the copy's execution is attributed to the file, nothing diluted. (Two earlier attempts failed on the ruby-chunk fetch, note 3.)
- `optimizeDeps`: the copy introduces no bare specifier the main module lacks; the dynamic import is a URL, not a bare specifier, and `tests/unit/test-setup.test.ts:510-534` passes (unit x3). No re-optimize was triggered by the copy in runs A/B/C (no "Failed to fetch" in those logs).

## (4) `tests/unit/registry.test.ts`

- Hunks: `:60-68` `packageOf` extracted (behaviour-preserving; the forward check still passes); `:70-89` `cssOf`/`cssImportedPackages`; `:91-110` `staleDependencies`; `:112-126` `cssRules`; `:128-160` `repeatedCssRules`; `:454-468` the stale check over items with files; `:470-496` its self-test; `:537-580` the css `describe` with the real-manifest repeat check and its transitive self-test.
- Legitimacy analysis: see note 1 (docs-only mention is not a use, correctly; type-only import is a use, so no false stale; `@plugin` key is the one future false positive). `base` (`files: []`) is exempt by `:459`; `loadRegistry` rewrites `files[].path` to root-relative (`lib/registry.ts:46`), so the `readFileSync(join(root, path))` reads resolve. Nothing depends on `@uifiles/base` (grep), so its `@layer base` rules cannot be reported as repeats. Selector-level comparison reports an intentional override of a dependency's declaration on the same selector — by the lead's decision (dependents do not repeat), stated in the message. String comparison of key paths means a cosmetically different spelling of the same selector would not be caught (false pass, not false fail).
- Three runs of the unit project: `335 passed (335)` ×3.

## (5) Docs

- `git diff -w c282003 -- AGENTS.md`: in the command table only the separator row (longer dash run) and the `pnpm test:e2e` cell change; the six other rows are padding only. Content hunks: `:78-82` (both directions, files qualifier, css `@import`), `:101-103` (repeat check), `:207-213` (e2e title, no sideways scroll, branch HTML, response formula). "axe and a clean console over … the home" is backed by `e2e/registry.spec.ts:19-34` (`collectPageProblems` + `expectNoAxeViolations` on `/`).
- `.claude/rules/registry.md:15-27`, `CHANGELOG.md:46-53`, `docs/architecture.md:272` and `:284` agree with `AGENTS.md`, with `registry.test.ts:458/542`, with `e2e/previews.spec.ts:49-56`, and with `response`'s `css` in `registry/ai/registry.json` (two `@import` keys + `@layer base > .katex-display`). One imprecision, note 2.

## (6) Static and runs

```
pnpm lint            → biome check: 151 files, no fixes; exit 0
pnpm format:check    → All matched files use Prettier code style!; exit 0
pnpm exec tsc --noEmit → exit 0
pnpm registry:validate → exit 0
unit x3              → Test Files 8 passed (8) / Tests 335 passed (335)  (each run)
run A (reasoning + code-block + tool + blocks/chat) → Test Files 4 passed (4) / Tests 207 passed (207)
run B (reasoning + code-block)                     → Test Files 2 passed (2) / Tests 104 passed (104)
run C (reasoning + code-block)                     → Test Files 2 passed (2) / Tests 104 passed (104)
coverage (code-block, pristine tree)               → 54 passed (54); code-block.tsx 98.57 | 86.27 | 96.72 | 99.49 | 540
playwright --list                                  → Total: 96 tests in 3 files
```

Reasoning test counts: 50 in the file (48 at c282003 + the shiki-pair/Code tab-stop test `:848` + the preview test `:884`; the link test `:920-926` strengthened, no test removed). Code-block: 54 before and after.

## Left behind

Nothing in the tree. My scratch logs stay under `qa/round3/verify-extras-regressions/`; the coverage report dirs were removed; the one `.vitest` failure screenshot my confounded runs wrote was removed (ignored path).
