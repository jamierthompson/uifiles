# fix-code-block-context

Lens: `code-block-context`. Files owned and changed: `registry/ai/code-block.tsx`,
`registry/ai/context.tsx`, `app/preview/code-block/page.tsx` (`app/preview/context/page.tsx`
unchanged), `tests/browser/ai/code-block.test.tsx`, `tests/browser/ai/context.test.tsx`;
`tests/browser/qa-round1/code-context-model-citation.test.tsx` deleted (my half migrated; the
model-selector / inline-citation half is at `git show 13c7c90:tests/browser/qa-round1/code-context-model-citation.test.tsx`,
verified identical to the working copy before deletion).

Note for the lead: the coordinator's mid-task note about `chain-of-thought.tsx:101` (target size)
was misrouted to me and later retracted; I did not touch `registry/ai/chain-of-thought.tsx` or
`queue.tsx`.

## Fixed

### code-block (report: code-context-model-citation.md unless stated)

- F1 (high) — token cache keyed on the whole `language:code` string (no slicing); a cache hit
  now invokes the caller's callback synchronously so a block whose tokens landed in the cache
  between render and effect is never stuck on raw text — `registry/ai/code-block.tsx`
  `getTokensCacheKey`, `highlightCode` — tests: `tests/browser/ai/code-block.test.tsx` ›
  "shows the new code when only the middle of a snippet changes" (failed before:
  `AssertionError: expected 'aaaa…' to contain 'middle = 2'`; passes after) and
  `highlightCode` › "notifies a caller synchronously on a cache hit".
- F2 (high) — the scroller (`data-slot="code-block-content"`) gets `tabIndex={0}`,
  `role="region"` and `aria-label` (prop, default "Code") only while `scrollWidth > clientWidth`
  (or vertical overflow); measured after mount, on `ResizeObserver` (container), on
  `MutationObserver` (tokens swap in / streamed code) and after `document.fonts.ready`. The
  attributes go through React state, so server HTML and the first client render match (the
  rendered-surface report's hydration-mismatch trap in `response.tsx`); verified in Chromium at
  375 px and 1280 px with a clean console (see "Hydration check"). Visible `focus-visible`
  outline inset so the container's `overflow-hidden` does not clip it. `aria-label` passed to
  `CodeBlock` is routed to this region instead of the container `div` (where axe flags it as
  `aria-prohibited-attr`) — `code-block.tsx` `CodeBlockContent`, `CodeBlock` — tests:
  `codeBlockContent` › "makes an overflowing block a focusable, named scroll region" (failed
  before: `expected [ 'scrollable-region-focusable' ] to deeply equal []`; now also tabs into it
  and scrolls with ArrowRight), "routes aria-label from CodeBlock to the scroll region", "is not
  a tab stop when the code fits, and re-checks on resize" (380 px → 96 px → 380 px).
- F6 (medium) — shiki's dual-theme `bg`/`fg` strings (`"#ffffff;--shiki-dark-bg:#0a0c10"`) are
  split into the colour plus custom properties (`splitThemeStyle`) and applied as separate
  style keys on the `<pre>`, so the light background applies and `dark:!bg-[var(--shiki-dark-bg)]`
  / `dark:!text-[var(--shiki-dark)]` resolve — `code-block.tsx` `tokenize`, `CodeBlockBody` —
  test: `codeBlock` › "applies the shiki theme background and colours in light and dark mode"
  (failed before: `expected 'rgba(0, 0, 0, 0)' to be 'rgb(255, 255, 255)'`; after: light
  `rgb(255, 255, 255)` / `#0e1116`, under `withDark` `rgb(10, 12, 16)` / `#f0f3f6`, token colours
  follow `--shiki-dark`, axe clean in dark).
- F10 (medium) — in-flight highlights are deduplicated per cache key (`pending` map): the
  `useMemo` sync call and the effect share one job; the sync-from-cache fast path is kept —
  `code-block.tsx` `highlightCode` — tests: "tokenises a block once per mount, even under
  StrictMode" (instrumented shiki: 4 `codeToTokens` calls before, 1 after) and `highlightCode` ›
  "shares one highlight between concurrent callers".
- F13 (low) — a language that is not in `bundledLanguages` (nor a shiki special language) is
  resolved to `"text"` before any highlighter is created: one `console.warn` per unknown
  language, no `console.error`, no rejected promise in the cache; `""`/undefined language is
  plain text silently. A grammar whose load actually fails (offline) is evicted from
  `highlighterCache` so the next mount retries, and raw text stays meanwhile —
  `code-block.tsx` `resolveLanguage`, `getHighlighter` — tests: "renders an unknown language as
  plain text with one warning per language" (two blocks → one warning; second language → second
  warning; `createHighlighter` never asked for `brainfuck`), "renders an empty language as plain
  text without warning", "keeps the raw text when a grammar fails to load and retries on the
  next mount".
