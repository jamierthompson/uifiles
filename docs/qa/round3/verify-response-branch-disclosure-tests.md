# verify-response-branch-disclosure-tests

refuted: false

Lens: test quality and mutation resistance of the tests the coder added or changed for
`registry/ai/{response,branch,checkpoint,confirmation,queue}.tsx`, `app/globals.css`,
`tests/browser/ai/{response,branch,checkpoint,confirmation,queue}.test.tsx`,
`tests/unit/branch.test.ts`, `tests/unit/ssr.test.ts`, `app/preview/{response,branch}/page.tsx`.

Scratch: `/docs/qa/round3/verify-rb-tests/`
(`mutate.sh`, `pristine/` + `pristine.sha256`, `mut/<name>.{diff,log}` + `mut/results.log`,
`run{1,2,3}-{browser,unit}.log`, `run{1,2,3}-sha-{before,after}.txt`, `initial-git-diff.txt`).

Judged against HEAD `82f6e83` (the lead re-checkpointed from `1f57fb7` during my session; see Environment notes).
Tests diffed against `ca6f2fd`; reproducers read from `git show ca6f2fd:tests/browser/qa-round3/components-b.test.tsx`
and `git show ca6f2fd:tests/unit/qa-round3-components-b.test.ts`.

## Verdict

Not refuted. 29 mutations applied across the five sources and the stylesheet (the four required fixes plus
the link-safety dialog, the fullscreen-table marker, the StrictMode clamp guard and the confirmation
class order): every one is caught by at least one of the coder's tests, every restore verified
byte-identical against the pre-mutation sha256, and the five browser files plus the two unit files pass
three consecutive runs (170/170, 170/170, 170/170; 31/31 ×3) with the source shas unchanged across each
run. Every round-3 reproducer for the coder's files is in a canonical file under a behavioural name, the
two dropped ones are justified, and both round-3 files are deleted in HEAD. No test-quality rule is broken.

## Problems

None that refute. Observations, none blocking:

1. `tests/browser/ai/response.test.tsx:701-706` › "leaves formulas that fit unmarked and clips none of
   their tall parts" compares two `page.screenshot({ save: false })` strings with no `settle()` between
   render and the first shot. It is not a flake in practice (passed in all 3 of my runs, all 3 of the
   coder's, and in the 11 mutation runs of the file where it was not the target; `MessageResponse` never
   sets `animated`, so Streamdown adds no `[data-sd-animate]` here), but a future `animated` default
   would make it one. Worth a `await settle()` before the first screenshot.
2. `tests/unit/branch.test.ts:232-337` › "branch through a real Flight round trip" requires
   `next/dist/compiled/react-server-dom-webpack/{server,client}.node` and spawns a child Node under
   `--conditions=react-server` in `beforeAll`. Real evidence for R3-3 (the served-HTML claim), but it is
   coupled to Next's compiled internals and will need attention on a Next upgrade. The name's "round"
   is "round trip", not a QA-round word.
3. Under mutation, four of the new tests fail only by timeout (about 15 s each: checkpoint
   `toHaveAccessibleDescription` polls, the link-safety `getByRole("dialog")` waits, confirmation
   `not.toHaveClass`). Correct, just slow to fail; a mutation run of `response.test.tsx` takes ~75 s
   when the dialog never appears.
4. Nine of the twenty round-3 reproducers belong to other owners (chat ×2, suggestion ×1, sync-tokens
   ×6). The coder handed them over as paste-ready snippets under
   `fix-response-branch-disclosure-requests/`; at the end of my session all nine are present in the
   working tree (`tests/browser/blocks/chat.test.tsx:1348,1368`, `tests/browser/ai/suggestion.test.tsx:214`,
   `tests/unit/tokens.test.ts:559-618`) as uncommitted changes by those owners. The lead should confirm
   they get committed, since the round-3 files that held them are already gone from HEAD.

## Mutation table

