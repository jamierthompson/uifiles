# fix-registry-manifest

Files edited: `registry/ai/registry.json`, `registry/blocks/registry.json` (nothing else).
`registry/base/registry.json` was left as the tokens fixer applied it (docs, dependencies,
devDependencies verified present; `tests/unit/tokens.test.ts` › base docs assertion passes).

Every `docs`/`description` claim below was checked against the current source before it was
applied (`registry/ai/<name>.tsx`, `registry/blocks/chat/**`, the `components/ui/*` wrappers,
`@base-ui/react` 1.8 `.d.ts`, `ai` 7 `index.d.ts`/`index.js`, `streamdown` 2.6 and
`@streamdown/*` package.json and dist). Corrections are listed per item.

## Base UI sentence (rule 3)

Added once, at the start of every `registry/ai` item's `docs` and the chat block's, in one of
two forms so that no item claims code it does not have:

- 16 items that import base-nova wrappers: "Built for the Base UI styles (base-nova): it
  composes the Base UI wrappers from components/ui and relies on their render prop and event
  signatures, so it does not work on Radix or React Aria styles."
- `image` and `response` (no wrapper imports at all; a plain `<img>` and a Streamdown wrapper):
  "Built for the Base UI styles (base-nova); the file imports no style wrappers, so nothing in
  it is style-specific." Saying these "do not work on Radix" would be false.
- `chat` block: "Built for the Base UI styles (base-nova): it composes the base-nova wrappers
  from components/ui and the @uifiles AI items, which rely on Base UI's render prop and event
  signatures, so it does not work on Radix or React Aria styles."

