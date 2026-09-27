# verify-tests-polish-tests

Lens: test quality and mutation resistance. HEAD `5643605`, pre-round checkpoint `9019bdf`. Scratch: `qa/round3/verify-tp-tests/v2/` (`orig/` byte copies + `orig.sha256`, `snip/`, `mut/*.log`, `logs/*.log`, `mutate.py`). The older content directly under `verify-tp-tests/` (05:56–06:01) is a previous, unfinished run; nothing below relies on it.

**refuted: true**

Everything the coder claims reproduces (all 9 of their mutations I re-ran are caught, three runs of every file are green, hygiene rules hold), but one of the lead's judging criteria fails: the N11 import-following walk is the only new check in this group with no self-test independent of the real tree. Its walk logic (seed dirs, `resolveLocal`, the type-only strip, the `files.push(local)` follow step) is unpinned: my V4 mutation survives, and the coder's own A3 survived and was shipped as "as expected". Everything else: confirmed.

## Problems

1. **medium — N11 walk has no self-test; its logic is mutation-transparent on the pristine tree.** `tests/unit/test-setup.test.ts:514-557`: the walk (`resolveLocal` at `:526`, the `typeOnly` strip at `:540`, the follow step `files.push(local)` at `:552`) lives inline in the real-tree test. Every other new check in the group has a synthetic self-test (N7 `registry.test.ts:570-616`, N10 `:482-520`, N1 `tooling.test.ts:156-175`, N4 `site.test.ts:212-224`); this one does not, and the file already has a `mkdtempSync` fixture pattern (`:387`) it could reuse.
   - V4 (mine): `for (const dir of ["registry", "components", "tests/browser"])` → `["registry", "components"]` → `Tests 26 passed (26)`, exit 0 (`mut/V4.log`).
   - Coder's A3 (`fix-tests-polish/mut/A3-walk-does-not-follow.log`): walk stops following local imports → `26 passed`, reported "as expected".
   - Only the `unresolved` guard has a mutation that fails on the pristine tree (coder's A2), and only because the real tree happens to have `.tsx` imports.
   - Fix (small): lift the walk into a function taking `root`, the seed dirs and the include list; add a test on a `mkdtempSync` tree with (a) an `a ↔ b` cycle, (b) an unresolvable `./nope`, (c) a statement-level `import type … from "next"` that must not be reported, (d) a bare specifier reached only through an `@/` hop and a `../` hop, (e) a seed dir that must be walked (drop one and the test fails). My V6/V6b below are the runtime evidence that (a), (b) and (d) behave today; they belong in the file, not in a verifier's temp files.

2. **low (process) — the coder ran `git checkout -q -- app/preview/reasoning/page.tsx`** during A3 (disclosed at `fix-tests-polish.md:134`). The brief forbids it. No damage: the file is byte-identical to HEAD (`orig.sha256` matches `git show HEAD:`), and their `mutate.py` asserted identity afterwards. Recording it so the lead's rule stays enforced.

3. **low (informational) — the type-only strip is statement-level only.** `tests/unit/test-setup.test.ts:540` `/^(?:import|export)\s+type\s[^"]*"[^"]*"/gm` skips `import type { X } from "next"` but not `import { type Metadata } from "next"`. A preview page written that way would demand `next` in `optimizeDeps.include`. The error is in the conservative direction (a failing test, not a silent gap), so not blocking; worth a comment or a second pattern when the self-test in (1) is written.

4. **info — e2e not executed** (`e2e/previews.spec.ts`, `e2e/origin.ts` changes): forbidden here. `pnpm exec tsc --noEmit` exit 0 covers compilation (tsconfig includes `e2e/`). Test-count arithmetic is consistent with the coder's 98: 2 projects × (19 previews × 2 schemes + 1 branch + 2 response + 8 in `registry.spec.ts`/`chat-keyboard.spec.ts`), but I did not run `playwright test --list`.

## Criteria checked (all hold unless listed above)

- **Behavioural names**: every new/renamed test names the behaviour (`forgets the callers of a failed highlight: the retry notifies only its own caller`; `… sees through @layer wrappers`; `isLocalRequest and expectsPublicOrigin answer, not throw, for a value that is not an absolute URL`; `stays silent outside a production build, whatever the origin`). No bug/review names.
- **Fixtures in `<main>`**: `chat.test.tsx` (hunk at `:1379-1384`, render at `:1372`) and `suggestion.test.tsx:223` both render inside `<main>`; the new scans are `expectNoViolations()` from `@/tests/a11y` (`chat.test.tsx:1384`, `suggestion.test.tsx:243`). No inline `axe.run`/`settle`.
- **No fixed sleeps in new code.** The `settled()` helper `chat.test.tsx:69-76` (poll, then a bounded 100 ms hold sampled every 10 ms for an "and nothing else happens" assertion) is pre-existing and unchanged; the edited test at `:1709` only changed the button name.
- **No `vi.spyOn(console…).mockImplementation` in browser tests**: the tooling rule test passes in all three unit runs; the new spy `code-block.test.tsx:806` has no implementation, `errors.mockRestore()` at `:830` mirrors the file's existing `:183`. `site.test.ts:213` uses `mockImplementation` in the **unit** project, which AGENTS.md permits (N3 residue unchanged).
- **`allowConsole` only where asserted**: `code-block.test.tsx:805` + `:811-816` asserts the logged `Failed to highlight code:` error and `:829` asserts exactly one.
- **No `.skip` / `.only` / `retry`** in the nine files (grep).
- **N9 assertion is observable behaviour**: `failed` never called, `retried` called once, `highlightCode(source,"haskell")` returns the retry's result (return value = cache), one error logged. The `shiki.grammars` count is at the shiki boundary through the file's pre-existing instrumentation (same as the ruby test at `:766`), not module internals. `shiki.failNext.has(...)` is mock bookkeeping, harmless.
- **N11 cannot loop on a cycle and fails on an unresolvable import**: V6/V6b below (terminates in the 18 ms test, reports the unresolvable path). The `reached` set is checked at pop time (`:543-545`), so a cycle is inert by construction.
- **Docs strings** (`AGENTS.md`, `docs/architecture.md` diff) match the code paths cited.
- **`chat.test.tsx:1709` "Submit"**: matches HEAD `registry/ai/prompt-input.tsx:1569` `aria-label={canStop ? "Stop" : "Submit"}`; chat run green.

## Runs (final files, HEAD 5643605)

```
unit project     run1/2/3: Test Files 8 passed (8)  Tests 338 passed (338)   (5.6 s)
code-block       run1: 55 passed   run2: 55 passed
                 run3: --sequence.shuffle --sequence.seed 424242 → 'Running tests with seed "424242"'  55 passed (55)
suggestion       run1/2/3: 18 passed (18) ×3
blocks/chat      run1: 67 passed (67)  (40 s; a foreign in-flight edit to registry/ai/prompt-input.tsx landed at its end)
tsc --noEmit     exit 0
```

## Mutation table

`v2/mutate.py`: snippet must occur exactly once → patch → run → restore from the in-memory bytes (never `git checkout`) → sha256 compared → `git diff --stat -- <file>` printed. Logs in `v2/mut/<id>.log`.

| id | file | mutation | result |
| --- | --- | --- | --- |
| M1 (coder) | tests/unit/registry.test.ts | `unlayered` keeps `@layer` ancestors | caught: `sees through @layer wrappers` — `expected [ …(3) ] to deeply equal [ …(5) ]`, both `canvas` lines missing; restored ok, diff-stat `''` |
| M2 (coder) | tests/unit/registry.test.ts | `cssImportedPackages` regex back to `@import` only | caught: stale-dependency self-test `+ "x declares \"@tailwindcss/typography\", which no file imports and no css @import or @plugin loads"` |
| M3 (coder) | registry/blocks/registry.json | `chat` gains top-level `"css": { ".katex-display": { "overflow": "visible" } }` | caught: real-manifest test `+ "chat repeats \`.katex-display\`, which @uifiles/response ships as \`@layer base > .katex-display\`"`; restored ok (sha `020c729e…`), diff-stat `''` |
| C6 (coder) | registry/ai/code-block.tsx | `.catch` drops `subscribers.delete(tokensCacheKey)` | caught: `forgets the callers…` — `expected "vi.fn()" to not be called at all, but actually been called 1 times`; 54 others pass |
| A1 (coder) | app/preview/reasoning/page.tsx | `import Link from "next/link"` added | caught: `expected [ 'next/link' ] to deeply equal []` |
| L1 (coder) | lib/registry.ts | warning ignores `NODE_ENV` | caught: `stays silent outside a production build…` — `expected "warn" to not be called at all, but actually been called 1 times` |
| O2 (coder) | e2e/origin.ts | unparsable value → `return true` | caught: `uifiles.dev: expected true to be false` |
| X2 (coder) | registry/ai/suggestion.tsx | chip gets `focus-visible:text-muted-foreground/40` | caught only by `does not scroll the page when a chip…`: `[serious] color-contrast` 1.74 (#c4c4c4 on #ffffff); 17 others pass |
| X3 (coder) | registry/blocks/chat/components/blocks/chat.tsx | stopped call's `ToolInput` gets `opacity-50` (`part.state === "input-available" && !isLive(status)`) | caught only by `shows a stopped call as Pending…`: `[serious] color-contrast` 2.01 (#b5b5b5 on #fdfdfd); 66 others pass |
| V1 (mine) | tests/unit/registry.test.ts | `unlayered` strips only `@layer base` (`/^@layer base\b/`) | caught: self-test `expected [ …(4) ] to deeply equal [ …(5) ]`, missing `canvas repeats \`@layer components > .katex-display\`…`. The same run also failed the real-manifest test with the M3 message: another verifier's M3-shaped edit of `registry/blocks/registry.json` was live (file mtime 11:50:09.26, my M3 restore log 11:50:08.50; diff captured). A clean re-run was not possible while that edit persisted; the self-test failure is the V1 evidence. |
| V3 (mine) | registry/ai/code-block.tsx | `.catch` notifies every subscriber with `createRawTokens(text)` before deleting them | caught: `forgets the callers…` — `expected "vi.fn()" to not be called at all, but actually been called 1 times` |
| V4 (mine) | tests/unit/test-setup.test.ts | walk no longer seeds from `tests/browser` | **survived**: `Tests 26 passed (26)` → problem 1 |
| V5 (mine) | e2e/origin.ts | `publicOrigin` message drifts from `baseUrl()`'s (drops `such as https://uifiles.dev`) | caught: `publicOrigin rejects … with the message the build gives` — `expected [Function] to throw error including 'NEXT_PUBLIC_BASE_URL must be an absol…' but got …` |
| V6 (mine, temp untracked files, no tracked edit) | tests/browser/__verify_cycle_a.ts ↔ __verify_cycle_b.ts; b also imports `./__verify_nope` and `definitely-not-a-package/sub` | terminates (18 ms test; 120 s `timeout` not hit), fails: `local imports the walk could not follow: + "tests/browser/__verify_cycle_b.ts: ./__verify_nope"`; files removed, `git status -- tests/browser` empty |
| V6b (mine, temp untracked files) | seed `tests/browser/__verify_cycle_a.ts` imports `@/app/__verify_cycle_b`; `app/__verify_cycle_b.ts` imports `../tests/browser/__verify_cycle_a` back plus `./__verify_nope` | terminates, fails: `+ "app/__verify_cycle_b.ts: ./__verify_nope"` — proves the walk follows an `@/` hop into `app/`, a `../` hop back, and the cycle guard holds; files removed, `git status -- app tests/browser` empty |

## Tree integrity at the end

`git diff --quiet HEAD -- <file>` is clean for every file I mutated (`tests/unit/registry.test.ts`, `tests/unit/test-setup.test.ts`, `lib/registry.ts`, `e2e/origin.ts`, `registry/ai/code-block.tsx`, `registry/ai/suggestion.tsx`, `registry/blocks/chat/components/blocks/chat.tsx`, `app/preview/reasoning/page.tsx`) except `registry/blocks/registry.json`, whose current diff is a foreign in-flight mutation (written after my restore, see V1). `registry/ai/prompt-input.tsx` is also foreign-modified (mtime 11:55; I never touched it). All 15 `v2/orig/` copies hash equal to `git show HEAD:<file>`.

## Commands

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
git diff 9019bdf HEAD -- <nine files> AGENTS.md docs/architecture.md
pnpm exec vitest run --project unit                                             # ×3
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx     # ×2, + --sequence.shuffle --sequence.seed 424242
pnpm exec vitest run --project browser tests/browser/ai/suggestion.test.tsx     # ×3
pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx       # ×1 (+ X3)
pnpm exec tsc --noEmit
python3 qa/round3/verify-tp-tests/v2/mutate.py <id> <file> <old> <new> <cmd>   # M1 M2 M3 C6 A1 L1 O2 X2 X3 V1 V3 V4 V5
# V6/V6b: printf two temp .ts files → vitest run --project unit tests/unit/test-setup.test.ts (under `timeout 120`) → rm → git status
```
