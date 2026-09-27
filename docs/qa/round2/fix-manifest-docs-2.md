# fix-manifest-docs-2

Lens: `manifest-docs-2` (deferred `docs`/`description` strings and doc sentences from the five round-2
fix reports). Scratch: `/docs/qa/round2/manifest-docs-2/`
(`parse-reports.mjs` + `report-strings.json` = the strings extracted from the reports, `apply-manifest.mjs`,
`apply-architecture.mjs`, `apply-changelog.mjs` = the anchored edits, `probe.log`/`probe2.log` = the preview
render-identity probe).

Files changed: `registry/ai/registry.json`, `registry/blocks/registry.json`, `docs/architecture.md`,
`CHANGELOG.md`, `app/preview/code-block/page.tsx` (+ new `code-block-demo.tsx`),
`app/preview/suggestion/page.tsx` (+ new `suggestion-demo.tsx`). Untouched: `AGENTS.md` (no report asked for a
rule sentence; the `docs/plan.md` reference leaves-tokens:F9 mentions is already gone), `tests/unit/registry.test.ts`
(no structural manifest change, every invariant passes).

Every string was applied by script from the report text (JSON-parsed, so `\"` escapes are exact), each partial
edit anchored on the current text and refused if the anchor was missing or ambiguous, and every claim was read
against the current source before applying (line refs below).

## Registry entries applied (`registry/ai/registry.json`)

| item | field | source report | verified against | note |
| --- | --- | --- | --- | --- |
| inline-citation | description, docs | fix-code-context-model-citation | `inline-citation.tsx:87` (`reason: "trigger-press"`), `:227-228` (delay/closeDelay default 0), `:249-253` (consumer `onClick` first, `preventDefault` skips `press`), `:155-157` (pinned card cancels the hover close), `:187-192` (Escape returns focus, ignore flag), `:272` `cycleTab`, `:292` `PinnedFocus`, `:215-216` try/catch hostname, `:553-556` `hasContent`, `:579` `<p>` title, `:478` `text-secondary-foreground`, `:488-490` `size-6` | applied verbatim |
| model-selector | description, docs | same | `model-selector.tsx:231-234` (`src`), `:245` default URL, `:248,259-261` hide keyed on the resolved source, `onError` still called; `app/preview/model-selector/model-selector-demo.tsx` passes `src={logos[...]}` on every logo | applied verbatim |
| context | docs (one sentence replaced) | same | `context.tsx:81-84` `usedPercent` (non-finite or `max <= 0` → 0, negative used → 0), `:88-92` `count`/`formatTokens` (undefined/NaN/Infinity/negative → 0), `:269-270` header, `:96-100` rows through `count` | applied verbatim |
| code-block | docs (from "uifiles changes:" to the end replaced) | same | `code-block.tsx:184-195` `defaultContentLabel` (aliases via `bundledLanguagesInfo`; text/plaintext/unknown → "Code"), `:205` `Object.hasOwn`, `:201-203` empty language returns before the warn, `:210-215` one warn per language, `:181` NUL-separated cache key, `:307-310` sync callback on cache hit, `:275-280` CRLF, `:596-598` `role="group"` + `tabIndex: 0`, `:95` `before:text-muted-foreground`, `:84-92` gutter digits | applied verbatim |
| code-block | description | (my correction) | same `:596` | "keyboard-focusable, labelled scroll region" → "… scroll container": the docs now say the scroller is a `role="group"`, not a landmark, so the description should not say "region" |
| queue | description, docs (last sentence replaced) | fix-disclosure | `queue.tsx:137` `pointer-coarse:opacity-100` next to `group-hover`/`group-focus-within`/`focus-visible`, `:82` `line-clamp-2` | applied verbatim |
| reasoning | docs (sentence inserted) | fix-disclosure | `reasoning.tsx:117` `Math.max(1, Math.ceil(...))`, `:191` `duration === 0` still reads as thinking, `:197` renders literally "Thought for 1 seconds" | applied verbatim |
| checkpoint | docs (sentence inserted) | fix-disclosure | `checkpoint.tsx:72` `describes = tooltip !== props["aria-label"] && tooltip !== children`, `:80-84` `aria-describedby` set before `{...props}` so a consumer's wins, `:94-97` `sr-only` description | applied verbatim |
| confirmation | docs (sentence inserted) | fix-disclosure | `confirmation.tsx:149` `<span className={cn("text-destructive", className)}>` | applied verbatim |
| tool | description | fix-disclosure | `tool.tsx:161-176` `renderOutput`: strings and objects in `CodeBlock`, React elements in a `<div>`, other primitives as `String()` | applied verbatim |
| chain-of-thought | title | fix-disclosure | already "Chain of Thought" (fix-meta applied it) | unchanged |
| branch | docs | fix-leaves-tokens | `branch.tsx:66-76` `countBranches` (fragments and host elements), `:99-104` derived count then registered fallback, `:110-113` `onBranchChange(clamped)` once, guarded by `totalBranches > 0`, `:176-182` layout-effect registration only when `derivedTotal` is undefined, `:270-279` `MessageBranchPageProps = ComponentProps<typeof ButtonGroupText>`; `components/ui/button-group.tsx:41-57` `ButtonGroupText` is `useRender` on a `div` with a `render` prop | applied verbatim |
| response | docs | fix-leaves-tokens | `response.tsx:31-41` code bodies "Code" and table scrollers "Table", `:59-67` `tabIndex`/`role="group"`/`aria-label` set and removed, `:79,112` resize + mutation observers, `:96-109` hydration guard, `:19-21` shiki themes | applied verbatim |
| sources | docs | fix-leaves-tokens | `sources.tsx:92-96` `children || (...)`, `title || (href ? hostnameOf(href) || href : undefined)` | applied verbatim |
| suggestion | docs | fix-leaves-tokens | `suggestion.tsx:52-59` `onFocus?.(event)` then `scrollIntoView({ block: "nearest", inline: "nearest" })` | applied verbatim |
| prompt-input | description, docs | fix-prompt-input-chat | current strings are byte-identical to the report's (fix-meta applied them) | unchanged |