- F12 (low) — `CodeBlockLanguageSelector` is generic: `CodeBlockLanguageSelectorProps<Value
  extends string = string> = ComponentProps<typeof Select<Value, false>>`, so `onValueChange`
  is `(value: Value | null, eventDetails) => void`; a `useState<string | null>` setter and a
  literal-union state both compile; `app/preview/code-block/page.tsx` drops its `as Language`
  cast — test: `codeBlockLanguageSelector` › `Typed` fixture (compile-time; the repo's
  `tsc --noEmit` covers the test file) + "accepts nullable and literal-union state without casts".
- F14 (low) — line-number gutter width follows the digit count: `<code>` carries
  `--line-digits` (= `String(lineCount).length`) and the gutter is
  `before:w-[calc(var(--line-digits,2)*1ch)]` — test: "widens the line-number gutter with the
  digit count" (10 lines → `2`, 1000 lines → `4`, `::before` width doubles).
- tokens-css.md F5 — `before:text-muted-foreground` (no alpha) — test: "renders line numbers in
  the full muted-foreground colour" (compares `::before` colour to a `text-muted-foreground`
  reference; mutation to `/50` fails with `oklab(0.53 0 0 / 0.5)` ≠ `oklch(0.53 0 0)`).
- disclosure-agent.md F1 / chat-block-and-leaves.md F1 (root hardening) — `toCodeString` treats
  non-string `code` as `""` at every entry point: `CodeBlock` (context value + content),
  `CodeBlockContent`, `highlightCode`, `createRawTokens`; types stay `string` — test: "treats a
  missing code prop as empty text" (`code={undefined}` and `null`, copy button copies `""`,
  `highlightCode(undefined)` yields `[[]]`; mutation fails with `Cannot read properties of
  undefined (reading 'split')`).
- Copy button — missing clipboard (`navigator.clipboard` undefined or `writeText` undefined) →
  `onError(new Error("Clipboard API not available"))`, no throw, no `onCopy`; rejection →
  `onError(error)`, icon stays "copy"; caught non-Error values are wrapped instead of cast;
  "copied" state ignores clicks and re-arms exactly at `timeout` (fake timers, 1999 ms vs
  2000 ms) and honours a custom `timeout`; the reset timer is cleared on unmount
  (`clearTimeout` spied with the id returned by `setTimeout`). The `navigator.clipboard` stub is
  an own configurable property removed in `afterEach` via `Reflect.deleteProperty`, restoring
  the prototype accessor.
- Coverage gap (CRLF) — raw tokens split on `/\r?\n/` so pre- and post-highlight line counts
  match and no `\r` reaches the DOM — test: "renders CRLF input as the same lines before and
  after highlighting" (mutation to `split("\n")` fails).

### context

- F7 (medium) — one helper `usedPercent(used, max)` returns 0 for `max <= 0`, non-finite
  `max`/`used`, or negative `used`, used by the trigger, header, progress value and icon ring —
  `registry/ai/context.tsx` — test: `tests/browser/ai/context.test.tsx` › `context` › "renders 0%
  instead of NaN% or ∞% when the window size is unknown" (failed before:
  `expected 'NaN%' not to match /NaN|∞/`; covers `maxTokens` 0/Infinity, `usedTokens` NaN/−5,
  header `0 / 0`, `aria-valuenow="0"`, ring offset = circumference).
