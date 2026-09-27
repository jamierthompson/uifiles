# fix-repair-3c

HEAD `5643605`, tree clean at start (`git status` empty). Scratch: `qa/round3/fix-repair-3c/` (`orig/` byte copies of the six owned files + `orig.sha256`, `mutate.py`, `mut/*.log`, `logs/*.log`, `walk-compare.mjs`, `new-tail.ts`). No commits, no build/dev/e2e/server commands, no `git checkout --`.

Files changed (only the six owned): `tests/unit/test-setup.test.ts`, `.claude/rules/registry.md`, `CHANGELOG.md`, `docs/architecture.md`, `registry/blocks/chat/components/blocks/chat.tsx` (JSDoc only), `registry/blocks/registry.json` (`chat` › `docs` only). `git diff --stat`: 6 files, +260/−60.

## Fixed

- **verify-tests-polish-correctness P1 / verify-tests-polish-regressions 1: the type-only erasure crossed statement boundaries.** `tests/unit/test-setup.test.ts:514`:
  ```ts
  const TYPE_ONLY_STATEMENT =
    /^(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+)\s+from\s+"[^"]*"/gm
  ```
  - It erases exactly one type-only from-statement: `import type { … } from "…"` (the braces can span lines), `import type X from "…"`, `import type * as X from "…"`, `export type { … } from "…"`, and `export type * from "…"`.
  - It does not match an `export type X = …` alias (no `from` follows the name), `import type from "x"` (a default binding named `type`), or an inline `import { type X }`.
  - Test: `the import walk behind the pre-bundling check` › "skips a whole type-only import or re-export statement, and still reports a value import that follows an `export type` alias". Its fixture holds every statement form plus the P1 shape: `export type Probe = { id: number }` followed by `import Link from "value-after-alias"`, and `export type Alias = Probe` followed by `export { thing } from "value-reexport"`.
  - Failed before, with the refactor in place and the old regex (`logs/before-regex-fix.log`): `AssertionError: expected [] to deeply equal [ 'value-after-alias', …(1) ]`, `Tests 1 failed | 31 passed (32)`. Passes after (`logs/after-regex-fix.log`, `32 passed`).
  - Real tree (`walk-compare.mjs`): the old regex erased 187 spans in the 81 reached files, 86 of them multi-line non-statement spans. The new one erases 56, none multi-line. Both reach the same 81 files with the same 39 bare specifiers, and nothing is unresolved.
  - Across all tracked `.ts`/`.tsx` under `registry components tests app`, the new regex matches 81 times. None of the matches contains `=` or `;` or more than one `from`.
  - The verifier's real-tree reproduction is now caught (mutation P1-real below).
- **verify-tests-polish-tests 1: the walk is now a pure function with self-tests.**
  - Helpers at module scope:
    - `listSources(dir)` (`:485`)
    - `resolveLocal(root, from, spec)` (`:496`)
    - `TYPE_ONLY_STATEMENT` (`:514`)
    - `readEachOnce()` (`:523`)
    - `walkImports(root, seeds, read): { reached, bare, unresolved }` (`:547`)
  - New `describe("the import walk behind the pre-bundling check")` (`:578`) builds `mkdtempSync` trees, which `afterEach` removes:
    1. "stops at an import cycle, reading each file once": `seed/a.ts ↔ lib/b.ts`. Asserts `reached`, `bare = ["cycle-pkg"]`, `unresolved = []`.
    2. "reports a local import that names no file": `./nope` and `@/nope` → `["seed/a.ts: ./nope", "seed/a.ts: @/nope"]`.
    3. The P1 test above.
    4. "counts an inline `import { type X } from "pkg"` as a use of pkg: only a whole type-only statement is skipped". This is the conservative direction, and the test name says so.
    5. "follows `@/` and `../` imports out of the seed directory to a bare specifier". The path is `tests/browser/page.test.tsx` → `@/lib` (index resolution) → `../app/page` → `next/link`.
    6. "sees a bare specifier only under a seed directory or in a file one imports, so a dropped seed hides its imports". Seeds `["one","two"]` report both packages; `["one"]` reports only `pkg-one`.
  - The real-tree test (`:723`) keeps the gap invariant and the unresolved guard. It now also names the seed directories on its own (not shared with the call), so dropping a seed from the call fails it:
    - every `.ts`/`.tsx` file under `registry`, `components` and `tests/browser` must be in `reached` ("seed files the walk did not read");
    - the walk must reach at least one file outside those directories ("files reached only through local imports"). Today that is 4 `app/preview` files and the 4 `tests/*.ts` helpers.
