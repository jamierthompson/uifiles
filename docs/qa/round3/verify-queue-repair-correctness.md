# verify-queue-repair-correctness

refuted: false

Lens: correctness of the fix for `verify-response-branch-disclosure-correctness` § P1 (rendered-surface R3-5, clamp half). Group files: `registry/ai/queue.tsx`, `tests/browser/ai/queue.test.tsx`, `tests/browser/ai/response.test.tsx`, the `queue` entry's `docs` in `registry/ai/registry.json`. Baseline: HEAD `38fe0a6` (the amended successor of the checkpoint `82f6e83`; `82f6e83` is not an ancestor of HEAD, so the diff below is `git diff 82f6e83 HEAD`). Working tree clean before, between and after every command (`git status --short` empty; `git diff --stat HEAD` over the four files empty at the end).

Evidence directory: `/docs/qa/round3/verify-qr-correctness/` (`queue-run{1,2,3}.log`, `response-run1.log`, `tsc.log`, `mut.sh`, `M{1,2,3,5}.{diff,log,pristine}`, `P-default.*`, `P{1..7}-*.*`, `P7{b,c}-*.*`).

## Problems

None that refute the fix. Observations for the lead (not defects in the coder's work; the reviewer listed the `title` mirror as one of three acceptable resolutions, and the coder chose it):

1. The mirror is a hover affordance. `title` never shows on a touch screen or from the keyboard, so under WCAG 1.4.12 text spacing the third line of such a title is still visually hidden for those readers; a screen reader already read the whole text before the fix. Dropping the clamp was the reviewer's other option. This is the accepted resolution, so not a refutation; it is the residual the lead should know when the docs claim "stays readable on hover" (that sentence is accurate as far as it goes).
2. On a generic `<span>` whose name comes from its content, `title` becomes the accessible description and equals the name. Screen readers do not normally announce descriptions on static text, and the chip (`registry/ai/queue.tsx:191`) already does exactly this and passed the previous verification (its M4), so this is consistent, not new.
3. `QueueItemContent` is rendered outside this component only by `app/preview/queue/page.tsx:79-81,117` (the chat block does not use it). The queue browser test does not render the preview page, so the preview's new `title` attributes are covered by the Playwright axe sweep only (forbidden here). A `title` on a span cannot trip an axe rule, and the component-level `expectNoViolations()` in the new test runs with `title` set.

## Confirmed

### The diff (`git diff 82f6e83 HEAD -- <four files>`: 4 files, +71/-25; only the parts below belong to this group)

`registry/ai/queue.tsx` (+8/-1), now lines 73-96:

```
export const QueueItemContent = ({
  children,                                    // 74: destructured
  ...
    // uifiles: the clamp can still hide a line (a long title, or WCAG 1.4.12
    // text spacing widening one that fit); the title shows it whole on hover.
    title={typeof children === "string" ? children : undefined}   // 91
    {...props}                                                      // 92: spread AFTER title, consumer's wins
  >
    {children}                                                      // 94
  </span>
```

- Applies only to string children (line 91; `undefined` renders no attribute, so a number, element or fragment child gets none).
- Sits before the spread (91 before 92), so a consumer's `title` overrides it.
- Mirrors `QueueItemFile` exactly (`queue.tsx:190-191`, same expression, same position).
- Deterministic from props: no SSR/hydration divergence possible.
- `line-clamp-2 grow break-words` unchanged (line 83).

`tests/browser/ai/response.test.tsx` (+2/-1): `settle` added to the `@/tests/a11y` import (line 9) and `await settle()` inserted before the first `page.screenshot` in "leaves formulas that fit unmarked and clips none of their tall parts" (line 706). Nothing else. `settle` is exported by `tests/a11y.ts` (the run passed).

`registry/ai/registry.json`, `queue` entry `docs` tail (the code-block/reasoning/response hunks in the same diff belong to the markdown-surfaces group and were ignored):

> "QueueItemContent clamps titles to two lines (upstream one) so a phone-width title is not cut off after a few words; the clamp cuts whole lines. QueueItemFile truncates the file name at 100px. Both the chip and the item title mirror the whole text in a title attribute when their children are a string (your own title wins), so a truncated file name, or a title that WCAG 1.4.12 text spacing pushes onto a third line, stays readable on hover."

Describes the code: both mirrors (`queue.tsx:91`, `:191`), string-children guard, consumer title wins (spread order), whole-line clamp (pinned by the existing test "clamps whole lines under WCAG 1.4.12 text spacing", `queue.test.tsx:352-379`). The old sentence that presented the non-fix as a fix is gone. The Base UI sentence is still first; `description` unchanged.

### The new test reproduces the reviewer's scenario (`tests/browser/ai/queue.test.tsx:163-185` fixture, `:381-410` test)

Shape of the assertions, read line by line:

- 383-389: render at `width="max-content"`, measure the title's one-line width, set the column to `ceil(oneLine / 1.7)` px. The column is derived from the rendered text, not a fixed pixel width, so the two-line fit holds for any font (contrast the earlier test at `:339`, `w-56`, which the refutation said clamps at default spacing too).
- 391-395: at default spacing, height > 1.5 line-heights (so two lines, not one) AND `scrollHeight <= clientHeight` (nothing hidden under the clamp, so at most two lines). Together: "fits in two lines at default spacing".
- 397-398: rerender with the 1.4.12 override (`TEXT_SPACING`, line 164-165: line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em, `p` margin-bottom 2em, all `!important`, scoped to `main *`) and assert `letterSpacing !== "normal"` (the override took).
- 400: `scrollHeight > clientHeight`: the clamp now hides content, i.e. a third line exists.
- 401: `title` equals the whole text.
- 403-408: consumer `title` wins; composed (element) children get no `title`.
- 409: axe.

Probe (test file patched to throw the measured numbers after every real assertion had passed, then restored; `P-default.log`):

```
Error: PROBE {"font":"\"Times New Roman\"","oneLine":267.140625,"width":"158px","lineHeight":20,
  "d0":{"h":40,"sh":40,"ch":40,"lh":"20px"},
  "d1":{"h":42,"sh":63,"ch":42,"lh":"21px","ls":"1.68px"}}
Tests  1 failed | 47 skipped (48)
```

d0 (default spacing): 40 px box = exactly two 20 px lines, scrollHeight equal, so nothing hidden. d1 (override): 21 px lines, 42 px clamped box, 63 px content = three lines, one hidden. Exactly the reviewer's "fits at default, clamped only under the override".

Font independence: the same probe with `fontFamily` forced on the fixture's column for every installed family of a different width (`fc-list`), each run restoring the file byte-identically:

| font | one-line width | column | d0 (default) | d1 (spaced) |
| --- | --- | --- | --- | --- |
| default stack (resolves to Times New Roman) | 267.14 | 158px | h=sh=ch=40 (2 lines) | ch=42, sh=63 (3 lines clamped) |
| Liberation Serif | 267.14 | 158px | same | same |
| FreeSans | 276.77 | 163px | same | same |
| Liberation Sans | 287.94 | 170px | same | same |
| Unifont | 301 | 178px | same | same |
| DejaVu Sans | 322.80 | 190px | same | same |
| DejaVu Sans Mono | 362.44 | 214px | same | same |

Every real assertion passed before the probe threw in all seven runs. (My first "Courier 10 Pitch" runs did not apply because an unquoted family name with a digit token is invalid CSS; quoted, Chromium still fell back to the serif metrics, so that font is not a separate data point. Six distinct widths from 267 to 362 px are.) Analytically: with the column at 58.8% of the one-line width, the override inflates the text by 43 x 0.12em + 7 x 0.16em = 6.28em, which exceeds the 17.6% needed for a third line for any font whose 43-character line is under ~36em, i.e. every text font.

### Three consecutive runs and the response run (working tree clean before and after)

```
queue run 1 exit=0 ::  Tests 48 passed (48) ::  Duration 4.31s
queue run 2 exit=0 ::  Tests 48 passed (48) ::  Duration 4.12s
queue run 3 exit=0 ::  Tests 48 passed (48) ::  Duration 4.18s
response run 1 exit=0 ::  Tests 31 passed (31) ::  Duration 7.96s
```

No `allowConsole`, `spyOn`, `mockImplementation`, `test.skip` or `retry` in `queue.test.tsx` (grep empty).

### My mutations (`mut.sh`: refuses if the file is already modified, copies the pristine file, `perl -0pi`, runs the whole queue file, restores, `cmp` + sha256 + `git diff --stat`; every line ended `restored=OK` with sha `25e271b5b64a2f18` unchanged and `git-diff-stat=[]`)

| # | mutation (`registry/ai/queue.tsx`) | result |
| --- | --- | --- |
| M1 | remove the mirror and its comment (lines 89-91) | 1 failed / 47 passed: `AssertionError: expected null to be 'Also update the README with the new s…'` |
| M2 | move `title=` after `{...props}` (raw diff confirms the spread now precedes it) | 1 failed / 47 passed: `expected 'Also update the README with the new s…' to be 'README: new setting'` |
| M3 | `title={String(children)}` | 1 failed / 47 passed: `expected true to be false` (composed children got a title) |
| M5 | `children.slice(0, 10)` (a truncated mirror) | 1 failed / 47 passed: `expected 'Also updat' to be 'Also update the README with the new s…'` |

The coder's own evidence (`fix-queue-repair/`: `mut.sh` with the same refuse-if-dirty guard, `M{1,2,3,1-final}.{diff,log}`, `before.log` showing the same `expected null` failure at HEAD before the fix) matches mine, and `queue.tsx.fixed` is byte-equal to the working tree.

### Static checks

```
pnpm exec tsc --noEmit                                         exit=0, 0 lines (no failure anywhere, so no re-run needed)
pnpm exec biome check <four files>                             Checked 4 files in 38ms. No fixes applied.   exit=0
pnpm exec prettier --check <four files>                        All matched files use Prettier code style!   exit=0
pnpm registry:validate                                         exit=0
pnpm exec vitest run --project unit tests/unit/registry.test.ts  Tests 26 passed (26)                         exit=0
```

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH   # before every command
git log --oneline -5; git status --short; git merge-base --is-ancestor 82f6e83 HEAD   # not an ancestor (amended)
git diff 82f6e83 HEAD --stat -- <four files>; git diff 82f6e83 HEAD -- <each>
cat -n registry/ai/queue.tsx; sed -n 300,412p tests/browser/ai/queue.test.tsx
grep -n "allowConsole\|spyOn\|mockImplementation\|test.skip\|retry" tests/browser/ai/queue.test.tsx
grep -rn QueueItemContent app registry/blocks components tests/browser/blocks
fc-list : family | sort -u; fc-match sans-serif|serif|monospace
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/ai/queue.test.tsx; done
pnpm exec vitest run --project browser tests/browser/ai/response.test.tsx
pnpm exec tsc --noEmit; pnpm exec biome check <four>; pnpm exec prettier --check <four>
pnpm registry:validate; pnpm exec vitest run --project unit tests/unit/registry.test.ts
verify-qr-correctness/mut.sh M1|M2|M3|M5 registry/ai/queue.tsx '<perl>'                       # whole file
verify-qr-correctness/mut.sh P-default|P1..P7|P7b|P7c tests/browser/ai/queue.test.tsx '<perl>' "text spacing clamps a title that fit"
git diff --stat HEAD -- <four files>   # empty at the end
```
