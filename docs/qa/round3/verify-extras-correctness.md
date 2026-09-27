# verify-extras-correctness (round 3b, group `extras`)

refuted: false

Lens: correctness. Baseline `git show c282003`; HEAD is `5f37284` (the lead re-cut the checkpoint, not a descendant of `c282003`), and `git diff --stat c282003` is exactly the nine files of this group (383+/42-), working tree clean before and after. Every hunk read and accounted for below. Scratch: `qa/round3/verify-extras-correctness/` (`mutate.py` restores bytes and asserts sha256 after each mutation; `mut/*.log`, `runs/*.log`, `mut/summary.txt`, `pristine.sha256`).

## Problems

None that refutes. Observations (not counted):

1. `tests/unit/registry.test.ts:117` (`cssRules`): a top-level string value in `css` (`{ color: "red" }`) would add the empty-string rule `""`; the shadcn schema never has that shape (top-level `css` values are objects), so it cannot fire on a real manifest.
2. `tests/browser/ai/reasoning.test.tsx:884-916` scans axe over the finished section only (the streaming demo above it keeps changing; the comment says so). The whole page at 375 px in both schemes is the Playwright sweep's job, which the width assertion now joins; not run here (e2e forbidden), evidence below.
3. Two of my code-block runs overlapped with the other verifiers' mutations (seed 987654: `code-block.test.tsx` dirty, both cold tests fail on the guard = CB-M8's signature; the coverage run: the grammar-retry test fails with `rgba(0, 0, 0, 0)` = CB-M4's signature). Re-run once each on a sampled-clean tree: `54 passed (54)` both.

## Hunks accounted for (`git diff c282003`)