- **verify-tests-polish-regressions 2:** `.claude/rules/registry.md:18-19` now reads "…on a declared package that none of its files imports and no `@import` or `@plugin` key of its `css` loads." This matches `AGENTS.md:80-81` and `tests/unit/registry.test.ts` `cssImportedPackages`.
- **verify-prompt-input-polish-correctness nit 1:** in `CHANGELOG.md:146-151`, the clause now reads "without `onStop`, `PromptInputSubmit` was still named Stop while submitted or streaming and showed the stop square while streaming, although a press submitted (it is a Stop button only when `onStop` is passed)".
  - Checked against `git show 9019bdf:registry/ai/prompt-input.tsx`: `aria-label={isGenerating ? "Stop" : "Submit"}` (1545), the square only on `status === "streaming"` (1525) with the spinner on `"submitted"` (1523), and `type={isGenerating && onStop ? "button" : "submit"}` (1549).
  - The rest of the paragraph was only re-wrapped. No new over-long lines: the ones left over 94 columns (60, 63, 64, 130) were already there.
- **verify-prompt-input-polish-correctness nit 2:** in `docs/architecture.md:182` (§3 `prompt-input`), the parenthetical now reads "(without it a press submits, so while generating it keeps the Submit name and type and never shows the square: the spinner while submitted, the return glyph while streaming; upstream names it Stop and shows the square either way)".
  - This matches `prompt-input.tsx:1539-1575`: `canStop` gates the label and type, the spinner shows on `submitted` alone, and the square shows on `streaming && canStop`.
  - It also matches registry docs (6): "keeps the Submit name, type and glyph, and only the spinner shows while submitted".
- **verify-prompt-input-polish-correctness nit 3:** `chat.tsx:695-707` JSDoc (comment only) now reads: "…and a submit button. While a response is in flight nothing submits and the draft and attachments are kept; the button is then a Stop button that calls `onStop` when one is passed (`Chat` passes its own through), and without `onStop` it keeps the Submit name and a press does nothing. After an error the button is a plain Submit again…". Checked against the code:
  - `Chat` forwards its own `onStop` prop at `:181`.
  - `ChatComposer` spreads `onStop` only when it is defined, at `:776`.
  - While busy without `onStop`, `handleSubmitClick` calls `preventDefault` and `handleKeyDown` blocks Enter.
- **`chat` › `docs`** in `registry/blocks/registry.json`: "Stop is the only action then." is replaced, in the same sentence, by "if you pass `onStop` to Chat or ChatComposer (the page passes `stop` from `useChat`) the submit button becomes a Stop button that calls it, and without `onStop` it keeps the Submit name and a press does nothing." The Base UI sentence is still first and the string is still one paragraph (`split("\n").length === 1`). `prettier --write` left it unchanged, `pnpm registry:validate` exits 0, and `registry.test.ts` passes 30 of 30.

## Not fixed and why

- **Test timeout (deviation from the prompt, on purpose).** I did not add a Vitest `timeout` to the cycle test, because it cannot stop this hang. The walk is synchronous, and a timer cannot interrupt a synchronous loop. Mutation G1b shows this: guard dropped and the reader bound removed, with the default 5 s unit `testTimeout` in force, the run was still spinning at 60 s and the shell `timeout` killed it (exit 124).
  - What bounds it instead: every call passes `readEachOnce()`, a reader that throws on a second read of the same path. With the cycle guard dropped (G1), the suite fails in 1.4 s with `read twice: …/seed/a.ts` (self-test) and `read twice: …/components/ui/button.tsx` (real tree).
  - Clean-up: G1b's killed run leaked one fixture dir (`/tmp/uifiles-imports-pUHVka`, its `afterEach` never ran). I removed it, and `/tmp` has no `uifiles-imports-*` left.
- **Observation, pre-existing and out of the brief:** the scan sees only `from "…"`. It misses a bare side-effect `import "pkg"` and a dynamic `import("pkg")` / `vi.mock("pkg")`.
  - Today the only side-effect imports under the seeds are `import "@/app/globals.css"`, which is local.
  - The dynamic ones are `import("@/registry/ai/code-block")` (local) and `typeof import("shiki")` (a type position; `shiki` is in `include` anyway).
  - No gap today. Worth a follow-up only if a bare side-effect import appears.

## Tests

- `tests/unit/test-setup.test.ts`: 26 → 32 tests (6 new self-tests). The unit project: 338 → 344.
- The P1 self-test failed before the regex change and passes after (logs above). The other five self-tests pin behaviour the walk already had: the brief asked for them as mutation cover, and they are shown by the mutations below.
- Mutation checks. `mutate.py` snapshots the file in memory, requires each snippet exactly once, patches, runs `timeout <n> pnpm exec vitest run --project unit tests/unit/test-setup.test.ts`, restores from the snapshot and compares sha256. Logs are in `fix-repair-3c/mut/`.

