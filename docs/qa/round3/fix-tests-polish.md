# fix-tests-polish

Group `tests-polish` (round 3c). Baseline: HEAD `9019bdf` (my backups in `fix-tests-polish/orig/` are byte-identical to it). While I worked, the lead re-cut the checkpoint as `79858f0`, which already contains every change below (`git status` now shows only the other coder's `registry/ai/prompt-input.tsx`). Diff of my files against the old HEAD: `git diff 9019bdf -- <files>` = 11 files, +242/−72. Scratch: `qa/round3/fix-tests-polish/` (`mutate.py`, `snip/`, `mut/*.log`, `logs/*.log`, `orig/`).

## Fixed

- critic N7: `repeatedCssRules` ignores `@layer` wrappers. `cssRules` (`tests/unit/registry.test.ts:115-137`) now maps each rule's full key path to what it styles, which is the same path with its `@layer` ancestors dropped. `repeatedCssRules` (`:144-178`) compares on that and reports both spellings: "chat repeats `.katex-display`, which @uifiles/response ships as `@layer base > .katex-display`". The self-test (`:570`, "…names the rule and sees through @layer wrappers") gains a `canvas` item with three copies of the rule: unlayered (reported), under `@layer components` (reported) and under `@media print` (a different rule, not reported). Failed before: `expected [ …(3) ] to deeply equal [ …(5) ]`. Passes after.
- critic N10: `cssImportedPackages` (`:75-93`) counts `@plugin "<pkg>"` keys as well as `@import` keys, and skips a relative file plugin. shadcn's `apps/v4/content/docs/registry/examples.mdx:833-836` requires a plugin's npm package to be listed in `dependencies`. The self-test (`:482`) adds `@plugin "@tailwindcss/typography"` plus `@plugin "./custom-plugin.js"`. The message now reads "…no css @import or @plugin loads" and the two test names say "@import or @plugin key". Failed before: `x declares "@tailwindcss/typography", which no file imports and no css @import loads`. Passes after.
- critic N9: `tests/browser/ai/code-block.test.tsx:801` "forgets the callers of a failed highlight: the retry notifies only its own caller". It calls `highlightCode` directly with a haskell grammar load set to fail. It checks that the failure is logged and consumed, then calls `highlightCode` again for the same code and language. Then it asserts:
  - the retry gets a fresh grammar request (two `haskell` requests);
  - only the retry's callback runs;
  - the first callback never runs;
  - the cache holds the retry's result;
  - exactly one error was logged.

  I used the main module rather than `coldCodeBlock()`, for two reasons. No other test in the file uses haskell, so the grammar is cold in any order. And a cold copy would add a fourth real highlighter (N12). It passes in two shuffled orders (seeds 12345 and 777) and on its own (`-t`). It pins existing behaviour: it passes on the pristine source and fails when the cleanup line is removed (C6 below).
- critic N11: the bare-specifier scan now walks the import graph (`tests/unit/test-setup.test.ts:514`). It starts from every `.ts`/`.tsx` file under `registry/`, `components/` and `tests/browser/`, and follows `@/…` and relative imports into the rest of the tree. That reaches four `app/` files:
  - `app/preview/reasoning/page.tsx`
  - `app/preview/response/page.tsx`
  - `app/preview/model-selector/model-selector-demo.tsx`
  - `app/preview/model-selector/logos.ts`

  It also reaches `tests/{a11y,axe-tags,console-guard,setup}.ts`.
  - **Why not all of `app/**`:** the rest of it imports `next`, `next/link` and `next/font/google`, which run only under Next and are not in `optimizeDeps.include` (`vitest.config.ts`, not mine). A wholesale scan would demand those entries for no reason.
  - **Type-only imports are skipped:** statement-level `import type`/`export type` lines are dropped, because they never reach the browser. My first version flagged `import type { Metadata } from "next"` in `app/preview/response/page.tsx`.
  - **Non-vacuity guard:** a local import the walk cannot resolve fails the test.
  - **Result:** the invariant still holds (unit 3×), and a bare import added to a preview page that a test renders is now caught (A1).
- critic N5: `e2e/previews.spec.ts:77-107`. The 375 px `/preview/response` test now loops over `COLOR_SCHEMES`. Each run attaches `collectPageProblems` before navigating, calls `emulateMedia`, asserts the `html` scheme class, and ends with `expect(problems).toEqual([])`, like the per-preview tests. The served-HTML test (`:61-75`) stays as it is, with a comment explaining why: it is a raw `request.get`, so no page runs, there is no console to collect, and the server returns the same HTML whatever colour scheme the client prefers. `playwright test --list`: 98 tests in 3 files (was 96; +1 per project). e2e not run (forbidden).
- critic N1: `e2e/origin.ts`.
  - **Change:** `isLocalRequest` (`:45-58`) returns `false` for a value `URL.canParse` rejects, instead of throwing.
  - **Choice: "not local", not "error at config time".** Both callers need a boolean. The route filter always receives a parsed `url.href`, and "not local" blocks the request, which is the safe side. For `expectsPublicOrigin`, a scheme-less host such as `uifiles.dev` names no loopback origin, so the no-localhost assertions stay on (the stricter direction).
  - **Why not config time:** `playwright.config.ts` is not mine, and `lib/registry.ts` `baseUrl()` already fails the build with a clear message for that value.
  - **Matching message in `publicOrigin`:** so the two specs that read the origin (`registry.spec.ts:43,96`) do not fail on a confusing diff, `publicOrigin` (`:24-29`) now throws the same message `baseUrl()` gives: `NEXT_PUBLIC_BASE_URL must be an absolute URL such as https://uifiles.dev; got "…"`.
  - **Unit cases:** `tests/unit/tooling.test.ts:156` covers the boolean answers, and `:165` asserts that `baseUrl()` and `publicOrigin()` throw the identical message for `uifiles.dev`, `//uifiles.dev` and `https://`.
  - **Failed before:** `TypeError: Invalid URL` and `uifiles.dev: expected [Function] to throw an error`. Passes after.
- critic N4: `tests/unit/site.test.ts:212` "stays silent outside a production build, whatever the origin". It uses a fresh module like its neighbours. `NODE_ENV` is undefined, `development` or `test`, with a localhost and a 127.0.0.1 origin: no warning. It then ends with a production call that must warn, which shows the silence was not the once-flag's doing. It uses the neighbours' pattern (`vi.spyOn(console,"warn").mockImplementation`), which is allowed in the unit project (the N3 residue is unchanged).
- critic N6: `expectNoViolations()` added at the end of `tests/browser/blocks/chat.test.tsx:1368` (a stopped call, open, Pending plus "No input yet"; it now also waits for "Parameters" to be visible before scanning) and of `tests/browser/ai/suggestion.test.tsx:214` (page scrolled, second chip keyboard-focused at 375×500). Both pass, and each catches a mutation that no other test in its file catches (X2, X3).
- Consequence of the other coder's N16 (not in the critic list, but in my file): `tests/browser/blocks/chat.test.tsx:1707-1709` "keeps the draft when the button is clicked while generating without an onStop". It looked up `name: "Stop"`, but under `prompt-input-polish`'s working-tree change `PromptInputSubmit` keeps the name "Submit" when no `onStop` is wired. It now clicks "Submit", with a comment. See Requests.

## Not fixed and why

- N2, N3, N8, N12, N13, N14, N15, N16: not in my list (N15 and N16 belong to `prompt-input-polish`).
- The verifier's dpp-tests note 2 (`test.use({ viewport })` duplicates the phone-width test in the `chromium-mobile` project): left alone because it is harmless and was not asked for. With the scheme loop, the listing now shows 4 phone-width entries per scheme pair (2 schemes × 2 projects).

## Tests

- Counts:
  - `tests/unit/registry.test.ts`: 30 → 30 (cases added to two self-tests and one name widened).
  - `tests/unit/test-setup.test.ts`: 26 → 26 (one test rewritten).
  - `tests/unit/site.test.ts`: 45 → 46.
  - `tests/unit/tooling.test.ts`: 20 → 22.
  - Unit project: 335 → 338.
  - `code-block.test.tsx`: 54 → 55.
  - `suggestion.test.tsx`: 18 → 18 and `chat.test.tsx`: 67 → 67 (assertions added).
  - Playwright listing: 96 → 98.
- No upstream tests to port (all of these are tooling checks and pins).

### Mutation table

Each row was produced by `fix-tests-polish/mutate.py`: check that the snippet occurs exactly once, patch, run, restore the original bytes, and assert the sha256 matches. For sources I do not own, `git diff --stat -- <file>` printed `''` after the restore. Logs are in `fix-tests-polish/mut/<id>.log`. "Before" means the test files as they were at `9019bdf`; "after" means my files.

| id | file | mutation | before | after |
| --- | --- | --- | --- | --- |
| M1 | tests/unit/registry.test.ts | `unlayered` keeps `@layer` ancestors (path-exact identity) | n/a (check) | caught: repeat self-test `expected [ …(3) ] to deeply equal [ …(5) ]` |
| M3 | registry/blocks/registry.json | `chat` gains top-level `"css": { ".katex-display": { "overflow": "visible" } }` (U4's shape) | survived (verifier U4 on reasoning: `30 passed (30)`) | caught: real-manifest test ``chat repeats `.katex-display`, which @uifiles/response ships as `@layer base > .katex-display` ``; restored, `git diff --stat` `''` |
| M2 | tests/unit/registry.test.ts | `cssImportedPackages` regex back to `@import` only | n/a (check) | caught: stale-dependency self-test `expected [ Array(1) ] to deeply equal []` |
| C6 | registry/ai/code-block.tsx | `subscribers.delete(tokensCacheKey)` removed from the `.catch` | survived (verifier C6: `54 passed (54)`) | caught: `forgets the callers of a failed highlight…` `expected "vi.fn()" to not be called at all, but actually been called 1 times`; sha256 OK, `git diff --stat` `''` |
| A1 | app/preview/reasoning/page.tsx | adds `import Link from "next/link"` | survived: `26 passed (26)` | caught: `expected [ 'next/link' ] to deeply equal []`; `git diff --stat` `''` |
| A2 | tests/unit/test-setup.test.ts | resolver drops the `.tsx`/`/index.tsx` suffixes | n/a | caught by the non-vacuity guard: `local imports the walk could not follow: expected [ …(106) ] to deeply equal []` |
| A3 | tests/unit/test-setup.test.ts + A1 | walk does not follow local imports, with the `next/link` import present | n/a | survived (`26 passed`), as expected: shows the walk is what catches A1 |
| O1 | e2e/origin.ts | `isLocalRequest` without the `URL.canParse` guard | n/a | caught: `TypeError: Invalid URL` |
| O2 | e2e/origin.ts | unparsable treated as local (`return true`) | n/a | caught: `uifiles.dev: expected true to be false` |
| O3 | e2e/origin.ts | `publicOrigin` validation removed | n/a | caught: `uifiles.dev: expected [Function] to throw an error` |
| L1 | lib/registry.ts | the warning ignores `NODE_ENV` (condition dropped) | survived: `45 passed (45)` | caught: `stays silent outside a production build…` `expected "warn" to not be called at all, but actually been called 1 times`; `git diff --stat` `''` |
| X3 | registry/blocks/chat/components/blocks/chat.tsx | a stopped call's `ToolInput` gets `opacity-50` | survived: `67 passed (67)` | caught only by `shows a stopped call as Pending…`: `[serious] color-contrast`; `git diff --stat` `''` |
| X2 | registry/ai/suggestion.tsx | chip gets `focus-visible:text-muted-foreground/40` | survived: `18 passed (18)` | caught only by `does not scroll the page when a chip…`: `[serious] color-contrast`; `git diff --stat` `''` |
| X1 (info) | registry/blocks/chat/components/blocks/chat.tsx | the whole stopped `Tool` gets `opacity-50` | already caught by `settles the partial answer after a mid-stream error…` (color-contrast) | n/a |

Fail-first for new checks (logs in `fix-tests-polish/logs/`):
- `BEFORE-registry.log`: 2 failed (the two self-tests, diffs above).
- `BEFORE-tooling.log`: 2 failed (`TypeError: Invalid URL`; `expected [Function] to throw an error`).
- test-setup: A1 before/after.

N4, N6 and N9 add assertions on behaviour that already holds, so their fail-first evidence is the before/after mutation rows.

### Runs (final files)

```
unit project   run1: Test Files 8 passed (8)  Tests 338 passed (338)
               run2: Test Files 8 passed (8)  Tests 338 passed (338)
               run3: Test Files 8 passed (8)  Tests 338 passed (338)
code-block     run1/2/3: Tests 55 passed (55) ×3
               --sequence.shuffle seed 12345: 55 passed; seed 777: 55 passed; -t "forgets the callers": 1 passed | 54 skipped
suggestion     run1/2/3: Tests 18 passed (18) ×3
blocks/chat    run1: 12 failed | 55 passed (67). The failures were composer/Submit/Thinking lookups while
               prompt-input-polish was editing registry/ai/prompt-input.tsx; per the brief I re-ran:
               run2/3/4: Tests 67 passed (67) ×3 (three consecutive)
playwright test --list: Total: 98 tests in 3 files
```

## Docs strings

`AGENTS.md`, the dependencies rule (lines 79-82):
> `tests/unit/registry.test.ts` checks the imports against the entry in both directions (for an item that ships files, a declared package that none of its files imports and no `@import` or `@plugin` key of its `css` loads fails too), that each package is installed here at that major, and that a cross-item `@/registry/ai/<x>` import has a matching `@uifiles/<x>` entry.

`AGENTS.md`, "Markdown needs CSS" (lines 102-104):
> (`tests/unit/registry.test.ts` fails on an item that repeats a `css` rule an `@uifiles/*` dependency ships, inside or outside an `@layer`: an unlayered copy of `.katex-display` would beat the layered one)

`AGENTS.md`, Tests › Pre-bundling (lines 185-189):
> `tests/unit/test-setup.test.ts` fails on a gap: it reads every file under `registry/`, `components/` and `tests/browser/` and follows their local imports into the rest of the tree (the `app/preview` pages and demos some tests render, the `tests/*.ts` helpers), skipping `import type` statements, which never reach the browser.

`AGENTS.md`, Tests › End to end (lines 214-219):
> `/preview/branch` must serve its branch selector and count in the HTML, not only after hydration (a raw request: no page, so no console and no colour scheme), and at 375 px, in light and dark with a clean console, the wide formula on `/preview/response` must overflow its own box while the page does not. A `NEXT_PUBLIC_BASE_URL` that is not an absolute URL (`uifiles.dev`) fails the specs that read the origin with the message `baseUrl()` gives the build, not a bare `Invalid URL`.

`docs/architecture.md` §5, Unit:
> … with a `css` `@import` or `@plugin` key counting as a use, and no `css` rule repeated from an `@uifiles/*` dependency, whether or not an `@layer` wraps either copy), the site's contracts (`baseUrl()`, the alias badge, `/llms.txt`, licence and doc accuracy) and the test tooling (the console guard, a Vitest pre-bundle list that names every bare specifier a browser test can reach, following local imports into the `app/` pages the tests render, and the Playwright origin helpers).

`docs/architecture.md` §5, End to end:
> … `/preview/response` at 375 px in light and dark (its wide formula scrolls without widening the page, console clean) …

Each sentence was checked against the code:
- `registry.test.ts:75-93` and `:115-178`
- `test-setup.test.ts:503-560`
- `e2e/previews.spec.ts:61-107`
- `e2e/origin.ts:24-29,45-58`
- `registry.spec.ts:43,96`

The `pnpm test:e2e` row of the command table ("the wide formula on `/preview/response` overflows its own box at 375 px") is still accurate, so I did not change it.

## Requests for other owners

- **Lead and `prompt-input-polish`:** `tests/browser/blocks/chat.test.tsx:1709` now clicks `name: "Submit"`, which matches N16 (`PromptInputSubmit` is named "Stop" only when `onStop` is wired). This holds only with `prompt-input-polish`'s working-tree change to `registry/ai/prompt-input.tsx`, which is not in `79858f0`. At `79858f0` on its own, that test fails. If N16 does not land, change the name back to `"Stop"`.
- **Lead:** the critic's blocking step 2 now expects **98** e2e tests (`playwright test --list`), not 96.
- **Lead (disclosure):** the A3 mutation command restored `app/preview/reasoning/page.tsx` with `git checkout -q -- <file>` after its own `sed`. The file had no other changes (`git status` was clean for it), and `mutate.py` then asserted byte-identity. `git diff --stat -- app/` is empty. That is the only git write I ran, and I did not use `checkout` otherwise.

## Strict-flag typecheck

- `pnpm exec tsc --noEmit`: exit 0. `pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`: exit 0 (the tsconfig includes `**/*.ts`, so the e2e files are covered).
- Errors in files I own: none. Errors in files I do not own: none.
- `pnpm exec biome check` on my 9 code files: "No fixes applied". `pnpm exec prettier --check` on those 9 plus `AGENTS.md` and `docs/architecture.md`: clean.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
pnpm exec vitest run --project unit tests/unit/{registry,test-setup,site,tooling}.test.ts   # fail-first and iterations
pnpm exec vitest run --project unit                                                          # ×3
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx                  # ×3, shuffle seeds 12345/777, -t isolated
pnpm exec vitest run --project browser tests/browser/ai/suggestion.test.tsx                  # ×3
pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx                    # ×4 (run1 hit the concurrent prompt-input edit)
python3 qa/round3/fix-tests-polish/mutate.py <id> <file> <old> <new> <cmd>                   # 14 mutations above
pnpm exec prettier --write/--check <my files>; pnpm exec biome check <my files>
pnpm exec tsc --noEmit [--exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals]
pnpm exec playwright test --list
git status --porcelain; git diff 9019bdf --stat -- <my files>; git log/show (HEAD re-cut to 79858f0 mid-session)
```
