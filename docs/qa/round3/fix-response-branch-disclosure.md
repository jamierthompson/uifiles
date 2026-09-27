# fix-response-branch-disclosure

Scratch: `<scratchpad>/fix3-rbd/` (`mutate.sh`, `mut/results.log` + per-mutation logs, `*-before.log`, `run{1,2,3}-{browser,unit}.log`, `unit-all.log`, `neighbours.log`).
Paste-ready tests for files I do not own: `/docs/qa/round3/fix-response-branch-disclosure-requests/`.

Note: the lead's checkpoint commit `6acd871` (amended from `0d8c2e0`) captured part of this work mid-session, so "before" runs below swap in the sources from `ca6f2fd` (the round-3 reproducer commit), not `HEAD`.

## Fixed

- components-b:F1 (high) — display math no longer widens the page. `app/globals.css:139` adds `.katex-display { overflow: auto hidden; padding-block: 0.25em; }` under `@layer base`. `registry/ai/response.tsx:43,63` adds `.katex-display` as a "Math" scroller. It becomes a named tab stop (`tabindex=0`, `role=group`, `aria-label="Math"`) only while it overflows sideways and its computed `overflow-x` is `auto` or `scroll`. Without the stylesheet rule nothing is marked, because nothing can scroll. Vertical overflow is ignored because it is clipped by design.
  - test: `tests/browser/ai/response.test.tsx` › "scrolls a formula wider than a phone inside a named tab stop instead of widening the page". At 375 px `documentElement.scrollWidth <= clientWidth`, the group is named "Math" and axe is clean in light and dark. ArrowRight scrolls it. At 1400 px the attributes are gone.
    - failed before: `AssertionError: expected 956 to be less than or equal to 375`. Passes after.
  - test: › "leaves formulas that fit unmarked and clips none of their tall parts". This is a pixel test with ten tall constructs (Bayes, sums with limits, integral, pmatrix, under/overbrace with text, prod/lim/binom, cube root/dfrac/left-right, cases, boxed). A screenshot of the page with the clip must equal a screenshot with the clip lifted.
    - padding-block 0 fails, bottom-only 0.25em fails, 0.1em passes. So 0.25em leaves 2.5× margin.
  - test: › "adds no tab stop to a formula that cannot scroll because the stylesheet rule is missing".
  - test: › "the preview page › keeps its long formula inside the column at phone width". The preview now carries a 466 px regularised logistic loss.
- components-b:F2 / rendered-surface:R3-3 (medium) — the branch count now works on the App Router. `registry/ai/branch.tsx:70` `componentOf()` resolves lazy element types through `_init(_payload)`, recursively, and also unwraps `memo` (`.type`) and `forwardRef` (`.render`). A lazy type is Flight's client reference.
  - A module that is still loading throws its promise from `_init`. MessageBranch lets that promise through and suspends on it, as React would on the element a moment later. The count is therefore right in the first HTML too. No `count` prop was needed.
  - test: `tests/unit/branch.test.ts` › "branch through a real Flight round trip". A Server Component tree is rendered by React's Flight server (`next/dist/compiled/react-server-dom-webpack/server.node`) in a child `node --conditions=react-server` process, with real `registerClientReference` client references. It is decoded by Next's compiled Flight client (`client.node`, whose `createLazyChunkWrapper`/`readChunk` match the turbopack build) and prerendered by Fizz (`react-dom/static`).
    - "renders the selector and page count on the first render, while the module chunk still loads" (asserts the chunk loader ran) and "renders the selector and page count once the module is loaded".
    - Both failed before: `expected '<div class="grid w-full gap-2 …' to contain 'aria-label="Previous branch"'` / `'aria-label="Next branch"'`. Both pass after.
  - also: › "counts content handed over as a client reference", › "counts content wrapped in memo or forwardRef" and › "waits for a reference whose module is still loading and counts it". All failed before.
  - also: `tests/browser/ai/branch.test.tsx` › "renders client references' selector on the server and hydrates it without a warning". It failed before; the console guard covers hydration.
  - `tests/unit/ssr.test.ts`: no change needed. Its branch case asserts only a non-empty render, which is still true. The selector guarantee lives in `tests/unit/branch.test.ts`.
- components-b:N1 (nit) — a controlled clamp is reported once under StrictMode. `registry/ai/branch.tsx:142` keeps a ref keyed `branch>clamped` and resets it when the parent adopts the index, so a repeated request is reported again.
  - test: `branch.test.tsx` › "reports a controlled clamp once under StrictMode's replayed effects". Failed before: `expected [ [ 2 ], [ 2 ] ] to deeply equal [ [ 2 ] ]`.
  - test: › "reports the same clamp again after the parent adopted it and asks for the branch once more". Guards the reset.
