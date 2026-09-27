# verify-repair-3c

refuted: false

Lenses: correctness, test quality / mutation resistance, regressions. HEAD `6365d91`, pre-repair checkpoint `5643605`. Tree clean at start and at the end (`git status --porcelain` empty; every file I touched `cmp`-equal to my `orig/` copy, `orig.sha256` unchanged). Scratch: `qa/round3/verify-repair-3c/` (`orig/` + `orig.sha256`, `mutate.py`, `snip/`, `mut/*.log`, `logs/*.log`, `regex-probe.mjs`, `walk-compare.mjs`). No tracked file edited except mutations restored from my own in-memory bytes (sha256 asserted after each; never `git checkout --`). No build/dev/e2e/server commands. `/tmp/uifiles-*` count: 0 before, 0 after (the one dir the deliberate G1b hang leaked was removed).

Every claim in `fix-repair-3c.md` reproduces; every wording change is true of the code it describes; the six self-tests each kill at least one mutation and the real-tree test now fails on a dropped seed. Nothing refutes. Three non-blocking nits below.

## Problems

None refuting.

### Nits (not blocking)

1. **Report imprecision** — `fix-repair-3c.md` says the new regex "erases 56, none multi-line". Over the same 81 reached files it erases 56 spans of which 6 span lines (`walk-compare.mjs`); all 6 are `import type {\n…\n} from "…"` brace lists (`registry/ai/code-block.tsx`, `inline-citation.tsx`, `prompt-input.tsx`, `response.tsx`, `registry/blocks/chat/components/blocks/chat.tsx`, `tests/browser/blocks/chat.test.tsx`), i.e. exactly the single-statement multi-line form the regex is meant to erase. The code is right; the sentence in the report is not.
2. **Edge, conservative direction** — `tests/unit/test-setup.test.ts:558` replaced the old `if (!spec …) continue` with `if (spec === undefined) continue`, so a literal `from ""` would now be reported as a gap (`""` is not in `include`) where the old code skipped it. No such import exists and a failing test is the safe side. Observation only.
3. **Edge, conservative direction** — `TYPE_ONLY_STATEMENT` (`:514`) is anchored at column 0 (`^` with `m`), so an indented `import type … from "pkg"` is not erased and counts as a use of `pkg` (`regex-probe.mjs` case "indented import type"). Prettier keeps top-level imports at column 0, so this cannot fire on this tree; again the safe side.

## (1) `tests/unit/test-setup.test.ts` — correctness

