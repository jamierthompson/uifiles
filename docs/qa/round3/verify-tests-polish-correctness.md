# verify-tests-polish-correctness

refuted: true

Lens: correctness (each check does what was asked and no more; every docs sentence true of the code). HEAD `5643605`, checkpoint `9019bdf`. Scratch: `qa/round3/verify-tp-correctness/` (`mut.sh`, `bak/`, `mut/*.log`, `logs/*.log`, `walk.mjs`, `erased.mjs`).

One refuting problem (P1, low, one-line fix) in the N11 check; everything else in the group holds. A tree-state problem (P2) that is not this group's work but blocked a clean third unit run.

## Problems

### P1 (low, refutes) N11: the type-only erasure in the pre-bundle scan swallows real imports

`tests/unit/test-setup.test.ts:540` `const typeOnly = /^(?:import|export)\s+type\s[^"]*"[^"]*"/gm`, applied at `:544` to every reached file before the `from "..."` scan. The regex does not stop at the end of a statement: from any `import type` / `export type` at a line start it erases up to the second `"` after it, wherever that is. Over the 81 reached files it erases 187 spans, and 131 of them are not type-import statements but `export type X = ...` aliases plus the code after them (`erased.mjs`; e.g. `registry/ai/tool.tsx`: `"export type ToolProps = ComponentProps<typeof Collapsible>\n\nexport const Tool = ({ className, ...props }: ToolProps) => "`). A bare import that lands inside such a span is invisible to the scan, and the test the docs say "fails on a gap" passes.

Demonstration (`mut/A1v.log`): in `app/preview/reasoning/page.tsx` (a page `reasoning.test.tsx` renders, reached by the walk), after the react import add
```
export type Probe = { id: number }
import Link from "next/link"
```
→ `pnpm exec vitest run --project unit tests/unit/test-setup.test.ts` → `Tests 26 passed (26)`. The same `import Link from "next/link"` without the preceding alias is caught (`mut/A1b.log`: `expected [ 'next/link' ] to deeply equal []`). The file was restored byte-identically (`cmp` ok, `git diff --stat` empty). Today no reached file has an import inside an erased span (the one `from "` inside a span is a JSDoc comment in `registry/ai/model-selector.tsx`), so the invariant holds on this tree; the mechanism is unsound.

Fix: erase one statement, not "until the next two quotes": `/^(?:import|export)\s+type\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+"[^"]*"/gm` (multi-line `{ ... }` lists included), or erase only `import type ... from "..."`, which is all the AGENTS.md sentence claims ("skipping `import type` statements").

### P2 (tree state, not this group) `registry/blocks/registry.json` carries an un-restored foreign mutation