- F5 (medium) — costs are computed once in the provider: usage is split into non-overlapping
  rows (Input = `inputTokens − cacheReadTokens`, Cache = `cacheReadTokens`, Output =
  `outputTokens − reasoningTokens`, Reasoning = `reasoningTokens`); Input at the input rate,
  Cache at the cache-read rate (`getUsage({ usage: { cacheReads } })`), Output and Reasoning at
  the output rate (`getUsage({ usage: { input: 0, output: n } })` — tokenlens 1.3 prices
  `reasoningTokens` only for models with `reasoningPerMTokens`, none in the bundled catalog;
  verified in `@tokenlens/helpers/dist/context.js:293-297` and by node probe). Each row is
  rounded to cents and the footer is the sum of the four rounded rows, so the displayed numbers
  add up. `$0.00` remains only when tokenlens returns no price (unknown model or no `modelId`) —
  tests: `contextContentFooter` › "totals the four rows without double counting cached input or
  reasoning" (failed before: `expected 'Reasoning6K• $0.00' not to contain '$0.00'`; asserts each
  row against tokenlens computed in the test and footer = Σ rows parsed from the DOM), "shows
  $0.00 everywhere for a model tokenlens cannot price", and the 4×"renders … usage without
  modelId".
  **Intentional divergence to confirm:** the row counts are the partitioned values (Input 42K,
  Output 12K for the test usage) instead of upstream's inclusive `inputTokens`/`outputTokens`
  (62K/18K), so counts and dollars in a row agree and the four counts sum to the tokens used.
  Documented in `docs` below; reverting to inclusive counts is a two-line change but then the
  rows no longer sum to the footer.
- F17 (nit) — `LOCALE = "en-US"` in one constant with module-level `Intl.NumberFormat`
  instances; mentioned in `docs`.
- test-quality.md M7 — test: `contextContentHeader` › "sets the progress bar to the percentage,
  not the fraction" (`aria-valuenow="40"`; mutation `value={percent}` fails).
- PreviewCard delays — `delay`/`closeDelay` forwarding verified by behaviour: test
  `contextTrigger` › "forwards delay and closeDelay to the hover trigger" (`600` ms: not open
  right after hover, open later; still open right after unhover, gone later; mutation to `0`
  fails); "opens the card from keyboard focus" kept.
- Icon ring — clamps at 100% so >100% no longer produces a negative dash offset — test "shows
  usage above the window as >100% and clamps the bar and the ring".

## Not fixed and why

- code-context-model-citation.md F16 (code-block `description` names the wrong themes) —
  `registry/ai/registry.json` is off-limits; exact replacement under "Registry entry changes".
- rendered-surface.md F17 (`content-visibility: auto` placeholder CLS on `/preview/code-block`) —
  upstream design, low severity, not in my brief; leave for a product decision (dropping
  `contentVisibility` trades a little scroll performance for zero CLS).
- Coverage gap "Playwright SSR/hydration parity test" — the e2e suite is not mine to run or
  extend; verified manually with a scratch Playwright script instead (below). Recommend the e2e
  owner add a 375 px axe + console-error pass over `/preview/code-block`.

## Hydration check (scratch Playwright against the running dev server)

`scratchpad/hydration-check.mjs` (Chromium, `waitUntil: "networkidle"`, then waits for the
highlighted `<pre>`), collecting console `error`/`warning` and `pageerror`:

- `/preview/code-block` @ 375 px: all three scrollers `tabindex="0"`, `role="region"`, labels
  `"Code"`, `"Code"`, `"Fetch example"`; `scrollWidth` 576/352/1624 vs `clientWidth` 341; pre
  background `rgb(255, 255, 255)`; `--line-digits` `2` on the numbered block. Console: clean (no
  hydration mismatch, unlike the effect-set `tabindex` in `response.tsx` that rendered-surface
  reported).
- `/preview/code-block` @ 1280 px: first two blocks have no `tabindex`/`role`/`aria-label`
  (`scrollWidth` 734 = `clientWidth`); the "Long lines" block is the only region. Console: clean.
- `/preview/context` @ 375 px: console clean.

## Tests

- `tests/browser/ai/code-block.test.tsx`: 3 tests before → 41 after; upstream
  `__tests__/code-block.test.tsx` ported: 9 of 9 (`codeBlock`: renders code content, renders with
  line numbers, renders children actions, applies custom className; `codeBlockCopyButton`:
  renders copy button, copies code to clipboard, calls onCopy callback, calls onError when
  clipboard fails, calls onError when clipboard API is not available). Skipped: none. shiki is
  loaded for real through `vi.mock("shiki")` with a thin wrapper that records `createHighlighter`
  languages and `codeToTokens` calls and can fail one grammar load on demand.