- components-b:F3 (medium) — Streamdown's fullscreen table is now a named tab stop. `registry/ai/response.tsx:40` adds `[data-streamdown="table-fullscreen"] [data-streamdown="table"]` (document-wide) to `findScrollers`. `:309` adds a `childList` observer on `document.body` that re-syncs only when a fullscreen view arrives or leaves.
  - test: `response.test.tsx` › "makes the fullscreen table view a named tab stop while the table overflows". The view is portaled to body, marked "Table" at 375 px, axe on the view is clean, and it is unmarked at 1400 px. Escape closes it.
    - failed before: `expected { tabindex: null, … } to deeply equal { tabindex: '0', role: 'group', … }`.
- components-b:F4 (medium) — the link-safety modal is replaced through Streamdown's own `linkSafety.renderModal`, which the port could use.
  - `registry/ai/response.tsx:123-240` renders a native modal `<dialog>` portaled to body. It is named by an `h2` ("Open external link?") and described by the warning. `showModal()` makes the page inert and moves focus to Close, and the browser returns focus to the link when it closes. It closes on Escape, Close or a backdrop click, and shows the whole URL wrapped, with no inner scroller. Copy link shows "Copied" for 2 s, and Open link calls Streamdown's `onConfirm` (window.open) and closes. Every string comes from Streamdown's `translations`.
  - `:250-264` builds `{ enabled: true, renderModal, ...linkSafety }`, so `enabled: false`, a consumer's `renderModal` and `onLinkCheck` still win. Link safety stays on by default.
  - tests: `response.test.tsx` › "link safety":
    - "confirms a link in a modal dialog that takes focus, shows the whole URL and gives focus back on Escape" (whole-page axe in light and dark with the dialog open, 250-character URL)
    - "opens the URL in a new tab from the dialog and closes it"
    - "copies the URL, says so, and closes from the close button or the backdrop"
    - "stays open under StrictMode's replayed effects"
    - "speaks the translations passed to MessageResponse"
    - "keeps a consumer's renderModal and onLinkCheck"
    - The first four and the translations test failed before (`Cannot find element with locator: getByRole('dialog', { name: 'Open external link?' })`, `toHaveFocus`). The last one is a regression guard for the spread order and passes before and after.
- components-b:F5 (low) — checkpoint compares the tooltip with the button's accessible name as text. `registry/ai/checkpoint.tsx:53` `textOf()` reads strings and numbers through arrays, fragments and host elements, and returns undefined when a component renders part of the name. `:100-109` sets the name to a non-empty `aria-label`, or else the children's text, or undefined under `aria-labelledby`. Whitespace is collapsed.
  - Behaviour change: `aria-label="Restore"` with children "Checkpoint 1" and tooltip "Checkpoint 1" now gets the description. The name is "Restore", so the tooltip adds information. Before, the identity check dropped it.
  - test: `checkpoint.test.tsx` › "adds no description when the tooltip repeats a name its children build from text and numbers" (`Checkpoint {index}`, a fragment with a `<span>{n}</span>`, whitespace, a blank aria-label). Failed before: `expected true to be false`.
  - test: › "describes a button whose name is more than the text it can read while rendering" (aria-label, a component child, aria-labelledby). Failed before.
- components-b:F6 (low, test gap) — `confirmation.test.tsx` › "merges className into the rejected outcome and lets it override the colour". It rerenders with `text-muted-foreground`, which must replace `text-destructive` (tailwind-merge), with the computed colour equal to `--muted-foreground`. `registry/ai/confirmation.tsx` needed no change. The mutant `cn(className, "text-destructive")` now fails this test (it survived before).
- components-b:F7 (low, test gap) — `checkpoint.test.tsx` › "lets a consumer's aria-describedby win over the tooltip mirror". It asserts the attribute, `toHaveAccessibleDescription` and axe. Moving the attribute after the spread now fails this test.
- rendered-surface:R3-5 (low) — `registry/ai/queue.tsx:185`: `QueueItemFile` puts the whole name in the chip's `title` when its children are a string. The attribute sits before the spread, so a consumer's `title` wins. The visible truncation stays.
  - test: `queue.test.tsx` › "shows the whole name in a title while the chip truncates it". Failed before: `expected null to be 'settings-mockup-final-approved-v2.png'`.
  - The two-line clamp is verified, not changed: `queue.test.tsx` › "clamps whole lines under WCAG 1.4.12 text spacing". With `line-height 1.5`, `letter-spacing .12em` and `word-spacing .16em` applied, the clamped box is exactly two line boxes, so no line is cut through. A `max-h-10 overflow-hidden` substitute fails it.