- `tests/browser/ai/reasoning.test.tsx` (+82): `ReasoningPreview` import; `WIDE_CODE` (a `ts` fence, one ~800 px line) and `CODE_BLOCK_BODY`; `NAMED_CODE`; the fence test (`:848`); the preview-page test (`:884`); the pre-click `BUTTON`/`data-streamdown="link"` check in the link test (`:920-926`).
- `tests/browser/ai/code-block.test.tsx` (+42/-): `beforeEach` clears `failNext`/`failStart`; `coldCodeBlock()` (`:141-150`); the two "shared highlighter" tests run on the cold copy and assert deltas; the twelve-language test asserts the sorted grammar list equals the 12 distinct languages.
- `app/preview/reasoning/page.tsx` (+27/-1): `finishedText` = `fullText` + fence + 4-column table + the response preview's formula (byte-identical to `WIDE_FORMULA` in the test); the finished demo renders it (`:104`). One `<h1>` (`:80`); `layout.tsx` title `Reasoning` unchanged.
- `e2e/previews.spec.ts` (+10/-2): test name; `scrollWidth <= clientWidth` of `<html>` after axe inside the `previews × COLOR_SCHEMES` loop (`:49-56`).
- `tests/unit/registry.test.ts` (+194/-4): `packageOf` extracted; `cssImportedPackages`, `staleDependencies`, `cssRules`, `repeatedCssRules`; test `:458` (files-only filter `:460`), self-test `:469`; `describe("css")` `:537` with the manifest test `:542` and self-test `:546`.
- `.claude/rules/registry.md` (+16/-4), `AGENTS.md` (+40/-, of which six table rows are Prettier re-padding), `CHANGELOG.md` (+8/-4), `docs/architecture.md` (+6/-4, the lead's two §5 sentences).

## (1) `reasoning.test.tsx`

- The fence test renders `<OpenReasoning markdown={WIDE_CODE} />` (a `ts` fence inside `ReasoningContent`, open, in `<main className="px-4">`) at `page.viewport(375, 800)`, polls the `const` token's `--sdm-c`/`--shiki-dark` pair to `["#A0111F", "#FF9492"]`, asserts the code body overflows, `<html>` does not, `scrollRegion(body)` equals `{ tabindex: "0", role: "group", label: "Code" }`, the group "Code" is visible, axe light and `withDark`.
- Mutation R-M7 (`registry/ai/reasoning.tsx:250` → `<MessageResponse shikiTheme={["github-light", "github-dark"]}>`): caught (2), restored OK, `git diff --stat` empty:
  ```
  R-M7 exit=1 18.7s restored=OK diffstat=''
  × highlights a code fence with the high-contrast GitHub pair ... AssertionError: expected [ '#D73A49', '#F97583' ] to deeply equal [ '#A0111F', '#FF9492' ]
  × scrolls the reasoning preview's code, table and formula ... AssertionError: [serious] color-contrast ... 4.11 (foreground color: #6a737d, background color: #0a0a0a ...)
  Tests  2 failed | 48 passed (50)
  ```
- N2: the pre-click assertion `expect(label.element().tagName).toBe("BUTTON")` is synchronous on the rendered text. Mutation R-M2 (`linkSafety={{ enabled: false }}`, `-t "confirms a link"`): `AssertionError: expected 'A' to be 'BUTTON'`, test time 261 ms, whole run 5.0 s (`Tests 1 failed | 49 skipped (50)`), restored OK.

## (2) `code-block.test.tsx` and `coldCodeBlock()`

- Fresh module state: the copy is `import(url.href)` with `?copy=<uuid>`; the browser keeps one module instance per URL, so `highlighterPromise` and `languageLoads` (module-level `let`/`const` in `registry/ai/code-block.tsx:161,164`) start empty. `vi.resetModules()` would not do this in browser mode (native ESM registry; the coder's probe and the vitest mocker's design agree).
- Real, current source: the URL is served by the Vite dev server's transform of the file on disk (new query → new module node, no cache hit). Proof: mutation CB-M5 (`highlighterPromise = undefined` removed in `registry/ai/code-block.tsx`) is caught by the start-up test that runs on the copy: `expected 'rgba(0, 0, 0, 0)' to be 'rgb(255, 255, 255)'`, `1 failed | 53 passed (54)`, restored OK.
- The mock reaches the copy: `@vitest/mocker`'s browser interceptor is an MSW worker matching the resolved (query-cleaned) URL of `shiki` for any importer (`@vitest/mocker/dist/browser.js:47-59`), and `shiki.instances - before === 1` plus the recorded grammars pass only if the copy's `createHighlighter` is the mock.
- Guard: mutation CB-M8 (`import("@/registry/ai/code-block")` in place of the URL) fails both cold tests at once: `AssertionError: a separate module instance: expected [Function CodeBlock] not to be [Function CodeBlock]` (127 ms / 65 ms), `2 failed | 52 passed (54)`, restored OK.
- `vitest.config.ts`: the copy's bare imports (`cn`, `lucide-react`, `react`, `shiki`, `@base-ui/react/button`, `@base-ui/react/select`, `class-variance-authority`) are all in `optimizeDeps.include`; the dynamic import names a source file, not a bare specifier, so no mid-run re-optimize; `tests/unit/test-setup.test.ts` passes (unit 335 x3). `crypto.randomUUID()` needs a secure context; `http://localhost` is one. Not fragile in nine runs.
- Coverage attribution: `--coverage.include=registry/ai/code-block.tsx` on a clean tree: `98.57 stmts / 86.27 branch / 96.72 funcs / 99.49 lines, uncovered 540`, the numbers the coder reported, so the copy's execution is charged to the file and the thresholds hold.
- Order: `--sequence.shuffle` with `--sequence.seed` 11, 12345 (the seed that failed at `c282003`), 987654 (after one clean re-run) and three unseeded (`1790485334414`, `1790485344458`, `1790485354152`): `54 passed (54)` each. Three plain runs: `54 passed (54)` x3.

## (3) `app/preview/reasoning/page.tsx`

- One `<h1>` (`:80`, "Reasoning"); `app/preview/reasoning/layout.tsx` `title: "Reasoning"` unchanged (`git diff c282003 -- app/preview/reasoning/layout.tsx` empty). The finished demo (`:102-105`, `defaultOpen`) renders `finishedText`: a `ts` fence with one 80-character line, a four-column table, the response preview's formula (byte-identical to the test's `WIDE_FORMULA`), all framed as reasoning text. Streaming and collapsed demos keep `fullText`.
- The browser test renders `<ReasoningPreview />` inside a `<main>` with the preview layout's classes at 375 px, finds the finished `<section>` by its heading, and polls `scrollRegion` of the code body, table scroller and `.katex-display` to `NAMED_CODE`/`NAMED_TABLE`/`NAMED_MATH`, asserts `<html>` does not widen, axe light and dark on the section.
- Mutations: P-M1 (finished demo back to `fullText`): `expected null to deeply equal { tabindex: '0', role: 'group', … }`; P-M2 (code line shortened to `export const revalidate = 60`): `expected { tabindex: null, role: null, …(1) } to deeply equal { tabindex: '0', role: 'group', …(1) }`. Both restored OK.

## (4) `e2e/previews.spec.ts`

- The width check sits inside `for (const name of previews) for (const scheme of COLOR_SCHEMES)` after `expectNoAxeViolations`, so it runs for every preview, both schemes, and in both Playwright projects (`chromium` desktop, `chromium-mobile` 375x812, `playwright.config.ts:17-24`). `pnpm exec playwright test --list`: `Total: 96 tests in 3 files`. `pnpm exec tsc --noEmit`: exit 0. Not executed (e2e forbidden); the round-3 sweep (`qa/round3/rendered-surface/sweep.json`, 23 routes x 4 contexts = 92 cells) has `overflow: null` in every cell on the old build, and the new reasoning content at 375 px is proven by the browser test above.

## (5) `tests/unit/registry.test.ts`

