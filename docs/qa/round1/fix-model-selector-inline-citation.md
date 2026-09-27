# fix-model-selector-inline-citation

Lens: `model-selector-inline-citation`. Reports addressed: `code-context-model-citation.md`
(F3, F4, F8, F9, F11, F15 and the model-selector/inline-citation coverage gaps) plus the
coordinator's notes from `rendered-surface.md` (F5 = F4 here, F13, F20, F21).

Files owned and changed: `registry/ai/inline-citation.tsx`, `registry/ai/model-selector.tsx`,
`tests/browser/ai/inline-citation.test.tsx`, `tests/browser/ai/model-selector.test.tsx`,
`app/preview/inline-citation/page.tsx`, `app/preview/model-selector/page.tsx`.
`tests/browser/qa-round1/code-context-model-citation.test.tsx` was only read (the code-block/context
fixer deletes it).

## Fixed

### inline-citation

- code-context-model-citation:F3 (high) — a source that is not an absolute URL no longer throws from
  render: `sourceLabel()` uses `URL.canParse` (present in the TS 7 `lib.dom`, Node 24 and Chromium)
  and falls back to the raw string, also when the URL has no host (`mailto:`) —
  `registry/ai/inline-citation.tsx:64-67` — test: `tests/browser/ai/inline-citation.test.tsx` ›
  "InlineCitationCardTrigger › shows a source that is not an absolute URL as given instead of
  throwing" (failed before: `expected "vi.fn()" to not be called at all, but actually been called
  1 times [TypeError: Failed to construct 'URL': Invalid URL]`; passes after).
- code-context-model-citation:F4 (medium) / rendered-surface:F5 (high) — the badge is a real
  control: `HoverCardTrigger render={<Badge render={<button type="button" />} …/>}`. Tab reaches
  it, Base UI's focus path opens the card, Escape closes it and focus stays on the badge; the
  accessible name is the badge text ("example.com +1") —
  `registry/ai/inline-citation.tsx:82-98` — test: "InlineCitationCardTrigger › is reachable by Tab,
  opens the card on focus and closes it on Escape" and "› is a button named after its sources and
  forwards Badge props" (failed before: `expected <body …> to be <span …>` for
  `document.activeElement` after Tab; passes after). The single-source `<a href>` variant was not
  used: a button never navigates away from the response and keeps one semantics for every count.
- code-context-model-citation:F8 (medium) — one `useCarouselSnap()` hook feeds the index and the
  prev/next buttons and listens to embla `select`, `reInit` and `slidesChanged`, unsubscribing all
  three — `registry/ai/inline-citation.tsx:133-160` — test: "InlineCitationCarouselIndex › updates
  when slides are added or removed" (failed before: `Expected element to have text content: 1/3 /
  Received: 1/2`; passes after, also 3 → 1 slide).
- code-context-model-citation:F11 (low) — `current` is 0 when `scrollSnapList()` is empty, so the
  index reads `0/0` — `registry/ai/inline-citation.tsx:149` — test: "InlineCitationCarouselIndex ›
  shows 0/0 with no slides" (failed before: `expected '1/0' not to be '1/0'`; passes after).
- brief item 5 — `InlineCitationSource` renders nothing when it has no title/url/description/children
  (empty strings included) and `InlineCitationQuote` renders nothing when empty, so no empty
  `<div>`/`<blockquote>` is left in a slide — `registry/ai/inline-citation.tsx:324-341,363-372` —
  tests: "InlineCitationSource › renders nothing without content", "InlineCitationQuote › renders
  nothing when empty" (before: the QA pin asserted an empty `<blockquote>` was rendered).
- rendered-surface:F20 (nit; coordinator note) — the carousel has a visible end state: Prev/Next are
  natively `disabled` at the first/last slide (embla `canScrollPrev/Next`, the same signal the
  base-nova `CarouselPrevious/Next` use) and get `disabled:opacity-50`; with `opts={{ loop: true }}`
  embla reports both as scrollable, so the buttons stay enabled and the index wraps, which keeps
  index and buttons consistent in both modes — `registry/ai/inline-citation.tsx:281,310` — tests:
  "InlineCitationCarouselNext › is disabled on the last slide so the carousel has a visible end",
  "InlineCitationCarouselPrev › is disabled on the first slide and with a single slide",
  "InlineCitationCarousel › keeps both controls enabled and wraps when opts.loop is set" (before:
  the QA pin "prev/next stop at the bounds without wrapping" documented `nextDisabled: false`).
- inherited upstream bug found while porting — `InlineCitationCarousel` spread `{...props}` after
  its own `setApi`, so a consumer `setApi` replaced the internal one and Index/Prev/Next went dead.
  Both are now called — `registry/ai/inline-citation.tsx:171-187` — test: "InlineCitationCarousel ›
  passes setApi through and still tracks the index".
- WCAG 2.5.8 (surfaced by `expectNoViolations`, which enables `target-size`) — Prev/Next were 16 px
  targets; they now have a 24 px hit area (`size-6`, icon unchanged, header height unchanged since
  the index row was already 24 px) and a `focus-visible:ring-3` ring —
  `registry/ai/inline-citation.tsx:257-260` — test: "InlineCitationCarouselNext › has a 24px hit area
  and a visible focus ring"; every composition test now passes axe with the card open.
- typing — `InlineCitationCardBodyProps` is `ComponentProps<typeof HoverCardContent>` instead of
  `ComponentProps<"div">`, so `side`/`align`/`sideOffset`/`alignOffset` type-check (they were always
  forwarded at runtime) — `registry/ai/inline-citation.tsx:101-103` — test: "InlineCitationCardBody
  › merges className and forwards side and align to the positioner".

### model-selector

- code-context-model-citation:F9 (medium) — port-level fix, no `command` fork: `ModelSelectorList`
  renders the cmdk listbox followed by a `<div aria-live="polite" data-slot="model-selector-empty">`
  and shares it by context; `ModelSelectorEmpty` portals cmdk's `Empty` into it when it is composed
  inside the list (in place otherwise). The message is no longer a child of the listbox (axe
  `aria-required-children` passes) and screen readers announce "No models found." — the upstream
  composition `<ModelSelectorList><ModelSelectorEmpty/>…` is unchanged —
  `registry/ai/model-selector.tsx:104-133` — tests: `tests/browser/ai/model-selector.test.tsx` ›
  "ModelSelectorList › renders the empty state outside the listbox in a polite live region",
  "ModelSelectorEmpty › shows when the search matches nothing and passes axe", "› shows with no
  items at all and passes axe", "› renders in place when used outside ModelSelectorList" (failed
  before: `aria-required-children: <div data-slot="command-list" … role="listbox"
  aria-label="Suggestions" …>`; passes after).
- new, same rule (critical) — `ModelSelectorSeparator` inside the list was also an
  `aria-required-children` violation: cmdk forces `role="separator"`, which a listbox may not own.
  The preview page and upstream's own example compose it that way. The divider is decorative (the
  groups around it have headings), so it is wrapped in `aria-hidden="true"`; cmdk still hides it
  while a search is active — `registry/ai/model-selector.tsx:156-165` — tests: "ModelSelectorSeparator
  › renders a decorative separator between items and hides it while searching", "integration tests ›
  renders shortcuts and Anthropic group" (failed before: `[critical] aria-required-children … Element
  has children which are not allowed: [role=separator]`; passes after).
- code-context-model-citation:F15 (low) — `ModelSelectorLogo` is decorative by default
  (`alt=""`, `aria-hidden="true"`), so option and trigger names are the model name only; an `alt`
  prop makes it an accessible image again; `aria-hidden`/`hidden` sit before `{...props}` so they
  stay overridable — `registry/ai/model-selector.tsx:227-258` — tests: "ModelSelectorLogo › renders a
  decorative logo image with the models.dev source", "› becomes an accessible image when alt is
  given", "› keeps option and trigger names to the model name".
- rendered-surface:F13 (low, partial) — an unknown provider no longer shows a broken-image glyph:
  `onError` records the failed provider and the `<img>` gets `hidden` (state resets when `provider`
  changes); the consumer's `onError` still fires — `registry/ai/model-selector.tsx:244-256` — test:
  "ModelSelectorLogo › hides itself when the provider has no logo and still calls onError". The
  runtime dependency on `https://models.dev` itself is upstream design; it is now named in `docs`.