- `tests/browser/ai/context.test.tsx`: 2 tests before → 45 after; upstream
  `__tests__/context.test.tsx` ported: 27 of 27 (`context` ×3, `contextTrigger` ×2,
  `contextContent` ×1, `contextContentHeader` ×2, `contextContentBody` ×1,
  `contextContentFooter` ×2, `contextInputUsage`/`OutputUsage`/`ReasoningUsage`/`CacheUsage` ×4
  each, generated from one table). Skipped: none. Upstream's ai@5 usage shapes
  (`reasoningTokens`, `cachedInputTokens`) are expressed through a `usageOf()` builder that emits
  the ai@7 `LanguageModelUsage` fields.
- Both files use `tests/a11y.ts` (`expectNoViolations`, `withDark`); no per-file `settle` copies;
  axe runs closed, open (popup-scoped, `region` rule not disabled), overflow state, and one
  composition under `withDark` per component. Every fixture is wrapped in `<main>`.
- Migrated QA reproducers (renamed): cache-key collision, overflow focusable, theme background,
  unknown language, empty code, clipboard missing → onError, copied re-arm; NaN%, reasoning
  priced, >100% clamp, ai@7 fields + priced model, unknown model / missing usage, keyboard focus
  opens, custom child replaces trigger. Dropped: none.
- Mutation checks performed (fix → test that caught it; all 16 caught, sources restored,
  `diff -q` clean):
  - M1 old sliced cache key → "shows the new code when only the middle of a snippet changes"
  - M2 scroll attributes never set → "makes an overflowing block a focusable, named scroll region"
  - M3 raw shiki `bg`/`fg` strings → "applies the shiki theme background and colours…"
  - M4 no `pending` dedupe → "tokenises a block once per mount, even under StrictMode" (got 4)
  - M5 no `text` fallback → "renders an unknown language as plain text with one warning per language"
  - M6 `--line-digits` fixed at 2 → "widens the line-number gutter with the digit count"
  - M7 `before:text-muted-foreground/50` → "renders line numbers in the full muted-foreground colour"
  - M8 `toCodeString` passthrough → "treats a missing code prop as empty text" (`reading 'split'`)
  - M9 no callback on cache hit → `highlightCode` › "notifies a caller synchronously on a cache hit"
  - M10 no `clearTimeout` on unmount → "clears the reset timer on unmount"
  - M16 `split("\n")` → "renders CRLF input as the same lines before and after highlighting"
  - M11 `used / max` → "renders 0% instead of NaN% or ∞% when the window size is unknown"
  - M12 reasoning via `reasoningTokens` → "totals the four rows…" (`Reasoning6K• $0.00`)
  - M13 footer = input + output → "totals the four rows…" (`expected 0.23 to be 0.32`)
  - M14 `value={percent}` → "sets the progress bar to the percentage, not the fraction"
  - M15 `delay={0}`/`closeDelay={0}` hard-coded → "forwards delay and closeDelay to the hover trigger"