- Round-3 reproducers:
  - Mine are migrated and renamed by behaviour: 8 of the 11 browser tests and 2 of the 8 unit tests.
  - Two browser pins were superseded on purpose: the StrictMode "twice" pin is inverted to once, and the link-safety URL-box pin became the dialog tests.
  - "still renders the selector on the server for a plain client tree" is dropped as a duplicate of `branch.test.ts` › "renders the selector, the page count and the requested branch".
  - Both qa-round3 files are deleted. The 9 pins for files I do not own are under Requests.

## Not fixed and why

- components-b:N2, N3: nits in `scripts/sync-tokens.ts` and queue. Out of scope; the reports say no action is needed.
- `ReasoningContent` (`registry/ai/reasoning.tsx`, not mine) renders `<Streamdown>` directly. Its links still open Streamdown's modal with the nested-interactive violation, and its code, table and math scrollers are unmarked. The globals.css rule does cover its reflow. See Requests.
- The served `/preview/branch` HTML could not be re-checked: build, dev and e2e are forbidden, and the production server runs the old build. The evidence is the real Flight round trip above. The lead should confirm after the next build (see the e2e request).

## Tests

- `tests/browser/ai/response.test.tsx`: 20 → 31
- `tests/browser/ai/branch.test.tsx`: 46 → 50
- `tests/browser/ai/checkpoint.test.tsx`: 10 → 13
- `tests/browser/ai/confirmation.test.tsx`: 29 → 29 (one test strengthened)
- `tests/browser/ai/queue.test.tsx`: 45 → 47
- `tests/unit/branch.test.ts`: 4 → 10
- `tests/unit/ssr.test.ts`: unchanged
- Deleted: `tests/browser/qa-round3/components-b.test.tsx` (11) and `tests/unit/qa-round3-components-b.test.ts` (8).
- Upstream tests: none newly applicable; these components' upstream suites were ported in earlier rounds.

Mutation checks (`fix3-rbd/mut/results.log`; every restore byte-identical):

| Mutation | Result |
| --- | --- |
| R1 no Math scroller | caught (1) |
| R2 no fullscreen table | caught (1) |
| R3 no body observer | caught (1) |
| R4 Math counts vertical overflow | caught (2) |
| R5 Math ignores computed overflow-x | caught (1) |
| R6 Streamdown default modal | caught (5) |
| R8 consumer linkSafety spread first | caught (2) |
| R10 no backdrop close | caught (1) |
| R13 `show()` instead of `showModal()` | caught (2) |
| R7 manual focus restore, R9 close-event open check, R11 cleanup `close()` | survived, so I deleted that code (Chromium restores focus on close and ignores a repeated `showModal()`) |
| R12 `!dialog.open` guard removed | **survived**, kept as documented defence: StrictMode replays the effect, and engines older than the current spec throw InvalidStateError on `showModal()` of an open dialog |
| CSS padding 0 / bottom-only | caught by the pixel test |
| B1 no lazy resolution | caught (5 unit, 1 browser) |
| B2 no memo | caught (1) |
| B3 no forwardRef | caught (1) |
| B4 swallow the pending promise | caught (1) |
| B5 no StrictMode guard | caught (1) |
| B6 guard never reset | caught (1) |
| C1 `cn(className, "text-destructive")` | caught (1) |
| K1 old identity compare | caught (2) |
| K2 describedby after spread | caught (1) |
| K3 ignore aria-labelledby | caught (1) |
| K4 components count as "" | caught (1) |
| K5 no whitespace normalisation | caught (1) |
| K6 children text over aria-label | caught (2) |
| Q1 no title | caught (1) |
| Q2 title after spread | caught (1) |
| Q3 fixed-height clamp | caught (2) |

Three consecutive runs (the five browser files together; `unit/branch` + `unit/ssr`):

```
browser run 1:       Tests  170 passed (170)    Duration  9.67s
unit run 1:          Tests  31 passed (31)
browser run 2:       Tests  170 passed (170)    Duration  8.53s
unit run 2:          Tests  31 passed (31)
browser run 3:       Tests  170 passed (170)    Duration  8.28s
unit run 3:          Tests  31 passed (31)
```

Neighbours, run once:
- `reasoning`, `blocks/chat`, `tokens`, `button` and `theme` browser files: 148/148.
- Whole unit project: 305/308. The 3 failures are the meta lens's by-design `qa-round3-meta.test.ts` reproducers and `workflows.test.ts` (`.github/workflows/ci.yml` SHA pins). None touch my files.
- `registry.test.ts` passes: `react-dom` is implicit and `streamdown` is declared.
- `pnpm registry:validate` is clean.

