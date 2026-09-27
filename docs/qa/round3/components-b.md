# components-b — QA round 3

Scratch: `/docs/qa/round3/components-b/`
(`live.mjs` + `live.json` Playwright 1.63 / axe-core 4.13 pass against the production server, `shots/queue-coarse-375.png`,
`mutate.sh` + `batch.sh` + `mut/results.log` + per-mutation logs and pristine/mutated copies, `run{1,2,3}-browser.log`,
`tokens-button-runs.log`, `unit-runs.log`, `qa3-browser-runs.log`, `qa3-unit-runs.log`, `branch.html` = served `/preview/branch`).
Reproducers: `tests/browser/qa-round3/components-b.test.tsx` (11 tests: 4 fail by design, 7 pins) and
`tests/unit/qa-round3-components-b.test.ts` (8 tests: 1 fails by design, 7 pins). Both Prettier/Biome clean; `tsc --noEmit` reports
nothing in them. Server: `:3000` serves BUILD_ID `8rHfk02_cIu5NBIzviWb2`; both stylesheet links return 200 and are byte-identical to
`.next/static/chunks/` (`0l32h8t1mbqja.css` 153,544 B, `3x59cvfd7p2ai.css` 3,701 B), so the live checks below are trusted.
Versions cited: streamdown 2.6.0, katex 0.16.47, @base-ui/react 1.8.0, ai 7.0.114, react 19.3.0, next 16.3.6, tailwindcss 4.3.3.

## Summary

Attacked the thirteen items in scope (`reasoning`, `tool`, `task`, `plan`, `chain-of-thought`, `queue`, `checkpoint`, `confirmation`,
`branch`, `response`, `sources`, `suggestion`, `image`), their 13 canonical browser files + `tests/unit/branch.test.ts`, the token layer
(`scripts/sync-tokens.ts`, `app/globals.css`, `registry/base`, `tokens.test.ts`, `tokens.test.tsx`, `button.test.tsx`), the thirteen
`docs`/`description` strings and the base item. Method: read every source and test line; verified each round-2 fix in scope against the
code, the compiled CSS, the served HTML and a real-device Playwright pass (touch phone, mouse at 375, both themes); 24 mutation runs
against the canonical files (22 caught, 2 survived, both killed by my new tests); 19 reproducers; three consecutive runs of every file.

