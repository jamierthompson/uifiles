# fix-queue-repair

Evidence directory: `/docs/qa/round3/fix-queue-repair/` (`before.log`, `after.log`, `run{1,2,3}.log`, `mut.sh`, `M{1,2,3,1-final}.{diff,log}`, `queue.tsx.fixed`, `prettier.log`, `biome.log`, `tsc.log`, `registry-validate.log`, `registry-test.log`).

## Fixed

- verify-response-branch-disclosure-correctness:P1 / rendered-surface:R3-5, clamp half: `QueueItemContent` now copies its text into `title` when its children are a string. The attribute sits before the props spread, so a consumer's `title` wins; children that are not a string get no `title`. The visible `line-clamp-2` is unchanged. This matches `QueueItemFile`. See `registry/ai/queue.tsx:73-96` (the `title` line is 91).
  - test: `tests/browser/ai/queue.test.tsx` › "shows the whole title in a title attribute when text spacing clamps a title that fit in two lines". This is the reviewer's scenario:
    1. It renders the preview title "Also update the README with the new setting" in a `text-sm` column. The column width is the title's one-line width divided by 1.7, so the title takes two lines at default spacing whatever font Chromium falls back to (Times New Roman here: 267 px on one line, a 158 px column).
    2. At default spacing it asserts the box is taller than 1.5 lines and `scrollHeight <= clientHeight`, so the title fits.
    3. It then rerenders with a `<style>` inside `<main>` that applies the 1.4.12 overrides: line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em, and `p` margin-bottom 2em.
    4. It asserts the override applied (`letterSpacing` is not `normal`), that the box now clamps (`scrollHeight > clientHeight`, measured 63 against 42, i.e. three lines against two), and that `title` holds the whole text.
    5. It also checks that a consumer's `title` wins, that composed children get no `title`, and runs axe.
  - Failed before (`registry/ai/queue.tsx` at HEAD, `before.log`): `AssertionError: expected null to be 'Also update the README with the new s…'` at `queue.test.tsx:401`. The default-spacing and clamp assertions before it passed, so the scenario was reproduced and only the missing mirror failed. Passes after (`after.log`, 48/48).
  - Which assertions fail on the old code: only the title-mirror assertion can. On the old code the "consumer title wins" and "composed children get none" assertions hold trivially, because there was no mirror to override. They are pinned by mutations M2 and M3 instead (see the table).
  - The existing clamp tests are kept unchanged: "wraps a long title onto a second line before clamping" and "clamps whole lines under WCAG 1.4.12 text spacing". The second still pins that the clamp cuts whole line boxes.
- `tests/browser/ai/response.test.tsx` › "leaves formulas that fit unmarked and clips none of their tall parts": added `await settle()` before the first `page.screenshot` and added `settle` to the `@/tests/a11y` import. Nothing else in the file changed. One run: 31/31 passed.

## Not fixed and why

- None.

## Tests

- `tests/browser/ai/queue.test.tsx`: 47 → 48 tests, with one new test and a module-level `SpacedTitles` fixture plus `TEXT_SPACING` and `SPACED_TITLE` constants. No upstream tests to port in this pass.
- `tests/browser/ai/response.test.tsx`: 31 tests before and after; only `settle()` was added.
- Mutation checks. `mut.sh` refuses to start unless `queue.tsx` equals the fixed copy, applies one `perl` substitution, runs the whole queue file, restores, and `cmp`s. Every run ended `restored=OK`:

| # | mutation (`registry/ai/queue.tsx`) | result |
| --- | --- | --- |
| M1 | remove the `title` mirror (and its comment) | 1 failed / 47 passed: the new test, `expected null to be 'Also update the README with the new s…'` |
| M1-final | same, re-run on the final formatted test file | 1 failed / 47 passed, same message |
| M2 | move `title=` after `{...props}` (spread order swapped) | 1 failed / 47 passed: `expected 'Also update the README with the new s…' to be 'README: new setting'` |
| M3 | `title={String(children)}` (drop the string guard) | 1 failed / 47 passed: `expected true to be false` (composed children got a title) |

