# fix-leaves

Lens: `leaves` (`branch`, `response`, `sources`, `suggestion`, `image`). Reports read in full:
`chat-block-and-leaves.md` (F4, F6, F7, F8, F9, F10, F12, "Other notes"), `test-quality.md` (F2
memo note), plus the three coordinator additions from `rendered-surface.md` (F6 hydration, F7 RSC
keys, F11 target size).

## Fixed

- chat-block-and-leaves:F4 — `MessageBranchContent` destructures `className` and merges it after
  the computed `block`/`hidden` class; `{...props}` can no longer override visibility. Audited every
  other owned component: `Source` also spread `className` after its base class and now merges it;
  the rest already merged or forward to a merging wrapper — `registry/ai/branch.tsx:129-141`,
  `registry/ai/sources.tsx:98` — test: `tests/browser/ai/branch.test.tsx` › "keeps only the active
  branch visible when className is set" / "…when className is undefined" (failed before:
  `Received element is visible: <p />` for "Second answer"; pass after)
- chat-block-and-leaves:F6 (+ rendered-surface:F7) — `Children.toArray(children)`: null/undefined/
  boolean children are dropped, lazy Server Component children resolve, every element gets a stable
  key; text branches key by position — `registry/ai/branch.tsx:121-142` — tests: "ignores null,
  undefined and boolean children when counting branches" (failed before:
  `TypeError: Cannot read properties of null (reading 'key')` in the boundary; passes after),
  "keys unkeyed children without a key warning", "resolves lazy (Server Component) children without
  a key warning" (hand-built `react.lazy` nodes, the shape RSC delivers)
- chat-block-and-leaves:F7 — `clampBranch` keeps the current index in `[0, count-1]`: the provider
  clamps against the registered count, `MessageBranchContent` against its own child count (correct
  first paint); count registration moved to `useLayoutEffect` with cleanup; `MessageBranchPage`
  reads "0 of 0" when nothing is registered — `registry/ai/branch.tsx:49-50,69,127,224` — tests:
  "clamps a defaultBranch past the end to the last branch" (failed before: found "8 of 3"; passes
  after), "clamps a negative defaultBranch to the first branch", "clamps a controlled branch that
  is out of range", "clamps the current branch when branches are removed", "hides with no content
  and the page reads 0 of 0"
- common brief (stable setter) — `onBranchChange` lives in a ref, `setBranch` depends only on
  `isControlled`; additive controlled `branch` prop (upstream had only `defaultBranch`) —
  `registry/ai/branch.tsx:52-80` — tests: "calls the latest onBranchChange after the parent swaps
  the callback", "shows the controlled branch and reports changes without switching on its own",
  "follows a parent that stores the branch in state"
- chat-block-and-leaves:F8 — a `ResizeObserver` on every code-block body (set reconciled from the
  `MutationObserver`, which now also watches `characterData` for streamed text) re-checks overflow
  on size changes and removes the tab stop when the block fits again —
  `registry/ai/response.tsx:52-96` — test: `tests/browser/ai/response.test.tsx` › "adds and removes
  the tab stop as a resize changes whether the code overflows" (failed before: `tabindex` never set
  after narrowing; QA fixture reported `expected true to be false`, mine with the observer removed
  `expected null to be '0'`; passes after)
- rendered-surface:F6 — the marker only touches bodies React has claimed (a `__reactFiber$…`
  property, absent on server DOM inside a dehydrated Suspense boundary) and re-polls per animation
  frame until every body is owned, so the attribute never reaches a boundary before it hydrates —
  `registry/ai/response.tsx:27-33,68-71,83` — test: "leaves server-rendered code blocks untouched
  until React has hydrated them" (renders through `react-dom/server`, hydrates with a still-pending
  lazy body under `[data-streamdown=code-block-body]`; failed before: `expected true to be false`
  on `hasAttribute("tabindex")` while dehydrated plus React's "A tree hydrated but some attributes
  of the server rendered HTML didn't match" on `console.error`; passes after)
- chat-block-and-leaves:F12 / test-quality:F2 — the memo test is load-bearing: it counts renders
  through `components.p`, asserts a className-only change is dropped by the memo (the DOM keeps the
  old class), that an `isAnimating` flip goes through (new class + streaming caret), and that new
  children re-render blocks — `tests/browser/ai/response.test.tsx` › "re-renders only when children
  or isAnimating change" (the "comparator → false" mutant survived the old test; killed now, as is
  the "comparator ignores isAnimating" mutant)