Findings: **1 high, 3 medium, 3 low, 3 nit.** Every round-2 fix in scope is really in the code and load-bearing except one that is
only half effective: the `branch` server-side count works for a hand-built client tree (what the tests render) but not on the App
Router (what the docs site and any Next consumer render), where `/preview/branch` still ships no selector in its HTML. The single
worst thing is new and invisible to axe: a display equation longer than about 40 characters (Bayes' rule, a regularised loss) makes the
whole page horizontally scrollable at phone width, because neither Streamdown nor KaTeX gives `.katex-display` an overflow container.

Verdict: **not yet** — F1 is a one-rule CSS fix plus one selector in the response marker; everything else is a follow-up.

## Fix verification

| round-2 finding | claimed fix | verified? | evidence |
| --- | --- | --- | --- |
| disclosure F1 (medium): queue actions invisible on touch | `pointer-coarse:opacity-100` | **yes** | `registry/ai/queue.tsx:137`; Tailwind 4.3.3 `r("pointer-coarse",["@media (pointer: coarse)"])` (`node_modules/tailwindcss/dist/lib.js`); compiled `.next/static/chunks/0l32h8t1mbqja.css` carries `@media (pointer:coarse){.pointer-coarse\:opacity-100{opacity:1}}` inside `@layer utilities` *after* `.opacity-0` (offsets 98,214 vs 44,236, same layer → the reveal wins); live Playwright `hasTouch+isMobile` at 375: `(pointer: coarse)` true, `(hover: hover)` false, all 8 action buttons `opacity: 1` with no interaction, axe clean, console clean (`live.json › queueCoarse`, `shots/queue-coarse-375.png`); mouse at 375: `opacity: 0` at rest as designed. Hybrid devices: the variant is `pointer` (primary input), not `any-pointer`; a phone with a paired mouse is `pointer: coarse` + `hover: hover` → always visible and hover-styled, fine; a touch laptop whose primary pointer is fine keeps the hover-only reveal, where a finger tap fires emulated `:hover` (first tap reveals, second activates) — acceptable, see N3. Mutation M1 caught |
| disclosure F2 (medium): 0 ms stream shimmers forever | `Math.max(1, …)` | **yes** | `reasoning.tsx:117`; `reasoning.test.tsx › reports at least one second … same millisecond` uses a frozen fake `Date`; M3 caught (1) |
| disclosure F3 (low): controlled parent re-open unpinned | test migrated | **yes** | `reasoning.test.tsx › keeps open a panel that a controlled parent re-opens after the auto-close` re-opens through a parent button, not the trigger; M4 (drop the timer callback's spent mark) caught (1) |
| disclosure F4 (low): two "no input" placeholders | chat block passes `part.input` through | **yes** | `registry/blocks/chat/components/blocks/chat.tsx:531` `<ToolInput input={part.input} />`; my `chat block tool part › shows exactly one 'No input yet' placeholder …` → one element, no "Streaming input"; `… stopped call as Pending with the same single placeholder` (status `ready` + `input-available` → "Pending") — both pass |
| disclosure F5 (low): spies bypass the console guard | spies removed; guard hardened | **yes** | `grep spyOn` over the 17 files: `task.test.tsx:122` (pass-through with `allowConsole`), `response.test.tsx:549` (rAF), `tests/unit/branch.test.ts:50` (unit project, no guard); `tests/console-guard.ts:98-120` now charges swallowed calls and fails on a replaced method |
| disclosure F7/F8 (nit): issue numbers, description wording, title | done | **yes** | no `#63`/`#86` in names; tool description reads "JSON and strings in Code Blocks, React nodes and primitives rendered as given" (matches `tool.tsx:161-176`); title "Chain of Thought" |
| rendered-surface N1 / leaves-tokens F1 (high): table scroller not focusable | marker generic over code bodies and table scrollers, `role="group"` + name | **yes** (inline tables) | `response.tsx:23-45,59-71`; live `/preview/response` at 375 light and dark: code body `tabindex=0 role=group aria-label=Code` (sw 656/cw 289), table scroller `tabindex=0 role=group aria-label=Table` (sw 312/cw 289), axe **clean** in both themes, no console output → the hydration guard holds on the real page (`live.json › response375Light/Dark`). M9 (tables never collected) caught 2, M10 (never unmarked) caught 2, M10b (mark dehydrated DOM) caught 1. Residual: Streamdown's fullscreen table view is a second, portaled scroller the marker cannot see — F3 |
| rendered-surface N4 (low): straddling chip not scrolled on focus | `onFocus` → `scrollIntoView({block:"nearest", inline:"nearest"})` | **yes** | `suggestion.tsx:49-59`; live `/preview/suggestion` at 375: Tab through six chips, every focused chip fully inside the viewport (`vpScrollLeft` 0 → 135 → 415 → 618 → 918), `window.scrollY` stays 0; it drives the ScrollArea's native viewport, no fight; my `does not scroll the page when a chip that is already in view receives focus` (page pre-scrolled to 200, stays 200) passes; M14 caught (1) |
| rendered-surface N6 (low): checkpoint tooltip visual only | sr-only mirror + `aria-describedby`, skipped when it repeats the name, consumer's wins | **yes** (rule has a gap, F5) | `checkpoint.tsx:59-99`; served `/preview/checkpoint` HTML: both triggers `aria-describedby="_R_…"` → `<span class="sr-only" id="_R_…">Restore the workspace to this point</span>`; live axe clean; M5 (no describedby) caught 1, M6 (`describes = true`) caught 1; consumer precedence verified by my `lets a consumer's aria-describedby win …` (passes) but the canonical file does not pin it (M6b survived, F7) |
| rendered-surface N10 (nit): rejected outcome unstyled | `<span className={cn("text-destructive", className)}>` | **yes** | `confirmation.tsx:149`; live `/preview/confirmation` light: rejected `lab(41.802 77.7132 69.6642)` = `--destructive`, accepted `lab(45.48 0 0)`; dark: rejected `lab(67.887 60.7028 31.0693)` = token; axe clean both themes; M8 (drop the class) caught 2. `cn` is clsx + tailwind-merge (`node_modules/cn/package.json`, `dist/index.js` imports `twMerge`), so a later `className` colour wins — verified by my `lets className override the destructive colour …`; the canonical "merges className" test does not pin the order (M7 survived, F6) |
| rendered-surface F18/N12 (low): queue titles cut at 375 | `line-clamp-2` | **yes** | `queue.tsx:82`; compiled `.line-clamp-2{-webkit-line-clamp:2;…}`; live 375 touch: all five `QueueItemContent` have `-webkit-line-clamp: 2`, four wrap onto two lines, none truncated (`live.json › queueCoarse.clamp`); M2 caught (1) |
| leaves-tokens F2 (low): `title=""` → unlabelled link | `\|\|` fallbacks | **yes** | `sources.tsx:90-96`; M13 (`title ??`) caught (1) |
| leaves-tokens F3 (low): cascade order | unlayered beats layered; same layering later wins; cross-layer refused | **yes** | `sync-tokens.ts:9-19,138-157`; M15 (layered beats unlayered) caught 2, M16 (no cross-layer refusal) caught 1; my edges: unlayered vs *two* layers → no refusal, value `1` (correct: unambiguous); `@layer a @layer b` vs `@layer a` → refused with both chains named; `!important` copied, not ranked (documented; N4) |
| leaves-tokens F4 (low): controlled clamp not reported | `onBranchChange(clamped)` once from an effect, guarded by `totalBranches > 0` | **yes** | `branch.tsx:105-112`; M12 (never report) caught 3, M12b (drop the `> 0` guard) caught 1. Under React StrictMode's double-invoked dev effects it is called twice with the same index (N1) |
| leaves-tokens F5 (low): selector missing from server HTML | render-time `countBranches` through fragments/host elements | **partial** | Works for the tree the tests build: `tests/unit/branch.test.ts` (4) and `branch.test.tsx › renders the selector … on the server and hydrates …` pass, M11/M11b caught. Does **not** work on the App Router: served `/preview/branch` HTML has **0** `aria-label="Next branch"` and no page count; after hydration 1 selector and "1 of 3" (`live.json › branch`, `branch.html`). Cause and reproducer in F2 |
| leaves-tokens F6 (low): three survived mutants unpinned | pins folded into canonical files | **yes** | `response.test.tsx › re-checks overflow when only a text node … changes`, `branch.test.tsx › resets the count when the content unmounts …` (+ custom-component variant), `button.test.tsx › shows a ring and a border in the ring token that clears 3:1 …` (canvas-painted `--ring`, WCAG ≥ 3); M19 (light `--ring` back to 0.708) caught 5 in `button.test.tsx` and 9 in `tokens.test.ts` |
| leaves-tokens F7 (nit): `MessageBranchPageProps` span type | `ComponentProps<typeof ButtonGroupText>` | **yes** | `branch.tsx:270`; `renders a div by default and another element through the render prop` |
| leaves-tokens F8 (nit): `--x: {}` dropped, unquoted `url()` cut | refused / read whole | **yes** | `sync-tokens.ts:92-104,108-110`; M17 caught 1, M18 caught 1; my `url(data:image/svg+xml;charset=utf-8,%3Csvg%3E) center` edge passes |
| leaves-tokens test-quality (`domQuiet(500)`, `setTimeout(100)`, `setTimeout(250)`, `.prettierrc`) | deterministic rewrites | **yes** | `grep` for `setTimeout(\|domQuiet\|sleep(` over the 17 files is empty; `tokens.test.ts:172-186` writes the repo's `.prettierrc` (minus plugins) beside the fixture; `formats the registry with Prettier, not with JSON.stringify` proves the step |
| meta F6 (nit): `awaitingOwnerDecision` cites `docs/plan.md` | cites architecture §4 | **yes** | `tokens.test.ts` › "light muted-foreground meets AA … (architecture §4 departure)" |
| rendered-surface N9 (nit): preview titles | `metadata` exports | **yes** (as scoped) | `app/preview/{tool,task,plan,queue,checkpoint,branch,response,sources,image,suggestion}/page.tsx` export `metadata`; served `<title>Branch · uifiles</title>`; `reasoning`, `confirmation`, `chain-of-thought` remain client pages (documented) |
| fix-manifest-docs-2: the 13 `docs`/`description` strings | applied verbatim | **yes, with the exceptions in F2/F3/F5** | every other sentence checked against the code; see Verified OK |

## Findings (most severe first)

### F1. `response`: a long display equation makes the whole page scroll horizontally at phone width — severity: high
- Where: `registry/ai/response.tsx` (the overflow marker knows `code-block-body` and the table scroller only, lines 29-45); `app/globals.css:5` (`@import "katex/dist/katex.min.css"` — KaTeX sets `.katex-display > .katex { white-space: nowrap }` and no overflow on `.katex-display`); Streamdown 2.6.0 wraps math in nothing (`@streamdown/math/dist/index.js` returns the rehype-katex output as is; `node_modules/streamdown/dist/chunk-YOKDWASO.js` has overflow containers for code bodies, tables and the link-safety URL box, none for math).
- What: a `$$ … $$` block wider than the column is not clipped or scrolled; it widens `document.documentElement.scrollWidth`, so the page gains a horizontal scrollbar and every element (nav, prompt input, chat list) pans with it. At 375 px with the site's 16 px gutters (343 px column): Bayes' rule `P(A \mid B) = \frac{P(B \mid A)P(A)}{P(B \mid A)P(A) + P(B \mid \neg A)P(\neg A)}` → document 408 px; a regularised logistic loss → 466 px; a 14-term polynomial → 832 px. Quadratic formula, softmax and attention fit (343 px). The preview's own equation is 309 px, so `/preview/response` does not show it and the desktop-only e2e never would. axe has no rule for reflow, so no axe run can catch it.
- Evidence: `tests/browser/qa-round3/components-b.test.tsx › response scrollers Streamdown renders outside the message › keeps a long display equation from widening the page at phone width` — FAIL ×3: `expected 832 to be less than or equal to 375`. Widths of the six realistic formulas measured with a throwaway probe (deleted): `bayes docScrollWidth 408`, `loss 466`, others 375 (probe source in the Commands section).
- Why it matters: WCAG 1.4.10 (reflow, AA) on the flagship renderer for content any STEM chat produces; the user sees the whole transcript slide sideways. The docs already tell consumers to import KaTeX's stylesheet and promise "tables and code blocks that overflow become keyboard-focusable scroll regions", which invites the assumption that math is handled too.
- Proposed fix: in `app/globals.css` (and the same line in the response/reasoning `docs`) `.katex-display { overflow: auto hidden; }` (KaTeX's own documented recommendation for long displays) and add `.katex-display` to `findScrollers` with the label "Math" so the new scroller is a named tab stop under the same overflow check; add a long-formula case to `response.test.tsx` that asserts `documentElement.scrollWidth <= clientWidth` at 375 px and `NAMED_MATH` on the display. `ReasoningContent` renders Streamdown with the same plugins and needs the same CSS.
- Test written: as named (expected: FAIL now).

### F2. `branch`: the server-side branch count does not work on the App Router, and the docs say it does — severity: medium
- Where: `registry/ai/branch.tsx:66-76` (`countBranches` matches `child.type === MessageBranchContent`); `app/preview/branch/page.tsx` (a Server Component composing the client components); `registry/ai/registry.json › branch › docs`: "MessageBranch counts the branches of its MessageBranchContent while rendering … so the selector and MessageBranchPage ("2 of 3") are in server-rendered HTML and hydrate without a warning; content rendered by a custom component cannot be counted that way …".
- What: when a Server Component renders `<MessageBranchContent>`, Flight serialises the element type as a client reference (`$L8` in the served RSC payload; `MessageBranchContent` is module `8` in `branch.html`) and the Flight client turns it into a lazy element type: `createLazyChunkWrapper` builds `{ $$typeof: react.lazy, _payload: chunk, _init: readChunk }` (`node_modules/next/dist/compiled/react-server-dom-turbopack/cjs/react-server-dom-turbopack-client.node.development.js:2182-2191`, used at `:2820-2827` for `$L`; the browser build has the same code at `:2029-2038` / `:2661-2668`). React resolves that type when it mounts the element; `Children.toArray` resolves lazy *children*, not lazy *types* (`react.development.js:344-350`), so the identity check fails, `countBranches` returns `undefined`, `registeredTotal` is 0 on the server, `MessageBranchSelector` returns `null`, and the selector appears after hydration through the layout-effect fallback — exactly the pre-round-2 behaviour. A `MessageBranchPage` placed outside the selector would read "0 of 0" in the server HTML and flip after hydration.
- Evidence: served `/preview/branch` (production server, current build): 0 × `aria-label="Next branch"`, 0 × `of`, after hydration 1 selector and "1 of 3" (`live.json › branch`); `.next/server/app/preview/branch.html` likewise 0. Reproducer `tests/unit/qa-round3-components-b.test.ts › branch rendered by a Server Component (App Router) › renders the selector and page count on the server when MessageBranchContent arrives as a client reference` — FAIL ×3: `expected '<div class="grid w-full …' to contain 'aria-label="Next branch"'` (the content itself still renders "Second" as the visible branch, so the content's own count is fine; only `MessageBranch` is blind). The sibling `still renders the selector on the server for a plain client tree` passes, which is what the canonical tests cover (`tests/unit/branch.test.ts`, `branch.test.tsx › renders the selector and page count on the server …`); the browser-side fallback with the same lazy types works (`branch handed client references … › registers the count after mount …` passes).
- Why it matters: the only environment where "server-rendered HTML" matters for this registry (Next App Router, shadcn's default) is the one where the claim is false; consumers who read the docs will expect no layout shift and no "0 of 0" flash and get both; the round-2 tests pass while the live page shows the opposite.
- Proposed fix: either resolve lazy types in `countBranches` (`type.$$typeof === Symbol.for("react.lazy") ? type._init(type._payload) : type`; on the SSR side the module chunk is already `resolved_module` for a client reference, so `_init` returns the component synchronously, and if it is pending React would suspend on the same element a moment later anyway) plus a unit test with a lazy-type element as in my reproducer, or drop the claim: "In the App Router, client components a Server Component renders arrive as references MessageBranch cannot identify while rendering, so the selector appears after hydration; render MessageBranch from a Client Component (or pass the count) to get it in server HTML." An explicit `branches`/`count` prop would make SSR deterministic in both cases.
- Test written: as named (expected: FAIL now); the client-side fallback pin passes.

### F3. `response`: Streamdown's fullscreen table view is a scroll region the marker never sees — severity: medium
- Where: `registry/ai/response.tsx:83-110` (`findScrollers(root)` scans the `data-slot="message-response"` subtree; the `MutationObserver` observes that root only); Streamdown 2.6.0 `table-fullscreen` (`chunk-YOKDWASO.js`: `createPortal(jsx("div",{"aria-label":"View fullscreen","aria-modal":"true",…,"data-streamdown":"table-fullscreen",role:"dialog",children:…jsx("div",{className:"flex-1 overflow-auto p-4 pt-0 …"},jsx("table",{"data-streamdown":"table"…}))}), document.body)`).
- What: every table Streamdown renders carries a "View fullscreen" button; the fullscreen dialog is portaled to `document.body`, outside the marker's root, so its scroller (`.flex-1.overflow-auto`, the table's parent, which the `TABLE` selector would otherwise match) never gets `tabindex`/`role`/name. A table wider than the phone stays wider than the phone in fullscreen and a keyboard user cannot scroll it.
- Evidence: `› makes the fullscreen table view a keyboard-reachable scroll region` — FAIL ×3: axe on the dialog `[serious] scrollable-region-focusable … .flex-1`, `tabindex` null (375 px, four-column table, sw > cw).
- Why it matters: the docs say tables that overflow "become keyboard-focusable scroll regions"; this one is a table Streamdown renders from the same markdown and it is the one meant for reading a wide table. Inherited from Streamdown, but the marker is uifiles' own layer and the claim is uifiles'.
- Proposed fix: also observe `document.body` (`childList` only) and include `document.querySelectorAll('[data-streamdown="table-fullscreen"] [data-streamdown="table"]')` in `findScrollers` while a fullscreen dialog exists (its parent element is the scroller; the React-ownership guard applies unchanged), or say in `docs` that the fullscreen view is Streamdown's and unmarked. Add the reproducer to `response.test.tsx`.
- Test written: as named (expected: FAIL now).

### F4. `response`: the default link-safety modal fails axe (`nested-interactive`) and its long-URL box is an unfocusable scroller — severity: medium (inherited; on by default)
- Where: Streamdown 2.6.0 link-safety modal (`chunk-YOKDWASO.js`: backdrop `jsx("div",{…,"data-streamdown":"link-safety-modal",onClick:o,onKeyDown:…,role:"button",tabIndex:0,children:…})` with a close `<button>` and two action `<button>`s inside; URL box `className:"break-all rounded-md bg-muted p-3 font-mono text-sm", e.length>100&&"max-h-32 overflow-y-auto"`); `MessageResponse` passes `linkSafety` through with Streamdown's default (enabled), as `response.test.tsx › sanitizes raw HTML and routes links through the link-safety button by default` documents.
- What: clicking any link in an assistant answer opens a dialog whose backdrop is `role="button" tabindex="0"` with focusable descendants (axe `nested-interactive`, serious) and, for a URL longer than 100 characters (any tracking link), a `max-h-32 overflow-y-auto` box without `tabindex` (axe `scrollable-region-focusable`, serious). Round-2's test opens neither the modal nor axe on it.
- Evidence: `› makes the link-safety URL box a keyboard-reachable scroll region when the URL is long` — FAIL ×3: `[serious] nested-interactive … .fixed` and `[serious] scrollable-region-focusable … .break-all`.
- Why it matters: reachable from every link in every response with the default props; both are WCAG 2.1.1/4.1.2-class failures in a modal the user must operate to follow a citation.
- Proposed fix: the `nested-interactive` half is Streamdown's (report upstream; a `role="presentation"` backdrop with the Escape handler on the dialog would do); the scroller half can be covered by the same body-level pass as F3 (`[data-streamdown="link-safety-modal"] .overflow-y-auto` → "Link"), or document `linkSafety={{ enabled: false }}` / `linkSafety.onLinkClick` as the way out. Either way add the modal to the response `docs` (it is not mentioned today).
- Test written: as named (expected: FAIL now).

### F5. `checkpoint`: the "tooltip repeats the name" rule compares the tooltip with the children *value*, so a name built from several children always gets a duplicate description — severity: low
- Where: `registry/ai/checkpoint.tsx:72` `const describes = tooltip !== props["aria-label"] && tooltip !== children`; docs: "unless it equals the button's aria-label or its text".
- What: `<CheckpointTrigger tooltip="Checkpoint 1">Checkpoint {index}</CheckpointTrigger>` (the preview's own children shape, `app/preview/checkpoint/page.tsx:47`) has `children = ["Checkpoint ", 1]`, never `===` a string, so the sr-only mirror is added and the button is described by its own name ("Checkpoint 1, button, Checkpoint 1"). Only a single string child matches the documented rule.
- Evidence: `› checkpoint › adds no description when the tooltip repeats a name built from several children` — FAIL ×3: description text `"Checkpoint 1"` equals the accessible name.
- Proposed fix: compare against the rendered text (`Children.toArray(children).join("")`) or the button's computed name after mount; document that the comparison is textual. Add the multi-child case to `checkpoint.test.tsx`.
- Test written: as named (expected: FAIL now).

### F6. `confirmation`: the canonical suite does not pin that `className` can override the destructive colour (mutant survived) — severity: low (test gap)
- Where: `tests/browser/ai/confirmation.test.tsx › merges className into the rejected outcome` asserts both classes are present; `cn` is tailwind-merge (`node_modules/cn`), so order decides which colour wins.
- What: mutation M7 (`cn(className, "text-destructive")`) leaves 29/29 green while the docs sentence "pass className to adjust" becomes false for a colour override.
- Evidence: `mut/results.log` M7 SURVIVED; my `› confirmation › lets className override the destructive colour of the rejected outcome` (computed colour = `--muted-foreground`, no `text-destructive` in `className`) kills it (M7b CAUGHT).
- Proposed fix: fold the computed-colour assertion into the canonical test.
- Test written: as named (PASS; fails under M7).

### F7. `checkpoint`: the canonical suite does not pin that a consumer's `aria-describedby` wins (mutant survived) — severity: low (test gap)
- Where: `registry/ai/checkpoint.tsx:80-84` sets `aria-describedby` before `{...props}`; docs: "your own aria-describedby wins".
- What: mutation M6b (move the attribute after the spread) leaves `checkpoint.test.tsx` 10/10 green.
- Evidence: `mut/results.log` M6b SURVIVED; my `› checkpoint › lets a consumer's aria-describedby win over the tooltip mirror` kills it (M6c CAUGHT).
- Proposed fix: move that test into `checkpoint.test.tsx`.
- Test written: as named (PASS; fails under M6b).

### N1. `branch`: the clamp report fires twice under React StrictMode (dev) — severity: nit
- `branch.tsx:105-112` has no once-guard; StrictMode's double-invoked dev effects call `onBranchChange(1)` twice for `branch={9}` over two children (production: once). Idempotent for a parent that stores the index; the docs' "called once" holds in production. Pinned by `› branch handed client references … › reports a controlled clamp on every effect run, so twice under StrictMode's double-invoked effects` (PASS) so a change is deliberate; a ref keyed on `currentBranch` would make it exactly once, as `reasoning` does.

### N2. `sync-tokens.ts`: an `!important` token inside a layer is ranked like a normal one — severity: nit (documented)
- Header line 16-17 says so; the browser would let the important layered declaration beat an unlayered normal one. Pinned by `› sync-tokens cascade rule at its edges › copies !important into the value without ranking it, as the header says` (PASS). Not reachable from a token file that never uses `!important`.

### N3. `queue`: `pointer-coarse` is the primary-pointer query — severity: nit (observation)
- On a laptop with a touchscreen and a trackpad (`pointer: fine`, `any-pointer: coarse`, `hover: hover`) the actions keep the hover-only reveal; a finger tap fires emulated `:hover` so it takes two taps. `any-pointer-coarse:opacity-100` (also shipped by Tailwind 4.3.3, `r("any-pointer-coarse",["@media (any-pointer: coarse)"])`) would show them always on such devices at the cost of hiding nothing for a mouse user on a touch laptop. Either is defensible; the docs sentence ("always on coarse pointers") is accurate as written.

## Mutation log

Harness `mutate.sh` (copy → `perl -0pi` → run only the named file(s) → restore → sha256 + `git diff --quiet`); `mut/results.log`. Every line `restored=OK`; `git diff --quiet` over the ten patched files is empty at the end.

| behaviour | mutation | test file | caught? |
| --- | --- | --- | --- |
| queue: coarse-pointer reveal | drop `pointer-coarse:opacity-100` (M1) | `ai/queue.test.tsx` | yes (1) |
| queue: two-line clamp | `line-clamp-2` → `line-clamp-1` (M2) | `ai/queue.test.tsx` | yes (1) |
| reasoning: ≥ 1 s measured duration | drop `Math.max(1, …)` (M3) | `ai/reasoning.test.tsx` | yes (1) |
| reasoning: timer callback marks the cycle spent | drop `autoCloseSpentRef.current = true` in the timer (M4) | `ai/reasoning.test.tsx` | yes (1) |
| checkpoint: description wired | `aria-describedby={undefined}` (M5) | `ai/checkpoint.test.tsx` | yes (1) |
| checkpoint: no description when it repeats the name | `describes = true` (M6) | `ai/checkpoint.test.tsx` | yes (1) |
| checkpoint: consumer `aria-describedby` wins | attribute moved after `{...props}` (M6b) | `ai/checkpoint.test.tsx` | **no** (10/10) |
| same | same (M6c) | `qa-round3/components-b.test.tsx` | yes (1 + the 4 by-design failures) |
| confirmation: `className` can override the colour | `cn(className, "text-destructive")` (M7) | `ai/confirmation.test.tsx` | **no** (29/29) |
| same | same (M7b) | `qa-round3/components-b.test.tsx` | yes (1 + 4) |
| confirmation: rejected outcome coloured | drop `text-destructive` (M8) | `ai/confirmation.test.tsx` | yes (2) |
| response: tables collected | table loop removed (M9) | `ai/response.test.tsx` | yes (2) |
| response: attributes removed when it fits | else-branch removed (M10) | `ai/response.test.tsx` | yes (2) |
| response: dehydrated scrollers left alone | `isClaimedByReact` bypassed (M10b) | `ai/response.test.tsx` | yes (1) |
| branch: render-time count | `countBranches` returns undefined (M11) | `unit/branch.test.ts` | yes (3) |
| same | same (M11b) | `ai/branch.test.tsx` | yes (1, the SSR test; fallback covers the rest by design) |
| branch: controlled clamp reported | callback removed (M12) | `ai/branch.test.tsx` | yes (3) |
| branch: no report without content | `totalBranches > 0` guard removed (M12b) | `ai/branch.test.tsx` | yes (1) |
| sources: empty title falls back | `title ??` (M13) | `ai/sources.test.tsx` | yes (1) |
| suggestion: scroll into view on focus | `scrollIntoView` removed (M14) | `ai/suggestion.test.tsx` | yes (1) |
| sync-tokens: unlayered beats layered | `if (previous === "") return` removed (M15) | `unit/tokens.test.ts` | yes (2) |
| sync-tokens: cross-layer conflict refused | throw disabled (M16) | `unit/tokens.test.ts` | yes (1) |
| sync-tokens: block value refused | throw removed (M17) | `unit/tokens.test.ts` | yes (1) |
| sync-tokens: unquoted `url()` read whole | url branch disabled (M18) | `unit/tokens.test.ts` | yes (1) |
| tokens: light `--ring` at 0.64 | reverted to `0.708` (M19) | `browser/button.test.tsx` | yes (5) |
| same | same (M19b) | `unit/tokens.test.ts` | yes (9) |

24 applied, 22 caught by canonical files, 2 survived (both killed by the new file → F6, F7).

## Test-quality issues (file › test name → problem)

- `tests/unit/branch.test.ts` (all four) and `tests/browser/ai/branch.test.tsx › renders the selector and page count on the server and hydrates them without a warning` → prove the render-time count on a hand-built client tree, which is not how the App Router hands the tree to SSR; the tests are green while the served page shows the opposite (F2). A lazy-type element (my reproducer) or a `renderToString` of the Flight-decoded tree would have caught it.
- `tests/browser/ai/response.test.tsx` → never opens Streamdown's fullscreen table or link-safety modal and never renders a display equation wider than the column; the three failures above are all in surfaces the file renders but does not exercise (F1, F3, F4).
- `tests/browser/ai/confirmation.test.tsx › merges className into the rejected outcome` → presence of both classes only; the order (which colour wins) is what the docs promise (F6).
- `tests/browser/ai/checkpoint.test.tsx › adds no description when the tooltip only repeats the button's name` → covers a single string child only; the preview's own `Checkpoint {index + 1}` shape behaves differently (F5). `› exposes the tooltip text as the accessible description before it opens` → does not pin that a consumer's `aria-describedby` wins (F7).
- `tests/browser/ai/checkpoint.test.tsx › defaults to a small ghost button and accepts overrides` and the `QueueItemIndicator`/`QueueItemContent` unit-style tests in `queue.test.tsx` → fixtures outside `<main>`; no axe there, cosmetic.
- Names, sleeps, spies, skips, rule exclusions: `grep -nE "setTimeout\(|sleep\(|mockImplementation|test\.skip|it\.skip|\.only\(|disableRules|\bBUG\b|\bQA\b|round[- ]?[0-9]|reviewer|\bpins?\b|domQuiet"` over the 17 files → empty. `spyOn`: three pass-through uses, all acceptable. Every axe run sits in `<main>`; `runAxe` enables `target-size` and disables nothing.
- Flakiness: three consecutive runs of the 13 canonical browser files → `363 passed (363)` each (12.54 s, 13.08 s, 11.16 s); `tokens.test.tsx` + `button.test.tsx` → `31 passed` ×3; unit `tokens.test.ts` + `branch.test.ts` → `164 passed` ×3. My files: 4 fail / 7 pass ×3 and 1 fail / 7 pass ×3, identical each run.

## Verified OK

- **Registry strings, sentence by sentence against the code** (the exceptions are F2, F3, F5):
  `reasoning` — ref-held `onOpenChange` (`:76-90`), shimmer span with `[--shimmer-duration:1s]` (`:191`), `<span>` labels, `data-open/closed` (`:252`), `(open)` only (`:152-158`), auto-open on rising edge (`:123-131`), manual toggle takes over (`:152-158`), each stream resets `autoCloseSpentRef` (`:126`), "Thought for 1 seconds" literal (`:197`), `duration === 0` sentinel (`:191`), shiki pair (`:235`), `min-h-6` (`:209`), CSS lines match `app/globals.css:1-9`, `katex@^0.16` declared.
  `tool` — `(open, eventDetails)` (Base UI Collapsible), `keepMounted`, `data-open`/`group-data-open` (`:31,99`), semantic icon tokens (`:62-70`), `bg-card text-destructive` (`:187`), `<div>` labels (`:130,178`), "No input yet" on `undefined` (`:134`), BigInt/`String()` (`:112-127`), falsy outputs and `String(output)` (`:161-176`), unknown state (`:75-76`).
  `task`, `plan`, `chain-of-thought` — every claim matches (`task.tsx:62` `min-h-6`, `group-data-panel-open`; `plan.tsx:56-60` `render={<Card/>}`, `:120-123` `PlanContent` = `CardContent` props, `:139-149` className merged into the Button, `<div>` title/description via `components/ui/card.tsx:35-56`; `chain-of-thought.tsx:80-93` one root, `:128-133` icon-only dim, `:169` unknown status, `:206` empty results, `:232-245` image frame + caption `<p>`); title "Chain of Thought".
  `queue` — every sentence including the coarse-pointer and two-line clamp ones (compiled CSS and live checks above); `QueueList` is Base UI ScrollArea; `QueueSectionContent` unmounts unless `keepMounted`.
  `checkpoint` — `render={<Button/>}`, works without a provider (test), Separator always `role=separator` (`components/ui/separator.tsx`), description sentence true for single-string children (F5 for arrays).
  `confirmation` — Base UI Button/`render`/`nativeButton`, `cn` merge (`:174`), destructive span (`:149`), `output-error` accepted (`:55-60`), null instead of an empty alert (`:81-83`).
  `branch` — controlled prop, clamp, "0 of 0", clamp callback (`:105-112`), remembered uncontrolled index (state is not clamped), null/boolean children and lazy nodes (`Children.toArray`), `ButtonGroupText` div + `render`, Base UI Button; the SSR sentence is F2.
  `response` — identical props, shiki pair overridable (test), code/table scrollers `role="group"` + name (live), re-check on stream/resize (tests), hydration guard (live console clean at 375 both themes), `@source`/`styles.css` (`node_modules/streamdown/styles.css` has `[data-sd-animate]` keyframes and the marker fade; `@streamdown/*` ship no classes), KaTeX line, `singleDollarTextMath ?? false` (`@streamdown/math/dist/index.js`); F3/F4 are omissions, not wrong sentences.
  `sources` — Trigger/Panel props, `data-open` classes, typed root props (`:14-18`), plural, 24 px, span without href (`:102-107`), external vs relative (`:73,113-114`), hostname/href and children fallbacks (`:90-96`).
  `suggestion` — ScrollArea.Root props, scroll-into-view + `onFocus` still called (`:49-59`, live and tests).
  `image` — `GeneratedFile`, `Experimental_GeneratedImage = GeneratedFile` (`ai/dist/index.d.ts:1162`), required `alt`, only alt/class/src reach the element, `image/png` fallback, nothing without base64, `DefaultGeneratedFile` spread; file unchanged since the pre-round-2 commit (`git diff 1e732c0 -- registry/ai/image.tsx` empty).
  `base` — class-based dark, reduced-motion guard shipped in `css` and in `app/globals.css:137-147`, cssVars byte-equal to the stylesheet (`tokens.test.ts › registry/base cssVars equal app/globals.css, key order included`, `sync-tokens is a no-op on the clean tree`).
- `sync-tokens.ts` exit codes: missing stylesheet → 1, no base item → 1, invariant drift → 1 (canonical), malformed registry JSON → 1 with the registry untouched (my pin); byte-identical no-op on the real CSS (canonical); a `.dark` block moved under `@media (prefers-color-scheme: dark)` yields no tokens and therefore fails the invariants loudly (my pin).
- `tokens.test.tsx`/`button.test.tsx`: the ring assertion paints `--ring` through a canvas and compares it with the settled focus border, then WCAG ≥ 3 against the body background; light `--ring` reverted → 5 failures (M19), so the token is pinned in the browser as well as in the unit model.
- Live pass (production server, current build): `/preview/{queue,response,branch,checkpoint,confirmation,suggestion}` — no console error or warning in any context, axe (WCAG 2.x A/AA + 2.2 AA + best-practice tags) clean on every page in every context tried (touch 375, mouse 375, desktop, light and dark).
- Chat block: a tool part with `input: undefined` renders one "No input yet" and no second placeholder; a stopped `input-available` part shows "Pending".

## Could not reach

- A real touch device: coarse pointer proven through Playwright's `hasTouch + isMobile` emulation (`pointer: coarse`, `hover: none`) and the compiled CSS; a hybrid laptop (`pointer: fine` + `any-pointer: coarse`) cannot be emulated by Playwright, reasoned from the Media Queries spec and Tailwind's variant definitions (N3).
- Next's own SSR of `/preview/branch` inside Vitest: the App Router's Flight round trip is not runnable from a test; F2 rests on the served HTML/RSC payload of the live server plus a unit model of the Flight client's lazy type (`createLazyChunkWrapper`) that reproduces the same output.
- `pnpm dlx shadcn@latest add @uifiles/<name>` round trip (`ui.shadcn.com` blocked); `pnpm build`/`registry:build` (forbidden by the brief).
- Screen-reader behaviour for the checkpoint description and the response groups; DOM/ARIA only.
- The concurrent `components-a` lens was mutating `registry/ai/code-block.tsx` and `registry/ai/inline-citation.tsx` during my session (both showed as modified at different times); neither is in my scope and neither is imported by the files I mutated. My harness verified every one of my restores against the pristine sha256.
- My two reproducer files were captured by a lead checkpoint commit while I worked (`git ls-files` lists them; the working tree matches HEAD), as happened in round 2; no other tracked file was changed by this lens.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round3/components-b

# server trust
curl -s http://localhost:3000/preview/queue | grep -o 'href="[^"]*\.css[^"]*"'      # 0l32h8t1mbqja.css, 3x59cvfd7p2ai.css → both 200, sizes equal to .next/static/chunks
cat .next/BUILD_ID                                                                  # 8rHfk02_cIu5NBIzviWb2

# three runs each (logs in $S)
pnpm exec vitest run --project browser tests/browser/ai/{reasoning,tool,task,plan,chain-of-thought,queue,checkpoint,confirmation,branch,response,sources,suggestion,image}.test.tsx   # 363/363 ×3
pnpm exec vitest run --project browser tests/browser/tokens.test.tsx tests/browser/button.test.tsx                                                                                   # 31/31 ×3
pnpm exec vitest run --project unit tests/unit/tokens.test.ts tests/unit/branch.test.ts                                                                                             # 164/164 ×3
pnpm exec vitest run --project browser tests/browser/qa-round3/components-b.test.tsx        # 4 failed | 7 passed (11) ×3 (F1, F3, F4, F5 by design)
pnpm exec vitest run --project unit tests/unit/qa-round3-components-b.test.ts               # 1 failed | 7 passed (8) ×3 (F2 by design)
pnpm exec prettier --check tests/browser/qa-round3/components-b.test.tsx tests/unit/qa-round3-components-b.test.ts; pnpm exec biome check <same>; pnpm exec tsc --noEmit | grep qa-round3   # clean

# compiled CSS and variant definitions
python3 …  .next/static/chunks/0l32h8t1mbqja.css   # pointer-coarse rule inside @media (pointer:coarse) in @layer utilities after .opacity-0; line-clamp-2 present
grep -o 'r("pointer-coarse",\[[^]]*\])\|r("any-pointer-coarse",\[[^]]*\])' node_modules/tailwindcss/dist/lib.js; grep -o 'static("hover",[^}]\{0,120\}' node_modules/tailwindcss/dist/lib.js

# live pass (Playwright 1.63 + @axe-core/playwright, node_modules symlinked into $S)
node $S/live.mjs $S/shots > $S/live.json                                            # queue touch/mouse, response 375 light/dark, branch SSR vs hydrated, checkpoint, confirmation light/dark, suggestion tabbing
curl -s http://localhost:3000/preview/branch > $S/branch.html                        # 0 × aria-label="Next branch"; RSC payload: MessageBranchContent is client reference $L8
curl -s http://localhost:3000/preview/checkpoint | grep -o '<span class="sr-only" id="[^"]*">[^<]*</span>'

# Streamdown / KaTeX / Flight facts
grep -o 'data-streamdown":"[a-z-]*"' node_modules/streamdown/dist/*.js | sort | uniq -c   # slot inventory (code-block-body, table, table-wrapper, table-fullscreen, mermaid, link-safety-modal, …)
grep -o '.\{160\}overflow-[xy]*-*auto.\{200\}' node_modules/streamdown/dist/chunk-YOKDWASO.js   # code body, fullscreen table, inline table, link-safety URL box; no math wrapper
grep -n -A12 "function createLazyChunkWrapper" node_modules/next/dist/compiled/react-server-dom-turbopack/cjs/react-server-dom-turbopack-client.node.development.js
grep -n -B2 -A6 "case REACT_LAZY_TYPE" node_modules/react/cjs/react.development.js   # Children.toArray resolves lazy children only

# mutations
bash $S/batch.sh; bash $S/mutate.sh M6b … ; bash $S/mutate.sh M6c … ; bash $S/mutate.sh M16 …   # → $S/mut/results.log (24 applied, all restored=OK)
git diff --quiet -- registry/ai/{queue,reasoning,checkpoint,confirmation,response,branch,sources,suggestion}.tsx scripts/sync-tokens.ts app/globals.css && echo pristine

# math width probe (temporary tests/browser/qa-round3/_probe-math.test.tsx, deleted afterwards)
#   six formulas at 375 px in a px-4 main → documentElement.scrollWidth: quadratic 375, bayes 408, cost 375, softmax 375, attention 375, loss 466
```

## Verdict

**Not yet.** Blocking: **F1** (display math widens the page at phone width on the flagship renderer; WCAG 1.4.10; invisible to
axe and to the desktop e2e; fix is `.katex-display { overflow: auto hidden }` in `app/globals.css` + the docs line, plus `.katex-display`
as a "Math" scroller in the response marker, with a 375 px long-formula test). Everything else in this lens ships as is and goes to a
follow-up: F2 (make the branch SSR count real on the App Router or correct the docs sentence), F3/F4 (Streamdown's portaled
fullscreen table and link-safety modal: extend the marker to `document.body` or document them; report `nested-interactive` upstream),
F5 (textual comparison for the checkpoint tooltip rule), F6/F7 (two canonical test gaps, tests already written).
