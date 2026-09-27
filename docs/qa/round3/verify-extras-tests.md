# verify-extras-tests

refuted: false

Lens: test quality and mutation resistance of the `extras` group. Tree at HEAD `5f37284` (the
coder's work is committed in that wip checkpoint; `git status --porcelain` empty before and
after). Diffs judged against `c282003` for `tests/browser/ai/reasoning.test.tsx` (+82),
`tests/browser/ai/code-block.test.tsx` (+42/-15), `e2e/previews.spec.ts` (+10/-1),
`tests/unit/registry.test.ts` (+194/-4), plus `app/preview/reasoning/page.tsx` and the three
docs files. Every hunk read. Scratch: `qa/round3/verify-extras-tests/` (`mutate.py`, the three
driver scripts, `mut/*.{orig,mutant,log}`, `runs/*.log`).

The coder's claims hold: I reproduced 9 of the 17 mutants in their table on the current tree
(every one in the brief's required set) and added 5 of my own; 13 of 14 distinct mutants were
caught, the two I predicted would survive did, and the same-module guard fires. Two findings
below are real but narrow gaps in the new unit invariant and a test over-specification; neither
contradicts a claim in `fix-extras.md`.

## Judgement against the lens

- Behavioural names: the two new reasoning tests ("highlights a code fence with the
  high-contrast GitHub pair and scrolls a line wider than a phone inside a named Code tab
  stop", "scrolls the reasoning preview's code, table and formula in named tab stops at 375 px
  without widening the page"), the four unit tests and the renamed e2e test ("… hydrates,
  passes axe, does not scroll sideways and logs nothing") name behaviour. Grep over the four
  files for `QA|BUG|round-N|verif` finds nothing.
- Fixtures in `<main>`: `OpenReasoning` (`reasoning.test.tsx:784-793`) renders
  `<main className="px-4">`; the preview test wraps the page in the layout's `<main>` classes
  (`:888-892`); both restructured code-block tests render `<main>` (`code-block.test.tsx:161,209`).
- Shared helpers: `expectNoViolations`/`withDark` from `@/tests/a11y` only; no `axe.run` or
  `settle` copy in either file.
- No fixed sleeps: every `setTimeout` mention is fake-timer configuration or a spy; the new
  tests use `expect.poll`/`expect.element`; the e2e width check runs after `waitForIdle` and axe.
- No `vi.spyOn(console…).mockImplementation`: none. Spies are implementation-free
  (`code-block.test.tsx:158`).
- `allowConsole` only where asserted: `code-block.test.tsx:157` (start-up test asserts
  `toHaveBeenCalledWith("Failed to highlight code:", …)` and `toHaveBeenCalledTimes(1)`);
  `reasoning.test.tsx:150` is the pre-existing error-boundary test, which asserts the thrown
  error through `onError` (React's boundary log is the console call). The other five in
  `code-block.test.tsx` (`:413,446,673,740,854`) predate the change and each pairs with a
  `vi.spyOn(console, …)` assertion.
- No `.skip`/`.only`/`retry`: none.
- Static: `pnpm exec tsc --noEmit` exit 0 (tsconfig includes `**/*.ts`, so the e2e spec is
  covered); prettier `--check` and biome clean over the eight files.

### The `coldCodeBlock()` guard (`code-block.test.tsx:142-150`)

Real. Scratch edit T1 replaced `/* @vite-ignore */ url.href` with the plain specifier
`"@/registry/ai/code-block"`; both restructured tests fail at the guard:

```
T1-copy-is-same-module: exit=1  restored sha256 ok  git diff --stat -- tests/browser/ai/code-block.test.tsx: ''
     × keeps the raw text when the highlighter fails to start and starts it on the next mount 131ms
     × highlights blocks in twelve languages with one highlighter, loading each grammar once, and Shiki logs nothing 69ms
AssertionError: a separate module instance: expected [Function CodeBlock] not to be [Function CodeBlock] // Object.is equality
      Tests  2 failed | 52 passed (54)
```

That the copy shares the hoisted `shiki` mock is proven by the pristine run itself: the
twelve-language test asserts `shiki.instances - before === 1` and twelve recorded grammars,
counters that only the mock increments.

### `ts` and `typescript` in the twelve-language fixture

The "exactly these grammars" assertion (`code-block.test.tsx:239-241`) passes for both, and
the reason is in the source: `resolveLanguage` (`registry/ai/code-block.tsx:205-222`) returns
the string unchanged when `Object.hasOwn(bundledLanguages, language)`, and shiki's
`bundledLanguages` has alias keys (`ts`, `js`, `sh`, `yml`); `getHighlighter` (`:239-260`)
caches and calls `loadLanguage` per that unresolved string. So `ts` and `typescript` are each
requested once and Shiki dedupes the second grammar internally (comment `:247-248`);
`plaintext` is in `SPECIAL_LANGUAGES` and is requested too. The C4 diff confirms the expected
list holds `"ts"` and `"typescript"` as separate entries. Strictly, the assertion is "each
requested language string once", not "each grammar once" (see problem 2).

### Restructured tests against the coder's mutants and mine

Start-up test: C1 (keep a failed start) and C2 (keep a failed grammar load) both fail it at
`expected 'rgba(0, 0, 0, 0)' to be 'rgb(255, 255, 255)'` (the retry never highlights).
Twelve-language test: C3 (per-language `createHighlighter`, surgical: `getSharedHighlighter()`
→ `createHighlighter({ langs: [language], … })`) fails it at `expected 12 to be 1` plus the
console guard on Shiki's "10 instances" warn; my C4 (no grammar-load cache: `ts` and `python`
requested twice) and C5 (preload `typescript` at creation: `typescript` twice) fail it on the
exact-list diff. Order independence: `--sequence.shuffle --sequence.seed=12345` passes 54/54
now; the coder's `fix-extras/mut/BEFORE-code-block-head-shuffle-12345.log` shows HEAD failing
that seed at `no block in this file has highlighted yet: expected 1 to be +0`.

## Problems

1. `tests/unit/registry.test.ts:113-127` (`cssRules`) and `:133-160` (`repeatedCssRules`):
   rules are keyed on the full key path, so the same selector repeated outside the layer is not
   a repeat. Mutant U4 (reasoning gains `"css": { ".katex-display": { "overflow": "auto hidden" } }`
   at top level while `@uifiles/response` ships it under `@layer base`) survives:
   ```
   U4-EXPECT-SURVIVE-katex-display-outside-layer: exit=0  restored sha256 ok  git diff --stat -- registry/ai/registry.json: ''
         Tests  30 passed (30)
   ```
   An unlayered duplicate beats the layered original in the cascade, so it is the more harmful
   copy. The report's wording ("compared at selector level") is accurate only within one
   at-rule path. Suggest also comparing the leaf selector when the only ancestors are `@layer`
   wrappers, or saying in the test comment that the check is path-exact. Not refuting: the two
   real repeats (`@layer base > .katex-display`, `@import "katex/dist/katex.min.css"`) are caught
   (U2, U3).
2. `tests/browser/ai/code-block.test.tsx:232-234,239-241`: the assertions pin the requested
   language *strings* (`codeToTokens(...).lang` equals the prop; grammar list equals the twelve
   prop values). A future refactor that normalised aliases before loading (`ts` → `typescript`,
   a legitimate improvement that would load the TypeScript grammar once instead of requesting
   it under two names) would fail both without any behaviour regression. The test name's
   "loading each grammar once" is loosely worded for the same reason. Nit.
3. `tests/browser/ai/code-block.test.tsx:155,181,188,236`: the `shiki.instances - before` delta
   relies on no other highlighter creation landing mid-test; the mock's `instances += 1`
   (`:57-58`) lands after `await actual.createHighlighter`, so a creation still in flight from
   the previous main-module test could bump it under shuffle. Every main-module test awaits
   `highlighted()` before ending, so the window is tiny: 0 failures in 9 shuffled runs (coder 6,
   mine 3). Theoretical; noting only.
4. `tests/browser/ai/reasoning.test.tsx:929-942`: for a mutant that keeps link safety on but
   drops the accessible dialog (R3, `linkSafety={{ enabled: true, renderModal: undefined }}`)
   the test catches it only after the 15 s dialog-locator timeout; moving the
   `[data-streamdown='link-safety-modal']` null check (`:940-942`) ahead of the dialog wait
   (`:930`) would fail in milliseconds, as the new `tagName === "BUTTON"` check does for R2. Nit.
5. `registry/ai/code-block.tsx:358-361`: C6 (drop `subscribers.delete(tokensCacheKey)` in the
   failure path, a stale-subscriber leak) survives the whole file (54 passed). Component
   unchanged by this group; for the code-block owner.
6. Infrastructure, not the tests: the first P1 run (05:05) hit
   `TypeError: Failed to fetch dynamically imported module: …/deps/highlighted-body-KPVGNVTW-CcHkmllj.js?v=8aa3cae8`
   and failed the fence test with `expected undefined …`. The shared deps cache
   `node_modules/.vite/vitest/ef98…/deps/_metadata.json` was rewritten at 05:06:40, i.e. a
   concurrent re-optimisation (other verifiers' browser runs). Re-run once as the rules say:
   only the preview test fails, on the mutation.
7. Not run (forbidden): `pnpm test:e2e`; also not run: `playwright test --list` (borderline
   e2e). The width assertion (`e2e/previews.spec.ts:49-56`) is read and tsc-clean; the coder
   reports 96 listed tests, unchanged from HEAD.

## Mutation table

Each mutation: baseline bytes from `git show HEAD:<path>` (the working file must equal HEAD
before patching), patched in place, run, restored, sha256 asserted, `git diff --stat -- <path>`
printed empty (`''` in every row's log line). Full logs in `verify-extras-tests/mut/<id>.log`.

| id | file | mutation | result |
| --- | --- | --- | --- |
| T1 | tests/browser/ai/code-block.test.tsx | `coldCodeBlock()` imports the plain specifier (same module) | caught (2): guard `a separate module instance: expected [Function CodeBlock] not to be [Function CodeBlock]` |
| R1 | registry/ai/reasoning.tsx | `<MessageResponse shikiTheme={["github-light", "github-dark"]}>` | caught (2): fence test `expected [ '#D73A49', '#F97583' ] to deeply equal [ '#A0111F', '#FF9492' ]`; preview test axe `[serious] color-contrast` |
| R2 | registry/ai/reasoning.tsx | `<MessageResponse linkSafety={{ enabled: false }}>` | caught (1) in 112 ms: `expected 'A' to be 'BUTTON'` |
| R3 (mine) | registry/ai/reasoning.tsx | `linkSafety={{ enabled: true, renderModal: undefined }}` (Streamdown's own modal) | caught (1) after 15 s: `Cannot find element with locator: getByRole('dialog', { name: 'Open external link?' })` (problem 4) |
| C1 | registry/ai/code-block.tsx | `highlighterPromise = undefined` removed (keep a failed start) | caught (1): start-up test `expected 'rgba(0, 0, 0, 0)' to be 'rgb(255, 255, 255)'` |
| C2 | registry/ai/code-block.tsx | `languageLoads.delete(language)` removed (keep a failed grammar load) | caught (2): start-up test and ruby retry, same assertion |
| C3 | registry/ai/code-block.tsx | `getSharedHighlighter()` → `createHighlighter({ langs: [language], themes: [...] })` (per-language highlighter) | caught (2): twelve-language `expected 12 to be 1` + console guard `[Shiki] 10 instances…`; ruby retry `expected [ 'ruby', 'ruby', 'ruby' ] to have a length of 2 but got 3` |
| C4 (mine) | registry/ai/code-block.tsx | `languageLoads.set(language, loaded)` removed (no grammar-load cache) | caught (1): twelve-language exact list, `+ "python"`, `+ "ts"` |
| C5 (mine) | registry/ai/code-block.tsx | `createHighlighter({ langs: ["typescript"], … })` (grammar preloaded) | caught (1): twelve-language exact list, `+ "typescript"` |
| C6 (mine, expected survive) | registry/ai/code-block.tsx | `subscribers.delete(tokensCacheKey)` removed from the failure path | survived: `54 passed (54)` (problem 5) |
| U1 | registry/ai/registry.json | reasoning `dependencies` += `streamdown@^2.6` (stale) | caught (1): `reasoning declares "streamdown", which no file imports and no css @import loads` |
| U2 | registry/ai/registry.json | reasoning gains `css: {"@layer base": {".katex-display": …}}` (repeated rule) | caught (1): ``reasoning repeats `@layer base > .katex-display`, which @uifiles/response ships`` |
| U3 (mine) | registry/ai/registry.json | reasoning gains `css: {"@import \"katex/dist/katex.min.css\"": {}}` (repeated empty statement) | caught (1): ``reasoning repeats `@import "katex/dist/katex.min.css"`, which @uifiles/response ships`` |
| U4 (mine, expected survive) | registry/ai/registry.json | reasoning gains `css: {".katex-display": …}` at top level (outside `@layer base`) | survived: `30 passed (30)` (problem 1) |
| P1 | app/preview/reasoning/page.tsx | fence line shortened to `export const revalidate = 60` | caught (1): preview test `expected { tabindex: null, role: null, …(1) } to deeply equal { tabindex: '0', role: 'group', …(1) }` (first attempt also showed the cache TypeError of problem 6; re-run clean) |

Coder's claims cross-checked from their logs: `BEFORE-reasoning-head-M7.log` shows HEAD's
test file surviving the theme override (`48 passed (48)`) and `R-M7-plain-github-themes.log`
the new file catching it (`2 failed | 48 passed (50)`), matching my R1.

## Runs (final files, pristine tree)

```
unit registry.test.ts   ×3: 30 passed (30) / 30 passed (30) / 30 passed (30)
reasoning.test.tsx      ×3: 50 passed (50) / 50 passed (50) / 50 passed (50)   (7.0 s each)
code-block.test.tsx     ×3: 54 passed (54) / 54 passed (54) / 54 passed (54)
code-block --sequence.shuffle: seed "1790485186933" 54 passed | seed "1790485196443" 54 passed
code-block --sequence.shuffle --sequence.seed=12345: 54 passed (54)   (HEAD: 1 failed, coder's BEFORE log)
tsc --noEmit exit 0; prettier --check clean; biome check clean (8 / 5 files)
```

## Commands run

All prefixed with `export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH`.

```
git diff c282003 -- <the five test/spec/page files> ; git diff c282003 -- .claude/rules/registry.md CHANGELOG.md AGENTS.md
pnpm exec vitest run --project unit tests/unit/registry.test.ts            # x3 + 4 mutations
pnpm exec vitest run --project browser tests/browser/ai/reasoning.test.tsx # x3 + 4 mutations (+1 re-run)
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx [--sequence.shuffle [--sequence.seed=12345]]  # x3, x2 shuffled, x1 seed 12345, + 7 mutations
python3 verify-extras-tests/mutate.py <id> <rel> <old> <new> <cmd>        # via run-unit-muts.py, run-guard-mut.py, run-browser-muts.py
pnpm exec tsc --noEmit ; pnpm exec prettier --check … ; pnpm exec biome check …
git status --porcelain ; git diff --stat ; sha256 of each mutated file vs `git show HEAD:`
```
