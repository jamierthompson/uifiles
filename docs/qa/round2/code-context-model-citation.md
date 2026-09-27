# code-context-model-citation — QA round 2

Scratch: `/docs/qa/round2/code-context-model-citation/`
(`previews.mjs` + `previews.log` Playwright sweep of the four previews on the production server, `typecheck/` scratch
consumers, `mutate.py` + `mutations.log` + `mutations.json`, `backup/` byte copies of the four sources, baseline logs).
Reproducers: `tests/browser/qa-round2/code-context-model-citation.test.tsx` (23 tests: 5 fail on real defects, 18 pass as pins).

## Summary

Attacked `registry/ai/{code-block,context,model-selector,inline-citation}.tsx` after the round-1 fixes: re-ran every round-1
reproducer's replacement, tried to re-break each fix with the inputs the fixers did not try (prototype-key language names,
colons in fence info, `undefined`/`NaN`/negative usage numbers, whitespace queries, the preview's own grouped composition
under axe, touch input, listener cleanup, slide removal at the last index), typechecked a scratch consumer of the generic
language selector, drove the four previews in Chromium on the production server (375/1280 px, dark, iPhone 13 touch),
ran 18 mutations against the fixers' tests, and read every sentence of the four `docs`/`description` strings against the
code. Findings: 1 high, 2 medium, 5 low, 1 nit. Every round-1 finding in this lens is fixed or fixed-with-a-caveat; the
fixes themselves are sound. The single worst thing is new: the citation badge is now a real `<button>` that does nothing
when tapped, so on every touch device the sources card is unreachable (upstream had the same gap behind a `<span>`; the
fix made it look interactive without making it work). Verdict: **not yet** for `inline-citation` (one small change: open
on click); the other three are ship-ready once the two docs sentences that over-promise are corrected.

## Fix verification