- **Regex erases exactly one type-only from-statement per form and never an alias.** `regex-probe.mjs` (17 cases, exit 0): `import type {…} from`, multi-line braces, `import type X from`, `import type * as X from`, `export type {…} from`, `export type * from`, `export type * as ns from`, `export type {} from` each match once and leave no bare specifier; `export type X = {…}` + `import Link from "next/link"` matches 0 and the walk sees `next/link`; `export type Alias = Probe` + `export { thing } from "value-reexport"` → 0, sees `value-reexport`; generic alias `export type Alias<T> = T` → 0; multi-line union alias → 0; `import type from "pkg"` → 0; inline `import { type Shape, make }` → 0 (counted); two consecutive type-only statements → exactly 2; type-only followed by value import → erases only the first. Contrast: the old regex on the alias trap erases `"export type X = { a: number }\nimport Link from \"next/link\""` whole.
- **Real tree** (`walk-compare.mjs`, `logs/walk-compare.log`): old and new regex reach the same 81 files and the same 39 bare specifiers, `unresolved []` both. Old erased 187 spans (92 multi-line, one containing a `from "` inside a JSDoc in `registry/ai/model-selector.tsx:56`); new erases 56, 0 suspicious (every match has exactly one `from`, no `=`/`;`, newlines only inside braces). Over every `.ts/.tsx` under `registry components tests app lib scripts e2e` the new regex matches 81 times, 0 suspicious. Reached outside the seeds: `app/preview/model-selector/{logos.ts,model-selector-demo.tsx}`, `app/preview/{reasoning,response}/page.tsx`, `tests/{a11y,axe-tags,console-guard,setup}.ts`.
- **`walkImports(root, seeds, read)` is pure** (`:547-576`): inputs are the root, the seed list and the reader; no module state; returns `{ reached, bare, unresolved }`. `listSources` `:485`, `resolveLocal(root, from, spec)` `:496` (`@/` from the root, `./`/`../` from the importer), `readEachOnce` `:523`.
- **Self-tests** (`describe` at `:578`, six `it`s) build `mkdtempSync(join(tmpdir(), "uifiles-imports-"))` trees; `afterEach` at `:592` `rmSync`s every root (`roots.splice(0)`). Temp dirs: 0 before and 0 after every one of the 15 harness runs, including the runs where a self-test failed (vitest still ran `afterEach`).
- **Real-tree test** (`:723-753`) still asserts the gap (`walk.bare` minus `node:`/`vitest`/`include` → `[]`, `:746-753`) and `unresolved` → `[]` (`:744`); it lists the seed dirs itself (`:733`, a second literal, not shared with the call) and asserts every `.ts/.tsx` under them was read (`:737` "seed files the walk did not read") and that files outside were reached (`:738-743` "files reached only through local imports").
- **Cycle guard dropped fails fast**: G1 under `timeout 60` → exit 1 in 1.46 s, `Error: read twice: /tmp/uifiles-imports-…/seed/a.ts` (self-test) and `read twice: /components/ui/button.tsx` (real tree). G1b (guard dropped AND the `readEachOnce` throw removed, `-t "stops at an import cycle"`) under `timeout 45` → exit 124: the 5 s vitest `testTimeout` did not stop the synchronous loop, so the reader is the bound, as the coder argued for not adding a timeout.
- **Reader bound cannot false-fail on a legitimate tree**: `read` is called only after `if (reached.has(file)) continue; reached.add(file)` (`:557-558`), and `resolveLocal` is filesystem-only per import, so a file two importers name is read once and resolved for both. D1 (a temporary extra self-test, restored): `seed/a.ts` imports `../lib/shared`, `seed/b.ts` imports `@/lib/shared`, `lib/shared.ts` imports `shared-pkg` → `reached` = the three files, `bare = ["shared-pkg"]`, `unresolved = []`, `33 passed (33)`. The real tree (`components/ui/button.tsx` imported by many) passes the same reader in all runs.
- **Test names**: behavioural throughout ("stops at an import cycle, reading each file once", "reports a local import that names no file", "skips a whole type-only import or re-export statement, and still reports a value import that follows an `export type` alias", "counts an inline `import { type X } from "pkg"` as a use of pkg: only a whole type-only statement is skipped", "follows `@/` and `../` imports out of the seed directory to a bare specifier", "sees a bare specifier only under a seed directory or in a file one imports, so a dropped seed hides its imports"). No bug or review names; no `.skip`/`.only`/`retry`.

## (2) Wording

| where | text | code it must match | verdict |
| --- | --- | --- | --- |
| `.claude/rules/registry.md:18-19` | "…no `@import` or `@plugin` key of its `css` loads" | `tests/unit/registry.test.ts:84` `/^@(?:import\|plugin)\s+…/` in `cssImportedPackages`; `AGENTS.md:80` same words | true, in step |
| `CHANGELOG.md:146-148` | "without `onStop`, `PromptInputSubmit` was still named Stop while submitted or streaming and showed the stop square while streaming, although a press submitted (it is a Stop button only when `onStop` is passed)" | `git show 9019bdf:registry/ai/prompt-input.tsx`: `isGenerating = submitted \|\| streaming`; `aria-label={isGenerating ? "Stop" : "Submit"}`; square only on `status === "streaming"`, spinner on `"submitted"`; `type={isGenerating && onStop ? "button" : "submit"}`; `handleClick` falls through to `onClick` without `onStop` | true |
| `docs/architecture.md:182` | "(without it a press submits, so while generating it keeps the Submit name and type and never shows the square: the spinner while submitted, the return glyph while streaming; upstream names it Stop and shows the square either way)" | HEAD `registry/ai/prompt-input.tsx:1542` `canStop = isGenerating && onStop !== undefined`; `:1546-1547` spinner on `submitted` alone; `:1548` square only on `streaming && canStop`, else the `CornerDownLeftIcon` default; `:1569` label, `:1573` type on `canStop`. Registry docs (6): "keeps the Submit name, type and glyph, and only the spinner shows while submitted" | true, consistent with (6) |
| `chat.tsx:695-707` JSDoc | "a submit button. While a response is in flight nothing submits and the draft and attachments are kept; the button is then a Stop button that calls `onStop` when one is passed (`Chat` passes its own through), and without `onStop` it keeps the Submit name and a press does nothing. After an error the button is a plain Submit again…" | `Chat` `:181` `onStop={onStop}`; `ChatComposer` `:715` `busy = isGenerating(status)`; `handleSubmit` returns `false` while busy (`:720`); `handleKeyDown` blocks Enter (`:734-741`); `handleSubmitClick` `preventDefault` while busy (`:749`); `PromptInputSubmit` gets `status === "error" ? "ready" : status` and `{...(onStop !== undefined && { onStop })}` (`:776-778`); with `onStop`, `prompt-input.tsx:1556-1560` calls `onStop` and never `onClick`; without, `onClick` → `handleSubmitClick` swallows | true |
| `registry/blocks/registry.json:47` `chat` › `docs` | "…if you pass `onStop` to Chat or ChatComposer (the page passes `stop` from `useChat`) the submit button becomes a Stop button that calls it, and without `onStop` it keeps the Submit name and a press does nothing." | `registry/blocks/chat/page.tsx:11,21` `const { …, stop } = useChat(…)`, `onStop={stop}`; behaviour as the row above | true with and without `onStop`; Base UI sentence first (`startsWith` true); one paragraph (`split("\n").length === 1`) |
| `registry/blocks/registry.json:8` `chat` › `description` | "…a Prompt Input composer with attachments whose submit button becomes Stop while a response is in flight (given onStop)…" | same code; "in flight" = submitted or streaming = `isGenerating` | true; length 897 ≤ 900 (was 897 at `5643605`, content differs) |