- rendered-surface:F21 (nit; coordinator note) — `ModelSelectorContent` gives cmdk a whole-term
  filter: every whitespace-separated term of the query must appear verbatim (case-insensitive) in
  the item value or its `keywords`; "opus" no longer matches "anthropic/claude-sonnet-4". Score is
  1/0 so the consumer's group and item order is kept. New optional props `filter` (any cmdk filter,
  e.g. `defaultFilter` from "cmdk" to restore fuzzy matching) and `shouldFilter` pass through —
  `registry/ai/model-selector.tsx:39-84` — tests: "ModelSelectorContent › filters by whole terms
  instead of scattered letters", "› matches item keywords", "› accepts a custom filter", "› leaves
  items alone with shouldFilter={false}". The preview passes `keywords={[model.name, model.provider]}`.
- brief item 3 — pinned: dialog named "Model Selector" by default and by `title`; `ModelSelectorDialog`
  named by the base-nova `CommandDialog` title ("Command Palette" / `title`); Escape closes with
  `reason: "escape-key"` and focus returns to the trigger; outside press closes with
  `reason: "outside-press"`; controlled `open` round-trips; `defaultOpen`; `initialFocus={false}`
  keeps focus on the trigger — tests under "ModelSelector", "ModelSelectorContent", "ModelSelectorDialog".