| round-1 finding | claimed fix | verified? | evidence |
| --- | --- | --- | --- |
| lens F1 (high) stale code on middle-of-snippet edit (sliced cache key) | key = `${language}:${code}`; sync callback on cache hit | yes | `code-block.test.tsx › shows the new code when only the middle…` passes 3/3; `highlightCode › notifies a caller synchronously on a cache hit`. New low: the key still collides when the language string contains a colon (Finding 5). |
| lens F2 (high) / rendered-surface F3 overflowing block not focusable | `tabIndex`/`role="region"`/`aria-label` via state while `scrollWidth > clientWidth`; RO + MO + fonts.ready | yes | Mutation M2 (never scrollable) caught; Playwright on the production server at 375 px: blocks 1 and 3 `tabindex="0" role="region"` labels "Code"/"Fetch example" (scrollWidth 1135/1573 vs 359), block 2 no attributes; at 1280 px only the "Long lines" block; no hydration warning in the console at either width. The MutationObserver path (code grows after mount) had no test: mutation M6 survived the canonical file (41/41) and is caught by my new pin. |
| lens F3 (high) relative URL throws | `URL.canParse` + raw-string fallback | yes | `inline-citation.test.tsx › shows a source that is not an absolute URL…`; mutation M16 caught. Browser floor caveat in Finding 6. |
| lens F4 (medium) / rendered-surface F5 badge unreachable by keyboard | `render={<Badge render={<button type="button"/>}/>}` | yes, keyboard only | `› is reachable by Tab, opens the card on focus and closes it on Escape` passes 3/3. Touch/click still opens nothing (Finding 1). |
| lens F5 (medium) reasoning priced $0.00, footer ignores cache | partitioned rows, reasoning at output rate, footer = Σ rounded rows | yes | `context.test.tsx › totals the four rows without double counting…` asserts each row against tokenlens and footer = Σ rows; mutation M11 (one `getUsage` call for the footer) caught (0.31 ≠ 0.32). Node probe: `getUsage(gpt-4o, {cacheReads:1000})` → 0.00125, so the cache-read rate is real. |
| lens F6 (medium) shiki bg/fg strings discarded | `splitThemeStyle` → colour + custom properties | yes | Mutation M1 (raw strings) caught by `› applies the shiki theme background and colours in light and dark mode` (asserts `--shiki-dark-bg` on `<pre>`, dark bg `rgb(10, 12, 16)` under `withDark` without re-highlighting). |
| lens F7 (medium) `NaN%`/`∞%` at `maxTokens` 0 | `usedPercent()` guard used by trigger, header, bar, ring | partial | Percent is guarded everywhere (mutation M9 caught). The header's counts are not: `maxTokens={undefined}` renders `80K / NaN` although `docs` promise the `undefined` case (Finding 2). |
| lens F8 (medium) carousel index stale on slide add/remove | one `useCarouselSnap` on `select`/`reInit`/`slidesChanged` | yes | `› updates when slides are added or removed`; mutation M17 (`select` only) caught; new pin: removing the current last slide clamps `3/3` → `2/2` and disables Next. |
| lens F9 (medium) empty state fails `aria-required-children` | `ModelSelectorEmpty` portals into a live region after the listbox | yes | `› renders the empty state outside the listbox in a polite live region`, `› shows when the search matches nothing and passes axe`; mutation M13 caught. New pin: the preview's own composition (groups wrapped in plain `<div>`s, separators, shortcut, logos) passes axe open, filtered to one group and filtered to none. |
| lens F10 (medium) tokenised twice per mount | `pending` map | yes | Mutation M3 caught by `› tokenises a block once per mount, even under StrictMode` (4 calls). |
| lens F11 (low) `1/0` with no slides | `current: count === 0 ? 0 : …` | yes | `› shows 0/0 with no slides` passes 3/3. |
| lens F12 (low) `onValueChange` receives `unknown` | generic `CodeBlockLanguageSelector<Value>` | yes | Scratch consumer `typecheck/consumer.tsx` compiles under the repo's strict flags: `useState<string \| null>` setter passed directly, explicit `<Lang>` union, union inferred from `value` alone, plain `string` state; preview dropped its cast. |
| lens F13 (low) unknown language: error every render, rejected promise cached | `resolveLanguage` → `"text"`, warn once, evict failed loads | partial | Mutations M4/M5 caught. But `language in bundledLanguages` is a prototype-chain check: `"constructor"`, `"toString"`, `"valueOf"`, `"hasOwnProperty"`, `"__proto__"` pass it and hit the exact pre-fix behaviour (Finding 3). |
| lens F14 (low) gutter narrower than four digits | `--line-digits` × `1ch` | yes | Fixer's test (10 → `2`, 1000 → `4`, `::before` width doubles) plus my pin (1 line → `1`, 10 000 lines → `5`). |
| lens F15 (low) logo alt pollutes names | `alt=""` + `aria-hidden` unless `alt` given | yes | `› keeps option and trigger names to the model name` asserts both the role name and the attributes; `› becomes an accessible image when alt is given`. |
| lens F16 (nit) description names wrong themes | registry string replaced | yes | `registry/ai/registry.json` code-block description: "github-light-high-contrast/github-dark-high-contrast" = `THEMES` in source. |
| lens F17 (nit) hard-coded en-US | `LOCALE` constant + docs sentence | yes | `context.tsx:25`; docs: "Numbers and currency use the fixed en-US locale (USD)." |
| rendered-surface F13 (low) logos fetched from models.dev | `onError` → `hidden`; dependency named in docs | partial | Broken glyph gone (production page: all four `<img hidden>` after `ERR_TUNNEL_CONNECTION_FAILED`); the runtime third-party dependency, the missing `src` override and the non-hermetic preview remain (Finding 4). |
| rendered-surface F20 (nit) carousel has no end state | Prev/Next `disabled` at the bounds unless `loop` | yes | Mutation M18 caught; `› keeps both controls enabled and wraps when opts.loop is set`. New pin: a single looping slide keeps both controls disabled. |
| rendered-surface F21 (nit) fuzzy search | whole-term `modelSelectorFilter`, `filter`/`shouldFilter` props | yes | Mutation M12 caught by `› filters by whole terms…` and by my whitespace-query pin; `defaultFilter` is exported by cmdk 1.1.1 (`dist/index.d.ts:412`), so the docs' escape hatch is real. |
| tokens-css F5 (medium) line numbers at `/50` alpha | `before:text-muted-foreground` | yes | `code-block.tsx:91`; `› renders line numbers in the full muted-foreground colour` compares the `::before` colour to a reference span. |
| test-quality M7 progress value unasserted | `› sets the progress bar to the percentage, not the fraction` | yes | `aria-valuenow="40"` asserted; fixer's mutation M14 recorded, test present. |

## Findings (most severe first)