- Reverse check (`:458`): only items with files (`.filter((item) => (item.files?.length ?? 0) > 0)`); a dependency counts as used when a file imports it or a `css` key `@import "<pkg>/…"` / `@import url("<pkg>/…")` names it (relative, absolute and URL specifiers ignored). Self-test (`:469`) is in-memory. Repeat check (`:542`): rules are key paths to a declaration block or an empty statement, compared at selector level, over the transitive `@uifiles/*` closure with a `seen` set (the CLI deep-merges `css` over the whole resolved payload: upstream `packages/shadcn/src/registry/resolver.ts:348-351`). Self-test (`:546`) covers direct, transitive-only, deduped and unrelated cases and a different declaration on the same selector.
- Scratch edits of `registry/ai/registry.json`, each restored byte-identically (`restored=OK diffstat=''`):
  ```
  U-M1 (reasoning dependencies += "streamdown@^2.6")        × every dependency of an item that ships files is imported ...  1 failed | 29 passed (30)
  U-M2 (reasoning css: @layer base > .katex-display)         × no item repeats a css rule that one of its @uifiles dependencies already ships  1 failed | 29 passed (30)
  U-M8 (response's @import "katex/dist/katex.min.css" removed) × every dependency of an item that ships files is imported ...  1 failed | 29 passed (30)
  U-M7 (files-only filter removed, tests/unit/registry.test.ts) × ... expected [ …(4) ] to deeply equal []  (base's cn, class-variance-authority, lucide-react, @base-ui/react)
  ```

## (6) Docs, sentence by sentence

- `.claude/rules/registry.md:15-19`: undeclared import fails (`:351-356` pre-existing) and, for an item with files, a declared package no file imports and no `css` `@import` loads fails (`:458`, filter `:460`). `:20-25`: `css` written by the CLI (`update-css` plugin) and merged along the dependency tree (resolver deepmerge); `response` ships the two `@import`s and `.katex-display` (`registry/ai/registry.json:255-262`); dependents do not repeat them (reasoning and chat have no `css`; `:542` enforces); only `@source` manual (reasoning `docs`: "Add `@source ...` yourself"). `:26-27`: `docs` carry the remaining manual step (the reasoning and response `docs` do).
- `AGENTS.md:33` (`pnpm test:e2e` row) and `:197-214` ("End to end"): axe and clean console over every preview and the home in light and dark at desktop and 375 px (`previews.spec.ts:33-48`, `registry.spec.ts:18-36`, both projects); `<title>` starts with the registry title then ` · uifiles` (`:44-47`); no sideways scroll, `scrollWidth <= clientWidth` of `<html>` (`:52-56`); branch HTML from `request.get` (`:65-73`); response formula overflows its box at 375 px while the page does not (`:75-96`). `:76-82`: "both directions" with the files-only parenthetical, true. `:97-103`: the repeat-rule parenthetical, true.
- `CHANGELOG.md:46-53`: the no-sideways-scroll check, the two unit checks (both directions, `css` `@import` as a use, no repeated `css` rule from an `@uifiles` dependency): all true of the code.
- `docs/architecture.md` §5 "Unit" and "End to end": the same facts in the same terms as `AGENTS.md` (title, no sideways scroll at desktop and 375 px, branch HTML, response formula; both-direction dependencies with a `css` `@import` counting, no repeated `css` rule). They agree with each other. `prettier --check docs/architecture.md` passes (long lines are `proseWrap: preserve`).

## (7) Runs and static checks (all with `PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH`)

```
pnpm exec vitest run --project unit  x3:  Test Files 8 passed (8)  Tests 335 passed (335)  (each)
pnpm exec vitest run --project browser tests/browser/ai/reasoning.test.tsx  x3:  50 passed (50)  (each, tree clean before and after)
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx  x3:  54 passed (54)  (each)
  --sequence.shuffle --sequence.seed=11 | 12345 | 987654(re-run):  54 passed (54)  each
  --sequence.shuffle (unseeded) x3:  54 passed (54)  each
  --coverage.enabled --coverage.include=registry/ai/code-block.tsx (re-run):  54 passed; code-block.tsx 98.57 | 86.27 | 96.72 | 99.49 | 540
pnpm exec biome check <5 ts/tsx files>:  Checked 5 files. No fixes applied.
pnpm exec prettier --check <5 files> .claude/rules/registry.md AGENTS.md CHANGELOG.md docs/architecture.md:  All matched files use Prettier code style!
pnpm exec tsc --noEmit:  exit 0
pnpm registry:validate:  exit 0
pnpm exec playwright test --list:  Total: 96 tests in 3 files
```

Tree state at the end: `git status --porcelain` empty; `sha256sum -c pristine.sha256` OK for `registry/ai/reasoning.tsx`, `registry/ai/code-block.tsx`, `registry/ai/registry.json`, `app/preview/reasoning/page.tsx`, `tests/browser/ai/code-block.test.tsx`, `tests/unit/registry.test.ts`.

## Verdict

refuted: false. Every deliverable does what the brief and the answered reports asked: the reasoning tests now pin the inherited shiki pair and the "Code" tab stop (R-M7 caught twice), the link test fails fast under `linkSafety={{ enabled: false }}`, the code-block start-up tests hold in any order on a cold module copy that runs the current source and the mock (CB-M5, CB-M8 caught; nine ordered and shuffled runs green), the reasoning preview carries the fence, table and formula and a browser test proves them at 375 px, the e2e width check runs for every preview in both projects, the two registry invariants fail on each scratch-edited manifest and exempt `base`, and every changed docs sentence is true of the code, with `AGENTS.md` and `docs/architecture.md` §5 in agreement.