| id | file | mutation | result |
| --- | --- | --- | --- |
| R1 (required) | tests/unit/test-setup.test.ts | regex reverted to `/^(?:import\|export)\s+type\s[^"]*"[^"]*"/gm` | caught: "skips a whole type-only import … `export type` alias", `expected [] to deeply equal [ 'value-after-alias', …(1) ]`, `1 failed \| 31 passed`; restore sha OK |
| S1 (required) | tests/unit/test-setup.test.ts | the real-tree call seeds `["registry", "components"]` (tests/browser dropped) | caught: real-tree test, `seed files the walk did not read: expected [ …(23) ] to deeply equal []` (every `tests/browser/**` file listed), `1 failed \| 31 passed`; restore sha OK |
| G1 (required) | tests/unit/test-setup.test.ts | cycle guard `if (reached.has(file)) continue` removed | caught in 1.41 s, no hang: cycle self-test `Error: read twice: /tmp/uifiles-imports-…/seed/a.ts` and real-tree test `read twice: …/components/ui/button.tsx`, `2 failed \| 30 passed`; restore sha OK |
| G1b (evidence) | tests/unit/test-setup.test.ts | G1 plus the `readEachOnce` throw removed, `-t "stops at an import cycle"` | hangs past the 5 s default test timeout; killed by `timeout 60` (exit 124). This shows why the bound is the reader and not a timer; restore sha OK; leaked temp dir removed |
| F1 | tests/unit/test-setup.test.ts | the walk stops following local imports (`pending.push(local)` dropped) | caught ×3: cycle test `expected [ 'seed/a.ts' ] to deeply equal [ 'lib/b.ts', 'seed/a.ts' ]`, hop test `expected [] to deeply equal [ 'next/link' ]`, real-tree `files reached only through local imports: expected [] to not deeply equal []`; restore sha OK |
| U1 | tests/unit/test-setup.test.ts | unresolved imports not recorded | caught: `expected [] to deeply equal [ 'seed/a.ts: ./nope', …(1) ]`; restore sha OK |
| A1 | tests/unit/test-setup.test.ts | `@/` resolved from the importer instead of the root | caught ×2: hop test `expected [] to deeply equal [ 'next/link' ]`, real-tree `files reached only through local imports`; restore sha OK |
| P1-real | app/preview/reasoning/page.tsx (not owned; byte-restored) | the verifier's shape: `export type Probe = { id: number }` then `import Link from "next/link"` after the react import | caught on the real tree: `expected [ 'next/link' ] to deeply equal []` (before this fix it passed, 26/26, per both verifiers); sha `312aa0f8…` before and after, `git diff --stat` empty |

The file's sha after every restore was `230f26cf…`, the same as before the mutations.

- Three consecutive runs of `pnpm exec vitest run --project unit` (`logs/unit-run{1,2,3}.log`, with `git status` captured before each run: only my six files modified):
  ```
  run1: Test Files  8 passed (8)   Tests  344 passed (344)
  run2: Test Files  8 passed (8)   Tests  344 passed (344)
  run3: Test Files  8 passed (8)   Tests  344 passed (344)
  ```
- Baseline before any change: `Tests 338 passed (338)` (`logs/unit-baseline.log`).

## Registry entry changes (applied: I own this string)

- `chat` › docs (in `registry/blocks/registry.json`), the changed sentence in full: "While a response is in flight, Enter, the submit button and a programmatic `form.requestSubmit()` submit nothing and the draft and attachments are kept (ChatComposer returns `false` from `onSubmit`); if you pass `onStop` to Chat or ChatComposer (the page passes `stop` from `useChat`) the submit button becomes a Stop button that calls it, and without `onStop` it keeps the Submit name and a press does nothing."

## Requests for other owners

- `registry/blocks/registry.json` › `chat` › `description` (not mine: I own only `docs`). "a submit button that becomes stop while streaming" is loose in the same way: the button is Stop while submitted too, and only with `onStop`. Suggested: "a submit button that becomes a Stop button while a response is in flight (when onStop is passed; the page wires useChat's stop)".

## Strict-flag typecheck

- `pnpm exec tsc --noEmit` exits 0. `tsconfig.json` already enables `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `noUnusedLocals`.
- Errors remaining in files I own: none. Errors in files I do not own: none.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
pnpm exec vitest run --project unit                                   # baseline 338; then x3 → 344
pnpm exec vitest run --project unit tests/unit/test-setup.test.ts     # before (old regex): 1 failed | 31 passed; after: 32 passed
node qa/round3/fix-repair-3c/walk-compare.mjs                         # old vs new erasure on the real tree
python3 qa/round3/fix-repair-3c/mutate.py <id> <file> <old> <new> [timeout] [-t filter]   # R1 S1 G1 G1b F1 U1 A1 P1-real
pnpm exec prettier --write tests/unit/test-setup.test.ts registry/blocks/registry.json
pnpm registry:validate                                                # exit 0
pnpm exec vitest run --project unit tests/unit/registry.test.ts       # 30 passed
pnpm exec biome check <6 files>                                       # Checked 3 files. No fixes applied. (the .md files are not biome's)
pnpm exec prettier --check <6 files>                                  # All matched files use Prettier code style!
pnpm exec tsc --noEmit                                                # exit 0
git show 9019bdf:registry/ai/prompt-input.tsx                         # checkpoint submit-button logic for the CHANGELOG wording
```