- brief item 4 — the preview compiles under the strict flags: `useState(allModels[0]?.id)` —
  `app/preview/model-selector/page.tsx:69` (was `TS2532: Object is possibly 'undefined'`).
- `"use client"` added to `registry/ai/model-selector.tsx:3` (Logo/List/Empty now use hooks). In
  practice the item was already client-only (every wrapper it composes is), but a consumer could
  previously render `ModelSelectorLogo` from a server component; documented in `docs`.

## Not fixed and why

- rendered-surface:F13 (runtime fetch from models.dev) — kept as upstream designed it; the type
  omits `src` on purpose. Adding a `src`/offline override is an API decision for the lead; the
  broken-glyph half is fixed and the dependency is now in `docs`.
- Touch: Base UI's PreviewCard opens on hover (mouse only) or `:focus-visible`; a tap on the badge
  does not open it. Upstream (Radix HoverCard) has the same limitation. Out of scope for this round;
  a controlled `open` plus `onClick` toggle would be the consumer-side workaround.
- `InlineCitationCarouselPrev/Next` ignore custom `children` (the explicit icon child wins over
  `props.children`) — upstream identical; kept, noted in coverage.
- `Carousel` wrapper leak (`components/ui/carousel.tsx:95-104` subscribes `reInit` but only
  unsubscribes `select`) — not my file; harmless today because embla `destroy()` clears listeners.
  Listed under requests.
- `URL.canParse` was preferred over try/catch per the brief; it is in the installed TS lib and every
  current browser. If the lead wants pre-2023 browser support, `sourceLabel()` is the single place
  to swap in a try/catch.

## Tests

- `tests/browser/ai/inline-citation.test.tsx`: 1 test before → 49 after. Upstream tests ported: 25 of
  26 (skipped: "inlineCitationCarouselIndex › renders index component" — it passes `count`/`current`
  as DOM attributes the component has no props for). QA reproducers/pins migrated and renamed: 7
  (relative URL, index on add, index 0/0, badge keyboard, bounds → disabled state, trigger text
  unknown/host/+N, source fields as paragraph). New: controlled/`defaultOpen`, hover open/close,
  `delay`/`closeDelay` timing (real timers: upstream uses none for this component and the 400 ms
  delays are checked immediately after the event, then polled), Badge prop forwarding, body
  `side`/`align`, `setApi`, `opts.loop`, slide roles, 24 px hit area, `Source`/`Quote` empty,
  composition axe closed/open/last slide/single source, and one under `withDark`.
- `tests/browser/ai/model-selector.test.tsx`: 1 → 58. Upstream tests ported: 40 of 40 (logo tests
  adapted from `getByAltText` to `alt=""` + `src`; `aria-describedby="test-description"` dropped
  because Base UI has no Radix description warning; `ModelSelectorDialog` asserts the dialog name
  too). QA reproducers/pins migrated: 4 (Escape/focus/reason, filter + empty state, value unchanged +
  ArrowDown/Enter, empty state passes axe). New: outside press, `defaultOpen`, `render` trigger,
  custom `title`, `initialFocus`, whole-term filter/keywords/custom filter/`shouldFilter`, live
  region, empty outside list, group role name, disabled item not selectable, separator decorative
  and hidden while searching, input group taller than 32 px, logo `alt`/`onError`/name, axe in the
  open, closed, no-match and empty states, and one under `withDark`.
- Mutation checks (each breaks one fix in the component source, runs the named test with `-t`,
  restores the file; all caught):