### 1. `inline-citation`: the badge is a `<button>` that does nothing on tap or click, so touch users cannot open the sources — severity: high
- Where: `registry/ai/inline-citation.tsx:82-98` (`HoverCardTrigger render={<Badge render={<button type="button" />} …/>}`, no `onClick`); Base UI `node_modules/@base-ui/react/preview-card/trigger/PreviewCardTrigger.js:60-75` (`useHoverReferenceInteraction` with `mouseOnly: true`, plus `useFocus`, which is gated on keyboard modality / `matchesFocusVisible` in `floating-ui-react/hooks/useFocus.js:59-109`); `PreviewCardRoot.d.ts` offers `open`/`onOpenChange`/`actionsRef` but no click option.
- What: a tap delivers `pointerdown/up` with `pointerType: "touch"`, a non-visible focus and a `click`; none of those is an open path. The round-1 fix (correctly) made the badge focusable, and in doing so turned a decorative `<span>` into a real button that visibly signals "press me" and ignores the press. The fixer's report lists this under "Not fixed: Touch … out of scope"; it is the only way to reach sources on a phone, and the item is about to be listed publicly.
- Evidence: Playwright, iPhone 13 emulation (`hasTouch`, `isMobile`) on the production `/preview/inline-citation`: `badge.tap()` twice → `cardOpenAfterTap: false, cardOpenAfterSecondTap: false`, `document.activeElement` is the badge (`previews.log`). Desktop mouse: `click()` opens (through the hover path) and the card closes when the pointer leaves. Reproducer `qa-round2 › inline-citation › opens the source card from a click on the badge, not only from hover or focus`: pointer parked on the heading, `button.click()` → `Cannot find element with locator: getByText('Card body')` (fails today).
- Why it matters: WCAG 2.5.x pointer input and plain usability: every phone user sees a pill they cannot open; upstream had the same limitation but its `<span>` did not pretend otherwise.
- Proposed fix: give the trigger a click toggle. `InlineCitationCard` already wraps `PreviewCard.Root`, which is controllable: keep `open` state in `InlineCitationCard` with the controlled/uncontrolled pattern from `docs/porting-ai-elements.md` §1, expose it through a small context, and in `InlineCitationCardTrigger` add `onClick={() => setOpen(!open)}` (the hover/focus paths keep working because Base UI still calls `onOpenChange`). Add to `docs`: "a click or tap toggles the card". Alternative with no state: `actionsRef` + `unmount`, but that only closes.
- Test written: the reproducer above (expected: FAIL now).

### 2. `context`: `maxTokens`/`usedTokens` of `undefined` renders `80K / NaN` in the header while `docs` promise the `undefined` case is handled — severity: medium
- Where: `registry/ai/context.tsx:263-264` (`compactFormat.format(usedTokens)` / `format(maxTokens)`); `registry/ai/registry.json` context docs "maxTokens of 0/undefined (model metadata not loaded yet) renders 0%, never NaN%"; `docs/architecture.md` §3 "an unknown or zero `maxTokens` renders 0%, never NaN%".
- What: `usedPercent()` guards the percentage, the bar and the ring, but the header formats the raw props: `Intl.NumberFormat(...compact).format(undefined)` is `"NaN"` (node probe). The trigger reads `0%` and the card reads `80K / NaN` (or `NaN / 200K` for an undefined `usedTokens`). The prop type is `number`, so a TypeScript consumer cannot pass `undefined` without a cast (`typecheck/undefined-max.tsx` → TS2322), but the docs name exactly that state, and JS consumers / `as number` reach it.
- Evidence: `qa-round2 › context › shows no NaN in the header…`: `AssertionError: expected '0%80K / NaNx' not to match /NaN|∞/` (fails today).
- Why it matters: the docs sentence is the thing that will be quoted; either the code should honour it or the sentence should say "0" only.
- Proposed fix: format through the same guard: `const total = compactFormat.format(Number.isFinite(maxTokens) ? maxTokens : 0)` (same for `usedTokens`), or change both docs sentences to "maxTokens of 0 renders 0%" and drop "undefined".
- Test written: the reproducer above (expected: FAIL now).

### 3. `code-block`: a language named after an `Object.prototype` key bypasses the plain-text fallback and logs an error on every mount — severity: low
- Where: `registry/ai/code-block.tsx:183` (`language in bundledLanguages`).
- What: `in` walks the prototype chain, so `"constructor"`, `"toString"`, `"valueOf"`, `"hasOwnProperty"` and `"__proto__"` count as bundled languages (`Object.hasOwn(bundledLanguages, "constructor")` is `false`). `createHighlighter({ langs: ["constructor"] })` rejects with `TypeError: Cannot read properties of undefined (reading 'split')` (node probe), which is the exact pre-fix path: `console.error("Failed to highlight code:")`, highlighter evicted, retried and re-logged on every mount, no theme background, and the `docs` sentence "an unknown or empty `language` renders as plain text (one console.warn per unknown language) instead of rejecting" is false for these names.
- Evidence: `qa-round2 › code-block › renders a language named after an Object.prototype key…`: `console.error: Failed to highlight code: TypeError: Cannot read properties of undefined (reading 'split')`, `expected "Mock" to not be called` (fails today).
- Proposed fix: `Object.hasOwn(bundledLanguages, language)` (ES2022; the file already relies on ES2020+ features) or `Object.prototype.hasOwnProperty.call`.
- Test written: the reproducer above (expected: FAIL now).