Since about 11:50 the working tree has had `"css": { ".katex-display": { "overflow": "visible" } }` on `chat` (`git diff -- registry/blocks/registry.json`: 1 insertion; still there at the end of my run, ~15 min later, after `registry/ai/prompt-input.tsx` and `e2e/origin.ts` were restored by their verifiers). It is the M3 mutation another verifier applied and did not restore. I did not touch it (rules: restore only my own mutations, never `git checkout --`). Consequence: unit run 3 fails exactly one test, the N7 check, with the expected message (below). The lead must restore that file (`git show 9019bdf:registry/blocks/registry.json` is the pristine content; the group's diff does not touch it).

## Observations (not refuting)

- O1 (N10): only the stale direction reads css keys. `cssImportedPackages` feeds `staleDependencies` alone (`registry.test.ts:103`); `undeclaredImports` (`:187`) scans files only. A css `@import "<pkg>/..."` or `@plugin "<pkg>"` whose package is missing from `dependencies` is reported by no test. Not in the critic's ask; AGENTS.md's parenthetical claims only the stale direction, so no docs sentence is false.
- O2: `git diff 9019bdf -- docs/architecture.md` also carries two §3 hunks (`prompt-input` at 179-183, `inline-citation` at 212-215). They are `prompt-input-polish`'s N15/N16 docs, not this group's; accounted for, not reviewed here.
- O3 (N5): `test.use({ viewport: 375×812 })` inside `chromium-mobile` duplicates the phone-width case (4 listed entries); the coder acknowledged it. Harmless.
- O4 (N1): `publicOrigin` and `baseUrl()` accept the same set of values (`URL.canParse` vs `new URL` in try/catch) and both `.trim()` first (`lib/registry.ts:98-101` `nonEmpty`), so the messages match for every input, not only the three tested.

## Hunks accounted for (`git diff 9019bdf`, 11 files, +245/−76)

| file | hunks | item |
| --- | --- | --- |
| `tests/unit/registry.test.ts` | `cssImportedPackages` regex `@(?:import\|plugin)` (:81-93), message and two test names, self-test `@plugin` cases (:507-519); `cssRules` → `Map<full, unlayered>` (:124-137), `repeatedCssRules` compares on the unlayered path and reports both spellings (:163-171), `canvas` self-test item (:596-613) | N10, N7 |
| `tests/browser/ai/code-block.test.tsx` | new test `:801-830` | N9 |
| `tests/unit/test-setup.test.ts` | import graph walk with `resolveLocal`, `typeOnly`, non-vacuity guard (:514-557) | N11 (P1) |
| `tests/unit/site.test.ts` | `:212-224` | N4 |
| `tests/unit/tooling.test.ts` | `baseUrl` import, tests `:156-174` | N1 |
| `e2e/previews.spec.ts` | comment on the raw-request test (:64-66); 375 px test looped over `COLOR_SCHEMES` with collector, `emulateMedia`, scheme class, `problems` (:80-106) | N5 |
| `e2e/origin.ts` | `publicOrigin` absolute-URL guard with `baseUrl()`'s message (:24-29); `isLocalRequest` `URL.canParse` guard (:50-51) | N1 |
| `tests/browser/blocks/chat.test.tsx` | `:1382-1383` Parameters wait + axe; `:1707-1709` clicks "Submit" | N6; N16 consequence (`registry/ai/prompt-input.tsx:1542,1569` at HEAD names it Stop only with `onStop`, so the change is right at HEAD) |
| `tests/browser/ai/suggestion.test.tsx` | `:243` axe | N6 |
| `AGENTS.md` | 4 hunks (deps rule, markdown CSS, pre-bundling, e2e) | docs |
| `docs/architecture.md` | §5 unit and e2e bullets (this group); §3 prompt-input and inline-citation (other group, O2) | docs |

## Per item

- **N7** matches critic and claim. `cssRules` maps each full key path to the path with `@layer` ancestors dropped (last key kept); `repeatedCssRules` matches on that and prints `X repeats \`mine\`, which @uifiles/dep ships[ as \`theirs\`]`. `@media`/`@supports` wrappers are kept, so a media-scoped copy is a different rule (the `canvas` self-test pins all three cases). Mutation: the unlayered `.katex-display` on `chat` → `mut/M3-probe.log` `× no item repeats a css rule ...` `+ "chat repeats \`.katex-display\`, which @uifiles/response ships as \`@layer base > .katex-display\`"` (`1 failed | 29 passed (30)`). My own M3 (`mut/M3.log`) applied on top of the foreign copy of the same mutation (P2) and its run reported 30 passed, then the foreign restore/re-mutation cycle explained it: the probe above is the same mutation as it sits in the tree now; restored from my copy, `cmp` ok.
- **N10** matches. Regex `^@(?:import|plugin)\s+(?:url\(\s*)?["']([^"']+)["']`, relative and absolute file plugins skipped, scoped names via `packageOf`. Mutation (regex back to `@import` only, `mut/N10.log`): `× the stale-dependency rule ... counts a css @import or @plugin key as a use` `+ "x declares \"@tailwindcss/typography\", which no file imports and no css @import or @plugin loads"` (the second failure in that log is P2). Restored, `git diff --stat` empty.
- **N9** matches. `highlightCode` called directly with `haskell` (no other test uses it: grep shows only `:807-828`), `failNext` consumed, retry gets a second grammar request, `failed` never called, cache holds the retry's tokens, one error logged. Mutation C6 (`subscribers.delete(tokensCacheKey)` removed from the `.catch`, `mut/C6.log`): `× forgets the callers of a failed highlight: the retry notifies only its own caller` `expected "vi.fn()" to not be called at all, but actually been called 1 times` (`1 failed | 54 passed (55)`); restored, `cmp` ok, `git diff --stat` empty.
- **N11** matches the critic's ask (app pages a test renders are scanned) but see P1. Walk replica (`walk.mjs`): 81 files reached from 73 roots; outside the roots exactly `app/preview/model-selector/logos.ts`, `app/preview/model-selector/model-selector-demo.tsx`, `app/preview/reasoning/page.tsx`, `app/preview/response/page.tsx`, `tests/a11y.ts`, `tests/axe-tags.ts`, `tests/console-guard.ts`, `tests/setup.ts`; unresolved `[]`. 25 files under `app/` import `next/*`; only `app/preview/response/page.tsx` is reached and its import is `import type { Metadata } from "next"` (erased). Unreached `app/**` is never read, so its `next/*` cannot be flagged. Mutation A1 (`import Link from "next/link"` among the imports of `reasoning/page.tsx`): first run `mut/A1.log` 26 passed (a concurrent verifier restored its own copy of that file between my patch and my run: same `git status` window as P2's owner), re-run `mut/A1b.log` `expected [ 'next/link' ] to deeply equal []`. Restored, `cmp` ok, `git diff --stat` empty.
- **N5** matches. Both schemes, `collectPageProblems` attached before `emulateMedia` and navigation, `html` class asserted, `expect(problems).toEqual([])` last. `pnpm exec playwright test --list` → `Total: 98 tests in 3 files` (`logs/pw-list.log`; the four `preview/response in light|dark mode ... at phone width` entries are lines 42-43 and 91-92). `pnpm exec tsc --noEmit` exit 0.
- **N1** matches. `isLocalRequest` returns `false` for a value `URL.canParse` rejects. Safe side: `expectsPublicOrigin({ NEXT_PUBLIC_BASE_URL: "uifiles.dev" })` → `true`, so the no-localhost assertions in `e2e/registry.spec.ts:50,115` stay on; the route filter (`e2e/helpers.ts:38`) passes `url.href` of a parsed `URL`, so it never reaches the guard, and an unparsable value there would be aborted (blocked), also the safe side. `publicOrigin` throws `NEXT_PUBLIC_BASE_URL must be an absolute URL such as https://uifiles.dev; got "<value>"`, byte-for-byte `lib/registry.ts:142`; `tooling.test.ts:165` asserts both throw the same message for `uifiles.dev`, `//uifiles.dev`, `https://` (passes in all unit runs). `playwright.config.ts` does not read the variable, so nothing fails earlier with a bare `Invalid URL`.
- **N4** matches. Fresh module, `NODE_ENV` undefined/development/test × localhost and 127.0.0.1, no warning, then a production call that warns once. Mutation L1 (`env.NODE_ENV === "production" &&` dropped, `mut/L1.log`): `× stays silent outside a production build, whatever the origin` `expected "warn" to not be called at all, but actually been called 1 times` (`1 failed | 45 passed (46)`); restored, `cmp` ok, `git diff --stat` empty.
- **N6** matches. `expectNoViolations()` closes both tests; `chat.test.tsx:1382` also waits for "Parameters" first. Extra mutation X2 (`focus-visible:text-muted-foreground/40` on the chip, `mut/X2.log`): only `× does not scroll the page when a chip that is already in view receives focus` fails, `[serious] color-contrast ... 1.74 (foreground color: #c4c4c4 ...)` (`1 failed | 17 passed (18)`); restored, `cmp` ok, `git diff --stat` empty. X3 not reproduced.
- **Docs**: every changed sentence checked against the code. AGENTS.md deps rule ↔ `registry.test.ts:81-93`; markdown-CSS parenthetical ("inside or outside an `@layer`: an unlayered copy ... would beat the layered one") ↔ `cssRules` and the cascade (unlayered normal declarations beat layered ones); pre-bundling ("reads every file under `registry/`, `components/` and `tests/browser/` and follows their local imports ... skipping `import type` statements") ↔ `test-setup.test.ts:514-557` (true as written; the code also erases `export type` aliases and more, P1); e2e ("a raw request: no page, so no console and no colour scheme"; "at 375 px, in light and dark with a clean console"; "fails the specs that read the origin with the message `baseUrl()` gives the build, not a bare `Invalid URL`") ↔ `previews.spec.ts:64-106`, `origin.ts:24-29`, `registry.spec.ts:43,96`. architecture §5 unit ("`@import` or `@plugin` key counting as a use", "whether or not an `@layer` wraps either copy", "following local imports into the `app/` pages the tests render", "the Playwright origin helpers") ↔ the same code plus `tooling.test.ts`; §5 e2e ("375 px in light and dark ... console clean") ↔ `previews.spec.ts:80-106`. The unchanged `pnpm test:e2e` table row is still accurate.