- chat-block-and-leaves:F9 — "Used 1 source" / "Used N sources" — `registry/ai/sources.tsx:44` —
  test: `tests/browser/ai/sources.test.tsx` › "pluralises the count" (failed before:
  `expected <p class="font-medium">Used 1 sources</p> to be null`; passes after)
- chat-block-and-leaves "Other notes" — the `<p>` inside the trigger `<button>` is a `<span>` —
  `registry/ai/sources.tsx:43` — test: "renders a non-submitting button with only phrasing content
  and a 24px target"
- rendered-surface:F11 — `min-h-6` on `SourcesTrigger` and on `Source` rows (24px targets; visual
  weight unchanged, rows gain 8px) — `registry/ai/sources.tsx:38,98` — test: same test
  (`getBoundingClientRect().height >= 24` and axe `target-size` via `expectNoViolations`; with the
  class removed: `expected 16 to be greater than or equal to 24`)
- leaves brief (sources 3) — `Source` without `href` renders a `<span>` (no link, no tab stop);
  absolute URLs (`scheme:` or `//`) get `target="_blank" rel="noreferrer noopener"`, relative URLs
  open in the same tab; `title` falls back to the hostname, then the href — `registry/ai/sources.tsx:70-124`
  — tests: "renders plain text instead of a link when there is no href", "renders source link",
  "opens relative links in the same tab", "labels the link with the hostname when there is no
  title", "lets props override target and rel and merges className"
- leaves brief (sources open/closed) — `Sources` types `open`/`defaultOpen`/`onOpenChange`/`disabled`
  (Base UI root props) on top of upstream's div props — `registry/ai/sources.tsx:14-18` — tests:
  "opens by default with defaultOpen", "follows a controlled open prop and reports toggles through
  onOpenChange", "expands to reveal the source links" (axe closed, open and dark)
- chat-block-and-leaves:F10 — `alt` is required in `ImageProps` (`""` allowed for decorative);
  `mediaType` falsy → `image/png`; `base64` falsy → renders nothing; only `alt`, `class`, `src`
  reach the element — `registry/ai/image.tsx:7-30` — tests: `tests/browser/ai/image.test.tsx` ›
  "requires alt and treats an empty alt as decorative" (a `@ts-expect-error` line makes the type
  contract load-bearing under `tsc`; failed before: `expected [ 'image-alt' ] to deeply equal []`),
  "falls back to image/png when mediaType is missing", "renders nothing when there is no image
  data", "puts nothing but alt, class and src on the element and logs no unknown-prop warnings"
- leaves brief (suggestion) — verified, no source change needed: Base UI's viewport carries
  `tabindex="0"` only while overflowing (`-1` when the row fits), ArrowRight/ArrowLeft scroll it
  after Tab, axe `scrollable-region-focusable` passes light and dark, `onClick` receives the
  suggestion string — tests: `tests/browser/ai/suggestion.test.tsx` › "makes the viewport a tab stop
  that arrow keys scroll when the row overflows", "keeps the viewport out of the tab order when the
  row fits", "calls onClick with suggestion", "activates from the keyboard"
- Preview: `app/preview/sources/page.tsx` adds a title-less source so the hostname fallback renders
  on `/preview/sources` (count now 4). All five preview routes return 200 on the dev server.

## Not fixed and why

- chat-block-and-leaves:F10, runtime half — an untyped caller that omits `alt` still gets an
  `<img>` without it. Defaulting to `alt=""` would declare meaningful images decorative, which is
  worse than the type error; the contract is type-level. Recommend leaving it.
- Coverage gap "mermaid fence renders a diagram" — not tested. The mermaid plugin lazy-loads a very
  large chunk; plugin registration is exercised through `plugins` (code and math render). Recommend
  an e2e-only check if it is wanted.
- Coverage gap "`content-visibility: auto` ancestors skip layout for offscreen code blocks" — the
  per-body `ResizeObserver` handles it by design (re-layout fires a size change on the observed
  body) but there is no test: a faithful fixture needs a real scroll container with skipped
  content and was out of scope for this round.
- `Suggestions` puts `className` on the inner row, not the ScrollArea (upstream parity) — kept and
  pinned by "applies custom className"; changing it is an API decision.
- QA pin "keepMounted keeps the links…" clicked the old label "Used 1 sources"; migrated with the
  corrected label ("keeps content mounted but hidden with keepMounted").

## Tests

- `tests/browser/ai/branch.test.tsx`: 3 tests before → 35 after; upstream `message.test.tsx`
  `MessageBranch*` tests ported: 11 of 11, names kept.