`registry/blocks/registry.json` › chat › docs: applied verbatim from fix-prompt-input-chat, verified against
`chat.tsx:222-223` (row for `error || status === "error"`), `:647` `"Something went wrong."` fallback, `:649` Retry only
with `onRetry`, `:634-637` `Promise.resolve().then(onRetry).catch(console.error)`, `:697` `if (busy) return false`,
`:701` `void onSubmit(message)`, `:531` `<ToolInput input={part.input} />`, and `registry/blocks/chat/page.tsx:24`
`void sendMessage(...)`. chat › description unchanged (the report says so). No `dependencies`/`registryDependencies`
changes anywhere.

Claims corrected: none of the report strings disagreed with the code. The one wording change of my own is the
code-block description ("scroll region" → "scroll container"); the same word in the CHANGELOG "Added" line for
`code-block`'s `aria-label` was aligned. Invariants checked by the apply script: every description ≤ 900 chars
(longest: prompt-input 706) and period-terminated, every `docs` starts with the "Built for the Base UI styles
(base-nova)" sentence, items stay sorted, Prettier applied.

## docs/architecture.md §3

- Applied fix-code-context-model-citation's requests: `code-block` bullet now says `role="group"` (not a landmark),
  "<Language> code"/"Code" default names, own-key language check and the language+code cache key; `context` bullet
  covers `usedTokens`/`maxTokens` zero/undefined/NaN/infinite/negative → 0% and 0 in the header; `model-selector`
  bullet gains `src` and the hermetic preview; `inline-citation` bullet gains press/pin/Tab/Escape, `trigger-press`,
  and the empty-content cases.
- fix-prompt-input-chat's chat and prompt-input wording was already in place (fix-meta); I added the two remaining
  round-2 prompt-input divergences (`maxFiles` across `add()` calls in provider mode; an empty tooltip renders
  neither tooltip nor description) and reflowed that bullet.
- Round-2 divergences from fix-disclosure and fix-leaves-tokens that §3 did not yet list (the section's contract is
  one line per item, mirrored in `docs`): `reasoning` ≥ 1 s duration; `queue` coarse-pointer reveal and two-line
  clamp; `confirmation` destructive span; new `checkpoint` bullet (tooltip description); `branch` render-time count,
  clamp callback and `ButtonGroupText`; new `response` bullet (code/table `role="group"` scrollers); `sources` empty
  title/children fallbacks; new `suggestion` bullet (scroll into view on focus).
- §4 untouched (the sync-tokens cascade rule lives in the script header and the CHANGELOG; no report asked for §4).

## CHANGELOG.md (0.1.0, the untagged curated release, where fix-meta put its round-2 lines)

Added: prompt-input `onSubmit` may return `false`; `ModelSelectorLogo` `src`. Changed: citation card opens on
click/tap, pins, Tab cycles, Escape returns focus; per-submit attachment clearing and tooltip-repeat rule;
chat generic error row and send-time attachment clearing; queue actions on coarse pointers + two-line titles;
response tables and code-block scrollers as `role="group"` named containers; branch SSR count and controlled
clamp callback; sources empty-title fallback, checkpoint description, confirmation destructive colour, suggestion
focus scroll; context header 0 not NaN/∞. Fixed: code-block prototype-key language crash and colon cache
collision; prompt-input controlled-textarea restore, provider-mode `maxFiles`, duplicated tooltip description;
reasoning 0 s "Thinking..." forever; chat rejected `onRetry` and late attachment clearing; sync-tokens cascade
rule (unlayered beats layered, cross-layer conflict, block value and unterminated `url(` refused).

