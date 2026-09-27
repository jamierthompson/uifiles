# code-context-model-citation — QA round 1

## Summary

Attacked `registry/ai/{code-block,context,model-selector,inline-citation}.tsx` against their upstream
AI Elements sources (commit 6a9d5b1), the base-nova wrappers they compose, and the installed
shiki 4.4.3 / tokenlens 1.3.1 / ai 7.0.114 / Base UI 1.8.0 / cmdk 1.1.1 / embla 8.6.0 contracts.
17 findings: 3 high, 7 medium, 5 low, 2 nit. 10 reproducer tests fail today, 15 pins pass
(`tests/browser/qa-round1/code-context-model-citation.test.tsx`). The port itself is faithful
(no `asChild`, no Radix data attributes, every `docs` API claim type-checks); most bugs are
inherited from upstream and were ported verbatim. Worst: `CodeBlock`'s token cache is keyed on
`length + first 100 + last 100 chars`, so editing the middle of a snippet renders the OLD code
(the copy button copies the new one). Close behind: any long line makes the code block an
unfocusable scroll region (axe `scrollable-region-focusable`, serious), and one relative/malformed
citation URL throws from render and takes the whole message tree down.

## Findings (most severe first)

### F1. CodeBlock renders stale code when a snippet changes only in the middle — severity: high
- Where: `registry/ai/code-block.tsx:144-148` (`getTokensCacheKey`), `:191-197`, `:394-397`
- What: the token cache key is `${language}:${code.length}:${code.slice(0,100)}:${code.slice(-100)}`.
  Two codes with the same length and the same first/last 100 characters share a key, so
  `highlightCode(codeB)` returns codeA's cached tokens and never subscribes the callback (cache hit
  returns before `subscribers` is touched). Render `<CodeBlock code={A}/>`, let it highlight, rerender
  with `B` (same length, different middle) → the DOM still shows A. `CodeBlockCopyButton` reads
  `code` from context, so the user sees A and copies B.
- Evidence: reproducer output:
  `AssertionError: expected 'aaaa…' to contain 'middle = 2'` / `Received: "aaaa…const middle = 1zzzz…"`.
- Why it matters: wrong code displayed to the user. Hits any >200-char snippet regenerated or edited
  in place (streamed answers that change a value, tool inputs re-run with one arg changed).
- Proposed fix: key the cache on the full code (a Map keyed by the string is fine; the 100-char
  slicing saves nothing) or hash it; drop the "cached → return early" path from bypassing the callback.
- Test written: `… › code-block › "FAILS TODAY: shows the new code when only the middle of a snippet changes (token cache key collision)"` (expected: FAIL now)

### F2. Overflowing code block is not keyboard-reachable (axe `scrollable-region-focusable`, serious) — severity: high
- Where: `registry/ai/code-block.tsx:429` (`<div className="relative overflow-auto">`)
- What: `CodeBlockContent` scrolls horizontally for any line wider than its container, but the
  scroller has no `tabIndex` and no focusable descendant. Render a 400-char line in a 240px-wide
  `<main>` → axe reports `scrollable-region-focusable`. The repo's own commit c9b0d6b fixed exactly
  this for `response` (Streamdown bodies) but not for `code-block` itself; the code-block preview's
  samples are short, so the Playwright axe run never sees it at desktop width. At phone width the
  77-char lines in `app/preview/code-block/page.tsx` overflow.
- Evidence: reproducer output: `expected [ 'scrollable-region-focusable' ] to deeply equal []`.
- Why it matters: WCAG 2.1.1; keyboard users cannot scroll long lines. Directory-listing risk if
  reviewers run axe on a narrow viewport.
- Proposed fix: same approach as `response.tsx` (`tabIndex=0` when `scrollWidth > clientWidth`, plus
  an accessible name such as `aria-label="Code"` / `role="region"`), or always `tabIndex={0}`.
- Test written: `… › code-block › "FAILS TODAY: an overflowing code block is keyboard-focusable (axe scrollable-region-focusable)"` (expected: FAIL now)

### F3. `InlineCitationCardTrigger` throws from render for a relative or malformed source URL — severity: high
- Where: `registry/ai/inline-citation.tsx:84` (`new URL(sources[0]).hostname`)
- What: `sources={["/docs/streaming"]}` (or `"example.com"`, `"not a url"`) → `TypeError: Failed to
  construct 'URL': Invalid URL` thrown during render. Without an error boundary the whole message
  tree unmounts. Upstream identical; ported verbatim.