### 4. `model-selector`: every consumer page fetches logos from `https://models.dev`, with no way to self-host, and the docs-site preview inherits the dependency — severity: medium
- Where: `registry/ai/model-selector.tsx:166-169` (`Omit<ComponentProps<"img">, "src" | "alt">` removes `src` from the props), `:256` (`src={\`https://models.dev/logos/${provider}.svg\`}`); `app/preview/model-selector/page.tsx` (four `ModelSelectorLogo`s); `e2e/previews.spec.ts` + `e2e/helpers.ts:24-33` (every console error fails the preview test).
- What: (a) Component: each option issues a third-party request from the user's browser (IP and referrer to models.dev), it is a hard failure under a `img-src 'self'` CSP or on an offline/intranet deployment, and because `src` is omitted from the type a consumer cannot substitute a local asset without forking the file. The round-1 fix hides the broken glyph and names the host in `docs`; it does not give consumers a way out. (b) Preview/e2e: `/preview/model-selector` is the one page whose "logs nothing" e2e assertion depends on egress. In this sandbox it fails deterministically (`console.error: Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED` ×3; `previews.log`); in CI it passes only while models.dev is up and reachable from the runner. A docs site that exists to be axe-and-console-checked should not have a network-dependent page.
- Evidence: `previews.log` `/preview/model-selector` → `failed: [models.dev/logos/{openai,anthropic,google}.svg]`, all four `<img>` `hidden: true`; the type omits `src`; upstream `model-selector.tsx:186` is identical (design inherited).
- Why it matters: registry consumers will hit CSP/offline breakage with no supported override; the e2e suite has a page whose result depends on a third party.
- Proposed fix: add an optional `src?: string | undefined` to `ModelSelectorLogoProps` that overrides the computed URL (parity kept: default unchanged), mention CSP in `docs`, and have the preview pass local assets (`/logos/<provider>.svg` under `public/`, or inline `data:image/svg+xml` URIs) so the page is hermetic; then the e2e console assertion is meaningful for that page. If the lead prefers upstream parity for the component API, do at least the preview half.
- Test written: none (network/e2e; documented via `previews.log`).

### 5. `code-block`: the token cache key still collides when the language string contains a colon — severity: low
- Where: `registry/ai/code-block.tsx:174-175` (`${language}:${code}`), `:281` (`String(language)` is the raw prop, not the resolved grammar).
- What: `("foo:bar", "baz")` and `("foo", "bar:baz")` both key to `"foo:bar:baz"`; the second block subscribes to the first block's pending job and, when it resolves, displays the first block's code. Same failure class as round-1 F1 (stale code shown, copy button copies the right one), reachable only with a colon in the fence info (`ts:file.ts`-style info strings exist in some markdown flavours) and matching text on the other side; contrived but a one-character fix.
- Evidence: `qa-round2 › code-block › keeps two blocks apart when the language string contains a colon`: `expected 'baz' to contain 'bar:baz'` (fails today).
- Proposed fix: `\`${language}\u0000${code}\`` or `JSON.stringify([language, code])`; optionally key on the resolved grammar so `""`/`brainfuck`/`text` share one tokenisation of the same text.
- Test written: the reproducer above (expected: FAIL now).

### 6. `inline-citation`: `URL.canParse` sets a 2023 browser floor with a render-time crash below it — severity: low
- Where: `registry/ai/inline-citation.tsx:66-67`.
- What: `URL.canParse` is Chrome 120 / Firefox 115 / Safari 17 (Sept–Dec 2023). On older engines (iOS 16 Safari is the realistic one) it throws `TypeError: URL.canParse is not a function` from render, the same unmount-the-message-tree failure round-1 F3 fixed, for a smaller population. SSR is safe: Next 16 requires Node ≥ 20.9 (`node_modules/next/package.json` engines) and Node has had it since 18.17/19.9; TS 7's `lib.dom.d.ts:37404` and `@types/node@24 url.d.ts:502` declare it, so it type-checks. The repo states no browser-support floor (no browserslist), and the fixer explicitly left this for the lead.
- Proposed fix: `const sourceLabel = (s: string) => { try { return new URL(s).hostname || s } catch { return s } }` — same line count, no floor. (Also fine to keep `canParse` and write the floor into `docs`; just decide.)
- Test written: none (cannot remove the API in Chromium; type-level and version facts above).