- Three consecutive runs of `tests/browser/ai/queue.test.tsx` (`run{1,2,3}.log`):
  - run 1 exit=0: Tests 48 passed (48), Duration 4.29s
  - run 2 exit=0: Tests 48 passed (48), Duration 4.08s
  - run 3 exit=0: Tests 48 passed (48), Duration 4.05s
- Console guard: no `allowConsole()` and no console spies. The new test logs nothing.
- `tests/browser/ai/response.test.tsx` one run: Test Files 1 passed (1), Tests 31 passed (31).

## Docs strings

- Only the `queue` entry's `docs` changed. The Base UI sentence is still first and `description` is unchanged. The tail went from:
  - "... QueueItemContent clamps titles to two lines (upstream one) so a phone-width title is not cut off after a few words. QueueItemFile truncates the file name at 100px and puts the whole name in the chip's title attribute when its children are a string (your own title wins). The two-line clamp cuts whole lines, also under WCAG 1.4.12 text spacing."
- to:
  - "... QueueItemContent clamps titles to two lines (upstream one) so a phone-width title is not cut off after a few words; the clamp cuts whole lines. QueueItemFile truncates the file name at 100px. Both the chip and the item title mirror the whole text in a title attribute when their children are a string (your own title wins), so a truncated file name, or a title that WCAG 1.4.12 text spacing pushes onto a third line, stays readable on hover."
- The old last sentence is gone because it presented the non-fix as a fix.
- The rest of the `registry/ai/registry.json` diff (code-block, reasoning, response) belongs to the markdown-surfaces coder; I did not touch it.

## Registry entry changes

- Applied directly: I own the `queue` `docs` string this round. `pnpm exec prettier --write registry/ai/registry.json` reported it unchanged. `pnpm registry:validate`: "√ Registry is valid. √ Checked 8 registry files and 83 items." `pnpm exec vitest run --project unit tests/unit/registry.test.ts`: 26 passed.

## Requests for other owners

- `docs/architecture.md` §3 (docs-previews-pins owner), only if it lists the queue divergences in detail: the item title now mirrors its text in `title` the same way the file chip does. If §3 only points at the item's `docs`, nothing is needed.

## Strict-flag typecheck

- `pnpm exec tsc --noEmit` exit 0 with no output. `tsconfig.json` carries `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `noUnusedLocals`.
- Errors remaining in files I own: none.
- Errors in files I do not own: none at the time of the run.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH   # before every command
pnpm exec vitest run --project browser tests/browser/ai/response.test.tsx          # after settle(): 31 passed
pnpm exec vitest run --project browser tests/browser/ai/queue.test.tsx -t "text spacing clamps a title"   # before fix: 1 failed (before.log)
# (one temporary probe assertion printing the layout numbers, run once, file restored from a copy and cmp'd)
pnpm exec vitest run --project browser tests/browser/ai/queue.test.tsx             # after fix: 48 passed (after.log)
fix-queue-repair/mut.sh M1|M2|M3|M1-final '<perl substitution>'                     # mutation table above
pnpm exec prettier --write registry/ai/registry.json tests/browser/ai/queue.test.tsx
pnpm exec prettier --check registry/ai/queue.tsx tests/browser/ai/queue.test.tsx tests/browser/ai/response.test.tsx registry/ai/registry.json   # All matched files use Prettier code style!
pnpm exec biome check <same four files>                                             # Checked 4 files. No fixes applied.
pnpm exec tsc --noEmit                                                              # exit 0
pnpm registry:validate                                                              # valid, 83 items
pnpm exec vitest run --project unit tests/unit/registry.test.ts                     # 26 passed
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/ai/queue.test.tsx; done   # 48/48 x3
```