## Registry entry changes (exact strings for registry.json; the registry owner applies them)

- response › css (new field, validated with `registryItemSchema` from `shadcn/schema`):
  `{ "@layer base": { ".katex-display": { "overflow": "auto hidden", "padding-block": "0.25em" } } }`
- response › docs: "Built for the Base UI styles (base-nova); the file imports no style wrappers, so nothing in it is style-specific. Extracted from AI Elements message.tsx (MessageResponse only; shadcn's own message replaces the rest). Export name and props identical (ComponentProps<typeof Streamdown>). No Radix code in this component. MessageResponse passes shikiTheme={[\"github-light-high-contrast\", \"github-dark-high-contrast\"]} to Streamdown because Streamdown's default GitHub light theme fails AA on orange tokens; your own shikiTheme prop overrides it. Code-block bodies, tables (inline, and in the fullscreen table view Streamdown portals to document.body) and display formulas that overflow (horizontally, or vertically past codeBlockMaxHeight / tableMaxHeight; formulas sideways only) become keyboard-focusable scroll regions on the client: tabindex=0 plus role=\"group\" and an aria-label (\"Code\", \"Table\" or \"Math\"; a group, not a region landmark, so several blocks on one page do not collide), re-checked as tokens stream in and on resize, removed again when the content fits, and applied only after React has hydrated them, so server-rendered blocks never cause a hydration mismatch. Links: Streamdown's link safety stays on by default, but its confirmation modal (a role=\"button\" backdrop around the dialog's buttons, which fails axe nested-interactive and never takes focus) is replaced through linkSafety.renderModal by a native modal <dialog>: named by its \"Open external link?\" heading, it makes the page inert, takes focus, shows the whole URL, copies it, closes on Escape, its close button or a backdrop click, returns focus to the link, and uses Streamdown's `translations`. `linkSafety={{ enabled: false }}` renders plain anchors, and your own linkSafety.renderModal or onLinkCheck wins (Streamdown renders renderModal's output inside the link's paragraph, so return phrasing content or a portal). CSS: Streamdown's own Tailwind classes only compile if your stylesheet can see them: add `@source \"../node_modules/streamdown/dist/*.js\"` next to your `@import \"tailwindcss\"` (the `@streamdown/*` plugins ship no classes). `@import \"streamdown/styles.css\"` provides the `[data-sd-animate]` fade/blur/slide keyframes and the list-marker fade; without it streamed blocks appear instantly instead of animating in. Math needs KaTeX's stylesheet: add `@import \"katex/dist/katex.min.css\";` to your globals.css (this item installs katex, which @streamdown/math uses); without it every formula renders twice, KaTeX's HTML plus the MathML fallback the stylesheet hides. KaTeX gives a display formula no overflow container, so one wider than the column widens the whole page on a phone (WCAG 1.4.10); this item adds `@layer base { .katex-display { overflow: auto hidden; padding-block: 0.25em; } }` to your globals.css (add it yourself if you copy the file by hand), so the formula scrolls sideways in its own box and the padding keeps limits, braces and accents from being clipped. Inline `$...$` math is off by default in @streamdown/math (singleDollarTextMath: false); `$$` blocks work."
  - If the `css` field is not adopted, replace "this item adds `@layer base { … }` to your globals.css (add it yourself if you copy the file by hand), so" with "add `@layer base { .katex-display { overflow: auto hidden; padding-block: 0.25em; } }` to your globals.css so".
