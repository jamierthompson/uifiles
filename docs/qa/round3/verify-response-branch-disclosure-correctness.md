# verify-response-branch-disclosure — correctness of the fix

refuted: true

Narrow refutation. Eight of the nine findings (F1, F2 + R3-3, F3, F4, F5, F6, F7, N1 and the chip half of R3-5) are fixed in the code, covered by tests that I made fail by patching each fix out, and the tree is green and clean. One sub-item is not fixed: the clamp half of rendered-surface R3-5 was "verified, not changed" and listed under Fixed, and the reason given does not answer the finding. Everything else below is confirmation.

Evidence directory: `/docs/qa/round3/verify-rb-correctness/` (`mut.sh`, `M*.{pristine,mutated,diff,log}`, `run{1,2,3}-{browser,unit}.log`, `tsc.log`, `registry-validate.log`, `registry-test.log`, `tokens-site.log`). `three-runs.log` in that directory is not mine (written 03:23:50, before this session started).

Tree state: HEAD `82f6e83` (the lead's checkpoint was amended twice during this session: `1f57fb7` → `af500fb` → `82f6e83`). Every file of this group is byte-identical to `82f6e83` (`git diff --stat HEAD -- <15 group files>` empty at the end); `tests/browser/qa-round3/components-b.test.tsx` and `tests/unit/qa-round3-components-b.test.ts` are gone from the tree and from `git ls-files`.

## Problems

### P1. rendered-surface R3-5, clamp half: no fix, and the reason does not hold — `registry/ai/queue.tsx:73-86`, `tests/browser/ai/queue.test.tsx:329-356`

- The finding: with the WCAG 1.4.12 spacing applied, two `/preview/queue` titles that fit in two lines at default spacing are clamped ("Also update the README with th…"), "i.e. content is lost under user text spacing". Proposed fix: `title` on `QueueItemContent` as well as the chip, or drop the clamp.
- What shipped: `QueueItemContent` is unchanged (`line-clamp-2 grow break-words`, no `title`); the report files it under Fixed as "verified, not changed" with the argument that "the clamped box is exactly two line boxes, so no line is cut through", plus a docs sentence "The two-line clamp cuts whole lines, also under WCAG 1.4.12 text spacing."
- Why that is not a fix: whole-line clamping removes the partial-glyph clip, but the third line is still hidden, which is the "loss of content" the finding names (F104: content clipped when text spacing is adjusted). The new test renders a 224 px box (`w-56`) with a title that clamps at default spacing too, so it neither pins nor exercises the reviewer's scenario (fits at default spacing, clamped only under the spacing override). The trivial mirror the coder applied to the chip (`title={typeof children === "string" ? children : undefined}`, `queue.tsx:184-185`) was not applied to `QueueItemContent`, and no reason is given; the item is not under "Not fixed and why".
- Severity: low, as the reviewer rated it. Resolution is small: either the `title` mirror on `QueueItemContent` (with a test in the reviewer's shape: a title that fits at default spacing, clamps under the override, `title` equals the text), or drop the clamp, or move the item to "Not fixed" with the design reason so the docs sentence is an explicit decision rather than a fix.

Command output showing the current state:

```
$ sed -n 73,86p registry/ai/queue.tsx
export const QueueItemContent = ({
  completed = false,
  className,
  ...props
}: QueueItemContentProps) => (
  <span
    className={cn(
      // uifiles: two lines, not upstream's one, so a phone-width title is not
      // cut off after a few words (the title is the item's only content).
      "line-clamp-2 grow break-words",
      ...
    )}
    {...props}
  />
```

No other problems found.

## Confirmed

### Three consecutive runs (all green)

```
browser (response, branch, checkpoint, confirmation, queue):
  run 1: Test Files 5 passed (5)  Tests 170 passed (170)  Duration 8.36s   exit=0
  run 2: Test Files 5 passed (5)  Tests 170 passed (170)  Duration 11.59s  exit=0
  run 3: Test Files 5 passed (5)  Tests 170 passed (170)  Duration 13.78s  exit=0
unit (tests/unit/branch.test.ts, tests/unit/ssr.test.ts):
  run 1: Tests 31 passed (31)  exit=0
  run 2: Tests 31 passed (31)  exit=0
  run 3: Tests 31 passed (31)  exit=0
```

### Static checks

```
pnpm exec tsc --noEmit                                  → exit=0 (no output)
pnpm exec biome check <15 group files>                  → Checked 15 files in 158ms. No fixes applied.  exit=0
pnpm exec prettier --check <15 group files>             → All matched files use Prettier code style!   exit=0
pnpm registry:validate                                  → √ Registry is valid.  exit=0
vitest --project unit tests/unit/registry.test.ts       → 26 passed (react-dom is in the implicit list, registry.test.ts:84-85)
vitest --project unit tests/unit/tokens.test.ts tests/unit/site.test.ts → 204 passed (the base item's css mirrors only the reduced-motion block, tokens.test.ts:276-296, so the new @layer base rule causes no drift)
```

### Mutation checks (my own; `mut.sh` refuses to start when the file already differs from HEAD, restores from a pristine copy, compares sha256 and `git diff --stat HEAD -- <file>`; every line below ended `restored=OK git-diff-stat-lines=0`)

| # | finding | mutation (file) | test file | result |
| --- | --- | --- | --- | --- |
| M1 | F2 / R3-3 | `componentOf`: `return componentOf(type._init(type._payload))` → `return type` (`branch.tsx:87`) | `tests/unit/branch.test.ts` | 5 failed / 5 passed: "counts content handed over as a client reference", "counts content wrapped in memo or forwardRef", "waits for a reference whose module is still loading and counts it", "renders the selector and page count on the first render, while the module chunk still loads", "…once the module is loaded" |
| M2 | F4 | `renderModal: (modal) => (<LinkSafetyDialog …/>)` removed (`response.tsx:258-260`) | `tests/browser/ai/response.test.tsx` | 5 failed / 26 passed: all five dialog tests (`Cannot find element with locator: getByRole('dialog', { name: 'Open external link?' })`, `toHaveFocus`) |
| M3 | F5 | `describes` back to `tooltip !== props["aria-label"] && tooltip !== children` (`checkpoint.tsx:109`) | `tests/browser/ai/checkpoint.test.tsx` | 2 failed / 11 passed: "adds no description when the tooltip repeats a name its children build from text and numbers", "describes a button whose name is more than the text it can read while rendering" |
| M4 | R3-5 chip | `title={…}` removed (`queue.tsx:185`) | `tests/browser/ai/queue.test.tsx` | 1 failed / 46 passed: "shows the whole name in a title while the chip truncates it" |
| M5b | F1 | `.katex-display { overflow: auto hidden; padding-block: 0.25em }` removed (`app/globals.css:139-142`) | `response.test.tsx` | 2 failed / 29 passed: "scrolls a formula wider than a phone inside a named tab stop instead of widening the page" (`AssertionError: expected 956 to be less than or equal to 375`), "the preview page › keeps its long formula inside the column at phone width" |
| M6 | F3 | `...document.querySelectorAll(FULLSCREEN_TABLE),` removed (`response.tsx:82`) | `response.test.tsx` | 1 failed / 30 passed: "makes the fullscreen table view a named tab stop while the table overflows" |
| M7 | N1 | `if (reportedClampRef.current === clamp) return` removed (`branch.tsx:149`) | `tests/browser/ai/branch.test.tsx` | 1 failed / 49 passed: "reports a controlled clamp once under StrictMode's replayed effects" (`expected [ [ 2 ], [ 2 ] ] to deeply equal [ [ 2 ] ]`) |
| M8 | F6 | `cn("text-destructive", className)` → `cn(className, "text-destructive")` (`confirmation.tsx`) | `tests/browser/ai/confirmation.test.tsx` | 1 failed / 28 passed: "merges className into the rejected outcome and lets it override the colour" (`toHaveClass("text-muted-foreground")`) |
| M9 | F1 pixel test | `padding-block: 0.25em` → `0` (`app/globals.css`) | `response.test.tsx` | 1 failed / 30 passed: "leaves formulas that fit unmarked and clips none of their tall parts" (`expected false to be true`), which proves the screenshot comparison can fail, i.e. it is not vacuous |

The first M5 run showed 7 failures; the five extra were the link-safety tests, and the log shows Streamdown's own `data-streamdown="link-safety-modal"` rendered, i.e. a concurrent verifier had `renderModal` patched out of `response.tsx` during my run (M6's pre-check then aborted on that same file). M5b is the clean re-run. Concurrent mutation windows were also seen on `branch.tsx` and `queue.tsx`, and once on `response.tsx` with the spread order swapped (the coder's R8 case); each was restored within 30 s and the group's files match HEAD at the end.

### Source review

- F1 (`app/globals.css:135-142`, `response.tsx:41-43, 60-72, 88-90`): `.katex-display` gets `overflow: auto hidden; padding-block: 0.25em` under `@layer base`; the "Math" scroller marks a display only when `getComputedStyle(...).overflowX` is `auto`/`scroll` and `scrollWidth > clientWidth`, so without the rule nothing is marked (the third test pins that with an unlayered `overflow: visible`). Preview page now carries a 466 px formula and a link (`app/preview/response/page.tsx:30-36`).
- F2 / R3-3 (`branch.tsx:60-90, 101`): `componentOf` unwraps `memo` (`.type`), `forwardRef` (`.render`) and `lazy` (`_init(_payload)`, recursively), then `countBranches` compares with `MessageBranchContent`. The Flight client's `readChunk` returns the module export for a fulfilled chunk and throws the chunk for pending/blocked/halted (`react-server-dom-webpack-client.node.development.js:1706-1721`), so a loading module suspends `MessageBranch`; the webpack and turbopack builds of `readChunk` and `createLazyChunkWrapper` are identical (`diff` of the two function bodies empty), so the unit test's webpack client models the turbopack build the site uses. `tests/unit/branch.test.ts:232-337` runs the real Flight server (`--conditions=react-server`, `registerClientReference`) → Flight client → `prerenderToNodeStream`, asserting the selector and "2 of 3" in the first HTML while the chunk loader is still pending (`loads` equals `["branch-first-render"]`). `app/preview/branch/page.tsx` is a Server Component with no `"use client"`, so this is the pipeline that page uses. No `count` prop was added, so nothing to check there. The docs replacement string matches the behaviour. The served `/preview/branch` HTML cannot be re-checked without a build (forbidden), as the coder says; the e2e request in the report is the right follow-up.
- N1 (`branch.tsx:142-152`): the clamp key `${branch}>${currentBranch}` is reset whenever the parent adopts the index, and the second browser test ("reports the same clamp again after the parent adopted it…") pins the reset.
- F3 (`response.tsx:38-40, 80-87, 116-117, 308-320`): fullscreen tables are collected document-wide, and a `childList` observer on `document.body` re-syncs only when a `[data-streamdown="table-fullscreen"]` node arrives or leaves; the React-ownership guard applies unchanged.
- F4 (`response.tsx:119-263, 339`): Streamdown calls `renderModal(props)` in place of its own modal with `{url, isOpen, onClose, onConfirm}` and `onConfirm` is `window.open(url, "_blank", "noreferrer")` (`streamdown/dist/chunk-*.js`, the `Zs` link component), which the tests assert exactly. `LinkSafetyDialog` returns null while closed, so nothing is rendered into the link's paragraph; open, it portals a native `<dialog>` to body, `showModal()` under a `!dialog.open` guard (StrictMode), `onClose` maps to Streamdown's close, backdrop click closes when `event.target === event.currentTarget`. `{ enabled: true, renderModal, ...linkSafety }` keeps a consumer's `enabled: false`, `renderModal` and `onLinkCheck` (test "keeps a consumer's renderModal and onLinkCheck"). All strings come from `{ ...defaultTranslations, ...translations }` and the keys used exist on `StreamdownTranslations` (`streamdown/dist/index.d.ts:339-373`).
- F5 (`checkpoint.tsx:48-76, 105-109`): `textOf` reads strings and numbers through arrays, fragments and host elements and returns `undefined` for a component child; the name is a non-empty trimmed `aria-label`, else the children's text, else `undefined` under `aria-labelledby`; comparison is whitespace-normalised. Behaviour change (`aria-label="Restore"` + tooltip equal to the visible text now described) is sensible and tested.
- F6/F7: the confirmation test asserts the computed colour equals `--muted-foreground` after a rerender; the checkpoint test asserts the consumer's `aria-describedby` value, the accessible description and axe.
- R3-5 chip (`queue.tsx:184-185`): `title` set before the spread so a consumer's wins; non-string children get none; tested with all three cases.
- Reproducer migration: of the 11 browser reproducers, 8 belong to this group and are in the canonical files under behaviour names (the StrictMode pin inverted to "once" on purpose; the link-safety URL-box pin became the dialog tests); the 3 for chat/suggestion are under Requests with paste-ready snippets. Of the 8 unit reproducers, the Flight one became the round-trip suite, the plain-client-tree one is a duplicate of "renders the selector, the page count and the requested branch", and the 6 sync-tokens pins are under Requests. No `QA`/`round`/`BUG` words in the new test names.

### `Not fixed and why` — reasons checked

- N2 (`scripts/sync-tokens.ts` `!important`) and N3 (`pointer-coarse` vs `any-pointer-coarse`): both files/decisions are outside this group and the reviewer wrote that no action is needed. Sound.
- `ReasoningContent` renders Streamdown directly (`registry/ai/reasoning.tsx`, not in this group): the `.katex-display` rule is global so its reflow is covered; the marker and the dialog are not. Routed to the reasoning owner with a concrete proposal. Sound.
- Served `/preview/branch` HTML: build/dev/e2e forbidden and the running server is the old build. The Flight round-trip test is the strongest evidence available in-session; the e2e request (assert `aria-label="Next branch"` in `page.request.get("/preview/branch")`) is the right way to close it. Sound.

### Observations for the lead (not problems with the coder's work)

- At `1f57fb7` the checkpoint commit did not contain the `renderModal` lines (`git show 1f57fb7:registry/ai/response.tsx` has no `renderModal:`), i.e. that amend captured a concurrent verifier's mutation window; `82f6e83` has them. Since verifiers keep mutating this tree, re-check `git status` is empty for this group before the final commit.
- The `css` field on the `response`/`reasoning` items (manifest stage) is what makes F1 reach consumers; until it is applied, an installed `@uifiles/response` has no `.katex-display` rule and the "Math" tab stop never appears by design.