### 7. `inline-citation`: `InlineCitationSource`/`InlineCitationQuote` render an empty element for an empty array of children — severity: low
- Where: `registry/ai/inline-citation.tsx:321-322` (`hasContent`), `:338`, `:369`.
- What: `hasContent([])` is `true` (an array is not null/boolean/""), so `<InlineCitationQuote>{quotes.map(…)}</InlineCitationQuote>` with no quotes leaves an empty `<blockquote>` with its left border in the slide, which is exactly what the round-1 "renders nothing when empty" change set out to remove. Same for `[null, false]`.
- Evidence: `qa-round2 › inline-citation › renders nothing for an empty array of children`: `expected <blockquote …> to be null` (fails today).
- Proposed fix: `Children.toArray(children).length > 0` (drops null/boolean/empty, matching `docs/porting-ai-elements.md` §1's guidance on lazy children).
- Test written: the reproducer above (expected: FAIL now).

### 8. Docs sentences that over-promise — severity: nit
- `registry/ai/registry.json` › code-block docs: "an unknown … `language` renders as plain text (one console.warn …) instead of rejecting" — not for prototype-key names (Finding 3).
- context docs and `docs/architecture.md` §3: "maxTokens of 0/undefined … renders 0%, never NaN%" — the header shows `NaN` for `undefined` (Finding 2).
- inline-citation description "opens a hover card" / docs "focus opens the card": nothing says a tap does not (Finding 1); add the click behaviour once implemented.
- Everything else in the four strings matches the code (checked sentence by sentence; list under Verified OK).

### 9. Test-quality gaps in the fixers' files — severity: low
See the section below; the two survived mutations (M6, M10) and the listener-cleanup gap are the load-bearing ones.

## Mutation log

Each mutation was applied to the source with `mutate.py`, the named test(s) run with `pnpm exec vitest run --project browser <file> -t "<name>"` (or the whole file where noted), and the source restored from `backup/` and checked with `cmp` (all 18 identical; `git status --short registry/` empty afterwards).

| behaviour | mutation | test file › test | caught? |
| --- | --- | --- | --- |
| shiki dual-theme bg/fg split (F6) | M1 raw `result.bg`/`result.fg` strings, no vars | ai/code-block › applies the shiki theme background and colours in light and dark mode | yes |
| overflow → focusable region (F2) | M2 `setScrollable(false)` always | ai/code-block › makes an overflowing block a focusable, named scroll region | yes |
| one highlight per key (F10) | M3 start a job on every call | ai/code-block › tokenises a block once per mount, even under StrictMode | yes |
| unknown language → text (F13) | M4 skip the `bundledLanguages` check | ai/code-block › renders an unknown language as plain text with one warning per language | yes |
| warn once per language (F13) | M5 skip `warnedLanguages` | same test | yes |
| re-measure when content grows | M6 remove the MutationObserver | ai/code-block (whole file) | **no** (41/41) |
| re-measure when content grows | M6 (same) | qa-round2 › becomes a scroll region when streamed code grows past the container | yes |
| CRLF line parity | M7 `split("\n")` | ai/code-block › renders CRLF input as the same lines before and after highlighting | yes |
| `aria-label` routed off the container | M8 also put it on the container | ai/code-block › routes aria-label from CodeBlock to the scroll region | yes |
| `usedPercent` guard (F7) | M9 `used / max` | ai/context › renders 0% instead of NaN% or ∞%… | yes |
| `count()` drops negative/NaN fields | M10 `typeof value === "number" ? value : 0` | ai/context (whole file) | **no** (45/45) |
| `count()` drops negative/NaN fields | M10 (same) | qa-round2 › omits a row whose own count is negative or NaN | yes |
| footer = Σ rounded rows (F5) | M11 one `getUsage` call for the total | ai/context › totals the four rows without double counting… | yes |
| whole-term filter (F21) | M12 no term split | ai/model-selector › filters by whole terms…; qa-round2 › treats a whitespace-only query as no query | yes (both) |
| empty state outside the listbox (F9) | M13 never portal | ai/model-selector › renders the empty state outside the listbox in a polite live region | yes |
| separator decorative | M14 drop `aria-hidden` | ai/model-selector › renders a decorative separator between items… | yes |
| snap listeners removed on unmount | M15 empty cleanup | ai/inline-citation (whole file) | **no** (49/49) |
| snap listeners removed on unmount | M15 (same) | qa-round2 › unsubscribes every carousel listener it registered when it unmounts | yes |
| relative URL fallback (F3) | M16 `new URL(source).hostname` | ai/inline-citation › shows a source that is not an absolute URL… | yes |
| index resync on reInit/slidesChanged (F8) | M17 `["select"]` only | ai/inline-citation › updates when slides are added or removed; qa-round2 › clamps the index when the current slide is removed | yes (both) |
| Next disabled at the end (F20) | M18 drop `disabled` | ai/inline-citation › is disabled on the last slide… | yes |

Score: 18 mutations; 15 caught by the fixers' tests, 3 survived them (M6 content-growth re-measure, M10 negative/NaN usage
fields, M15 listener cleanup) and are caught by the new pins in `qa-round2`. Every survivor is a real behaviour the
`docs`/comments claim.