- `tests/browser/ai/response.test.tsx`: 2 → 16; upstream `MessageResponse` tests ported: 4 of 4.
  Skipped from `message.test.tsx`: 15 tests of `Message`, `MessageContent`, `MessageActions`,
  `MessageAction` (components not ported; shadcn's `message` replaces them). Adaptation: Streamdown
  renders emphasis as `<span data-streamdown="strong">`, asserted by attribute.
- `tests/browser/ai/sources.test.tsx`: 1 → 22; upstream `sources.test.tsx`: 11 of 11 ("renders
  source link" now expects `rel="noreferrer noopener"`).
- `tests/browser/ai/suggestion.test.tsx`: 3 → 15; upstream `suggestion.test.tsx`: 8 of 8.
- `tests/browser/ai/image.test.tsx`: 1 → 8; upstream `image.test.tsx`: 3 of 4 (skipped "renders
  without alt text": `alt` is required now; replaced by "requires alt and treats an empty alt as
  decorative").
- Total 10 → 96. Migrated from `tests/browser/qa-round1/chat-block-and-leaves.test.tsx`: the 7
  reproducers (F4 ×2, F6, F7, F8, F9, F10) and the 12 passing pins for these components, renamed by
  behaviour; the chat-block fixer deleted the file. Every file imports `expectNoViolations` /
  `withDark` from `@/tests/a11y` (no local `settle`/`axe.run`), wraps fixtures in `<main>`, runs
  axe per meaningful state and once under `withDark`, and passes the new `tests/setup.ts` console
  guard (expected error-boundary logs are swallowed with a mocked `console.error` spy).
- Mutation checks (`scratchpad/leaves/mutate.py`, sources restored from backups, 15/15 killed):
  - branch: className spread after the visibility class → "keeps only the active branch visible…" (2 fail)
  - branch: raw children array instead of `Children.toArray` → "ignores null, undefined and boolean children…"
  - branch: no clamping → "clamps a defaultBranch past the end…"
  - branch: callback ref never updated → "calls the latest onBranchChange…"
  - response: no ResizeObserver → "adds and removes the tab stop as a resize…" (`expected null to be '0'`)
  - response: mark dehydrated DOM → "leaves server-rendered code blocks untouched…"
  - response: memo comparator → `false` → "re-renders only when children or isAnimating change"
  - response: memo comparator ignores `isAnimating` → same test
  - sources: always plural → "pluralises the count"
  - sources: no rel on external links → "renders source link"
  - sources: `<a>` without href → "renders plain text instead of a link…"
  - sources: trigger below 24px → "…24px target" (`expected 16 to be greater than or equal to 24`)
  - image: no mediaType fallback → "falls back to image/png…"
  - image: renders with empty data → "renders nothing when there is no image data"
  - suggestion: `onClick("")` → "calls onClick with suggestion"
- Three consecutive runs of the five files (`pnpm exec vitest run --project browser tests/browser/ai/{branch,response,sources,suggestion,image}.test.tsx`):
  ```
  Test Files  5 passed (5)   Tests  96 passed (96)   Duration  8.70s
  Test Files  5 passed (5)   Tests  96 passed (96)   Duration  5.50s
  Test Files  5 passed (5)   Tests  96 passed (96)   Duration  5.82s
  ```
  (`pnpm exec vitest run --project unit`: 7 files, 243 passed, including the optimizeDeps check.)

## Registry entry changes (exact strings for registry/ai/registry.json)

- branch › docs: "Extracted from AI Elements message.tsx (the MessageBranch* family only; shadcn's own message replaces the rest). Same export names and props as upstream, plus an optional controlled `branch` prop (pair it with `onBranchChange`; `defaultBranch` stays uncontrolled). The current branch is clamped into range, so an out-of-range `defaultBranch`/`branch` or a shrinking branch list never shows an empty page, and MessageBranchPage reads \"0 of 0\" while no content is registered. MessageBranchContent ignores null/boolean children (conditional branches) and accepts children rendered by a Server Component (RSC lazy nodes resolve without key warnings). Base UI: Button is the Base UI Button primitive (nativeButton), so onClick/disabled/type behave as before; no asChild anywhere."
- response › docs: "Extracted from AI Elements message.tsx (MessageResponse only; shadcn's own message replaces the rest). Export name and props identical (ComponentProps<typeof Streamdown>). No Radix code in this component. Code-block bodies that overflow (horizontally, or vertically past codeBlockMaxHeight) become keyboard-focusable (tabindex=0) on the client, re-checked as tokens stream in and on resize, and only after React has hydrated them, so server-rendered code blocks never cause a hydration mismatch. Note for consumers: Streamdown's Tailwind classes need `@source \"../node_modules/streamdown/dist/*.js\"` (and optionally `@import \"streamdown/styles.css\"`) in globals.css; inline `$...$` math is off by default in @streamdown/math (singleDollarTextMath: false), `$$` blocks work."
- sources › docs: "Ported to Base UI Collapsible: SourcesTrigger and SourcesContent accept Base UI Trigger/Panel props (render instead of asChild; keepMounted instead of forceMount). Open/closed animation classes use data-open/data-closed instead of data-[state=open|closed]. Sources types `open`, `defaultOpen`, `onOpenChange` and `disabled` (Base UI root props) on top of upstream's div props. Divergences from upstream: the trigger pluralises (\"Used 1 source\") and is a 24px-tall target; Source without `href` renders a <span> rather than an anchor; absolute URLs get target=\"_blank\" rel=\"noreferrer noopener\" while relative links open in the same tab; a missing `title` falls back to the URL's hostname."
- image › docs: "ImageProps extends `GeneratedFile` from ai@7 (Experimental_GeneratedImage is a deprecated alias slated for removal in v8; the shape is identical) and, unlike upstream, requires `alt` (pass \"\" only for a decorative image). Only alt, className and the data: src reach the <img>; uint8Array and providerMetadata are stripped. A missing mediaType falls back to image/png (browsers sniff the real format); missing base64 renders nothing. Spread plain objects only: a DefaultGeneratedFile instance exposes base64 through a prototype getter that object spread does not copy, so pass base64/mediaType/uint8Array explicitly. Uses a plain <img> (biome noImgElement suppressed) because the source is an inline data: URL."
- sources › description (append): "…opens in a new tab). A Source without href renders as plain text. Use under an assistant message to surface citations from web-search or retrieval tool results."
- No `dependencies` changes.

## Requests for other owners

- Lead (git history): checkpoint `2582fa5` captured a mutated `registry/ai/sources.tsx` ("Used N
  sources" always) and `registry/ai/sources.tsx.mutbak` while my mutation script was running;
  `152d8ae` already holds the correct file and no backup. Checkpoint `3c53816` captured my scratch
  probe `tests/browser/ai/zz-probe.test.tsx`, deleted since. Please make sure neither the `.mutbak`
  nor `zz-probe.test.tsx` survives into the curated PR.
- `vitest.config.ts` (optional): `tests/browser/ai/response.test.tsx` imports `react-dom/server`
  and `react-dom/client` for the SSR/hydration test; `react-dom/*` is exempt from the
  `optimizeDeps` unit check, and the only cold-cache run showed one "Vite unexpectedly reloaded a
  test" re-optimise before passing. Adding `"react-dom/server"` to `optimizeDeps.include` avoids
  that first-run reload.
- `docs/porting-ai-elements.md` (doc owners): note that Streamdown emits emphasis as
  `<span data-streamdown="strong">`, and that a Server Component parent hands client components
  lazy children (`Children.toArray` resolves them; plain `children.key` reads are `undefined`).

## Strict-flag typecheck

- `pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`
- Errors remaining in files I own: none
- Errors in files I do not own: none at the final run (earlier in the round:
  `tests/browser/qa-round1/prompt-input.test.tsx` ×3, `tests/browser/qa-round1/chat-block-and-leaves.test.tsx`
  ×3 (one from the new `alt` requirement), `tests/browser/tokens.test.tsx` ×1; all since fixed or deleted by their owners)

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>
# baseline + reproducers before the fix
pnpm exec vitest run --project browser tests/browser/ai/{branch,response,sources,suggestion,image}.test.tsx   # 5 files / 10 tests pass
pnpm exec vitest run --project browser tests/browser/qa-round1/chat-block-and-leaves.test.tsx -t "^(branch|response|sources|suggestion|image) "   # 7 failed | 12 passed
# after the fix
pnpm exec vitest run --project browser tests/browser/ai/{branch,response,sources,suggestion,image}.test.tsx   # ×3: 96 passed
pnpm exec vitest run --project unit   # 243 passed
python3 scratchpad/leaves/mutate.py   # 15/15 killed (log: scratchpad/leaves/mutations.txt)
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals   # clean
pnpm exec prettier --check <owned files>; pnpm exec biome check <owned files>   # clean
pnpm registry:validate   # exit 0
curl -s -o /dev/null -w "%{http_code}" localhost:3000/preview/{branch,response,sources,suggestion,image}   # 200 ×5
```