- Console guard (`tests/setup.ts`, added by the tooling fixer mid-round): console spies are
  call-through (no `mockImplementation`) and restored inside their own test so hook order cannot
  matter; exactly three tests opt in — `code-block` › "renders an unknown language as plain text
  with one warning per language" (`allowConsole("warn")`, asserts one `console.warn` per language
  and no `console.error`), "keeps the raw text when a grammar fails to load and retries on the
  next mount" (`allowConsole("error")`, asserts the one "Failed to highlight code:" error), and
  `context` › "throws error when components used outside Context provider" (`allowConsole("error")`,
  React's boundary log). Every other test runs with a clean console. Negative check: with
  `allowConsole("warn")` removed, the unknown-language test fails with "Console output during
  the test …" (see "Commands run"); reverted.
- Three consecutive runs before the guard existed: 86/86, 86/86, 86/86 (10.31 s / 9.03 s / 10.03 s).
- Three consecutive runs under the guard (`pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx tests/browser/ai/context.test.tsx`):
  - run 1: `Test Files 2 passed (2) | Tests 86 passed (86) | Duration 9.71s`
  - run 2: `Test Files 2 passed (2) | Tests 86 passed (86) | Duration 7.12s`
  - run 3: `Test Files 2 passed (2) | Tests 86 passed (86) | Duration 5.55s`

## Registry entry changes (exact strings for `registry/ai/registry.json`; the registry owner applies them)

- code-block › description: "Syntax-highlighted code block for AI chat and agent UIs, rendered with shiki (github-light-high-contrast/github-dark-high-contrast, lazy-loaded per language, token cache, one highlight per snippet). Composes a header with filename/title, a copy-to-clipboard button with a checkmark timeout, a language selector built on Select, optional line numbers, and a body that shows raw text instantly and swaps in highlighted tokens when the highlighter resolves; a block that overflows becomes a keyboard-focusable, labelled scroll region. Use it for model-generated code, tool inputs/outputs, and snippets inside Response or Tool; use CodeBlockContent/CodeBlockContainer to build custom layouts."
- code-block › docs: "Ported to Base UI. CodeBlockLanguageSelector is Base UI Select.Root and is generic over the value: onValueChange is (value: Value | null, eventDetails) instead of (value: string), so a useState<string | null> setter or a literal-union state type-checks without casts (guard null before narrowing); pass `items` (Record<value, label>) to Select so CodeBlockLanguageSelectorValue renders the label instead of the raw value. CodeBlockLanguageSelectorContent forwards side/sideOffset/align/alignOffset to the positioner; Radix `position=\"popper\"` is `alignItemWithTrigger={false}` (the wrapper defaults to true). Copy button is the Base UI Button (use `render` instead of `asChild`). Header background is bg-muted/50 (upstream bg-muted/80) so 12px muted-foreground text meets 4.5:1 in the light theme. uifiles changes: a block whose code overflows becomes a focusable scroll region (tabIndex 0, role=\"region\") named by `aria-label` (default \"Code\"; `aria-label` on CodeBlock is routed to that region, not the container); an unknown or empty `language` renders as plain text (one console.warn per unknown language) instead of rejecting; `code` that is undefined/null renders as empty; CRLF input renders as the same lines before and after highlighting; the token cache is keyed on the full code, one highlight runs per snippet, and highlightCode invokes its callback synchronously on a cache hit; line numbers use the full muted-foreground colour and the gutter width follows the digit count."
- context › description: "Context-window usage indicator for AI chat: a ghost button showing percent used with a ring icon that opens a hover card with a progress bar, token counts (input, output, reasoning, cached) and a USD cost estimated by tokenlens from the model id, with reasoning billed as output and cached reads at the cache rate so the rows add up to the total. Use in a chat toolbar or prompt-input footer to show how much of the model's context a conversation has consumed."
- context › docs: "Base UI Preview Card puts hover delays on the trigger, not the root: Context no longer accepts openDelay/closeDelay; pass delay/closeDelay to ContextTrigger instead (both default 0). ContextTrigger composes HoverCardTrigger via render (a custom child element still replaces the default button, as upstream). Context's onOpenChange receives (open, eventDetails). ai@7 LanguageModelUsage moved fields: reasoning tokens are read from usage.outputTokenDetails.reasoningTokens and cached tokens from usage.inputTokenDetails.cacheReadTokens (upstream read usage.reasoningTokens / usage.cachedInputTokens). The Progress bar carries aria-label=\"Context window usage\" (upstream had no accessible name), and ContextContentFooter's label uses text-secondary-foreground for AA contrast on bg-secondary. Costs: the rows partition the usage so they add up to the footer — Input = inputTokens − cacheReadTokens at the input rate, Cache = cacheReadTokens at the cache-read rate, Output = outputTokens − reasoningTokens at the output rate, Reasoning = reasoningTokens at the output rate (tokenlens prices reasoning separately only for models with a reasoning rate; providers bill it as output). Each row is rounded to cents and Total cost is the sum of the rounded rows; a model tokenlens cannot price, or no modelId, shows $0.00. maxTokens of 0/undefined (model metadata not loaded yet) renders 0%, never NaN%. Numbers and currency use the fixed en-US locale (USD)."
- code-block › dependencies: unchanged (`lucide-react`, `shiki@^4.4`). context › dependencies: unchanged (`ai@^7`, `tokenlens@^1`).

## Requests for other owners

- `registry/ai/tool.tsx` (disclosure-agent fixer): `ToolInput` should still guard its own side
  (`JSON.stringify(input ?? null, null, 2)` or a "Streaming input…" placeholder); CodeBlock no
  longer crashes on `undefined`, so this is now presentation, not a crash.
- `registry/blocks/chat/components/blocks/chat.tsx` (chat-block fixer): same as above for the
  `input-streaming` card; no CodeBlock change needed.
- `tests/unit/qa-round1-tokens-css.test.ts` (tokens-css owner): the alpha-suffix regex now passes
  for `registry/ai/code-block.tsx` (`before:text-muted-foreground`); no change needed on my side.
- `docs/plan.md` / `docs/porting-ai-elements.md` (docs owner): note the two intentional
  divergences — CodeBlock `aria-label` → scroll region; Context rows are partitioned
  (Input excludes cache reads, Output excludes reasoning) so the footer is the sum of rows.
- Playwright owner: run the axe sweep over `/preview/code-block` at 375 px as well; the new "Long
  lines" sample exercises the focusable region at desktop width too.

## Strict-flag typecheck

`pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`

- Errors remaining in files I own: none (`registry/ai/code-block.tsx`, `registry/ai/context.tsx`,
  `app/preview/code-block/page.tsx`, `app/preview/context/page.tsx`,
  `tests/browser/ai/code-block.test.tsx`, `tests/browser/ai/context.test.tsx`).
- Errors in files I do not own (as of my run; other fixers were editing concurrently):
  `app/preview/model-selector/page.tsx:69`, `app/preview/prompt-input/page.tsx:42,136`,
  `components/ui/scroll-area.tsx:5`, `registry/blocks/chat/components/blocks/chat.tsx:491`,
  `scripts/generate-aliases.ts:40,73`, `scripts/sync-tokens.ts:43`,
  `tests/browser/ai/branch.test.tsx:28`, `tests/browser/ai/checkpoint.test.tsx:154`,
  `tests/browser/ai/prompt-input.test.tsx:62,75`, `tests/browser/ai/suggestion.test.tsx:40`.
- Default `pnpm exec tsc --noEmit`: only `tests/browser/qa-round1/chat-block-and-leaves.test.tsx:1169,1177,1219`
  and `tests/browser/qa-round1/prompt-input.test.tsx:234,250,272` (other lenses' reproducers).

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>

# baseline (before the fix): 10 failed | 20 passed (30) across the QA file + both canonical files
pnpm exec vitest run --project browser tests/browser/qa-round1/code-context-model-citation.test.tsx tests/browser/ai/code-block.test.tsx tests/browser/ai/context.test.tsx

# library probes (node ESM, written under node_modules/ and deleted): tokenlens getUsage per
# usage shape (reasoningTokens → $0 for gpt-4o; as output → $0.06/6K; cacheReads priced;
# unknown model → {}), shiki bg/fg strings, CRLF, "text" special language, bundledLanguages aliases

# fix loop
pnpm exec prettier --write registry/ai/code-block.tsx registry/ai/context.tsx app/preview/code-block/page.tsx tests/browser/ai/code-block.test.tsx tests/browser/ai/context.test.tsx
pnpm exec biome check registry/ai/code-block.tsx registry/ai/context.tsx app/preview/code-block/page.tsx app/preview/context/page.tsx tests/browser/ai/code-block.test.tsx tests/browser/ai/context.test.tsx   # clean
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals   # no errors in owned files
pnpm exec tsc --noEmit   # no errors in owned files
pnpm registry:validate   # exit 0

# tests (×3) and mutation checks (scratchpad/mutate.py applied each break, ran the target test, restored)
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx tests/browser/ai/context.test.tsx
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx -t "<test name>"

# render check against the running dev server
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/preview/code-block   # 200, SSR pre style="background-color:transparent;color:inherit", scroller without tabindex, --line-digits:2
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/preview/context      # 200, 40% / 95%
node scratchpad/hydration-check.mjs   # Playwright: /preview/code-block at 375 px and 1280 px, /preview/context at 375 px; console errors/warnings and region attributes

# console guard (tests/setup.ts): 3 runs under it (86/86 each), plus a negative check — with
# allowConsole("warn") removed from the unknown-language test:
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx -t "unknown language as plain text"
#   Tests 1 failed | 40 skipped (41)
#   Error: Console output during the test (call allowConsole() in a test that asserts it):
#     console.warn: CodeBlock: shiki has no "brainfuck" grammar; rendering it as plain text.
#     console.warn: CodeBlock: shiki has no "malbolge" grammar; rendering it as plain text.
# (test file restored; diff -q clean)
```
