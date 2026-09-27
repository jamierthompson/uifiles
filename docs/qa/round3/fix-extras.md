# fix-extras

Tree at HEAD `c282003`; no commits. Changed only the eight owned files (`git status --porcelain`: `.claude/rules/registry.md`, `AGENTS.md`, `CHANGELOG.md`, `app/preview/reasoning/page.tsx`, `e2e/previews.spec.ts`, `tests/browser/ai/code-block.test.tsx`, `tests/browser/ai/reasoning.test.tsx`, `tests/unit/registry.test.ts`). Every scratch mutation of a non-owned file (`registry/ai/reasoning.tsx`, `registry/ai/code-block.tsx`, `registry/ai/registry.json`) went through `fix-extras/mutate.py`, which restores the bytes and asserts the sha256; `git diff --stat -- registry/` is empty. Scratch: `.../qa/round3/fix-extras/` (`mut/*.log`, `runs/*.log`, `mutate.py`).

## Fixed

- verify-markdown-surfaces-tests:P1 (reasoning does not pin the inherited shiki pair / "Code" region) — new test in "reasoningContent markdown surfaces": a `ts` fence with one ~800 px line inside `ReasoningContent` at 375 px; asserts the `const` token's `--sdm-c`/`--shiki-dark` pair is `#A0111F`/`#FF9492` (as `response.test.tsx:257-289` does for `MessageResponse`), the body overflows, `<html>` does not, the body is a named `role="group"` "Code" tab stop, axe light + dark — `tests/browser/ai/reasoning.test.tsx:848` › "highlights a code fence with the high-contrast GitHub pair and scrolls a line wider than a phone inside a named Code tab stop" (failed before: with `reasoning.tsx:250` → `<MessageResponse shikiTheme={["github-light", "github-dark"]}>`, HEAD's file passes `48 passed (48)` (log `mut/BEFORE-reasoning-head-M7.log`); the new file fails `expected [ '#D73A49', '#F97583' ] to deeply equal [ '#A0111F', '#FF9492' ]`; passes on the pristine source).
- verify-markdown-surfaces-tests:N2 — the link-dialog test now checks the rendered link text is Streamdown's safety button before clicking (`tagName === "BUTTON"`, `data-streamdown="link"`) — `tests/browser/ai/reasoning.test.tsx:920-926`. Under `linkSafety={{ enabled: false }}` it now fails in 100 ms with `expected 'A' to be 'BUTTON'` (was a 14,984 ms locator timeout; `expect.element` on a missing locator waits for the test timeout in Vitest 5, so the check is synchronous on the text element).
- Task 2 (code-block start-up test only worked first in file) — `tests/browser/ai/code-block.test.tsx:135-150`: `coldCodeBlock()` imports a copy of `registry/ai/code-block.tsx` under its own URL (`new URL("../../../registry/ai/code-block.tsx", import.meta.url)` + `?copy=<uuid>`, `/* @vite-ignore */`), which has its own `highlighterPromise`/`languageLoads`/token caches but the same React and the same mocked `shiki` (all its bare imports resolve to the same pre-bundled URLs; nothing new for `optimizeDeps`). `vi.resetModules()` + `import("@/registry/ai/code-block")` was tried first and returns the SAME module in browser mode (probe: `a.CodeBlock === CodeBlock` true; `resetModules` only clears `evaluatedModules`, which native ESM does not use). The start-up test and the twelve-language test both run on a fresh copy and assert deltas (`shiki.instances - before === 1`); the start-up test also asserts the injected failure was consumed; `coldCodeBlock` asserts the copy is a different module instance (guard). `beforeEach` now also clears `failNext`/`failStart`. The twelve-language assertion is stronger: the requested grammars equal exactly the 12 distinct languages (was "no duplicates"). Failed before: `--sequence.shuffle --sequence.seed=12345` → `AssertionError: no block in this file has highlighted yet: expected 1 to be +0`, `1 failed | 53 passed (54)` (`mut/BEFORE-code-block-head-shuffle-12345.log`); passes after under seeds 12345, 777, 424242 and three random seeds.
- Task 3 (reasoning preview at page level) — `app/preview/reasoning/page.tsx:19-44,104`: the "Finished (duration supplied, opened by default)" demo renders `finishedText` = the original text plus a `ts` fence with one long line (`export const revalidate = 60 // and revalidateTag("profile") in the rename action`), a four-column caching table (headers as the tests' `WIDE_TABLE`), and the response preview's regularised logistic loss (byte-identical line, `diff` checked), framed as reasoning ("If a model predicted which profiles get renamed…"; closes "Not worth it for a profile page: a 60 second window is simpler."). The streaming demo keeps the plain text (partial `$$` while streaming would risk KaTeX console output, and `waitForIdle` does not wait for this page's stream: nothing on it sets `aria-busy`). One `<h1>` and the layout title unchanged. Proven by a new browser test rendering the page inside the layout's `<main>` at 375 px: the finished section's code body, table scroller and `.katex-display` are named "Code"/"Table"/"Math" tab stops, `<html>` does not widen, axe clean light + dark on the section — `tests/browser/ai/reasoning.test.tsx:884` › "scrolls the reasoning preview's code, table and formula in named tab stops at 375 px without widening the page" (fails with the old demo text: `expected null to deeply equal { tabindex: '0', role: 'group', … }`; fails with a short code line: Code region unmarked).
- Task 3 (e2e generalised) — `e2e/previews.spec.ts:30,49-56`: every per-preview test (both projects, both schemes) now asserts `document.documentElement.scrollWidth <= clientWidth` after axe; the test name gains "does not scroll sideways". It runs at desktop too (the layout is `max-w-3xl`, and the round-3 QA sweep measured `overflow: null` on every route in all four contexts, `rendered-surface/sweep.json`); at 375 px (`chromium-mobile`) it is the WCAG 1.4.10 check the lead asked for. The response-specific formula test is unchanged. Not run (e2e forbidden); `pnpm exec tsc --noEmit` clean; `pnpm exec playwright test --list` → **Total: 96 tests in 3 files** (same count as HEAD, `mut/BEFORE-e2e-list.log`: assertions were added to existing tests, none added).
- Task 4 (registry invariants) — `tests/unit/registry.test.ts`:
  - `staleDependencies` (`:96`) + test `:458` › "every dependency of an item that ships files is imported by one of its files or loaded by an @import key of its css": uses the file's `importedPackages` scanner plus `cssImportedPackages` (`:80`, `@import "<pkg>/…"` and `@import url("<pkg>/…")` keys of `css`; relative, absolute and URL imports ignored). Failure message: `reasoning declares "streamdown", which no file imports and no css @import loads`. Only items with files are held to it: the file-less `base` item declares its style's packages (`cn`, `class-variance-authority`, `lucide-react`, `@base-ui/react`) and would fail otherwise (mutation U-M7).
  - Self-test `:469` (synthetic item, in-memory sources, independent of the manifest) proves the message and that a css `@import` counts as a use.
  - `repeatedCssRules` (`:133`) + test `:542` › "no item repeats a css rule that one of its @uifiles dependencies already ships": rules are key paths to a declaration block or an empty statement (`@layer base > .katex-display`, `@import "katex/dist/katex.min.css"`), compared at selector level (a different declaration on the same selector still counts), over the transitive `@uifiles/*` closure (shadcn's resolver deep-merges the css of every resolved item: `packages/shadcn/src/registry/resolver.ts:348-351` in the upstream clone). Message: ``reasoning repeats `@layer base > .katex-display`, which @uifiles/response ships``.
  - Self-test `:546` (synthetic items): direct repeat, transitive-only repeat (`agent` → reasoning → response), one report when a dependency is reached twice (`chat`), same rule on an unrelated item not reported, different declaration still reported.
  - Scratch confirmations on the real manifest (restored, sha256-checked, `git diff --stat -- registry/ai/registry.json` empty): U-M1 add `streamdown@^2.6` to reasoning → fails; U-M2 give reasoning `css: {"@layer base": {".katex-display": …}}` → fails; U-M8 drop response's `@import "katex/dist/katex.min.css"` key → fails with `response declares "katex"…`. The current manifest passes both.
  - `packageOf` extracted from `importedPackages` (no behaviour change; the forward check still passes).
- Task 5 (docs):
  - `.claude/rules/registry.md:15-27`: dependency rule now states both directions; new bullet on the `css` field (CLI writes and merges it along the dependency tree; `response` ships the two imports and `.katex-display`; dependents do not repeat them, enforced by the unit test; only `@source` stays manual because its path is relative to the consumer's CSS file); the `docs` bullet now says "every remaining manual step (the `@source` line)".
  - `AGENTS.md`: `pnpm test:e2e` row lists the new assertions (title, no sideways scroll, branch HTML, response formula); "End to end" bullet likewise; the "Declare every bare npm import" and "Markdown needs CSS" bullets now name the two new unit checks. Prettier re-padded the command table (the e2e cell became the widest), so the other six table rows change whitespace only.
  - `CHANGELOG.md` `[0.1.0]` › Added, the existing test-infrastructure bullet: adds the no-sideways-scroll check and the two registry unit checks. No user-visible entry: nothing user-visible changed.

## Not fixed and why

- `docs/architecture.md` §5 does not list the no-sideways-scroll e2e check or the two unit invariants: out of ownership. Nothing I wrote contradicts it (it still correctly lists the per-route title, branch HTML and response formula checks). Exact text under Requests.
- Rest of the verifier's notes: N1 (no axe in the two code-block start-up tests) and N3 (formula-once test predates the change) need no change, as the verifier said.

## Tests

- `tests/browser/ai/reasoning.test.tsx`: 48 → 50 tests (+ Code/shiki-pair test, + preview-page test; link test strengthened).
- `tests/browser/ai/code-block.test.tsx`: 54 → 54 (two tests restructured onto a cold module copy; hooks reset the failure flags).
- `tests/unit/registry.test.ts`: 26 → 30 (two invariants + two self-tests). Unit project 331 → 335.
- No upstream tests apply (no component source changed).

Mutation checks (each run over the whole file unless noted; restore byte-identical and sha256-asserted by `mutate.py`; logs in `fix-extras/mut/`):

| id | file | mutation | result |
| --- | --- | --- | --- |
| R-M7 | registry/ai/reasoning.tsx | `<MessageResponse shikiTheme={["github-light", "github-dark"]}>` | caught (2): the new fence test (`['#D73A49','#F97583']` vs `['#A0111F','#FF9492']`) and the preview test (axe `color-contrast` 4.11 on the dark `#6a737d` comment). HEAD's test file: survived, `48 passed (48)` |
| R-M2 | registry/ai/reasoning.tsx | `linkSafety={{ enabled: false }}` | caught (1) in 100 ms: `expected 'A' to be 'BUTTON'` (was a 14,984 ms timeout) |
| R-M1 | registry/ai/reasoning.tsx | `82f6e83` version (bare Streamdown) | caught (5): Math, Table, Code/pair, preview page, link dialog |
| P-M1 | app/preview/reasoning/page.tsx | finished demo back to `fullText` | caught: preview test, Code region `null` |
| P-M2 | app/preview/reasoning/page.tsx | code line shortened to `export const revalidate = 60` | caught: preview test, Code region unmarked |
| CB-M5 | registry/ai/code-block.tsx | `highlighterPromise = undefined` removed | caught (1): start-up test (`expected 'rgba(0, 0, 0, 0)' to be 'rgb(255, 255, 255)'`) |
| CB-M4 | registry/ai/code-block.tsx | `languageLoads.delete(language)` removed | caught (2): start-up test, ruby retry |
| CB-M3 | registry/ai/code-block.tsx | `82f6e83` version (per-language highlighter) | caught (2): twelve languages (`expected 12 to be 1` plus the guard's `[Shiki] 10 instances…` warn), ruby retry |
| CB-M8 | code-block.test.tsx | copy imported from the plain specifier (same module) | caught (2) under seed 12345: the not-the-same-module guard fires |
| U-M1 | registry/ai/registry.json | reasoning `dependencies` += `streamdown@^2.6` | caught (1): `reasoning declares "streamdown"…` |
| U-M2 | registry/ai/registry.json | reasoning gains `css` with `@layer base > .katex-display` | caught (1): ``reasoning repeats `@layer base > .katex-display`, which @uifiles/response ships`` |
| U-M8 | registry/ai/registry.json | response's `katex` stylesheet `@import` key removed | caught (1): `response declares "katex"…` |
| U-M3 | registry.test.ts | css `@import`s not counted as a use | caught (2) |
| U-M4 | registry.test.ts | dependency walk direct-only | caught (1): repeat self-test (transitive `agent`) |
| U-M5 | registry.test.ts | no `seen` dedupe | caught (1): repeat self-test (`chat` reported twice) |
| U-M6 | registry.test.ts | rules keyed by declaration, not selector | caught (1): repeat self-test |
| U-M7 | registry.test.ts | files-only filter removed | caught (1): `base declares "cn"`, `"class-variance-authority"`, `"lucide-react"`, `"@base-ui/react"` |

Three-run evidence (final files; `fix-extras/runs/`):

```
run1 unit       Tests  335 passed (335)   run1 reasoning  Tests  50 passed (50)   run1 code-block  Tests  54 passed (54)
run2 unit       Tests  335 passed (335)   run2 reasoning  Tests  50 passed (50)   run2 code-block  Tests  54 passed (54)
run3 unit       Tests  335 passed (335)   run3 reasoning  Tests  50 passed (50)   run3 code-block  Tests  54 passed (54)
code-block --sequence.shuffle: seed "1790484585854" 54 passed | seed "1790484594804" 54 passed | seed "1790484603923" 54 passed
code-block fixed seeds 12345 / 777 / 424242: 54 passed each (12345 failed at HEAD)
reasoning --sequence.shuffle: seed "1790484612970" 50 passed (50)
```

Coverage: `vitest run --project browser tests/browser/ai/code-block.test.tsx --coverage.enabled --coverage.include=registry/ai/code-block.tsx` gives the same numbers before and after (98.57 stmts / 86.27 branch / 96.72 funcs / 99.49 lines, uncovered line 540 only), so the copy's execution is attributed to `code-block.tsx` (the query is stripped by `fileURLToPath`) and the start-up catch stays covered. Reports written to scratch, not the repo.

Console guard: no new `allowConsole`; the existing one in the start-up test still asserts `console.error` (`toHaveBeenCalledWith` + `toHaveBeenCalledTimes(1)`). No `vi.spyOn(console…).mockImplementation`, no fixed sleeps, fixtures in `<main>`, axe through `tests/a11y.ts`.

## Registry entry changes

- None.

## Docs strings (exact sentences)

- `.claude/rules/registry.md`:
  - "Declare every bare npm import in the item's `dependencies` (`cn` included), pinned to a range when upstream leaves it bare, and no package the item does not use: `tests/unit/registry.test.ts` fails on an undeclared import and, for an item that ships files, on a declared package that none of its files imports and no `@import` key of its `css` loads."
  - "CSS a consumer needs goes in the item's `css` field, which the CLI writes into their CSS file and merges along the dependency tree. The `response` item ships `@import "streamdown/styles.css"`, `@import "katex/dist/katex.min.css"` and the `.katex-display` rule; items that depend on `@uifiles/response` do not repeat them (the unit test fails on a `css` rule an `@uifiles/*` dependency already ships). Only Streamdown's `@source` line stays manual, because its path is relative to the consumer's CSS file."
  - "Put every intentional divergence from upstream and every remaining manual step (the `@source` line) in the item's `docs`; the current list is `docs/architecture.md` §3."
- `AGENTS.md` `pnpm test:e2e` row: "Playwright: axe and a clean console over every preview page and the home in light and dark, at desktop and 375 px phone width; each preview's `<title>` starts with its registry title and no preview scrolls sideways; the served HTML of `/preview/branch` carries its branch selector and count; the wide formula on `/preview/response` overflows its own box at 375 px; plus the registry endpoints, `/llms.txt`, and a keyboard walk of the chat preview. Requests to any host but localhost are aborted. Locally it starts `pnpm registry:build && pnpm dev` (or reuses a running server); in CI it runs against `pnpm start` after `pnpm build`."
- `AGENTS.md` "End to end" (inserted after the `html.light`/`html.dark` sentence): "Each preview's `<title>` must start with its registry item's title (then ` · uifiles`), and the page must not scroll sideways (`scrollWidth` of `<html>` at most its `clientWidth`, at desktop and at 375 px: wide code, tables and formulas scroll in their own boxes). `/preview/branch` must serve its branch selector and count in the HTML, not only after hydration, and at 375 px the wide formula on `/preview/response` must overflow its own box while the page does not."
- `AGENTS.md` "Declare every bare npm import": "… `tests/unit/registry.test.ts` checks the imports against the entry in both directions (for an item that ships files, a declared package that none of its files imports and no `@import` key of its `css` loads fails too), that each package is installed here at that major, and that a cross-item `@/registry/ai/<x>` import has a matching `@uifiles/<x>` entry."
- `AGENTS.md` "Markdown needs CSS": "… inherit, so they do not repeat them (`tests/unit/registry.test.ts` fails on an item that repeats a `css` rule an `@uifiles/*` dependency ships): …"
- `CHANGELOG.md` (existing bullet, new part): "…, Playwright with axe over every preview page in light and dark at desktop and phone width with a clean-console assertion, a check that the page never scrolls sideways and every third-party request blocked, a keyboard walk of the chat preview, unit checks that the `dependencies` of every item with files match its imports in both directions (a `css` `@import` counts as a use) and that no item repeats a `css` rule an `@uifiles` dependency already ships, and a weekly upstream-drift check …"

Verified against code: the title/branch/response assertions (`e2e/previews.spec.ts:41-47,65-73,78-99`), the new width assertion (`:49-56`, both projects), `collectPageProblems` for the clean console, `tests/unit/registry.test.ts:458,542`, response's `css` keys in `registry/ai/registry.json`, the CLI's deep merge (upstream `resolver.ts`).

## Requests for other owners

- `docs/architecture.md` §5 (docs owner), "End to end" bullet: replace "with console errors and warnings asserted empty and each preview's `<title>` starting with its item's registry title, plus" with "with console errors and warnings asserted empty, each preview's `<title>` starting with its item's registry title and no preview scrolling sideways (`<html>` `scrollWidth` at most its `clientWidth`, at desktop and at 375 px), plus". "Unit" bullet: replace "the registry invariants (unique names, descriptions, the `@uifiles/` fork rule, one alias per primitive)" with "the registry invariants (unique names, descriptions, the `@uifiles/` fork rule, one alias per primitive, `dependencies` that match each item's imports in both directions with a `css` `@import` counting as a use, and no `css` rule repeated from an `@uifiles/*` dependency)".
- Lead: run `pnpm test:e2e` after a build. New assertions to watch: the per-preview no-sideways-scroll check at desktop and 375 px (evidence it holds: round-3 QA `sweep.json` shows `overflow: null` on every route in all four contexts on the old build, and the new reasoning preview content is covered at 375 px by the browser test above), and the reasoning preview's finished demo (fence, table, formula) under axe at 375 px in light and dark.

## Strict-flag typecheck

- `pnpm exec tsc --noEmit` (tsconfig has `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`): exit 0. `pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`: exit 0.
- Errors remaining in files I own: none. Errors in files I do not own: none.

## Commands run

All prefixed with `export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH` (pnpm resolves from `/opt/node22/bin`).

```
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx --sequence.shuffle --sequence.seed=12345   # HEAD: 1 failed
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx -t probe   # resetModules probe, then query-URL probe (scratch edits, removed)
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx [--sequence.shuffle [--sequence.seed=12345|777|424242]]
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx --coverage.enabled --coverage.include=registry/ai/code-block.tsx --coverage.reportsDirectory=<scratch>/cov-{before,after}
pnpm exec vitest run --project browser tests/browser/ai/reasoning.test.tsx [-t preview|-t 'reasoning preview'] [--sequence.shuffle]
pnpm exec vitest run --project unit tests/unit/registry.test.ts
pnpm exec vitest run --project unit   # x3
python3 fix-extras/mutate.py <id> <file> <old> <new> <cmd>   # the 17 mutations in the table, plus BEFORE captures (HEAD shuffle, HEAD reasoning test under R-M7, HEAD e2e list)
pnpm exec prettier --check|--write <owned files>
pnpm exec biome check <owned ts/tsx files>
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals
pnpm exec playwright test --list   # 96 tests (also 96 with HEAD's spec)
pnpm registry:validate
git status --porcelain ; git diff --stat -- registry/
```