```
CAUGHT  | F3 relative URL guard        | -t "shows a source that is not an absolute URL as given" | 1 failed | 48 skipped
CAUGHT  | F4 button trigger            | -t "is reachable by Tab, opens the card on focus" | 1 failed | 48 skipped
CAUGHT  | F8 reInit/slidesChanged      | -t "updates when slides are added or removed" | 1 failed | 48 skipped
CAUGHT  | F11 0/0                      | -t "shows 0/0 with no slides" | 1 failed | 48 skipped
CAUGHT  | Quote empty                  | -t "renders nothing when empty" | 1 failed | 48 skipped
CAUGHT  | Source empty                 | -t "renders nothing without content" | 1 failed | 48 skipped
CAUGHT  | F20 Next disabled at end     | -t "is disabled on the last slide" | 1 failed | 48 skipped
CAUGHT  | F20 Prev disabled at start   | -t "is disabled on the first slide" | 1 failed | 48 skipped
CAUGHT  | setApi passthrough           | -t "passes setApi through" | 1 failed | 48 skipped
CAUGHT  | 24px hit area                | -t "has a 24px hit area" | 1 failed | 48 skipped
CAUGHT  | F9 empty state portal        | -t "renders the empty state outside the listbox|shows when the search matches nothing and passes axe" | 2 failed | 56 skipped
CAUGHT  | F15 alt pollution            | -t "renders a decorative logo image|keeps option and trigger names" | 1 failed | 1 passed | 56 skipped
CAUGHT  | F15 hide on error            | -t "hides itself when the provider has no logo" | 1 failed | 57 skipped
CAUGHT  | F21 whole-term filter        | -t "filters by whole terms" | 1 failed | 57 skipped
CAUGHT  | shouldFilter passthrough     | -t "leaves items alone with shouldFilter" | 1 failed | 57 skipped
CAUGHT  | separator decorative         | -t "renders a decorative separator|renders shortcuts and Anthropic group" | 2 failed | 56 skipped
CAUGHT  | dialog title default         | -t "names the dialog Model Selector by default" | 1 failed | 57 skipped
CAUGHT  | F15 alt + aria-hidden together | -t "keeps option and trigger names|renders a decorative logo image" | 1 failed | 1 passed | 56 skipped
```
  The last line showed that "keeps option and trigger names to the model name" alone passed for the
  wrong reason (the logo request fails in the test browser, the image hides itself and drops out of
  the name), so that test now also asserts `alt=""`/`aria-hidden` on the logo inside the trigger and
  the option; the decorative-logo test is the primary guard. Sources were restored byte-identical
  (`cmp` against the backup) after every mutation.

- Three consecutive runs after the last edit of each file:
  - inline-citation: `Tests 49 passed (49)` / `49 passed` / `49 passed` (6.6 s, 6.1 s, 6.0 s)
  - model-selector: `Tests 58 passed (58)` / `58 passed` / `58 passed` (5.9 s, 7.6 s, 7.8 s)
- QA reproducer file after the fixes (`-t "model-selector|inline-citation"`): the 5 reproducers that
  failed before pass; 2 pins now fail because the behaviour changed on purpose — "prev/next stop at
  the bounds without wrapping" (Previous is disabled at 1/2, Playwright refuses to click it) and
  "source renders only the fields it is given…" (`getByTestId("quote")`: an empty quote renders
  nothing). Both are replaced in the canonical file; the code-block/context fixer deletes the QA file.
- `pnpm exec prettier --check` and `pnpm exec biome check` are clean on all six files.
- `pnpm registry:validate`: "Registry is valid."
- Rendered: `/preview/inline-citation` and `/preview/model-selector` return 200 from the running dev
  server; the SSR HTML shows `<button type="button" data-slot="hover-card-trigger" …>ai-sdk.dev +1`
  and `<img aria-hidden="true" alt="" … src="https://models.dev/logos/openai.svg">`.

## Registry entry changes (exact strings for registry.json; the registry owner applies them)