Covers registry-contract.md F6 ("Base UI only" is now stated in every AI item's docs).

## Per item

### branch (fix-leaves)
- docs: replaced with the fixer's string. Verified: controlled `branch` + `onBranchChange`,
  clamping (`clampBranch`), "0 of 0" (`MessageBranchPage`), `Children.toArray` for
  null/boolean/RSC children. Reworded "Base UI: Button is the Base UI Button primitive" to
  "The buttons are the Base UI Button primitive" (reads better after the new lead sentence).
- description, dependencies: unchanged.

### chain-of-thought (fix-cot-queue-checkpoint-confirmation)
- docs: existing string + the requested append (unknown status → complete styling,
  `ChainOfThoughtSearchResults` renders nothing without children, `ChainOfThoughtImage` frame
  and caption). All three verified in source.
- description, dependencies: unchanged.

### checkpoint
- docs: Base UI sentence only; existing claims re-verified (TooltipTrigger `render`, no
  TooltipProvider needed, Base UI Separator).

### code-block (fix-code-block-context; code-context F16)
- description: replaced. F16 fixed: themes are now `github-light-high-contrast` /
  `github-dark-high-contrast` (matches `THEMES` in source); adds "one highlight per snippet"
  and the focusable scroll region.
- docs: replaced. Verified: generic `CodeBlockLanguageSelector<Value>`; `items` accepted by
  Base UI `Select.Root` (`Record<string, ReactNode> | array`); wrapper defaults
  `alignItemWithTrigger = true` and forwards side/sideOffset/align/alignOffset
  (`components/ui/select.tsx:61-79`); `bg-muted/50` header; `role="region"` + `tabIndex 0` +
  `aria-label` default "Code" routed to the scroller; `resolveLanguage` warn-once fallback;
  `toCodeString`; CRLF split; cache key `language:code`; synchronous callback on cache hit;
  `before:text-muted-foreground` and `--line-digits` gutter.
- dependencies: unchanged.

### confirmation (fix-cot-queue-checkpoint-confirmation)
- description and docs: replaced with the fixer's strings. Verified: `respondedStates`
  includes `output-error`; `Confirmation` returns null unless request or a boolean decision;
  `ConfirmationAction` merges `h-8 px-3 text-sm` through `cn`; `nativeButton` exists on the
  Base UI Button.

### context (fix-code-block-context)
- description and docs: replaced. Verified `splitUsage`/`priceRows` (Input = input − cache
  reads, Output = output − reasoning, reasoning priced at output rate, cents rounding, total is
  the sum of rounded rows, `$0.00` without a priceable model), `usedPercent` guard, en-US
  formatters. Added one true clause the fixer left out: "A row with zero tokens is omitted"
  (`UsageRow` returns null when `!tokens`), because the partition description otherwise
  suggests four rows always render. Replaced the em dash in the fixer's string with a full stop.
- dependencies: unchanged.

### image (fix-leaves)
- docs: replaced. Correction: the fixer's "Only alt, className and the data: src reach the
  <img>; uint8Array and providerMetadata are stripped" was reworded to "base64 and mediaType
  become the data: src; uint8Array and providerMetadata are stripped, so only alt, className
  and src reach the <img>" (base64/mediaType are consumed, not stripped). `GeneratedFile`
  fields and the `DefaultGeneratedFile` lazy getter confirmed in `ai/dist`.
- description: "pass alt and className through" → "alt is required and className passes
  through" (alt is now a required prop; the old wording implied optional).

### inline-citation (fix-model-selector-inline-citation)
- docs: replaced. Verified: `render={<Badge render={<button type="button" />} />}`,
  `URL.canParse` fallback, `InlineCitationCardBodyProps = ComponentProps<typeof
  HoverCardContent>`, `disabled={!canScrollPrev/Next}`, `size-6` + focus ring, snap sync on
  `select`/`reInit`/`slidesChanged` and `0/0`, `consumerSetApi`, `hasContent` guards, `<p>`
  title, `text-secondary-foreground` index.
- description, dependencies: unchanged.

### model-selector (fix-model-selector-inline-citation; fix-tooling)
- description and docs: replaced with the fixer's strings. Verified: `modelSelectorFilter`
  whole-term matching, `filter`/`shouldFilter` props, `ModelSelectorList` live-region slot +
  `createPortal`, `aria-hidden` separator, logo `alt=""`/`aria-hidden`/`hidden` on error,
  `**:data-[slot=input-group]:h-auto!` (command wrapper forces `h-8!`), `"use client"`.
- dependencies: kept `["cmdk@^1", "cn"]` as the tooling fixer applied it. Note: the source no
  longer imports `cmdk` (the fixer replaced the fuzzy filter with a local one; `cmdk` appears
  only in a comment), so the import cross-check does not require it. Kept because the docs tell
  consumers to pass `defaultFilter` from "cmdk", and the pin keeps that on a 1.x that matches
  upstream `command`. Remove it if you prefer declared = imported strictly.

### plan (fix-reasoning-tool-task-plan)
- docs: replaced. Verified: `render={<Card />}`, `PlanContent` typed as `CardContent` props
  (no `keepMounted`), `shimmer` span, `PlanTrigger` `{...props}` after `render`,
  `CardTitle`/`CardDescription` are `<div>`s (`components/ui/card.tsx:35,48`), closed by default.

### prompt-input (fix-prompt-input)
- docs: replaced with the fixer's 13-point string, unchanged apart from the lead sentence.
  Every point verified: (1) `PromptInputActionAddScreenshot` no `closeOnClick` default, catch
  path → `onError` `{ code: "screenshot" }` / `console.error`; (2) `closeOnClick={false}` on
  AddAttachments; (3) delay context; (4) `PromptInputSelect: typeof Select`, Base UI
  `SelectValue` children function; (5) Base UI event types; (6) Enter → enabled
  `button[type="submit"]` only; (7) `matchesAccept` + partial-batch `onError`; (8) codes and
  exported `PromptInputError`; (9) `restoreText`; (10) `syncHiddenInput` clear-only; (11)
  `aria-label="Message"` before `{...props}`; (12) `delay={0}` + `sr-only` description,
  `components/ui/tooltip.tsx` has no aria/role; (13) `flex-wrap` tools, `shrink-0` submit,
  `useAddonClick` focuses the textarea.
- description, dependencies: unchanged (`ai@^7`, `cn`, `lucide-react`, `nanoid@^6`).

### queue (fix-cot-queue-checkpoint-confirmation; fix-tokens-css F6)
- description and docs: replaced with the component owner's strings. This also satisfies the
  tokens fixer's F6 ask (the old "completed items keep upstream's text-muted-foreground/50 and
  /40, which do not meet AA contrast" sentence is gone); the tokens fixer's shorter replacement
  sentence was not used because the owner's string covers the same change plus the indicator
  and focus-reveal changes. Verified in source (`QueueItemContent`, `QueueItemIndicator`,
  `QueueItemAction` `focus-visible`/`group-focus-within`).

### reasoning (fix-reasoning-tool-task-plan; fix-tokens-css)
- description: replaced.
- docs: replaced, with one correction. The fixer wrote "plus one @source line per
  @streamdown/* plugin: cjk, code, math, mermaid"; the plugin dists contain no class strings
  (checked all four `@streamdown/*/dist/*.js`; only `streamdown/dist/chunk-*.js` carries
  Tailwind classes, and this repo's `app/globals.css` has exactly the one `@source`). The CSS
  sentence now matches the tokens fixer's wording (one `@source`, `styles.css` for the
  animations) and carries the KaTeX sentence. Verified: ref-held `onOpenChange`, `<span>`
  labels, `wasStreamingRef`/`autoCloseSpentRef` cycle, controlled parent receives both
  requests, `shikiTheme` high-contrast pair, `min-h-6`.
- dependencies: added `katex@^0.16` (see "KaTeX dependency" below); order follows the
  existing convention (alphabetical ignoring the `@` scope prefix).

### response (fix-leaves; fix-tokens-css)
- docs: replaced with the leaves fixer's string, the streamdown sentence swapped for the tokens
  fixer's wording, and the KaTeX sentence appended (both requested). Verified `styles.css`
  ships `sd-fadeIn`/`sd-blurIn`/`sd-slideUp`/`sd-markerIn` and `[data-sd-animate]`
  selectors; `@streamdown/math` `singleDollarTextMath` note kept. Added one true sentence no
  fixer supplied: `MessageResponse` passes the high-contrast `shikiTheme` pair (same
  divergence the reasoning docs already record; `{...props}` after it, so a consumer's prop
  wins).
- dependencies: added `katex@^0.16`.
- description: unchanged.

### sources (fix-leaves)
- docs: replaced. Correction: "a missing `title` falls back to the URL's hostname" → "(or the
  href itself when it has none)", matching `hostnameOf(href) || href`.
- description: the requested "A Source without href renders as plain text." sentence added;
  also corrected "opens in a new tab" → "absolute URLs open in a new tab" (relative links now
  open in the same tab) and "Used N sources" → "(singular for one)".

### suggestion, task, tool
- docs: Base UI sentence + the fixers' strings (task, tool from fix-reasoning-tool-task-plan).
  Verified: `CollapsibleTriggerProps extends NativeButtonProps` (so `nativeButton={false}` is
  real), `min-h-6`, `group-data-panel-open`, `keepMounted` on `Collapsible.Panel`; tool's
  `<div>` labels, "No input yet", BigInt replacer + `String()` fallback, falsy outputs,
  unknown-state fallback.
- descriptions, dependencies: unchanged.

### chat block (fix-chat-block; fix-tokens-css)
- description: the two requested edits applied (ChatErrorMarker in the export list; "an error
  row with Retry when a request fails"), then tightened from ~1080 to 897 characters to stay
  under the ~900 target: dropped "Complete", "(Streamdown markdown)" → "(Streamdown)",
  "(collapsible thinking)", "with input and output", "and anchors each user turn", "file parts
  as". All exports named exist in `chat.tsx`.
- docs: replaced with the fixer's string plus the CSS sentence (Streamdown `styles.css` +
  `@source`, KaTeX stylesheet). Verified: `error`/`onRetry` props and `ChatErrorMarker`,
  `handleKeyDown` Enter guard, `isLive`/settled mapping (`input-available` → "Pending"), no
  Confirmation wiring, page uses `h-svh` and `transport`/`regenerate`.
- registryDependencies: added `"button"` (imports `@/components/ui/button` for Retry).

## KaTeX dependency (judgment call; revert if unwanted)

`katex@^0.16` was added to `response` and `reasoning` `dependencies` although no fixer asked
for it. The tokens fixer's docs claim "streamdown depends on katex, so it resolves without a
direct dependency" holds only for hoisting package managers: `katex` is a dependency of
`@streamdown/math`, not of `streamdown`, and under pnpm (this repo's own package manager) it is
not linked into the consumer's root `node_modules`, so `@import "katex/dist/katex.min.css"`
fails to resolve. This is exactly why the tooling fixer had to add `katex@^0.16.47` directly to
`package.json` here. Declaring it lets the CLI install it so the docs instruction works
everywhere; the docs say "(this item installs katex, which @streamdown/math uses)". The chat
block does not declare it (it gets it through `@uifiles/response`/`@uifiles/reasoning`; its
docs say so). The unit invariant "every declared dependency is installed here with a compatible
major/minor" passes (`^0.16` vs installed `^0.16.47`).

## Dependency cross-check (rule 4)

Grepped every `from "..."` in the 18 `registry/ai/*.tsx`, `chat.tsx`, `demo-conversation.ts`
and `page.tsx`: every bare package import is declared (react/react-dom exempt), every
`@/components/ui/<x>` import has a bare `<x>` entry, and every `@/registry/ai/<x>` import has
`@uifiles/<x>` (`tool.tsx` imports `./code-block` → `@uifiles/code-block`). No other additions
were needed. `tests/unit/registry.test.ts` enforces the same and passes.

## Verification

- `pnpm registry:validate`: "√ Registry is valid. √ Checked 8 registry files and 83 items."
- `pnpm exec biome check registry`: "Checked 29 files in 45ms. No fixes applied."
- `pnpm exec prettier --write registry/ai/registry.json registry/blocks/registry.json`: run
  after every apply.
- `pnpm exec vitest run --project unit tests/unit/registry.test.ts`: 22 passed (22).
- `pnpm exec vitest run --project unit` (all): 7 files, 243 tests; 1 failure, unrelated to
  the manifests: `tests/unit/site.test.ts › licensing and attribution › keeps LICENSE as the
  only licence-like file at the root` (the docs fixer's staged rename `LICENSE-ai-elements →
  licenses/APACHE-2.0-ai-elements.txt` and their edit to `site.test.ts` were in flight during
  the run; an earlier run also failed the README `LICENSE-ai-elements` assertion, which had
  cleared by the second run). `tokens/tooling/workflows/ssr/test-setup`: 190 passed.
- Description lengths (chars): branch 474, chain-of-thought 423, checkpoint 295, code-block
  688, confirmation 602, context 460, image 274, inline-citation 311, model-selector 386,
  plan 357, prompt-input 685, queue 443, reasoning 573, response 373, sources 383, suggestion
  433, task 329, tool 513, chat 897. None over 900.
- Base UI sentence present in 19 of 19 `docs`; items array sorted by name in both files; every
  description ends with a period (the unit regex requires it).

## Not applied and why

- fix-tokens-css › queue docs sentence: superseded by the queue owner's fuller string (same
  F6 outcome; see queue above).
- fix-reasoning-tool-task-plan › "one @source line per @streamdown/* plugin": factually wrong
  (plugins ship no classes); corrected rather than applied.
- fix-tooling › `input-otp` title and per-item `cn`: already on disk, confirmed.
- fix-app-docs-oss: no registry asks.
- Not in my ownership: the reasoning/prompt-input reports ask for wrapper forks
  (`components/ui/command.tsx`, `tooltip.tsx`, `select.tsx`, `carousel.tsx`); the docs strings
  describe the current local workarounds, which stay accurate until a fork lands.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
node <scratchpad>/registry-manifest/apply.mjs      # applies <scratchpad>/registry-manifest/updates.txt
pnpm exec prettier --write registry/ai/registry.json registry/blocks/registry.json
pnpm registry:validate
pnpm exec biome check registry
pnpm exec vitest run --project unit
pnpm exec vitest run --project unit tests/unit/registry.test.ts
```