## Preview page splits

- `app/preview/code-block/page.tsx` is a server component (`metadata: Metadata = { title: "Code Block" }`, the
  `<h1>`, then `<CodeBlockDemo />`); `code-block-demo.tsx` (`"use client"`) holds the samples, `useState` and the
  three blocks. `app/preview/suggestion/page.tsx` likewise (`{ title: "Suggestion" }`, the `<section>` and `<h1>`,
  then `<SuggestionDemo />`); `suggestion-demo.tsx` holds the list, `useState`, the `<h2>`, `Suggestions` and the
  status line. Mirrors `app/preview/model-selector/`.
- Rendered output: a throwaway unit test (`probe.log`, `probe2.log`; file deleted afterwards) rendered the HEAD
  pages and the new pages with `renderToStaticMarkup`. Lengths identical (10094 / 8239 chars); the only bytes that
  differ are React `useId` values (`base-ui-_R_6a_` → `base-ui-_R_p6_` on the Select trigger and its hidden input,
  and the Base UI style ids), which move with the component boundary; with ids normalised both pages are
  byte-identical, the `<h1>` is still the first element / first child of the `<section>`.
- Not rendered against the server: `:3000` serves the build from before this round (`pnpm build` is the lead's).
  After the rebuild, `/preview/code-block` and `/preview/suggestion` should carry "Code Block · uifiles" and
  "Suggestion · uifiles" through the root layout's `%s · uifiles` template; `pnpm test:e2e` covers the pages.

## Not applied and why

- `AGENTS.md`: no rule sentence requested; leaves-tokens:F9's `docs/plan.md` reference is already gone (grep is
  empty; the site test asserts its absence).
- Cross-owner code requests in the reports are already done by their owners or out of my files:
  `e2e/helpers.ts` route block (fix-meta did it), `registry/ai/code-block.tsx` `role="group"` (ccmc fixer did it),
  `tests/setup.ts` guard (fix-meta), the chat.test.tsx "Pending" pin (chat fixer's file; already covered at
  `chat.test.tsx:768` per fix-disclosure), `tests/unit/ssr.test.ts` branch assertion, `components/ui/button.tsx`
  destructive focus border and `components/ui/tooltip.tsx` description prop (vendored; owner decisions).
- `tests/unit/registry.test.ts`: no new exemption needed; all 25 tests pass with the new strings.

## Verification

```
pnpm exec prettier --write <8 files>            # all "(unchanged)" after the scripts' output; --check: clean
pnpm exec biome check registry app/preview/code-block app/preview/suggestion docs   # Checked 33 files. No fixes applied.
pnpm registry:validate                          # Registry is valid. Checked 8 registry files and 83 items.
pnpm exec tsc --noEmit                          # exit 0
pnpm exec vitest run --project unit             # Test Files 8 passed (8) / Tests 296 passed (296)
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx tests/browser/ai/suggestion.test.tsx
                                                # Test Files 2 passed (2) / Tests 69 passed (69)
# render-identity probe (temporary tests/unit/zz-preview-split.test.ts + HEAD copies as old-page.tsx, deleted):
#   raw: 2 failed, only useId values differ (lengths equal); ids normalised: 2 passed
git status --short                              # only the 8 files above (6 modified, 2 new)
```

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round2/manifest-docs-2
node $S/parse-reports.mjs        # extracts the report strings → report-strings.json (all full strings JSON-parse cleanly)
node $S/apply-manifest.mjs       # 20 fields changed, 3 already applied; invariants asserted
node $S/apply-architecture.mjs; node $S/apply-changelog.mjs
pnpm exec prettier --write app/preview/code-block/page.tsx app/preview/code-block/code-block-demo.tsx app/preview/suggestion/page.tsx app/preview/suggestion/suggestion-demo.tsx docs/architecture.md CHANGELOG.md registry/ai/registry.json registry/blocks/registry.json
pnpm exec biome check registry app/preview/code-block app/preview/suggestion docs
pnpm registry:validate; pnpm exec tsc --noEmit
pnpm exec vitest run --project unit
pnpm exec vitest run --project browser tests/browser/ai/code-block.test.tsx tests/browser/ai/suggestion.test.tsx
pnpm exec vitest run --project unit tests/unit/zz-preview-split.test.ts   # probe, then rm of the probe files
```