- inline-citation › docs: "Base UI Preview Card puts hover delays on the trigger, not the root: InlineCitationCard no longer accepts openDelay/closeDelay; pass delay/closeDelay to InlineCitationCardTrigger instead (both default 0). InlineCitationCardTrigger composes HoverCardTrigger via render={<Badge render={<button type=\"button\" />} />} (no asChild): the badge is a real button, so it is in the Tab order and focus opens the card; remaining props still go to the Badge. A source that is not an absolute URL (relative path, bare host) is shown as given instead of throwing. InlineCitationCardBody is typed as the hover-card content props, so side/align/sideOffset/alignOffset type-check. InlineCitationCarouselPrev/Next are disabled at the first/last slide unless opts={{ loop: true }}, and have a 24px hit area and a focus ring; InlineCitationCarouselIndex follows slides added while streaming and reads 0/0 with none. A setApi passed to InlineCitationCarousel is called alongside the internal one. InlineCitationSource and InlineCitationQuote render nothing when they have no content. InlineCitationSource renders its title as <p> instead of <h4> so a hover card never breaks the page's heading order. InlineCitationCarouselIndex uses text-secondary-foreground on the bg-secondary header for AA contrast."
- inline-citation › description: unchanged.
- model-selector › docs: "Base UI Dialog: ModelSelectorTrigger takes render={<Button />} instead of asChild, and ModelSelector's onOpenChange receives (open, eventDetails). ModelSelectorContent is the Base UI Dialog Popup, so initialFocus/finalFocus replace onOpenAutoFocus/onCloseAutoFocus. ModelSelectorContent filters by whole terms (every whitespace-separated term of the query must appear in the item value or its keywords, case-insensitive) instead of cmdk's fuzzy match; pass filter (for example defaultFilter from \"cmdk\") or shouldFilter={false} to change that, and give ModelSelectorItem keywords for names that differ from the value. ModelSelectorEmpty placed inside ModelSelectorList renders after the listbox in a polite live region, and ModelSelectorSeparator is decorative (aria-hidden), because a listbox may not own a message or a separator. ModelSelectorLogo is decorative (alt=\"\", aria-hidden) unless you pass alt, loads from https://models.dev at runtime and hides itself when the provider has no logo there (onError still fires). ModelSelectorDialog wraps the base-nova CommandDialog (title, description, className, showCloseButton). The base-nova command input is an InputGroup with a forced h-8, so ModelSelectorContent also sets **:data-[slot=input-group]:h-auto! to keep upstream's taller py-3.5 input. The file is a client module (\"use client\")."
- model-selector › description: "Searchable model picker for AI chat: a dialog opened from any trigger that hosts a cmdk command palette with a whole-term search input, grouped items, separators, keyboard-shortcut hints, an announced empty state, and decorative provider logos from models.dev (ModelSelectorLogo, ModelSelectorLogoGroup, ModelSelectorName). Use to switch the model behind a conversation or prompt input."
- dependencies: unchanged for both (no new packages; `react-dom` is already a peer of every consumer).

## Requests for other owners

- `components/ui/command.tsx` (vendored base-nova `command`; fork proposal, not applied): the same
  two axe `aria-required-children` violations hit every consumer of the shadcn `command` item, not
  only this port. (1) `CommandEmpty` inside `CommandList`: have `CommandList` render
  `<CommandPrimitive.List …/>` followed by `<div aria-live="polite" data-slot="command-empty-slot" ref={setSlot}/>`,
  provide the slot by context and let `CommandEmpty` `createPortal` into it (the pattern in
  `registry/ai/model-selector.tsx:104-133`). (2) `CommandSeparator` inside `CommandList`: wrap in
  `aria-hidden="true"` (cmdk forces `role="separator"`). Also, cmdk renders an empty `<label cmdk-label>`
  unless `Command` gets `label`, so the combobox input is named only by its placeholder; consider
  forwarding `label` (and `CommandDialog`'s `title`) to `CommandPrimitive`.
- `components/ui/carousel.tsx:95-104`: the effect subscribes `reInit` and `select` but the cleanup
  only `off`s `select`; add `api.off("reInit", onSelect)`.
- `registry/ai/registry.json`: apply the strings above (inline-citation docs, model-selector docs and
  description).
- `tests/browser/qa-round1/code-context-model-citation.test.tsx` (code-block/context fixer): the
  model-selector and inline-citation `describe`s are fully migrated; delete the file when yours are.
- `AGENTS.md` / `docs/porting-ai-elements.md` (doc owner): one rule worth adding under "Rules for
  registry work": cmdk's `CommandEmpty` and `CommandSeparator` may not be listbox children (axe
  `aria-required-children`); render the empty state in a live region after the list and mark
  separators `aria-hidden` (see `model-selector`).