## Test-quality issues (file › test name → problem)

- `tests/browser/ai/code-block.test.tsx` › nine copy-button/className tests (`applies custom className`, `renders copy button`, `copies code to clipboard`, `calls onError when clipboard fails`, `calls onError when clipboard API is not available`, `shows the check for timeout ms…`, `honours a custom timeout`, `clears the reset timer on unmount`, `renders custom children instead of the icon`) → fixtures rendered without `<main>` (brief rule; none of them runs axe, so no false pass today, but the first one to add `expectNoViolations()` fails `region`).
- `tests/browser/ai/code-block.test.tsx` › `ignores a highlight that finishes after the code changed or the block unmounted` → the unmount half only asserts `console.error` was not called; React 19 never logs setState-after-unmount, so that assertion cannot fail whatever the cleanup does (the `cancelled` flag is unguarded).
- `tests/browser/ai/code-block.test.tsx` › `accepts nullable and literal-union state without casts` → the runtime assertion (`combobox` is null) is filler; the value is the compile-time `Typed` fixture. Acceptable, but the name promises a runtime behaviour.
- `tests/browser/ai/code-block.test.tsx` (whole file) → the MutationObserver branch (content growth after mount) has no test; mutation M6 survives. My pin covers it.
- `tests/browser/ai/context.test.tsx` (whole file) → `count()`'s `> 0`/finite guard has no test for negative or NaN fields; mutation M10 survives. My pin covers it.
- `tests/browser/ai/context.test.tsx` › `renders 0% instead of NaN% or ∞%…` → the `[80_000, Infinity]`/`[NaN, 200_000]` loop renders only the trigger, so the header (`80K / ∞`, `NaN / 200K`) is never looked at; that is where Finding 2 lives.
- `tests/browser/ai/inline-citation.test.tsx` › `shows 0/0 with no slides` → `await new Promise((resolve) => setTimeout(resolve, 150))` is a timing sleep. A negative ("never flips to 1/0") cannot be polled, but it can be tied to a real event: wait for the wrapper's `reInit`/`setApi` (both observable) instead of 150 ms.
- `tests/browser/ai/inline-citation.test.tsx` (whole file) → the `useCarouselSnap` cleanup has no test; mutation M15 (empty cleanup) survives 49/49. My pin covers it.
- `tests/browser/ai/inline-citation.test.tsx` › `waits for delay before opening…` and `tests/browser/ai/context.test.tsx` › `forwards delay and closeDelay…` → the "not open yet" assertions immediately after hover are timing-sensitive negatives (they hold only while the test runner is faster than 400/600 ms). Not flaky in 3×3 runs; noting the shape.
- `tests/browser/ai/model-selector.test.tsx` › `hides itself when the provider has no logo and still calls onError` → uses a synthetic `error` event rather than a failed load; fine (deterministic), but it means no test in the repo ever observes a real logo request.
- Names: no `BUG`/`QA`/round/reviewer/"pins" words in any of the four files; no `test.skip`/`only`; no disabled axe rules; all four files pass 3/3 runs (durations: code-block 16.3/6.1/5.5 s, context 5.1/5.3/4.7 s, model-selector 6.3/5.7/7.4 s, inline-citation 5.8/5.7/6.1 s).
- `tests/browser/qa-round2/code-context-model-citation.test.tsx` (mine): 23 tests, 3/3 runs identical (5 failed | 18 passed; 7.4/11.1/12.9 s); prettier and biome clean; every fixture in `<main>`; helpers from `tests/a11y.ts`/`tests/setup.ts`; no sleeps (the click reproducer uses a bounded `expect.element` poll); behaviour-named. The five failing tests are the reproducers for Findings 1, 2, 3, 5 and 7 and are meant to fail until those are fixed.

## Verified OK