## Runs (all on HEAD `5643605`, logs in `verify-tp-correctness/logs/`)

```
pnpm exec vitest run --project unit   run1: Test Files 8 passed (8)  Tests 338 passed (338)
                                      run2: Test Files 8 passed (8)  Tests 338 passed (338)
                                      run3 (two attempts, unit-run3.log / unit-run3c.log): 1 failed | 337 passed (338)
                                        the failure is `no item repeats a css rule ...` on the foreign registry.json mutation (P2); the group's files are clean
code-block.test.tsx                   run1: 55 passed (55)   run2: 55 passed (55)
suggestion.test.tsx                   run1: 18 passed (18)   run2: 18 passed (18)
blocks/chat.test.tsx                  run1: 67 passed (67)
pnpm exec tsc --noEmit                exit 0
pnpm exec biome check <9 code files>  Checked 9 files. No fixes applied.
pnpm exec prettier --check <9 + AGENTS.md + docs/architecture.md>  All matched files use Prettier code style!
pnpm exec playwright test --list      Total: 98 tests in 3 files
```

Mutation protocol: `mut.sh <id> <file> <old> <new> <cmd>` copies the file to `bak/<id>.bak`, asserts the snippet occurs once, patches, runs, copies the backup back, prints `cmp` and `git diff --stat`. Every mutated file printed `cmp ok` and an empty `git diff --stat` after restore, except M3 whose backup already carried P2's foreign line (restored to that same state; the file's remaining diff is P2's, not mine). Tracked files edited: only the mutation targets above, all restored; no git write commands.

## Verdict

refuted: true, on P1 only. The N11 check's `typeOnly` erasure crosses statement boundaries, so a bare specifier placed after an `export type` alias in a reached file is not reported (demonstrated on `app/preview/reasoning/page.tsx`: 26 passed with `next/link` imported). The fix is a one-regex change. N1, N4, N5, N6, N7, N9, N10 and every docs sentence hold as claimed; the coder's mutation table reproduces (M3 via the probe on the tree's copy of the same mutation, N10, C6, A1 on re-run, L1, X2). Separately, the lead must restore `registry/blocks/registry.json` (P2), which is not this group's diff.