## Strict-flag typecheck

`pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`

- Errors remaining in files I own: none (before: `app/preview/model-selector/page.tsx(69,48): TS2532`).
- Errors in files I do not own (from the same run, path:line):

```
components/ui/scroll-area.tsx(5,13) — TS6133: 'React' is declared but its value is never read.
tests/browser/ai/branch.test.tsx(291,40) — TS2353: Object literal may only specify known properties, and '"data-testid"' does not exist in type 'HTMLAttributes<HTMLDivElement>'.
tests/browser/ai/code-block.test.tsx(930,11) — TS6133: 'screen' is declared but its value is never read.
tests/browser/ai/context.test.tsx(282,20) — TS2322: Type 'number | undefined' is not assignable to type 'number'.
tests/browser/ai/context.test.tsx(282,42) — TS2322: Type 'number | undefined' is not assignable to type 'number'.
tests/browser/ai/context.test.tsx(394,20) — TS2554: Expected 0 arguments, but got 1.
tests/browser/ai/context.test.tsx(400,30) — TS2554: Expected 0 arguments, but got 1.
tests/browser/ai/prompt-input.test.tsx(39,8) — TS6133: 'PromptInputMessage' is declared but its value is never read.
tests/browser/ai/prompt-input.test.tsx(2898,42) — TS2551: Property 'click' does not exist on type 'HTMLElement | SVGElement'. Did you mean 'onclick'?
tests/browser/ai/prompt-input.test.tsx(2903,42) — TS2551: Property 'click' does not exist on type 'HTMLElement | SVGElement'. Did you mean 'onclick'?
tests/browser/qa-round1/chat-block-and-leaves.test.tsx(1169,43) — TS2379: Argument of type '{ name: string | undefined; }' is not assignable to parameter of type 'LocatorByRoleOptions' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
tests/browser/qa-round1/chat-block-and-leaves.test.tsx(1177,45) — TS2379: Argument of type '{ name: string | undefined; }' is not assignable to parameter of type 'LocatorByRoleOptions' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
tests/browser/qa-round1/chat-block-and-leaves.test.tsx(1219,10) — TS2741: Property 'alt' is missing in type '{ base64: string; uint8Array: Uint8Array<ArrayBuffer>; mediaType: string; providerMetadata: { openai: { revisedPrompt: string; }; }; }' but required in type '{ className?: string | undefined; alt: string; }'.
tests/browser/qa-round1/prompt-input.test.tsx(234,16) — TS2375: Type '{ "aria-label": string; tooltip: string | undefined; }' is not assignable to type '{ tooltip?: PromptInputButtonTooltip; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
tests/browser/qa-round1/prompt-input.test.tsx(250,31) — TS2532: Object is possibly 'undefined'.
tests/browser/qa-round1/prompt-input.test.tsx(272,12) — TS2375: Type '{ onStop: (() => void) | undefined; status: "error" | "ready" | "streaming" | "submitted" | undefined; }' is not assignable to type '{ status?: ChatStatus; onStop?: () => void; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
```

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>

# before: QA reproducers for my sections (5 failed, 6 passed)
pnpm exec vitest run --project browser tests/browser/qa-round1/code-context-model-citation.test.tsx -t "model-selector|inline-citation"
# after the component fixes: 9 passed, 2 pins fail by design (see Tests)

# format / lint / strict types on owned files only
pnpm exec prettier --write registry/ai/model-selector.tsx registry/ai/inline-citation.tsx app/preview/model-selector/page.tsx app/preview/inline-citation/page.tsx tests/browser/ai/model-selector.test.tsx tests/browser/ai/inline-citation.test.tsx
pnpm exec biome check registry/ai/model-selector.tsx registry/ai/inline-citation.tsx app/preview/model-selector/page.tsx app/preview/inline-citation/page.tsx tests/browser/ai/model-selector.test.tsx tests/browser/ai/inline-citation.test.tsx
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals

# canonical tests, three times each
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/ai/inline-citation.test.tsx; done
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/ai/model-selector.test.tsx; done

# mutation checks (python driver in the session log; each: patch source → vitest -t "<name>" → restore → cmp)

pnpm registry:validate
curl -s http://localhost:3000/preview/inline-citation | grep -o '<button[^>]*hover-card-trigger[^>]*>[^<]*'
curl -s http://localhost:3000/preview/model-selector | grep -o '<img[^>]*models.dev[^>]*>'
```