- `CodeBlockLanguageSelector` generics: scratch consumer compiles under `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess`/`noUnusedLocals` with a `useState<string | null>` setter, an explicit union, a union inferred from `value`, and plain `string`; `defaultFilter` from `cmdk` is assignable to `ModelSelectorContent filter`; `delay`/`closeDelay` on both hover triggers and `side/align/sideOffset/alignOffset` on `InlineCitationCardBody` type-check; `aria-label` on `CodeBlock` and `CodeBlockContent` type-check.
- Two sibling blocks with identical code and different languages tokenise independently (`highlightCode("# note", "python")` and `("# note", "javascript")` return different token arrays) and the same code rendered twice concurrently shares one job (fixer's `highlightCode › shares one highlight between concurrent callers`).
- Scroll region: created when a `hidden` ancestor is shown (ResizeObserver 0 → width), when a block below the fold is scrolled into view, and in `dir="rtl"` (Tab reaches it; ArrowLeft scrolls to a negative `scrollLeft`); server HTML carries no `tabindex` (`curl` of `/preview/code-block`: three plain `data-slot="code-block-content"` divs, `<pre style="background-color:transparent;color:inherit">`); no hydration warning at 375 or 1280 px.
- Theme flip without re-highlight: `<pre>` carries `--shiki-dark-bg`/`--shiki-dark` as inline custom properties and `dark:!bg-[var(--shiki-dark-bg)]`, so toggling `.dark` changes the background with no new tokenisation (fixer's test; M1).
- `toCodeString`: `undefined`/`null` → `""` (fixer's test); a number would also become `""` (type-forbidden; noted, not a finding). Lone `\r` and trailing `\r` are kept inside the line by both the raw split and shiki (node probe: `"a\rb"` → 1 line on both sides), so raw/highlighted line counts match for CRLF, LF, trailing newline (`"a\nb\n"` → 3/3) and `""` (1/1).
- Copy button: missing `navigator.clipboard`/`writeText` → `onError`, rejected write → `onError` and icon stays "copy", fake-timer re-arm at exactly `timeout`, `clearTimeout` on unmount (fixer's tests, 3/3).
- `context`: `usedTokens > maxTokens` → trigger `150%`, `aria-valuenow` clamped to 100, ring offset 0; `cachedInputTokens > inputTokens` → Input row omitted, Cache row `30`, no minus sign; `reasoningTokens > outputTokens` → Output row omitted; `modelId=""` → `$0.00` on every row and footer; `inputTokens: NaN` → row omitted; rows with 0 tokens omitted; footer equals the sum of the rounded rows; the `docs` formula (Input − cache at input rate, Cache at cache-read rate, Output − reasoning and Reasoning at output rate, cents rounding, Σ rounded rows) matches `priceRows` line for line; tokenlens accepts `cacheReads` without `input` and prices it at the cache-read rate; `getUsage` never throws for `""`, `":"`, `"openai:"`, `"openai:gpt-4o:extra"` (returns `{}` → `$0.00`).
- `model-selector`: the preview's grouped composition passes axe open, filtered to one group and filtered to none (`aria-required-children` with plain-`div` group wrappers, `aria-hidden` separators, a shortcut and decorative logos); the empty-state node keeps its identity while the query keeps changing (one child in the `aria-live="polite"` region, so it is announced once); whitespace-only query shows every option; Escape/outside press return focus and report the reason; controlled `open` round-trips; dialog named "Model Selector"/custom `title`; `ModelSelectorDialog` named by `CommandDialog`'s `title` (fixer's tests).
- `inline-citation`: `sourceLabel` for `mailto:`, `data:`, `blob:`, `javascript:` → raw string (no host); IPv6 → `[::1]`; `localhost:3000` → `localhost`; credentials stripped (`host.example`); `"example.com"`/`"//example.com/x"` → raw; IDN → punycode host (shown as `xn--…`; upstream identical, not a finding). Escape closes and keeps focus on the badge; hover open/close; controlled `open` + `onOpenChange(open, { reason: "trigger-hover" })`; `setApi` consumer and internal both called; every listener the snap hook registers is `off`'d on unmount; removing the current last slide clamps to `2/2` and disables Next; a single looping slide keeps both controls disabled.
- Registry entries: `dependencies`/`registryDependencies` match imports for all four (`react-dom` is a peer; `cmdk` arrives through the `command` item and is only referenced in docs); all four descriptions end with a period and exceed the unit test's length rule; every remaining `docs` sentence checked against code: Base UI sentence, `items` on Select, `alignItemWithTrigger = true` default in `components/ui/select.tsx` `SelectContent`, `bg-muted/50` header, `initialFocus`/`finalFocus` on `DialogContent` (`DialogPrimitive.Popup.Props`), `**:data-[slot=input-group]:h-auto!` vs the command wrapper's `h-8!`, `"use client"` on all four, `<p>` title, `text-secondary-foreground` index, 24 px hit area, `size-6`.
- No `asChild`, `data-[state=`, `@radix-ui` or `@/lib/utils` in the four sources; Apache header present.

## Could not reach

- The production server at `:3000` serves HTML that references `/_next/static/chunks/3g4d4pl8l91w7.css`, which returns **500** (the `.next` directory was rebuilt at 23:40 with a different chunk hash, `0jgcpcuv4iy7d.css`, after the server started). Every preview therefore loads without its main stylesheet (`console.error: Failed to load resource: … 500` on all four previews, `previews.log`), so any computed-style or dark-mode measurement against that server is invalid this round (my dark check there read the light background). Not in my lens; flagged for the app-tooling owner. Hydration, attribute and network observations above do not depend on CSS and stand.
- `URL.canParse` absence cannot be simulated in Chromium 140; Finding 6 rests on version facts.
- `pnpm dlx shadcn add @uifiles/<name>` round-trips (`ui.shadcn.com` blocked).
- Real touch hardware; the touch finding uses Playwright's iPhone 13 emulation (`hasTouch`, `page.tap`).

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>
D=/docs/qa/round2/code-context-model-citation

# baseline, three runs each (all green; logs baseline-run1.log, baseline-run2-3.log)
for f in code-block context model-selector inline-citation; do pnpm exec vitest run --project browser tests/browser/ai/$f.test.tsx; done

# library probes (node ESM written under node_modules/ and deleted): bundledLanguages prototype keys,
# createHighlighter({langs:["constructor"]}) rejection, shiki line splitting for "\r", "\r\n", trailing "\n",
# tokenlens getUsage for odd ids / cacheReads-only / negative / NaN, Intl compact format(undefined) → "NaN",
# sourceLabel over mailto/data/blob/IPv6/localhost/credentials/IDN

# production-server sweep (Playwright from node_modules; script kept at $D/previews.mjs, output $D/previews.log)
cp $D/previews.mjs node_modules/.qa2-previews.mjs && node node_modules/.qa2-previews.mjs; rm node_modules/.qa2-previews.mjs
curl -s http://localhost:3000/preview/code-block | grep -o '<div class="relative overflow-auto[^>]*>'   # no tabindex in SSR
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/_next/static/chunks/3g4d4pl8l91w7.css   # 500

# type claims (TS 7 has no baseUrl; configs extend the repo tsconfig)
pnpm exec tsc -p $D/typecheck/tsconfig.json    # consumer.tsx: exit 0
pnpm exec tsc -p $D/typecheck/tsconfig2.json   # undefined-max.tsx: TS2322 (maxTokens: number)

# reproducers (5 expected failures)
pnpm exec prettier --write tests/browser/qa-round2/code-context-model-citation.test.tsx
pnpm exec biome check tests/browser/qa-round2/code-context-model-citation.test.tsx   # clean
pnpm exec vitest run --project browser tests/browser/qa-round2/code-context-model-citation.test.tsx

# mutations (driver applies each patch, runs the target test(s), restores from $D/backup and cmp's)
python3 $D/mutate.py   # $D/mutations.log, $D/mutations.json; git status --short registry/ → empty
```

### Reproducer output (identical across three runs; `qa2-final-run{1,2,3}.log`)

```
 ❯ tests/browser/qa-round2/code-context-model-citation.test.tsx (23 tests | 5 failed)
   code-block
     × renders a language named after an Object.prototype key as plain text with one warning
       console.error: Failed to highlight code: TypeError: Cannot read properties of undefined (reading 'split')
       AssertionError: expected "Mock" to not be called at all, but actually been called 1 times
     × keeps two blocks apart when the language string contains a colon
       AssertionError: expected 'baz' to contain 'bar:baz'
     ✓ highlights the same code independently per language
     ✓ becomes a scroll region when streamed code grows past the container
     ✓ becomes a scroll region once a hidden block is shown
     ✓ becomes a scroll region once a block below the fold scrolls into view
     ✓ keeps the scroll region keyboard-scrollable in right-to-left text
     ✓ sizes the gutter for one line and for ten thousand lines
     ✓ renders CodeBlockContent with an undefined language as plain text without warning
   context
     × shows no NaN in the header when the window size or the used count is missing
       AssertionError: expected '0%80K / NaNx' not to match /NaN|∞/
     ✓ omits a row whose partition would be negative instead of showing a minus
     ✓ omits a row whose own count is negative or NaN
     ✓ drops a NaN usage field instead of rendering NaN
     ✓ prices nothing for an empty modelId
   model-selector
     ✓ passes axe with the preview composition open, filtered to one group, and filtered to none
     ✓ keeps one empty-state node while the query keeps changing
     ✓ treats a whitespace-only query as no query
   inline-citation
     × opens the source card from a click on the badge, not only from hover or focus
       VitestBrowserElementError: Cannot find element with locator: getByText('Card body')
     ✓ unsubscribes every carousel listener it registered when it unmounts
     ✓ clamps the index when the current slide is removed
     ✓ disables both controls for a single looping slide
     × renders nothing for an empty array of children
       AssertionError: expected <blockquote …(2)></blockquote> to be null
     ✓ labels IPv6, localhost and credentialed sources by host only

 Tests  5 failed | 18 passed (23)
```