- reasoning › css (new field): the same object as response.
- reasoning › docs: append at the very end of the current string (after "…plus the MathML fallback the stylesheet hides.") the sentence " KaTeX gives a display formula no overflow container, so one wider than the column widens the whole page on a phone (WCAG 1.4.10); this item adds `@layer base { .katex-display { overflow: auto hidden; padding-block: 0.25em; } }` to your globals.css (add it yourself if you copy the file by hand)."
- branch › docs: replace the sentence "MessageBranch counts the branches of its MessageBranchContent while rendering (it looks through fragments and plain elements among its own children), so the selector and MessageBranchPage (\"2 of 3\") are in server-rendered HTML and hydrate without a warning; content rendered by a custom component cannot be counted that way and registers after mount, so its selector appears on the client." with "MessageBranch counts the branches of its MessageBranchContent while rendering: it looks through fragments and plain elements among its own children, through memo/forwardRef wrappers, and through the client references a Server Component hands over in the App Router (a reference whose module is still loading suspends MessageBranch until it is in), so the selector and MessageBranchPage (\"2 of 3\") are in server-rendered HTML, including a page that is a Server Component, and hydrate without a warning; content rendered by a custom component cannot be counted that way and registers after mount, so its selector appears on the client." Also replace "`onBranchChange` is called once with the clamped index so the parent's state follows" with "`onBranchChange` is called once with the clamped index (once under StrictMode too) so the parent's state follows".
- checkpoint › docs: replace "unless it equals the button's aria-label or its text; your own aria-describedby wins." with "unless it repeats the button's accessible name, compared as text with whitespace collapsed: a non-empty aria-label, or else the text its children render (strings and numbers, read through fragments and plain elements, so `Checkpoint {index}` counts); the description stays when a child component renders part of the name or aria-labelledby names the button, since neither can be read while rendering; your own aria-describedby wins."
- queue › docs: append " QueueItemFile truncates the file name at 100px and puts the whole name in the chip's title attribute when its children are a string (your own title wins). The two-line clamp cuts whole lines, also under WCAG 1.4.12 text spacing."

## Requests for other owners

- `tests/browser/blocks/chat.test.tsx` (chat owner): paste `fix-response-branch-disclosure-requests/chat.test.tsx.snippet` into `describe("ChatToolPart")`. It is two migrated round-3 pins: exactly one "No input yet" and no "Streaming input"; a stopped call shows as Pending with one placeholder. Add `type ToolUIPart` to the `ai` type import.
- `tests/browser/ai/suggestion.test.tsx` (suggestion owner): paste `suggestion.test.tsx.snippet` into `describe("suggestions")`. It is the pin that the page does not scroll when a chip already in view gets focus. Add `import { useState } from "react"`.
- `tests/unit/tokens.test.ts` (tokens owner): paste `tokens.test.ts.snippet` into `describe("scripts/sync-tokens.ts parser")`. It holds six cascade-edge pins; every import is already there, and two names are corrected to what they assert.
- `registry/ai/reasoning.tsx` (reasoning owner): ReasoningContent renders Streamdown directly, so it has neither the scroll-region marker nor the accessible link-safety dialog. The simplest fix is to render the reasoning text with `MessageResponse` (add `@uifiles/response` to registryDependencies). It already carries the plugins and the shiki pair ReasoningContent duplicates.
- `e2e/previews.spec.ts` (e2e owner): assert the served HTML, which would have caught R3-3. `const html = await (await page.request.get("/preview/branch")).text(); expect(html).toContain('aria-label="Next branch"'); expect(html).toMatch(/>1<!-- --> of <!-- -->3</)`. Also check `/preview/response` at 375 px for `document.documentElement.scrollWidth <= clientWidth`; the preview now has a formula that is too wide.
- `docs/architecture.md` §3 (docs owner): add the `.katex-display` rule (a post-install step, shipped via the `css` field if adopted) and the link-safety dialog replacement to the list of divergences and post-install steps.

## Strict-flag typecheck

- Errors remaining in files I own: none.
- Errors in files I do not own: none. `tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals` reports 0 errors repo-wide, and plain `tsc --noEmit` is clean.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=<scratchpad>/fix3-rbd
pnpm exec vitest run --project browser tests/browser/qa-round3/components-b.test.tsx   # before: 4 failed | 7 passed
pnpm exec vitest run --project unit tests/unit/qa-round3-components-b.test.ts          # before: 1 failed | 7 passed
node --conditions react-server - < $S/flight-server.cjs                                 # Flight prototype: $L client references, I rows
# before runs: git show ca6f2fd:<source> > <source>; vitest run <file>; cp back; cmp  (response, branch, checkpoint, queue)
$S/mutate.sh <name> <file> '<perl subst>' <project> <test>                             # 33 mutations, results in $S/mut/results.log
pnpm exec prettier --write <my 12 files>; pnpm exec biome check <my 12 files>; pnpm exec prettier --check <my 12 files>
pnpm exec tsc --noEmit; pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/ai/{response,branch,checkpoint,confirmation,queue}.test.tsx; pnpm exec vitest run --project unit tests/unit/branch.test.ts tests/unit/ssr.test.ts; done
pnpm exec vitest run --project unit; pnpm exec vitest run --project browser tests/browser/ai/reasoning.test.tsx tests/browser/blocks/chat.test.tsx tests/browser/{tokens,button,theme}.test.tsx
pnpm registry:validate
node --input-type=module -e "…registryItemSchema.safeParse(item with css)…"          # css field valid for response and reasoning
rm tests/browser/qa-round3/components-b.test.tsx tests/unit/qa-round3-components-b.test.ts
```