## (3) Hunks accounted for (`git diff 5643605`, 6 files, +261/−61)

| file | hunks | what |
| --- | --- | --- |
| `tests/unit/test-setup.test.ts` | `mkdirSync` import; helpers `listSources`/`resolveLocal`/`TYPE_ONLY_STATEMENT`/`readEachOnce`/`ImportWalk`/`walkImports` + `describe` with six self-tests (`:484-690`); real-tree test rewritten over `walkImports` with the three non-vacuity guards (`:723-753`) | P1 / regressions 1 / tests 1 |
| `.claude/rules/registry.md` | `:18-19` `@plugin` | regressions 2 |
| `CHANGELOG.md` | `:146-151` reworded clause, rest re-wrapped | pip nit 1 |
| `docs/architecture.md` | `:182` parenthetical | pip nit 2 |
| `registry/blocks/chat/components/blocks/chat.tsx` | `:695-707` JSDoc only | pip nit 3 |
| `registry/blocks/registry.json` | `:8` `description` (lead), `:47` `docs` (coder) | request for other owners / docs |

No other file differs from `5643605`.

## Mutation table

Harness `mutate.py`: snapshot bytes → each snippet must occur exactly once → patch → `timeout <s> pnpm exec vitest run --project unit tests/unit/test-setup.test.ts [-t …]` → restore from the snapshot → sha256 compared → `git diff --stat -- <file>` → `/tmp/uifiles-*` counted before and after. Logs `mut/<id>.log`. Every row: `restore_sha_ok=True`, `git_diff_stat=''`, tmpdirs 0 → 0 (except G1b, by design).