Harness: copy the tracked file, `perl -0pi` substitution, refuse to start unless the file's sha256 equals
the pre-session snapshot (waits up to 60 s for another verifier's in-flight mutation), run the named test
file(s), restore the snapshot copy, sha256-check. `results.log` has every line; `mut/<name>.diff` the
exact patch. "caught (n)" is the number of failing tests; names below are the tests that failed.

| # | Fix | Mutation (file:line) | Test file | Result |
| --- | --- | --- | --- | --- |
| M1 | `.katex-display` rule | delete the whole rule, `app/globals.css:139-142` | browser response | caught (2): "scrolls a formula wider than a phone inside a named tab stop instead of widening the page" (`expected 956 to be less than or equal to 375`), "keeps its long formula inside the column at phone width" |
| M2 | `.katex-display` padding | `padding-block: 0.25em` → `0`, `app/globals.css:141` | browser response | caught (1): "leaves formulas that fit unmarked and clips none of their tall parts" (pixel test) |
| M3 | Math scroller marking | remove the `MATH_DISPLAY` loop from `findScrollers`, `registry/ai/response.tsx:88-90` | browser response | caught (2): the two Math tests above |
| M4 | Math scroller marking | `MATH.overflows` → `overflowsEitherAxis`, `response.tsx:68-69` | browser response | caught (2): "leaves formulas that fit unmarked…", "adds no tab stop to a formula that cannot scroll because the stylesheet rule is missing" |
| M18 | fullscreen table | drop `...document.querySelectorAll(FULLSCREEN_TABLE)`, `response.tsx:82` | browser response | caught (1): "makes the fullscreen table view a named tab stop while the table overflows" |
| M19 | fullscreen table | drop `portalObserver.observe(document.body, …)`, `response.tsx:320` | browser response | caught (1): same test (first attempt skipped: file not pristine, another verifier mid-mutation; re-run caught) |
| M20 | link-safety dialog | delete the `renderModal` line, `response.tsx:258-260` (the shape HEAD `1f57fb7` had) | browser response | caught (5): all five dialog tests |
| M21 | link-safety dialog | `...linkSafety` spread first, `response.tsx:257-261` | browser response | caught (2): "renders plain anchors that open in a new tab when linkSafety is disabled", "keeps a consumer's renderModal and onLinkCheck" (first run also showed the two Math tests failing with `956 <= 375` while another verifier had the CSS rule removed; clean re-run M21b: exactly these 2) |
| M22 | link-safety dialog | `showModal()` → `show()`, `response.tsx:152` | browser response | caught (2): "confirms a link in a modal dialog that takes focus…", "copies the URL, says so, and closes from the close button or the backdrop" (same CSS noise on the first run; clean re-run M22b: exactly these 2) |
| M23 | link-safety dialog | drop `onClose={onClose}`, `response.tsx:185` | browser response | caught (3): the confirm, open-link and copy tests |
| M5 | lazy-type resolution | delete the `LAZY` branch of `componentOf`, `registry/ai/branch.tsx:78-88` | unit branch | caught (5): "counts content handed over as a client reference", "counts content wrapped in memo or forwardRef", "waits for a reference whose module is still loading and counts it", both Flight round-trip renders |
| M5b | lazy-type resolution | same | browser branch | caught (1): "renders client references' selector on the server and hydrates it without a warning" |
| M6 | lazy-type resolution | `return type._init(type._payload)` without recursing, `branch.tsx:87` | unit branch | caught (1): "counts content wrapped in memo or forwardRef" (the `clientReference(memo(…))` case) |
| M7 | lazy-type resolution | swallow the thrown promise (`try … catch { return type }`), `branch.tsx:87` | unit branch | caught (1): "waits for a reference whose module is still loading and counts it" |
| M15 | StrictMode clamp guard | remove the `reportedClampRef` check, `branch.tsx:148-150` | browser branch | caught (1): "reports a controlled clamp once under StrictMode's replayed effects" |
| M16 | StrictMode clamp guard | never reset the ref, `branch.tsx:145` | browser branch | caught (1): "reports the same clamp again after the parent adopted it and asks for the branch once more" |
| M8 | checkpoint text comparison | revert to `tooltip !== props["aria-label"] && tooltip !== children`, `registry/ai/checkpoint.tsx:105-109` | browser checkpoint | caught (2): "adds no description when the tooltip repeats a name its children build from text and numbers", "describes a button whose name is more than the text it can read while rendering" |
| M9 | checkpoint text comparison | `normalize` trims only, `checkpoint.tsx:77` | browser checkpoint | caught (1): "adds no description…" (the `"Checkpoint   3"` / `"  Checkpoint "` + `3` case) |
| M10 | checkpoint text comparison | `textOf` returns `""` for a component child, `checkpoint.tsx:73` | browser checkpoint | caught (1): "describes a button whose name is more than…" (`<Latest />` case) |
| M11 | checkpoint text comparison | ignore `aria-labelledby`, `checkpoint.tsx:106-108` | browser checkpoint | caught (1): "describes a button whose name is more than…" (`aria-labelledby="turn"` case) |
| M11b | checkpoint text comparison | `aria-label ?? textOf(children)` (blank label wins), `checkpoint.tsx:107` | browser checkpoint | caught (1): "adds no description…" (`aria-label="  "` case) |
| M12 | queue `title` | delete the `title=` line, `registry/ai/queue.tsx:185` | browser queue | caught (1): "shows the whole name in a title while the chip truncates it" |
| M13 | queue `title` | move `title=` after `{...props}`, `queue.tsx:185-186` | browser queue | caught (1): same (consumer's title no longer wins) |
| M14 | queue `title` | `title={String(children)}` always, `queue.tsx:185` | browser queue | caught (1): same (`<span>` child gets `"[object Object]"`) |
| M17 | confirmation class order | `cn(className, "text-destructive")`, `registry/ai/confirmation.tsx:149` | browser confirmation | caught (1): "merges className into the rejected outcome and lets it override the colour" |

29 applied (27 distinct + 2 clean re-runs), 29 caught, 0 survived, 29 restores OK. The coder's own log
(`fix3-rbd/mut/results.log`, 33 lines) agrees on every overlapping mutation; the two it reports as
survived-and-deleted (R7, R11) no longer exist in the source, and R12 (the `!dialog.open` guard) is a
Chromium no-op by spec, so its survival is expected.

## Test quality

- Names: behavioural throughout. `grep -niE '\b(qa|round|bug|pin|fails today|expected fail|reviewer|regression)\b'`
  over the seven files matches only `tests/unit/branch.test.ts:232` "branch through a real Flight round trip".
- Fixtures: every new or changed browser test renders inside `<main>` (`Demo` in `branch.test.tsx:52-67`
  wraps in `<main>`; the hydration tests create a `<main>` container by hand; the strengthened confirmation
  test moved its fixture into `<main>`). The pre-existing fixtures outside `<main>` in `queue.test.tsx` and
  `confirmation.test.tsx` (the boundary test) are unchanged and not this coder's.
- Helpers: `expectNoViolations`/`withDark` from `@/tests/a11y` in all five browser files; no `axe.run`, no
  `settleAnimations` copy. Axe is run in the open state of the fullscreen view (`expectNoViolations(view)`),
  on the whole page with the dialog open in light and dark, on the Math group in light and dark, and on the
  preview page.
- No fixed sleeps: `grep -nE 'setTimeout\(r|new Promise\(\(r'` is empty; the unit tests' `setImmediate`
  models a pending module chunk, not a wait. All waits are `expect.poll`/`expect.element`.
- Console: no `vi.spyOn(console, …).mockImplementation`. The two `vi.spyOn(window, "open").mockImplementation(() => null)`
  (`response.test.tsx:810,912`) are the pattern `tests/unit/tooling.test.ts:581-583` explicitly allows
  (non-console spies). `allowConsole("error")` appears only at `branch.test.tsx:141` and
  `confirmation.test.tsx:135`, both pre-existing error-boundary tests that assert the thrown message.
- No `.skip`, `.only`, `retry`, rule exclusions.
- `tests/unit/ssr.test.ts:187-196`: unchanged, and correctly so; its branch case asserts only
  `html.length > 0` ("renders to a non-empty string without throwing"), so it never carried the selector
  claim R3-3 objected to. That claim now lives in `tests/unit/branch.test.ts` where it is proven through
  Flight.

## Round-3 reproducer migration (against `ca6f2fd`)

Browser `tests/browser/qa-round3/components-b.test.tsx` (11):

| ca6f2fd test | Canonical location | Status |
| --- | --- | --- |
| confirmation › lets className override the destructive colour of the rejected outcome | `confirmation.test.tsx` › "merges className into the rejected outcome and lets it override the colour" | migrated (folded into the existing test; computed colour = `--muted-foreground`, `text-destructive` gone) |
| checkpoint › lets a consumer's aria-describedby win over the tooltip mirror | `checkpoint.test.tsx` › same name (+ `toHaveAccessibleDescription`, axe) | migrated |
| checkpoint › adds no description when the tooltip repeats a name built from several children | `checkpoint.test.tsx` › "adds no description when the tooltip repeats a name its children build from text and numbers" | migrated (three shapes) |
| chat block tool part › shows exactly one 'No input yet' placeholder… | `tests/browser/blocks/chat.test.tsx:1348` | other owner; snippet handed over; present, uncommitted |
| chat block tool part › shows a stopped call as Pending with the same single placeholder | `tests/browser/blocks/chat.test.tsx:1368` | other owner; present, uncommitted |
| branch handed client references › registers the count after mount so the selector still appears on the client | `branch.test.tsx` › "shows the selector for content a Server Component hands over as client references" | migrated (same assertions; the count is now render-time) |
| branch › reports a controlled clamp on every effect run, so twice under StrictMode's double-invoked effects | `branch.test.tsx` › "reports a controlled clamp once under StrictMode's replayed effects" | deliberately inverted (N1 fixed); the pre-fix "twice" pin would now be wrong |
| response scrollers… › makes the fullscreen table view a keyboard-reachable scroll region | `response.test.tsx` › "makes the fullscreen table view a named tab stop while the table overflows" | migrated (+ unmarked at 1400 px, Escape closes) |
| response scrollers… › makes the link-safety URL box a keyboard-reachable scroll region when the URL is long | `response.test.tsx` › describe "link safety" (6 tests; the 250-char URL is shown whole in a native `<dialog>`, whole-page axe light and dark) | superseded (the URL box no longer exists) |
| response scrollers… › keeps a long display equation from widening the page at phone width | `response.test.tsx` › "scrolls a formula wider than a phone inside a named tab stop instead of widening the page" | migrated (+ Math group, keyboard scroll, unmarked at 1400 px) |
| suggestion › does not scroll the page when a chip that is already in view receives focus | `tests/browser/ai/suggestion.test.tsx:214` | other owner; present, uncommitted |

Unit `tests/unit/qa-round3-components-b.test.ts` (8):

| ca6f2fd test | Canonical location | Status |
| --- | --- | --- |
| renders the selector and page count on the server when MessageBranchContent arrives as a client reference | `tests/unit/branch.test.ts` › "counts content handed over as a client reference" (+ memo/forwardRef, pending chunk, and the two Flight round-trip renders) | migrated |
| still renders the selector on the server for a plain client tree | `tests/unit/branch.test.ts:62-74` › "renders the selector, the page count and the requested branch" (asserts `Next branch` and `2 of 3`) | dropped as a duplicate, correctly |
| sync-tokens cascade rule at its edges (6 tests) | `tests/unit/tokens.test.ts:559-618` | other owner; all six present, uncommitted |

Round-3 files: `tests/browser/qa-round3/` does not exist and `tests/unit/qa-round3-components-b.test.ts` is
gone; neither is tracked (`git ls-files` empty); HEAD `82f6e83` records both deletions.

## Three consecutive runs

```
browser run 1:  Test Files 5 passed (5); Tests 170 passed (170); Duration 9.39s
unit run 1:     Test Files 2 passed (2); Tests 31 passed (31);   Duration 2.35s
browser run 2:  Test Files 5 passed (5); Tests 170 passed (170); Duration 9.40s
unit run 2:     Test Files 2 passed (2); Tests 31 passed (31);   Duration 2.25s
browser run 3:  Test Files 5 passed (5); Tests 170 passed (170); Duration 10.11s
unit run 3:     Test Files 2 passed (2); Tests 31 passed (31);   Duration 2.28s
```

Source sha256 (response, branch, checkpoint, confirmation, queue, globals.css) recorded before and after
every run: identical all six times (`run{1,2,3}-sha-{before,after}.txt`), so no other verifier's mutation
overlapped a run.

## Restore proof

```
$ sha256sum -c pristine.sha256
registry/ai/response.tsx: OK
registry/ai/branch.tsx: OK
registry/ai/checkpoint.tsx: OK
registry/ai/confirmation.tsx: OK
registry/ai/queue.tsx: OK
app/globals.css: OK
```

`git diff --stat HEAD` at the end lists only files I never touched (`registry/ai/code-block.tsx`,
`registry/ai/reasoning.tsx`, `tests/browser/ai/reasoning.test.tsx`, `tests/browser/ai/suggestion.test.tsx`,
`tests/browser/blocks/chat.test.tsx`, `tests/unit/tokens.test.ts`): other fixers' uncommitted work. For the
six files in this group it is empty.

## Environment notes for the lead

- When I started, HEAD was `1f57fb7` and its `registry/ai/response.tsx` lacked the `renderModal` line
  (`safety = { enabled: true, ...linkSafety }` with `strings` and `LinkSafetyDialog` unused); the working
  tree had it as a 3-line uncommitted addition (`initial-git-diff.txt`). That checkpoint had captured the
  coder's R6 mutation mid-flight. The re-checkpoint `82f6e83` contains the line (`git show HEAD:… | grep -c
  'renderModal: (modal)'` = 1) and the working tree matches it. Resolved; noting it because M20 shows that
  committed shape fails five tests.
- Twice during my session another verifier had a file of this group mutated: `response.tsx` (M19 waited
  60 s and was skipped, then re-run) and `app/globals.css` (the `.katex-display` rule absent during my M21/M22
  runs, producing the two extra Math failures; both re-run clean).

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
V=/docs/qa/round3/verify-rb-tests
cp -p <six sources> $V/pristine/…; sha256sum <six sources> > $V/pristine.sha256; git diff HEAD > $V/initial-git-diff.txt
git diff ca6f2fd HEAD -- <group sources and tests>; git show ca6f2fd:tests/browser/qa-round3/components-b.test.tsx; git show ca6f2fd:tests/unit/qa-round3-components-b.test.ts
grep -nE '\.skip\(|\.only\(|mockImplementation|allowConsole|retry|settleAnimations|axe\.run|setTimeout\(r' <seven test files>
grep -niE '\b(qa|round|bug|pin|fails today|expected fail|reviewer|regression)\b' <seven test files>
$V/mutate.sh <name> <file> '<perl subst>' <project> <test file>   # 29 runs, $V/mut/results.log
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/ai/{response,branch,checkpoint,confirmation,queue}.test.tsx; pnpm exec vitest run --project unit tests/unit/branch.test.ts tests/unit/ssr.test.ts; done
sha256sum -c $V/pristine.sha256; git status --short; git diff --stat HEAD
```