- Evidence: reproducer output: `1st vi.fn() call: [TypeError: Failed to construct 'URL': Invalid URL]`
  (caught by the test's error boundary).
- Why it matters: citation URLs come from model output / search tools and are frequently relative or
  scheme-less. One bad string crashes the response.
- Proposed fix: `URL.canParse(sources[0]) ? new URL(sources[0]).hostname : sources[0]` (or try/catch).
- Test written: `… › inline-citation › "FAILS TODAY: a relative source URL does not crash the render"` (expected: FAIL now)

### F4. Citation badge is unreachable by keyboard, so the source card never opens for keyboard/AT users — severity: medium
- Where: `registry/ai/inline-citation.tsx:71-81`; Base UI `node_modules/@base-ui/react/preview-card/trigger/PreviewCardTrigger.js:59-73,79`
- What: Base UI's `PreviewCard.Trigger` opens on hover (`mouseOnly: true`) and on focus (`useFocus`),
  but it renders whatever `render` gives it and adds no `tabIndex`. `render={<Badge/>}` yields a
  `<span>`, so Tab skips it: after `userEvent.tab()` from a preceding button `document.activeElement`
  is `<body>`, and the card never opens. Radix upstream was mouse-only by design too, but Base UI
  supports focus-open for free if the trigger is focusable; the `docs` string advertises the Base UI
  behaviour without delivering it.
- Evidence: reproducer output: `expected <body …> to be <span …>` (activeElement after Tab).
- Why it matters: WCAG 2.1.1 / 4.1.2; sources are unreachable without a mouse.
- Proposed fix: render the trigger as a real control (`render={<Badge render={<button type="button" />} />}`
  or an `<a href={sources[0]}>`), which also gives it a role; then Base UI's focus path works.
- Test written: `… › inline-citation › "FAILS TODAY: the citation badge is reachable by keyboard and opens the card on focus"` (expected: FAIL now)

### F5. `ContextReasoningUsage` always prices reasoning at `$0.00`; total cost ignores cache and reasoning — severity: medium
- Where: `registry/ai/context.tsx:373-377` (`getUsage({ usage: { reasoningTokens } })`), `:223-231` (footer), `:292-297` (input row)
- What: tokenlens' `getUsage` does not price a `reasoningTokens`-only usage:
  `getUsage({modelId:"openai:gpt-4o", usage:{reasoningTokens:1000}}).costUSD` →
  `{"inputUSD":0,"outputUSD":0,"totalUSD":0,…}` (node probe). So the Reasoning row renders
  `Reasoning 6K • $0.00` for every model. Related inconsistencies in the same component:
  `ContextContentFooter` sums input+output only (the Cache row's `$0.03` and any reasoning cost are
  not in "Total cost"), and `ContextInputUsage` prices all 62K input tokens at the full rate although
  20K of them are cache reads that the Cache row prices again. Observed text:
  `Input 62K• $0.16 Output 18K• $0.18 Reasoning 6K• $0.00 Cache 20K• $0.03 Total cost $0.33`.
  Upstream identical.
- Evidence: reproducer output: `expected 'Reasoning6K• $0.00' not to contain '$0.00'`; node probe in
  "Commands run".
- Why it matters: the component's whole purpose is a cost readout; `$0.00` next to 6K reasoning
  tokens is a wrong number, not a missing one.
- Proposed fix: price reasoning as output (`usage: { input: 0, output: reasoningTokens }`), and make
  the footer the sum of the rows (or pass the full usage incl. `cacheReads` once).
- Test written: `… › context › "FAILS TODAY: reasoning tokens are priced instead of always $0.00"` (expected: FAIL now)

### F6. Shiki's dual-theme `bg`/`fg` strings are discarded, so the theme background never applies and `dark:!bg-[var(--shiki-dark-bg)]` is dead — severity: medium
- Where: `registry/ai/code-block.tsx:213-225,257-263,271-277`; shiki: `codeToTokens(…, { themes })` returns
  `bg: "#ffffff;--shiki-dark-bg:#0a0c10"`, `fg: "#0e1116;--shiki-dark:#f0f3f6"` (node probe, shiki 4.4.3).
- What: `preStyle = { backgroundColor: tokenized.bg, color: tokenized.fg }` hands the combined string to
  React, which assigns `style.backgroundColor = "#ffffff;--shiki-dark-bg:#0a0c10"`; the CSSOM rejects it
  silently (React's dev warning only matches a trailing semicolon, `badStyleValueWithSemicolonPattern =
  /;\s*$/`), so the `<pre>` keeps the raw-token `transparent`/`inherit`. Computed `backgroundColor` after
  highlighting is `rgba(0, 0, 0, 0)`, `--shiki-dark-bg` is never set on the `pre`, and the
  `dark:!bg-[var(--shiki-dark-bg)]` / `dark:!text-[var(--shiki-dark)]` classes on `<pre>` resolve to
  `initial`/`inherit`. Tokens are fine (their `htmlStyle` sets `--shiki-dark` per span). Net: code renders
  on the consumer's `bg-background`, not on the theme background the high-contrast themes were tuned
  against (`#ffffff` / `#0a0c10`). In this repo light `--background` is `oklch(1 0 0)` so it is invisible;
  dark is `oklch(0.145 0 0)` vs `#0a0c10`; any consumer with a tinted background gets untested contrast.
  Upstream identical. The `docs`/commit a506687 contrast claim is therefore "tokens on whatever the
  page background is".
- Evidence: reproducer output: `expected 'rgba(0, 0, 0, 0)' to be 'rgb(255, 255, 255)'`; shiki node probe.
- Proposed fix: split on `;` — `const [bg, ...vars] = result.bg.split(";")` and set the custom
  properties via `style` keys (`"--shiki-dark-bg": …`), or use `codeToTokens` with a single theme
  per colour scheme.
- Test written: `… › code-block › "FAILS TODAY: applies the shiki theme background and dark-theme variable to the pre"` (expected: FAIL now)

### F7. `Context` renders `NaN%` / `∞%` when `maxTokens` is 0 — severity: medium
- Where: `registry/ai/context.tsx:70,118-122,169-173,194`
- What: `usedTokens / maxTokens` with `maxTokens = 0` → `NaN` (0/0) or `Infinity`; `Intl.NumberFormat`
  formats them as `"NaN%"` and `"∞%"` (node probe). The trigger, the header `<p>` and the icon ring all
  show it. Base UI Progress treats a non-finite value as indeterminate (`ProgressRoot.js:50`), so the
  bar is fine and no axe violation follows, but the visible text is garbage. `maxTokens` is 0/undefined
  in the common "model metadata not loaded yet" state of a chat toolbar.
- Evidence: reproducer output: `expected 'NaN%' not to match /NaN|∞/`.
- Proposed fix: `const usedPercent = maxTokens > 0 ? usedTokens / maxTokens : 0` in one helper used by
  all four call sites.
- Test written: `… › context › "FAILS TODAY: maxTokens=0 does not render NaN% in the trigger"` (expected: FAIL now)

### F8. `InlineCitationCarouselIndex` count goes stale when slides are added or removed — severity: medium
- Where: `registry/ai/inline-citation.tsx:179-191` (listens to `select` only)
- What: embla re-initialises on slide DOM changes (`watchSlides`, default on) and emits `reInit` /
  `slidesChanged` (`embla-carousel/components/EventHandler.d.ts:8,14`), never `select`. Rendering 2
  slides then rerendering with 3 leaves the index at `1/2`. Sources that arrive incrementally while a
  response streams hit this. Upstream identical.
- Evidence: reproducer output: `Expected element to have text content: 1/3 / Received: 1/2`.
- Proposed fix: also subscribe to `reInit` (and `slidesChanged`) and `off` both in cleanup.
- Test written: `… › inline-citation › "FAILS TODAY: the carousel index updates when sources are added"` (expected: FAIL now)

### F9. Model selector's no-match/empty state fails axe `aria-required-children` (owner: base-nova `command` wrapper / cmdk, not the port) — severity: medium
- Where: `components/ui/command.tsx:88-101` (`CommandList` = cmdk list, `role="listbox"`); reached through
  `registry/ai/model-selector.tsx:76-86` every time a search matches nothing.
- What: with zero matching items the listbox's only child is the `cmdk-empty` div, so axe (4.13) flags
  the listbox: `aria-required-children: <div data-slot="command-list" … role="listbox" aria-label="Suggestions" …>`.
  The existing model-selector test never types a non-matching query, so it never sees this state.
- Evidence: reproducer output (node HTML included in the assertion message above).
- Why it matters: every empty search result in the picker is an axe "serious" violation; reviewers who
  poke the search box will see it.
- Proposed fix (wrapper or port): render the empty message outside the listbox, or fork `command`
  and give the list `aria-busy`/remove `role="listbox"` when it has no options. Flagged for the
  `command` owner; the port can only work around it.
- Test written: `… › model-selector › "FAILS TODAY (command wrapper): the empty state shows and passes axe"` (expected: FAIL now)

### F10. `CodeBlockContent` tokenises every block twice per mount and stalls the main thread on big inputs — severity: medium
- Where: `registry/ai/code-block.tsx:394-397` (useMemo calls `highlightCode` without a callback) and
  `:412-424` (effect calls it again with a callback)
- What: both calls happen before the cache is populated (the highlighter is async), so each starts its
  own `getHighlighter(...).then(codeToTokens)`; the second result finds no subscribers and is thrown
  away. In React StrictMode dev that is 4 tokenisations per block. `codeToTokens` for a 10k-line
  TypeScript block takes ~4.1 s in node (probe below); the browser is comparable, on the main thread,
  with no chunking or worker. Upstream identical.
- Evidence: call sites `code-block.tsx:395,415`; `node … 10k lines ms: 4100`.
- Why it matters: a large tool output or file dump freezes the chat for seconds, twice.
- Proposed fix: make `highlightCode` dedupe in-flight work per key (a `pending` map next to
  `tokensCache`), and document/guard a line-count ceiling (fall back to raw tokens above N lines).
- Test written: none (timing-based; not deterministic in CI). Reading-level finding.

### F11. `InlineCitationCarouselIndex` shows `1/0` with no slides — severity: low
- Where: `registry/ai/inline-citation.tsx:175-176`
- What: `selectedScrollSnap() + 1` is 1 even when `scrollSnapList().length` is 0. A citation whose
  sources array is empty (the trigger renders "unknown") shows `1/0`.
- Evidence: reproducer output: `expected '1/0' not to be '1/0'`.
- Proposed fix: `setCurrent(count === 0 ? 0 : api.selectedScrollSnap() + 1)`.
- Test written: `… › inline-citation › "FAILS TODAY: the carousel index with no slides is not 1/0"` (expected: FAIL now)

### F12. `docs` for the language selector understates the type change: `onValueChange` receives `unknown`, not `string | null` — severity: low
- Where: `registry/ai/code-block.tsx:520-524`; `registry/ai/registry.json` code-block `docs`
- What: `CodeBlockLanguageSelectorProps = ComponentProps<typeof Select>` erases Base UI's `Select.Root`
  generic, so `onValueChange` is `(value: unknown, eventDetails) => void`. The docs say "widen state to
  `string | null` or guard null"; that alone does not compile:
  `onValueChange={(value) => setLang(value)}` with `useState<string | null>` →
  `TS2345: Argument of type 'unknown' is not assignable to parameter of type 'SetStateAction<string | null>'`.
  The preview page already has to cast (`value as Language`, `app/preview/code-block/page.tsx:95`).
- Evidence: scratch type-check `scratchpad/qa/round1/code-context-model-citation/typecheck/select-value.tsx`.
- Proposed fix: type the wrapper's `onValueChange` as `(value: string | null, details) => void` (or make
  `CodeBlockLanguageSelector` generic), and say "cast" in `docs`.
- Test written: none (type-level; scratch tsc in "Commands run").

### F13. Unknown language: no fallback to plain text, `console.error` on every render, rejected highlighter cached forever — severity: low
- Where: `registry/ai/code-block.tsx:158-164,208-243`
- What: `createHighlighter({ langs: ["brainfuck"] })` rejects (`Language \`brainfuck\` is not included in
  this bundle`); the rejected promise stays in `highlighterCache`, so every later `highlightCode` call for
  that language re-logs the error. The `langToUse … : "text"` fallback at `:211` is unreachable (it only
  runs after a successful load). Shiki accepts `langs: ["text"]` (special language, probe below), so a
  real fallback is one retry away. Raw text is shown, so the failure is loud (console) and non-fatal;
  `language: ""`/`undefined` cast from LLM fence info behaves the same.
- Evidence: pin test `"an unknown language falls back to plain text and reports the error"` (passes;
  documents the current behaviour) and the shiki node probe.
- Proposed fix: on rejection, retry with `langs: ["text"]` (or `bundledLanguages[language] ? … : "text"`
  up front) and drop the rejected promise from the cache.

### F14. Line-number gutter is narrower than four digits — severity: low (arithmetic, not measured)
- Where: `registry/ai/code-block.tsx:80-91` (`before:w-8`, `before:text-right`, `before:inline-block`)
- What: 32px box; four monospace digits at `text-sm` (14px × ~0.6em) are ~33.6px, so lines ≥ 1000 overflow
  the box, lose right-alignment against 3-digit numbers, and eat into the 16px `mr-4`.
- Proposed fix: `before:w-[calc(var(--digits,3)*1ch)]` with `--digits` from the line count, or `before:min-w-8`.
- Test written: none.

### F15. `ModelSelectorLogo`'s `alt="<provider> logo"` pollutes every option's and trigger's accessible name — severity: low
- Where: `registry/ai/model-selector.tsx:186`
- What: an option reads "openai logo GPT-4o" and the preview's trigger "openai logo GPT-4o …" to a screen
  reader; the existing test dodges it with a regex (`/Claude Sonnet 4/`). An unknown `provider` string
  also yields a broken `<img>` from `models.dev` with that alt text. Upstream identical.
- Proposed fix: `alt=""` (decorative) with the provider name available via `ModelSelectorName`, or make
  `alt` overridable.
- Test written: none.

### F16. code-block `description` names the wrong themes — severity: nit
- Where: `registry/ai/registry.json` code-block `description` ("rendered with shiki (github-light/github-dark …)")
- What: commit a506687 switched the code to `github-light-high-contrast`/`github-dark-high-contrast`
  (`code-block.tsx:160,216-217`) without updating the searchable description.

### F17. Hard-coded `en-US` number/currency formatting — severity: nit
- Where: `registry/ai/context.tsx:119,170,174,177,232,265,298,338,380,420`
- What: percent, compact and currency formatting ignore the document locale (upstream identical). Note
  for the description ("USD cost") rather than a bug.

## Coverage gaps (behaviours with no test today; no bug found, but untested)

Existing tests: `tests/browser/ai/{code-block,context,model-selector,inline-citation}.test.tsx` (3+2+1+1
tests). My file adds 15 passing pins. Per export, what remains untested:

### code-block
- `highlightCode` (exported) › direct API: callback invoked once per key, callback not invoked on cache hit, rejection path — why: it is public API; suggested: unit-style browser test with a unique language/code, count callbacks.
- `CodeBlock` › SSR/hydration parity — why: commit 3364e53 fixed a real mismatch and nothing guards it (browser tests never SSR; the e2e suite only checks axe). Suggested: Playwright test on `/preview/code-block` asserting the server HTML `<pre style="background-color:transparent;color:inherit">` and no hydration warning in console.
- `CodeBlock` › `\r\n` input: raw tokens keep the `\r` (split on `\n`), shiki strips it (probe: 3 lines, no CR token), so pre-highlight and post-highlight DOM differ in whitespace. Suggested: pin line count and absence of `\r` in text nodes after highlight.
- `CodeBlock` › trailing newline / tab characters / `showLineNumbers` counter values ≥ 10 — suggested: render 12 lines and read `getComputedStyle(span, "::before").content` is not resolvable; instead snapshot `code.querySelectorAll(":scope > span").length` and visual e2e screenshot.
- `CodeBlock` › code containing `<script>`: rendered via React text nodes (no `dangerouslySetInnerHTML` anywhere in the file), so it is safe; pin it so a future switch to `codeToHtml` cannot regress silently.
- `CodeBlock` › language change with the same code (`asyncKeyRef` invalidation) and unmount mid-highlight (`cancelled` flag) — no observable assertion exists; suggested: rerender `language="javascript"`→`"python"` and assert the `data-language` attribute plus a python-only token.
- `CodeBlockContainer` › `data-language`, `contentVisibility`/`containIntrinsicSize` style merge with a consumer `style` — untested.
- `CodeBlockHeader`, `CodeBlockTitle`, `CodeBlockFilename`, `CodeBlockActions` › className merge / children passthrough — untested (trivial but public).
- `CodeBlockContent` › standalone use (without `CodeBlock`) — untested.
- `CodeBlockCopyButton` › `onError` when `writeText` rejects; custom `children` replaces the icon (and then there is no "copied" feedback) — untested. My pins cover missing API and the copied-state guard/timeout.
- `CodeBlockLanguageSelector*` › keyboard operation (ArrowDown/Enter open and select), `null` value when `value` is cleared, `CodeBlockLanguageSelectorContent` `side/align` forwarding and `alignItemWithTrigger={false}` (the `docs` claim) — untested.

### context
- `Context` › `open`/`onOpenChange` controlled round trip with `(open, eventDetails)`; `defaultOpen`; unmount while open — untested (my pins use `defaultOpen` only).
- `ContextTrigger` › `delay`/`closeDelay` actually delay (e.g. `delay={300}` → not open after 100 ms) — untested; forwarding verified by reading only.
- `ContextTrigger` › Button props (`variant`, `size`, `className`) reach the default button; dropped when a custom child is given (upstream parity) — untested.
- `ContextIcon` (internal) › dash offset for 0 %, 100 %, >100 % — untested.
- `ContextContent` › `side`/`align` forwarding — untested.
- `ContextContentHeader` / `ContextContentBody` / `ContextContentFooter` › custom `children` replace the defaults — untested here (upstream had tests for each).
- `ContextInputUsage`/`ContextOutputUsage`/`ContextReasoningUsage`/`ContextCacheUsage` › custom `children` return path; `modelId` undefined → cost text `$0.00` still shown (arguably should be hidden) — untested.
- All `*Usage` rows › `usage` with `undefined` numeric fields (ai@7 types allow `number | undefined`) — pinned indirectly by "missing usage" only.

### model-selector
- `ModelSelector` › `open={true}` initial render; `onOpenChange` on outside press (`reason: "outside-press"`) — untested (Escape is pinned).
- `ModelSelectorTrigger` › `disabled`, `render` with a non-button element, native `nativeButton` handling — untested.
- `ModelSelectorContent` › `title` prop overrides the sr-only title; `showCloseButton` passthrough; `initialFocus`/`finalFocus` (the `docs` claim) — untested.
- `ModelSelectorDialog` › not rendered by any test or preview at all (wraps `CommandDialog`, whose sr-only title lives outside the popup).
- `ModelSelectorInput` › `className` merge and the `**:data-[slot=input-group]:h-auto!` override actually producing a taller input (`docs` claim) — untested; suggested: assert `getComputedStyle(inputGroup).height !== "32px"`.
- `ModelSelectorList`, `ModelSelectorGroup` (heading), `ModelSelectorSeparator`, `ModelSelectorShortcut` › rendered only in the preview; no assertions — suggested: role/label pins (`group` name = heading, `separator` role).
- `ModelSelectorItem` › `disabled` → `aria-disabled="true"` and not selectable; `keywords`; `data-checked` styling used by the preview — untested.
- `ModelSelectorLogo` › `src` URL shape and `width/height`; `ModelSelectorLogoGroup` › overlap classes; `ModelSelectorName` › truncation — untested.
- cmdk `shouldFilter={false}` / custom `filter` passthrough on `Command` (via `ModelSelectorContent`) — not exposed/tested.

### inline-citation
- `InlineCitation`, `InlineCitationText` › className merge, `group-hover:bg-accent` — untested.
- `InlineCitationCard` › controlled `open`/`onOpenChange` `(open, eventDetails)`; `defaultOpen` — untested.
- `InlineCitationCardTrigger` › `delay`/`closeDelay` timing; Badge props (`variant`, `className`) reach the badge — untested; forwarding verified by reading.
- `InlineCitationCardBody` › `side`/`align` forwarding; `data-open` styling — untested.
- `InlineCitationCarousel` › `opts` passthrough (e.g. `loop`), `setApi` consumer callback, unmount removes the `select` listener (no observable assertion) — untested.
- `InlineCitationCarouselContent`, `InlineCitationCarouselItem`, `InlineCitationCarouselHeader` › only exercised structurally — no assertions on `role="group"`/`aria-roledescription="slide"` from the wrapper.
- `InlineCitationCarouselPrev`/`Next` › custom `children`, `disabled` passthrough; they are never disabled at the bounds (wrapper's `CarouselPrevious` is) — my pin documents "no wrap", not the missing disabled state.
- `InlineCitationSource` › `children` alongside fields; long `url` truncation — untested.
- `InlineCitationQuote` › empty quote renders an empty blockquote (pinned tag only).
- Whole component › axe on the open card at the last slide and with a single source (preview's second citation) — only the first citation is axe-checked.

## Verified OK (claims you checked that hold; one line each, so the fixer does not re-check)

- No `asChild`, `data-[state=`, `group-data-[state`, `@radix-ui` or `@/lib/utils` in any of the four files (grep); only `@/components/ui/*` imports; `cn` from `"cn"`; Apache header lines 1-2 present and accurate on all four; `"use client"` matches upstream (present in code-block/context/inline-citation, absent in model-selector as upstream).
- Export names and prop names match upstream 1:1 for all four files; the only API deltas are the documented ones (`Context`/`InlineCitationCard` lose `openDelay`/`closeDelay`; `ContextTrigger`/`InlineCitationCardTrigger` gain `delay`/`closeDelay`; `InlineCitationSource` `h4`→`p`).
- `docs` type claims hold under `tsc` (scratch `docs-claims.tsx`): `(value: string) => void` no longer type-checks on `CodeBlockLanguageSelector`; `openDelay` on `Context` and `InlineCitationCard` is a type error; `asChild` on `ModelSelectorTrigger` is a type error; `ModelSelector onOpenChange(open, details)` and `ModelSelectorContent initialFocus` compile.
- Base UI 1.8 contracts: `PreviewCard.Root.Props` has no delay props, `PreviewCard.Trigger.Props` has `delay`/`closeDelay` (`PreviewCardTrigger.d.ts:33,38`); `Select.Root onValueChange` is `(value | null, eventDetails)` (`SelectRoot.d.ts:143`); `Dialog.Root onOpenChange` is `(open, eventDetails)` (`DialogRoot.d.ts:40`); `Dialog.Popup` has `initialFocus`/`finalFocus` (`DialogPopup.d.ts:24,34`).
- Base UI Progress clamps `aria-valuenow` (`ProgressRoot.js:53,69`); pinned: `usedTokens=150, maxTokens=100` → trigger "150%", `aria-valuenow="100"`; `aria-label="Context window usage"` is on the progressbar (ARIA tree in run log).
- ai@7 `LanguageModelUsage` (`node_modules/ai/dist/index.d.ts:320-370`) has `inputTokens`, `outputTokens`, `totalTokens`, `inputTokenDetails.cacheReadTokens`, `outputTokenDetails.reasoningTokens`; no top-level `reasoningTokens`/`cachedInputTokens`. context.tsx reads the v7 paths; pinned: Reasoning row 6K, Cache row 20K, Input 62K, Output 18K with the test usage.
- tokenlens `getUsage({ modelId, usage: { input, output, cacheReads, reasoningTokens } }).costUSD.totalUSD` exists in 1.3.1 (re-exported from `@tokenlens/core`); `"openai:gpt-4o"` (colon form, used by tests/preview) is priced ($0.0125 for 1k/1k); `"openai/gpt-4o"` (slash form) returns $0 and unknown ids return `costUSD: {}` → `$0.00` without throwing (pinned). `getUsage({ modelId: undefined })` throws, but `modelId` is truthiness-guarded at every call site.
- shiki 4.4.3: both `github-light-high-contrast` and `github-dark-high-contrast` exist in `bundledThemes`; `getLoadedLanguages()` includes aliases (`ts`, `cts`, `mts`); `codeToTokens("")` → `[[]]` (one empty line, matches `createRawTokens`); `text` is a special language accepted by `codeToTokens` and `createHighlighter`; `mermaid` is bundled.
- Tailwind v4 compiled the legacy `!`-prefix and counter utilities: `.dark\:\!bg-\[var\(--shiki-dark-bg\)\]:is(.dark *){background-color:var(--shiki-dark-bg)!important}` and `--tw-content: counter(line)` are in the served CSS.
- SSR of `/preview/code-block` emits raw tokens only (`<pre … style="background-color:transparent;color:inherit">`, no `--shiki` inline styles), so the `useSyncExternalStore` hydration guard works as the commit claims.
- Copy button: uses `navigator.clipboard.writeText(code)` with the raw code from context (not the highlighted DOM); missing API → `onError(new Error("Clipboard API not available"))`, no `onCopy` (pinned); second click while "copied" is swallowed and the button re-arms after `timeout` (pinned); the timeout is cleared on unmount (`code-block.tsx:498-503`).
- Unknown language is loud (`console.error("Failed to highlight code:", …)`) and non-fatal (raw text stays) — pinned.
- `ContextTrigger` focus-opens the card (Base UI `useFocus`) — pinned with `userEvent.tab()`; a custom element child replaces the default button (upstream parity) — pinned.
- model-selector: Escape closes, `onOpenChange(false, { reason: "escape-key" })`, focus returns to the trigger; dialog accessible name "Model Selector" from the sr-only title; typing filters and shows the empty state; `onSelect` receives the value unchanged (cmdk trims but does not lowercase; `cmdk/dist/index.mjs` `useValue` → `.trim()`); ArrowDown/Enter select — all pinned.
- inline-citation: `sources=[]` → "unknown", one source → bare hostname, three → "example.com +2"; prev/next do not wrap (embla `loop` default false); title renders as `<p>` (docs claim); quote is a `<blockquote>` — all pinned.
- Existing tests mutation-checked: code-block "highlights TypeScript" would fail without highlighting (`getByText("const", {exact:true})` needs the token split); context test fails if any `*Usage` row reads a wrong field (row returns null → label missing); model-selector test fails if `onSelect` is not wired (dialog would stay open); inline-citation test fails if `select` is not subscribed ("2/2" never appears). None of them asserts costs, focus, keyboard, or edge inputs.

## Could not reach

- Real dark-mode rendering of the code block (the browser tests never add `.dark`; the dev server has no theme toggle in previews). F6 is proven from the CSSOM in light mode plus the compiled CSS; the dark-mode visual difference (`bg-background` vs `#0a0c10`) is inferred, not screenshotted.
- Main-thread stall measurement in the browser for F10 (node timing only; a timing assertion would be flaky in CI).
- Line-number gutter overflow (F14) was computed, not measured; it needs a visual/e2e check.
- `ModelSelectorDialog` runtime behaviour (never rendered anywhere in the repo; I did not add a pin because its accessible-name wiring belongs to the `command` wrapper).
- `pnpm dlx shadcn add @uifiles/<name>` round-trips: all four items have bare upstream `registryDependencies` (`button`, `select`, `hover-card`, `progress`, `command`, `dialog`, `badge`, `carousel`) and `ui.shadcn.com` is blocked here.
- `pnpm exec tsc --noEmit` over the whole project currently reports errors in two OTHER lenses' new files (`tests/browser/qa-round1/chat-block-and-leaves.test.tsx:656`, `tests/browser/qa-round1/prompt-input.test.tsx:667`); none in mine.

## Commands run (for the fixer to reproduce)

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>

# reproducers + pins (10 expected failures, 15 passes; ~30 s)
pnpm exec vitest run --project browser tests/browser/qa-round1/code-context-model-citation.test.tsx
pnpm exec prettier --check tests/browser/qa-round1/code-context-model-citation.test.tsx   # clean
pnpm exec biome check   tests/browser/qa-round1/code-context-model-citation.test.tsx   # clean

# static Radix-leftover check (prints only a comment line in model-selector.tsx)
grep -n "asChild\|data-\[state\|group-data-\[state\|@radix-ui\|@/lib/utils" registry/ai/{code-block,context,model-selector,inline-citation}.tsx

# docs type claims (scratch; symlink node_modules next to the scratch file first)
pnpm exec tsc -p /docs/qa/round1/code-context-model-citation/typecheck/tsconfig.json   # exit 0 apart from the {}/unknown value probe
pnpm exec tsc -p /docs/qa/round1/code-context-model-citation/typecheck/tsconfig2.json  # TS2345 unknown → string | null (F12)

# library probes (node ESM scripts; written under node_modules/.qa-*.mjs then deleted)
#   tokenlens: getUsage for "openai:gpt-4o" / "openai/gpt-4o" / unknown / reasoning-only / cache-only
#   shiki:     bundledThemes, codeToTokens bg/fg strings, "" → [[]], CRLF, text special lang, brainfuck rejection, 10k-line timing
# key outputs:
#   "openai:gpt-4o" -> costUSD.totalUSD 0.0125 ; "nope-model" -> costUSD {} ; reasoning only -> totalUSD 0 ; cache only -> totalUSD 0.00125
#   bg: "#ffffff;--shiki-dark-bg:#0a0c10"  fg: "#0e1116;--shiki-dark:#f0f3f6"  rootStyle: undefined
#   brainfuck: Language `brainfuck` is not included in this bundle. ; text createHighlighter ok ; 10k lines ms: 4100

# SSR / CSS evidence
curl -s localhost:3000/preview/code-block | grep -o '<pre[^>]*>'          # style="background-color:transparent;color:inherit"
curl -s "localhost:3000$(curl -s localhost:3000/preview/code-block | grep -o 'href="/_next/static/[^"]*\.css[^"]*"' | head -1 | sed 's/href="//;s/"$//')" | grep -c shiki-dark   # 10
```

### Test output (final run, `scratchpad/qa/round1/code-context-model-citation/run2.log`)

```
 ❯ tests/browser/qa-round1/code-context-model-citation.test.tsx (25 tests | 10 failed)
   code-block
     × FAILS TODAY: shows the new code when only the middle of a snippet changes (token cache key collision)
     × FAILS TODAY: an overflowing code block is keyboard-focusable (axe scrollable-region-focusable)
     × FAILS TODAY: applies the shiki theme background and dark-theme variable to the pre
     ✓ an unknown language falls back to plain text and reports the error
     ✓ empty code renders a single empty line without throwing
     ✓ copy button reports a missing Clipboard API through onError
     ✓ copy button ignores clicks while showing the check, then re-arms after the timeout
   context
     × FAILS TODAY: maxTokens=0 does not render NaN% in the trigger
     × FAILS TODAY: reasoning tokens are priced instead of always $0.00
     ✓ usage above the window shows >100% and the progress bar clamps aria-valuenow
     ✓ reads ai@7 usage details and prices the known model
     ✓ unknown model id and missing usage degrade to $0.00 without throwing
     ✓ keyboard focus on the trigger opens the card
     ✓ a custom element child replaces the default trigger button
   model-selector
     ✓ Escape closes the dialog, restores focus to the trigger and reports the reason
     ✓ typing filters the list and shows the empty state
     ✓ onSelect receives the item value unchanged and ArrowDown moves the selection
     × FAILS TODAY (command wrapper): the empty state shows and passes axe
   inline-citation
     × FAILS TODAY: a relative source URL does not crash the render
     × FAILS TODAY: the carousel index updates when sources are added
     × FAILS TODAY: the carousel index with no slides is not 1/0
     × FAILS TODAY: the citation badge is reachable by keyboard and opens the card on focus
     ✓ prev/next stop at the bounds without wrapping
     ✓ trigger text: unknown for no sources, bare hostname for one, +N for many
     ✓ source renders only the fields it is given, with the title as a paragraph

 Test Files  1 failed (1)
      Tests  10 failed | 15 passed (25)
   Duration  27.51s

Failure messages (verbatim, trimmed):
  cache key collision  : AssertionError: expected 'aaaa…' to contain 'middle = 2'  Received: "…const middle = 1zzzz…"
  overflow focusable   : AssertionError: expected [ 'scrollable-region-focusable' ] to deeply equal []
  theme background     : AssertionError: expected 'rgba(0, 0, 0, 0)' to be 'rgb(255, 255, 255)'
  NaN%                 : AssertionError: expected 'NaN%' not to match /NaN|∞/
  reasoning $0.00      : AssertionError: expected 'Reasoning6K• $0.00' not to contain '$0.00'
  command empty state  : aria-required-children: <div data-slot="command-list" … role="listbox" aria-label="Suggestions" …>
  relative URL         : expected "vi.fn()" to not be called … [TypeError: Failed to construct 'URL': Invalid URL]
  index stale          : Expected element to have text content: 1/3  Received: 1/2
  index 1/0            : AssertionError: expected '1/0' not to be '1/0'
  badge keyboard       : AssertionError: expected <body …> to be <span …>   (activeElement after Tab)
```
