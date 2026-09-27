# verify-queue-repair-tests

refuted: false

Lens: test quality and mutation resistance for the `queue-repair` group (`registry/ai/queue.tsx`, `tests/browser/ai/queue.test.tsx`, `tests/browser/ai/response.test.tsx`, the `queue` entry's `docs` in `registry/ai/registry.json`). Evidence directory: `/docs/qa/round3/verify-queue-repair-tests/` (`queue-run{1,2,3}.log`, `response-run1.log`, `mutate.sh`, `queue.tsx.pristine`, `mut/V*.{diff,log,mutated}`, `wraps.{ca6f2fd,tree}.txt`).

State of the tree: HEAD is `38fe0a6` (the lead's round-3 checkpoint, 03:51:47), which bundles the earlier round-3 fixer's chip mirror and the 3b coder's content mirror in one commit. The coder's saved copies match: `cmp fix-queue-repair/queue.tsx.fixed registry/ai/queue.tsx` → identical; `fix-queue-repair/queue.test.tsx.new` differs from the tree only at lines 403-408 (prettier line wrapping, as the report says). The four group files were at HEAD at the end of my checks (`git status --short -- <4 files>` empty).

## Verdict

The finding (correctness P1 / rendered-surface R3-5, clamp half) is fixed and the fix is pinned by a test that fails on the old code, fails on every mutation I ran (the three prescribed plus two of my own), and reproduces the reviewer's exact scenario (fits in two lines at default spacing, needs a third line under the 1.4.12 override, `title` holds the whole text). No problem found that refutes the claim.

## Problems

None that refute. Observations, none blocking:

1. `tests/browser/ai/queue.test.tsx:352-379` ("clamps whole lines under WCAG 1.4.12 text spacing") cannot be byte-compared to its pre-3b state: that test was added by the earlier round-3 fixer after `ca6f2fd` and both fixers' work landed in the same checkpoint, and no scratchpad copy of the pre-3b test file exists (`verify-rb-tests/initial-git-diff.txt` covers only `response.tsx`; the `0880408…` hash I first took for the rb verifier's record was my own `sha256sum` of the then-clean tree). The evidence that it is unchanged: `git diff ca6f2fd 38fe0a6 -- tests/browser/ai/queue.test.tsx` contains no removed line at all (three pure-addition hunks), the correctness verifier cited that test at `queue.test.tsx:329-356` (28 lines) and it sits at 352-379 (28 lines) in HEAD, an offset of exactly 23 = the 3b fixture block at 163-185; the rb verifier's `mut/M12-no-title.log` cites the chip assertion at `queue.test.tsx:518:48` and it is at 572 in HEAD, an offset of 54 = 23 + the 31-line new test at 380-410. The body also matches both the rb fixer's description ("exactly two line boxes", `w-56`) and the P1 finding's description. The "wraps a long title onto a second line before clamping" test (335-350) is byte-identical to `ca6f2fd` (`diff wraps.ca6f2fd.txt wraps.tree.txt` empty).
2. The "consumer title wins" and "composed children get none" assertions at `queue.test.tsx:403-408` pass on the old code (the coder says so in the report); they are pinned by mutations V2 and V3 below, so they are not vacuous in the suite.
3. Environment, not the coder: a concurrent verifier was probing `tests/browser/ai/queue.test.tsx` in place at 03:58 (`fontFamily: "Courier 10 Pitch"` on the column, a `throw new Error("PROBE …")` replacing `await expectNoViolations()`) and had mutated/restored `registry/ai/queue.tsx` at 03:57. My harness refuses to start a mutation unless both files equal HEAD and marks a run invalid if either changes during it; every run below was valid and the probe was gone before my runs started.

## Mutation table (`registry/ai/queue.tsx`, whole `queue.test.tsx` run each time)

Harness: `verify-queue-repair-tests/mutate.sh <id> <sed-script>`: refuses unless `queue.tsx` equals the HEAD blob (`queue.tsx.pristine`, sha256 `25e271b5…`) and `queue.test.tsx` equals HEAD; applies a line-addressed `sed`; saves the mutated copy and `diff -u`; runs `pnpm exec vitest run --project browser tests/browser/ai/queue.test.tsx`; checks the source still equals the mutated copy and the test file still equals HEAD; restores with `cp` from the HEAD blob; `cmp`; `git diff --stat -- registry/ai/queue.tsx`.

| # | mutation (line in `queue.tsx`) | result | failing assertion | restored |
| --- | --- | --- | --- | --- |
| V1 | remove the mirror: `title={typeof children === "string" ? children : undefined}` deleted (line 91) | 1 failed / 47 passed (48) | `queue.test.tsx:401:41` `AssertionError: expected null to be 'Also update the README with the new s…'` | `cmp` OK, `git diff --stat` 0 lines, sha `25e271b5…` |
| V2 | move `title=` after `{...props}` (line 91 moved below 92) | 1 failed / 47 passed | `queue.test.tsx:403:74` `expected 'Also update the README with the new s…' to be 'README: new setting'` | OK, 0 lines |
| V3 | `title={String(children)}` unconditionally (line 91) | 1 failed / 47 passed | `queue.test.tsx:406:76` `expected true to be false` (composed children got a title) | OK, 0 lines |
| V4 (mine) | mirror only the first 20 characters: `children.slice(0, 20)` (line 91) | 1 failed / 47 passed | `queue.test.tsx:401:41` `expected 'Also update the READ' to be 'Also update the README with the new s…'` | OK, 0 lines |
| V5 (mine) | drop the clamp: `"line-clamp-2 grow break-words"` → `"grow break-words"` (line 83) | 3 failed / 45 passed | new test at `queue.test.tsx:400:32` `expected 0 to be greater than 0` (no hidden third line), plus `344:55` (`expected 'none' to be '2'`, the wraps test) and `374:34` (the clamps-whole-lines test) | OK, 0 lines |

V5 proves the new test's precondition is live: it fails when nothing is clamped, so the `title` assertion is not reachable through a layout that never hides a line. Final state: `cmp registry/ai/queue.tsx queue.tsx.pristine` identical; `git diff --stat -- registry/ai/queue.tsx` empty.

Fail-first claim checked: `fix-queue-repair/before.log` shows the new test failing on the old source at the same `queue.test.tsx:401:41` with `expected null to be 'Also update the README with the new s…'` (1 failed | 47 skipped, run with `-t`).

## Test quality (`tests/browser/ai/queue.test.tsx:163-184`, `381-410`)

- Fixture in `<main>`: yes, `SpacedTitles` renders `<main>` (line 171); the `<style>` with the 1.4.12 override is a child of that `<main>` and its selectors are `main * …` / `main p …` (line 165), so the override is scoped to the fixture.
- Shared helpers: `expectNoViolations` from `@/tests/a11y` (import at line 22, call at 409); no local `axe.run`, no local `settle`. The file also runs axe under `withDark()` twice elsewhere (not required of this test).
- No fixed sleeps, no `setTimeout`, no `waitFor`, no fake timers, no `retry`, no `.skip`/`.only`, no `allowConsole`, no console spies (`grep` over the file: none). The test logs nothing, and the console guard passed on all three runs.
- Name is behavioural: "shows the whole title in a title attribute when text spacing clamps a title that fit in two lines"; no bug or review words.
- Reproduces the reviewer's scenario, not a proxy: at default spacing it asserts the box is taller than 1.5 lines (392-394, so it wrapped) and `scrollHeight <= clientHeight` (395, so it fits in the two visible lines); under the override it asserts the override applied (`letterSpacing !== "normal"`, 398), that a line is now hidden (`scrollHeight > clientHeight`, 400) and that `title` equals the whole text (401). Detachment cannot pass silently: a detached `plain` gives height 0 and `NaN` line height, so 392 fails before the `<=` at 395 could pass trivially. `screen.rerender` keeps the same `<span>` node (same tree position; the added `<style>` is inserted before the column), so `plain` stays the rendered element across the three renders.
- Font independence (`queue.test.tsx:386-389`): the column width is derived from the title's own one-line width in whatever font renders (`width: max-content` on the column, `-webkit-box` children are block-level, so `plain.getBoundingClientRect().width` is the unwrapped text width), then divided by 1.7. Two lines at that width hold 2/1.7 = 117.6% of the one-line width. The override adds 0.12em per character and 0.16em per space, i.e. for 43 characters and 7 spaces a growth of 43×0.12/w + 7×0.16/(43w) relative to an average advance `w` (in em): ≈30% for a narrow face (w=0.40), 24% for DejaVu Sans or a monospace (w≈0.55-0.60), 20% at w=0.68; the growth exceeds the 17.6% headroom for any face with average advance below ≈0.72em, and line breaking only at spaces removes further headroom, so a third line is needed in every realistic UI font, narrow or wide. The default-spacing "fits in two lines" leg needs a break after "README" with the first line ≤ 58.8% of the one-line width; "Also update the README" is 22 of 43 characters (51.2% in a monospace, ~51-55% in proportional faces since only "README" is capitals), so it holds. In this browser the text renders in Chromium's default face because `app/globals.css:15` declares `--font-sans: var(--font-sans)` (self-referential, so `font-sans` resolves to the initial value; next/font is not loaded under Vitest): `fc-match serif` → DejaVu Serif; the coder measured 267 px for the one-line title. A concurrent verifier's Courier 10 Pitch probe was checking the same thing empirically.
- The two pre-existing clamp tests: unchanged (see Problems 1 for the evidence); the mutation V5 shows all three clamp tests still catch a dropped clamp.

## `tests/browser/ai/response.test.tsx`

`diff round3/response.test.tsx.before tests/browser/ai/response.test.tsx`:

```
9c9
< import { expectNoViolations, withDark } from "@/tests/a11y"
---
> import { expectNoViolations, settle, withDark } from "@/tests/a11y"
705a706
>     await settle()
```

Line 706 is inside "leaves formulas that fit unmarked and clips none of their tall parts", immediately before the first `page.screenshot` at 707 (the second is at 709). Nothing else changed. `settle` is the shared helper (`tests/a11y.ts:13`), not a sleep.

## Docs string

`registry/ai/registry.json` `queue.docs` tail now reads: "QueueItemContent clamps titles to two lines (upstream one) so a phone-width title is not cut off after a few words; the clamp cuts whole lines. QueueItemFile truncates the file name at 100px. Both the chip and the item title mirror the whole text in a title attribute when their children are a string (your own title wins), so a truncated file name, or a title that WCAG 1.4.12 text spacing pushes onto a third line, stays readable on hover." That matches `queue.tsx:91` and `queue.tsx:191` (guard, spread order). `pnpm exec vitest run --project unit tests/unit/registry.test.ts` → 26 passed.

## Runs (tree at HEAD)

```
queue run 1 exit=0  Tests 48 passed (48)  Duration 4.08s
queue run 2 exit=0  Tests 48 passed (48)  Duration 4.08s
queue run 3 exit=0  Tests 48 passed (48)  Duration 3.97s
response run exit=0 Tests 31 passed (31)  Duration 7.55s
```

Static: `git show HEAD:<f> | pnpm exec prettier --check --stdin-filepath <f>` OK for all three code files; `pnpm exec biome check registry/ai/queue.tsx tests/browser/ai/queue.test.tsx tests/browser/ai/response.test.tsx registry/ai/registry.json` → "Checked 4 files in 30ms. No fixes applied." (exit 0; my earlier stdin-mode biome runs printed "The contents aren't fixed. Use the `--write` flag" for every file, which is stdin-mode behaviour, not a lint result).

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH   # before every command
git diff ca6f2fd 38fe0a6 -- registry/ai/queue.tsx tests/browser/ai/queue.test.tsx registry/ai/registry.json
cmp fix-queue-repair/queue.tsx.fixed registry/ai/queue.tsx; diff fix-queue-repair/queue.test.tsx.new tests/browser/ai/queue.test.tsx
diff round3/response.test.tsx.before tests/browser/ai/response.test.tsx
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/ai/queue.test.tsx; done
pnpm exec vitest run --project browser tests/browser/ai/response.test.tsx
verify-queue-repair-tests/mutate.sh V1-remove-mirror '91d'
verify-queue-repair-tests/mutate.sh V2-title-after-spread '91{h;d};92{G}'
verify-queue-repair-tests/mutate.sh V3-string-unconditional '91s/typeof children === "string" ? children : undefined/String(children)/'
verify-queue-repair-tests/mutate.sh V4-first-20-chars '91s/? children :/? children.slice(0, 20) :/'
verify-queue-repair-tests/mutate.sh V5-drop-clamp '83s/"line-clamp-2 grow break-words"/"grow break-words"/'
git show HEAD:<f> | pnpm exec prettier --check --stdin-filepath <f>   # three files
pnpm exec biome check <four group files>
pnpm exec vitest run --project unit tests/unit/registry.test.ts
git status --short -- <four group files>   # empty
```