| id | file | mutation | result |
| --- | --- | --- | --- |
| R1 (required) | test-setup.test.ts | regex reverted to `/^(?:import\|export)\s+type\s[^"]*"[^"]*"/gm` | caught: "skips a whole type-only import … `export type` alias" `expected [] to deeply equal [ 'value-after-alias', …(1) ]`; `1 failed \| 31 passed (32)` |
| S1 (required) | test-setup.test.ts | real-tree call seeds `["registry", "components"]` (tests/browser dropped) | caught: `seed files the walk did not read: expected [ …(23) ] to deeply equal []`; `1 failed \| 31 passed` |
| G1 (required, `timeout 60`) | test-setup.test.ts | `if (reached.has(file)) continue` removed | caught in 1.46 s: `Error: read twice: …/seed/a.ts` (cycle self-test) and `read twice: …/components/ui/button.tsx` (real tree); `2 failed \| 30 passed`; no hang |
| G1b (evidence, `timeout 45`, `-t "stops at an import cycle"`) | test-setup.test.ts | G1 + `readEachOnce` throw removed | hangs past the 5 s test timeout, killed: exit 124; leaked `/tmp/uifiles-imports-CAO44Z` (afterEach never ran), removed; count back to 0 |
| A1 (required) | test-setup.test.ts | `@/` resolved from the importer (`join(dirname(from), spec.slice(2))`) | caught ×2: hop self-test `expected [] to deeply equal [ 'next/link' ]`; real tree `files reached only through local imports: expected [] to not deeply equal []` |
| P1-real (required) | `app/preview/reasoning/page.tsx` | `export type Probe = { id: number }` + `import Link from "next/link"` after the react import | caught on the real tree: `expected [ 'next/link' ] to deeply equal []`; `1 failed \| 31 passed`; sha `312aa0f8…` before and after |
| F1 | test-setup.test.ts | `pending.push(local)` dropped (walk stops following) | caught ×3: cycle `expected [ 'seed/a.ts' ] to deeply equal [ 'lib/b.ts', 'seed/a.ts' ]`, hop `[ 'next/link' ]`, real tree "files reached only through local imports" |
| U1 | test-setup.test.ts | `unresolved.push(…)` → `void …` | caught: `expected [] to deeply equal [ 'seed/a.ts: ./nope', …(1) ]` |
| Ma (mine) | test-setup.test.ts | regex loses the `export` alternative | caught: `expected [ 'type-reexport', 'type-star', …(2) ] to deeply equal [ 'value-after-alias', …(1) ]` |
| Mb (mine) | test-setup.test.ts | braces may not span lines (`\{[^}\n]*\}`) | caught: `expected [ 'type-multiline', …(2) ] …` |
| Mg (mine) | test-setup.test.ts | `listSources` lists only `.ts` | caught ×3: alias self-test `expected []…`, hop `[ 'next/link' ]`, real tree "files reached only through local imports" |
| Mh (mine) | test-setup.test.ts | `resolveLocal` drops the `/index.ts(x)` suffixes | caught: hop self-test `expected [] to deeply equal [ 'next/link' ]` (`@/lib` → `lib/index.ts`) |
| Ms (mine) | test-setup.test.ts | `bare` not sorted | caught ×2: inline-type test `[ 'mixed-pkg', 'inline-type-pkg' ]`, seeds test `[ 'pkg-two', 'pkg-one' ]` |
| Mr (mine, `-t "the import walk…"`) | test-setup.test.ts | walk ignores `seeds` (`listSources(root)`) | caught: seeds self-test `expected [ 'pkg-one', 'pkg-two' ] to deeply equal [ 'pkg-one' ]`; `1 failed \| 5 passed \| 26 skipped` |
| D1 (mine, positive) | test-setup.test.ts | temporary extra self-test: two seed files import one `lib/shared.ts` via `../` and `@/`, read through `readEachOnce()` | passes: `33 passed (33)`; reader bound yields no false failure on a diamond |

Coverage of the six self-tests by kill: 1 ← G1, F1; 2 ← U1; 3 ← R1, Ma, Mb, Mg; 4 ← Ms; 5 ← A1, F1, Mg, Mh; 6 ← Ms, Mr. The real-tree test ← S1, G1, A1, F1, Mg, P1-real.

## Runs (logs in `logs/`)

```
pnpm exec vitest run --project unit      run1: Test Files 8 passed (8)  Tests 344 passed (344)  4.78s
                                         run2: Test Files 8 passed (8)  Tests 344 passed (344)  4.67s
                                         run3: Test Files 8 passed (8)  Tests 344 passed (344)  4.25s
  (git status --porcelain empty before each run: status-before-unit-run{1,2,3}.log)
pnpm exec vitest run --project unit tests/unit/registry.test.ts   Tests 30 passed (30)
pnpm registry:validate                   exit 0
pnpm exec tsc --noEmit                   exit 0
pnpm lint                                exit 0  (biome: Checked 151 files. No fixes applied.)
pnpm format:check                        exit 0  (All matched files use Prettier code style!)
pnpm exec prettier --check <6 changed files>   All matched files use Prettier code style!  exit 0
pnpm exec biome check <3 code/json files>      Checked 3 files. No fixes applied.  exit 0
node regex-probe.mjs                     17/17 ok, exit 0
node walk-compare.mjs                    reached 81=81, bare 39=39, unresolved []=[], new spans 56 (0 suspicious)
```

## Verdict

refuted: false. The erasure is now one statement per match and never an alias (probe + real tree), the verifier's real-tree reproduction is caught, `walkImports` is pure with six self-tests that each kill mutations and clean up their temp trees, the real-tree test fails on a dropped seed and on a lost cycle guard without hanging, the reader bound cannot false-fail a legitimate tree, and all six wording changes are true of the code at HEAD (and, for the CHANGELOG, of `9019bdf`). Three unit runs at 344, registry test 30, validate/tsc/lint/format/prettier/biome all green. Only nits: the report's "none multi-line" undercounts six legitimate brace-list matches, and two column-0 / empty-specifier edges fall on the conservative side.
