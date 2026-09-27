# disclosure-agent — QA round 1

## Summary

Attacked the eight Base UI Collapsible / agent-lifecycle ports (`reasoning`, `tool`, `task`, `plan`,
`chain-of-thought`, `queue`, `checkpoint`, `confirmation`): the shared controlled/uncontrolled
pattern, timers, every `state` branch, `docs` claims, keyboard/axe in open and closed states, and
the existing tests. Reproducers: `tests/browser/qa-round1/disclosure-agent.test.tsx` (30 tests:
6 fail by design, 24 pin working behaviour). Findings: 1 high, 6 medium, 4 low, 2 nit.
Worst thing: `ToolInput` crashes the React tree on the very first chunk of every streaming tool
call, because `ai@7` creates the part with `input: undefined` and the port (like upstream) does
`JSON.stringify(undefined)` → `CodeBlock` calls `.split` on `undefined`. The preview page hides it
by passing `{ city: "Melb" }` for the `input-streaming` example. Second worst: the port's
controlled/uncontrolled replacement makes `Reasoning`'s auto-close timer restart on every parent
render whenever `onOpenChange` is an inline function (Radix's setter was stable), so the panel never
auto-closes while the rest of the message is streaming.

## Findings (most severe first)

### F1. `ToolInput` crashes on the `input: undefined` that ai@7 emits for a fresh `input-streaming` part — severity: high

- Where: `registry/ai/tool.tsx:127` (`JSON.stringify(input, null, 2)` → `undefined`), consumed by
  `registry/ai/code-block.tsx` `createRawTokens`/`getTokensCacheKey` (`code.split`, `code.slice`).
- What: `<ToolInput input={undefined} />` throws `TypeError: Cannot read properties of undefined
  (reading 'split')` during render. `ai@7` sets exactly this shape on `tool-input-start`
  (`node_modules/ai/dist/index.js:7878-7897`: `state: "input-streaming", input: void 0`) and the
  type allows it (`node_modules/ai/dist/index.d.ts:2162-2163`: `input?: DeepPartial<…> | undefined`).
  The item's `description` says "Use it to render ToolUIPart … parts from useChat messages" — the
  documented use crashes on the first chunk of every tool call unless the consumer guards.
- Evidence: reproducer `tool › EXPECTED FAIL: ToolInput survives the undefined input of a fresh
  input-streaming part` →
  `AssertionError: expected "vi.fn()" to not be called … [TypeError: Cannot read properties of undefined (reading 'split')]`.
  `app/preview/tool/page.tsx:27-29` passes `{ city: "Melb" }` for the `input-streaming` example, so the
  preview never exercises the real shape. Inherited from upstream `tool.tsx:351` (same code), but the
  registry owns the consumer contract now.
- Why it matters: whole chat page unmounts (no error boundary) the moment a model starts a tool call.
- Proposed fix: in `ToolInput`, `code={JSON.stringify(input ?? null, null, 2)}` or render a
  placeholder when `input === undefined`; harden `CodeBlock` with `code ?? ""`. Update the preview to
  use `input={undefined}` for the streaming example so Playwright/axe sees the real state.
- Test written: `tests/browser/qa-round1/disclosure-agent.test.tsx` › "tool › EXPECTED FAIL: ToolInput
  survives the undefined input of a fresh input-streaming part" (expected: FAIL now)

### F2. `Reasoning` auto-close timer restarts on every parent render when `onOpenChange` is unstable — severity: medium

- Where: `registry/ai/reasoning.tsx:77-83` (`setIsOpen = useCallback(…, [isOpenControlled, onOpenChange])`),
  `:120-134` (auto-close effect depends on `setIsOpen`; cleanup `clearTimeout`). The pattern is the one
  prescribed by `docs/porting-ai-elements.md:41-51`.
- What: with `onOpenChange={(open) => …}` (an inline arrow, the common way to write it) every parent
  render gives `setIsOpen` a new identity, the effect re-runs, and the 1 s timer is cleared and
  restarted. A chat page re-renders on every streamed token of the answer that follows the reasoning
  block, so the panel never auto-closes until 1 s after the last render. Upstream's Radix
  `useControllableState` stores `onChange` in a ref and keeps the setter stable, so upstream closes on
  time. `Reasoning` is `memo`, but `children`/`onOpenChange` change every render, so memo does not help.
- Evidence: reproducer parent re-renders every 150 ms with an inline handler; after `isStreaming`
  flips to false, `aria-expanded` is still `"true"` after 2.5 s (`AssertionError: expected 'true' to be
  'false'`). The sibling test with a `useCallback` handler passes (closes within ~1 s), isolating the
  cause to handler identity.
- Why it matters: silent behavioural divergence from upstream; the headline feature of the item
  ("auto-closes one second after it ends") does not happen in a real streaming chat. The same pattern
  is in `chain-of-thought.tsx:62-68` (harmless there: no effects depend on it) and, per the porting
  doc, in every other port that replaced `useControllableState`.
- Proposed fix: keep the latest `onOpenChange` in a ref (`useRef` + `useLayoutEffect`, or
  `@base-ui/utils/useStableCallback` if the dependency is acceptable) and give `setIsOpen` a stable
  identity; fix the snippet in `docs/porting-ai-elements.md`. Also drop `setIsOpen` from the effect
  deps once stable.
- Test written: › "reasoning › EXPECTED FAIL: auto-close still fires when the parent re-renders with an
  inline onOpenChange" (expected: FAIL now); › "reasoning › auto-closes ~1s after streaming ends even
  when the parent re-renders (stable onOpenChange)" (expected: PASS, control).

### F3. `QueueItemAction` is invisible when reached by keyboard (opacity 0 on focus) — severity: medium (a11y; inherited)

- Where: `registry/ai/queue.tsx:131` — `opacity-0 transition-opacity group-hover:opacity-100 …`; no
  `focus-visible:` / `group-focus-within:` rule.
- What: Tab lands on the "Complete task-1" button (it is focusable, has a name, receives the focus
  ring) but `getComputedStyle(button).opacity === "0"`. A keyboard user cannot see what they are about
  to activate (WCAG 2.4.7 Focus Visible). Same classes upstream (`queue.tsx:129`).
- Evidence: reproducer `queue › EXPECTED FAIL (inherited from upstream): hover-only action buttons
  become visible on keyboard focus` → `AssertionError: expected '0' to be '1'`. axe cannot catch this
  (it does not evaluate `:hover`/`:focus` styles), which is why the existing test passes.
- Proposed fix: add `focus-visible:opacity-100 group-focus-within:opacity-100` (and note the change in
  `docs`, as the port already does for the contrast fix).
- Test written: › "queue › EXPECTED FAIL (inherited from upstream): hover-only action buttons become
  visible on keyboard focus" (expected: FAIL now)

### F4. A user cannot close `Reasoning` while it is streaming — the auto-open effect re-opens it — severity: medium (inherited)

- Where: `registry/ai/reasoning.tsx:113-117` — `if (isStreaming && !isOpen && !isExplicitlyClosed) setIsOpen(true)`
  runs whenever `isOpen` changes, not only when streaming starts.
- What: click the trigger during streaming → Base UI calls `onOpenChange(false)` → state becomes
  false → the effect immediately sets it back to true. The chevron/aria-expanded flicker and the panel
  stays open. Upstream has the identical effect (`reasoning.tsx:101-105`).
- Evidence: reproducer clicks the trigger while `isStreaming` and reads `aria-expanded` 200 ms later:
  `AssertionError: expected 'true' to be 'false'`.
- Why it matters: long reasoning streams (tens of seconds) cannot be collapsed by the reader.
- Proposed fix: auto-open only on the false→true transition of `isStreaming` (track the previous value
  in a ref), leaving later user toggles alone.
- Test written: › "reasoning › EXPECTED FAIL (inherited from upstream): a user closing the panel while
  streaming stays closed" (expected: FAIL now)

### F5. `queue` docs claim the opposite of the code about completed-item contrast; the existing test's contrast exclusion is stale — severity: medium (docs) / low (test)

- Where: `registry/ai/registry.json:213` (`docs`: "Note: completed items keep upstream's
  text-muted-foreground/50 and /40, which do not meet AA contrast") vs `registry/ai/queue.tsx:82,103`
  (`"text-muted-foreground line-through"` — the alpha was dropped). `tests/browser/ai/queue.test.tsx:92-97`
  repeats the stale claim and disables `color-contrast` for the completed fixture.
- What: the code is right (full-alpha muted text passes AA; my pin test runs axe with
  `color-contrast` enabled on completed rows and gets zero violations), the docs are wrong, and the
  test exclusion now hides any future regression back to `/50`.
- Evidence: pin test `queue › completed rows keep full-alpha muted text (contrary to the registry docs)
  and pass color-contrast` passes.
- Proposed fix: rewrite the `docs` sentence ("completed items use full-alpha text-muted-foreground
  instead of upstream's /50 and /40 to meet AA"); remove the `rules: { "color-contrast": … }` exclusion
  and the comment from `tests/browser/ai/queue.test.tsx`.
- Test written: › "queue › completed rows keep full-alpha muted text (contrary to the registry docs)
  and pass color-contrast" (expected: PASS)

### F6. `Confirmation` renders an empty `role="alert"` box for an approved tool whose execution then fails (`output-error`) — severity: medium (inherited)

- Where: `registry/ai/confirmation.tsx:62-79` (renders the Alert whenever `approval` exists and state is
  not `input-*`), `:109-125` (`ConfirmationAccepted` only shows for `approval-responded`,
  `output-denied`, `output-available`).
- What: `ai@7` types `output-error` with `approval?: { approved: true … }`
  (`node_modules/ai/dist/index.d.ts:2226-2247`). For such a part the Alert mounts with
  `ConfirmationRequest`, `ConfirmationAccepted`, `ConfirmationRejected` and `ConfirmationActions` all
  returning null → an empty bordered alert (live region) with nothing in it. Same in upstream.
- Evidence: reproducer renders `state="output-error"` with `approved: true`; the ARIA tree shows a
  bare `alert` and `getByText("You approved it.")` never resolves.
- Proposed fix: add `"output-error"` to the accepted-state list (the approval was accepted; the
  error belongs to `ToolOutput`), or have `Confirmation` return null when no child would render.
- Test written: › "confirmation › EXPECTED FAIL (inherited from upstream): an approved tool that then
  errors still shows the accepted outcome" (expected: FAIL now)

### F7. `reasoning` docs omit the Streamdown `@source` / `styles.css` requirement that `response` documents — severity: medium (docs; consumer-tripping)

- Where: `registry/ai/registry.json:217-247` (reasoning `docs`) vs `:260` (response `docs`: "Streamdown's
  Tailwind classes need `@source "../node_modules/streamdown/dist/*.js"` …"). `app/globals.css:4-11`
  shows the repo itself needs `@import "streamdown/styles.css"` plus five `@source` lines (streamdown
  and each `@streamdown/*` plugin).
- What: `ReasoningContent` renders through the same Streamdown + four plugins as `response`, but
  `reasoning` does not depend on `@uifiles/response`, so a consumer who installs only
  `@uifiles/reasoning` gets no hint and sees unstyled markdown (lists, code blocks, math, mermaid).
- Evidence: registry JSON as cited; no `@source`/styles mention in the reasoning entry.
- Proposed fix: copy the note into the reasoning `docs` (and mention the per-plugin `@source` lines,
  which the response note also lacks).

### F8. `ToolOutput` drops falsy results (`0`, `false`, `""`) — severity: low (inherited)

- Where: `registry/ai/tool.tsx:143-145` — `if (!(output || errorText)) return null`.
- What: a tool whose output is `0` or `false` (a count, a boolean check) renders no "Result" section
  at all. Same upstream (`tool.tsx:367`).
- Evidence: reproducer `tool › EXPECTED FAIL (inherited from upstream): ToolOutput shows falsy results
  such as 0 and false` — `getByText("Result")` never resolves.
- Proposed fix: `if (output === undefined && !errorText) return null` and `typeof output !== "undefined"`
  for the branches.
- Test written: as named (expected: FAIL now)

### F9. `tool` silently changed the "Parameters"/"Result" headings from `<h4>` to `<div>` — severity: low (undocumented divergence)

- Where: `registry/ai/tool.tsx:123-125, 159-161` (`<div className="text-xs …">`) vs upstream
  `tool.tsx:347, 383` (`<h4>`). Not mentioned in the item `docs` (`registry.json:315-333`), which
  otherwise lists every change.
- What: presumably done to satisfy axe `heading-order` inside cards; fine, but a consumer relying on
  headings for screen-reader navigation loses them without notice.
- Proposed fix: one sentence in `docs`.

### F10. `reasoning` docs/description drift: `shikiTheme` override undocumented; "unless controlled" is inaccurate — severity: low

- Where: `registry/ai/reasoning.tsx:220-224, 236` sets `shikiTheme={["github-light-high-contrast",
  "github-dark-high-contrast"]}` (upstream passes none) — only a source comment explains it; the
  `docs` field does not. `registry.json:220` description: "Auto-opens … and auto-closes … unless
  controlled or defaultOpen={false}" — in controlled mode the component still calls `onOpenChange(true)`
  when streaming starts and `onOpenChange(false)` after the delay (pinned by test "reasoning › still
  asks a controlled parent to open when streaming starts"), so a controlled parent that mirrors the
  value gets the same auto behaviour. Upstream behaves the same; the wording is what is wrong.
- Proposed fix: mention the theme pair in `docs`; reword to "a controlled parent receives the
  auto-open/auto-close requests through onOpenChange".

### F11. `ReasoningTrigger` still puts `<p>` inside the trigger `<button>` — severity: low

- Where: `registry/ai/reasoning.tsx:174, 176` (`<p>Thought for …</p>` rendered as a child of
  `CollapsibleTrigger`, a native `<button>`).
- What: `task`'s `docs` (`registry.json:298-314`) explicitly calls `<p>` inside a button "invalid" and
  swaps it for `<span>`; `reasoning` kept upstream's `<p>`. Button content model is phrasing content
  only. React does not warn (verified: no `console.error` in my tests) and axe does not flag it, so it
  is a validity/consistency issue, not a runtime one.
- Proposed fix: `<span>` as in `task.tsx:70`.

### F12. `confirmation.tsx` duplicates a union member — severity: nit

- Where: `registry/ai/confirmation.tsx:23-27` and `:28-32` are the identical
  `{ id: string; approved: true; reason?: string }` member (upstream has it once, `confirmation.tsx:295-299`).
- Proposed fix: delete one.

### F13. `getStatusBadge` renders a blank badge for an unknown `state` — severity: nit (forward-compat)

- Where: `registry/ai/tool.tsx:49-74` — `statusIcons[status]` / `statusLabels[status]` are `undefined`
  for a value outside the `ai@7` union; the Badge mounts with no icon and no text.
- Evidence: pinned in "tool › renders a label and icon for every ai@7 tool state and survives an
  unknown one" (`badge.textContent === ""`, no crash). A future `ai` state value will show an empty pill
  rather than a fallback.
- Proposed fix: `statusLabels[status] ?? status`.

## Coverage gaps (behaviours with no test today; no bug found, but untested)

Per export. "(pinned)" = now covered by `tests/browser/qa-round1/disclosure-agent.test.tsx`.

reasoning
- `useReasoning` › throws outside `<Reasoning>` — upstream tests it; ours do not — render `<ReasoningTrigger/>` alone inside an error boundary and assert the message.
- `Reasoning` › `onOpenChange` receives exactly one argument (docs claim) — (pinned).
- `Reasoning` › `open` without `onOpenChange` is read-only — (pinned).
- `Reasoning` › controlled parent still receives auto-open request — (pinned).
- `Reasoning` › second stream re-opens and re-measures duration (`Math.ceil` → "1 seconds") — (pinned). Note: a second stream never auto-closes again (`hasAutoClosed` is never reset, `reasoning.tsx:96,129`); inherited, worth a test once the intended behaviour is decided.
- `Reasoning` › unmount with a pending auto-close timer logs nothing — (pinned).
- `Reasoning` › `duration` prop wins over the measured value when both exist — no test — render `duration={9}` with a stream that ends and assert "9 seconds".
- `Reasoning` › `defaultOpen` changes after mount are ignored — no test.
- `Reasoning` › switching uncontrolled → controlled mid-life produces no warning (Base UI always gets a boolean `open`, so no `useControlled` warning; upstream Radix warned) — no test; a `console.error` spy test would pin the silent switch.
- `ReasoningTrigger` › duration 0 → shimmering "Thinking..."; undefined → "Thought for a few seconds" — (pinned).
- `ReasoningTrigger` › custom `children` replace the default label — no test.
- `ReasoningTrigger` › `getThinkingMessage` override is called with `(isStreaming, duration)` — no test.
- `ReasoningTrigger` › negative/NaN `duration` renders "Thought for NaN seconds" — no test; decide whether to clamp.
- `ReasoningContent` › empty string renders without crashing — (pinned).
- `ReasoningContent` › markdown that is mid-stream (unclosed `**`) renders via Streamdown's default `parseIncompleteMarkdown` — no test.
- `ReasoningContent` › closed-state axe — (pinned).

tool
- `Tool` › `onOpenChange(open, eventDetails)` (docs claim) — (pinned).
- `Tool` › chevron rotates via `group-data-open` (computed `rotate: 180deg`) — (pinned).
- `Tool` › keyboard Enter/Space + `aria-controls` → panel id — (pinned).
- `getStatusBadge` › every ai@7 state has icon + label — (pinned); unknown state → blank — (pinned, see F13).
- `ToolHeader` › name derivation for multi-dash `tool-get-current-weather` — (pinned); `type="tool-"` → empty name (accessible name is the badge only) — no test; `title` overriding derived name — covered by existing test only for dynamic-tool.
- `ToolContent` › `keepMounted` keeps the panel hidden in the DOM — no test (task has one).
- `ToolInput` › `input` undefined — F1; `null` renders `"null"`; circular object / BigInt throw in `JSON.stringify` (inherited, no guard) — no tests.
- `ToolOutput` › string / object / React element / errorText+output — (pinned); falsy outputs — F8; `errorText=""` with output → "Result" — no test.

task
- `Task` › `defaultOpen` default true (existing) ; `onOpenChange` two-arg — no test.
- `TaskTrigger` › chevron rotates on `data-panel-open` — (pinned); custom `children` render inside the native `<button>` with no React nesting error, `title` ignored — (pinned); `render` prop substitutes the element (docs claim) — no test.
- `TaskContent` › `keepMounted` keeps a hidden panel — (pinned).
- `TaskItem` / `TaskItemFile` › only rendered inside existing fixture; no assertion on `TaskItemFile` classes (`inline-flex … bg-secondary`) — no test.
- closed-state axe — (pinned).

plan
- `Plan` › root is a single element carrying `data-slot="plan"`, card classes, `shadow-none`, consumer `className`; no leftover `data-slot="card"`/`"collapsible"` — (pinned).
- `Plan` › `onOpenChange(open, eventDetails)` and read-only `open` — (pinned).
- `PlanTrigger` › `className` override beats `size-8` via twMerge (docs claim), `data-slot="plan-trigger"` — (pinned); `render` override — no test.
- `PlanContent` › `data-slot="plan-content"`, consumer `className` merged, id matches `aria-controls` — (pinned).
- `PlanTitle` / `PlanDescription` › throw outside `Plan` (upstream tests it) — no test; shimmer on description — existing test only checks the title.
- `PlanAction`, `PlanFooter`, `PlanHeader` › `data-slot` attributes and `className` pass-through (upstream tests) — no test.
- closed-state axe — (pinned).

chain-of-thought
- `ChainOfThought` › single root, trigger and panel are direct children, `aria-controls` absent when closed and equal to panel id when open (docs claim) — (pinned).
- `ChainOfThought` › `onOpenChange` gets one argument — (pinned); throws outside provider — no test.
- `ChainOfThoughtHeader` › default label "Chain of Thought" — (pinned); chevron rotation class flips with `isOpen` — no test.
- `ChainOfThoughtStep` › unknown `status` does not crash — (pinned); `pending` dims only the icon (`[&>div:first-child>svg]:opacity-50`, the documented a11y change) — no test asserts computed opacity of the icon vs text; `description` omitted renders no description node — no test.
- `ChainOfThoughtSearchResults` › empty renders an empty flex container — no test.
- `ChainOfThoughtSearchResult` › `variant` is overridable because `{...props}` follows `variant="secondary"` (upstream order too) — no test.
- `ChainOfThoughtImage` › without `caption` renders no `<p>` — (pinned).
- closed- and open-state axe — (pinned).

queue
- `QueueSection` › `defaultOpen` true — existing; `onOpenChange` two-arg — no test.
- `QueueSectionTrigger` › `data-panel-open` on the native button, chevron `-90deg` closed / `0deg` open, keyboard toggle, `aria-controls` — (pinned).
- `QueueSectionLabel` › `count` undefined renders " tasks" with a leading space — no test; `icon` slot — no test.
- `QueueSectionContent` › `keepMounted` — no test.
- `QueueList` › 30 items scroll inside 160 px, viewport `tabIndex=0`, axe `scrollable-region-focusable` passes — (pinned).
- `QueueItemAction` › keyboard focus visibility — F3; `onClick` — no test (upstream has one); names via `aria-label` — existing.
- `QueueItemContent` / `QueueItemDescription` › completed → `line-through`, full-alpha, contrast passes — (pinned).
- `QueueItemIndicator` › completed vs pending border classes — no test (upstream has one).
- `QueueItemImage` › default `alt=""`, 32×32, consumer `alt` overrides — no test (upstream has one).
- `QueueItemFile` › truncation at `max-w-[100px]` — no test.
- `QueueItemAttachment`, `QueueItemActions`, `Queue` › `className` pass-through — no test.

checkpoint
- `CheckpointTrigger` › `onClick` fires once with and without tooltip; `type="button"` — (pinned).
- `CheckpointTrigger` › tooltip opens on keyboard focus (Tab) — (pinned); works without `TooltipProvider`, no console errors — (pinned).
- `CheckpointTrigger` › `variant`/`size` defaults (`ghost`, `sm`) and overrides — no test.
- `CheckpointIcon` › `children` replaces the bookmark; `className` merged — no test.
- `Checkpoint` › separator is `role="separator"` with `aria-orientation="horizontal"` (docs claim: always exposed, no `decorative`) — (pinned). Note this is a semantic change from upstream's `decorative` Radix separator (`role="none"`): every checkpoint now announces a separator.

confirmation
- `Confirmation` › `approval-responded` shows accepted / rejected and hides actions — (pinned); `output-error` + approved — F6; `className` merged — no test (upstream has one); returns null with `approval` present but `input-streaming` — no test (existing covers `input-available` without approval only).
- `ConfirmationTitle` › `inline` class — no test.
- `ConfirmationRequest` › only in `approval-requested` — existing.
- `ConfirmationAccepted` / `ConfirmationRejected` › `approved: undefined` in `approval-responded` (malformed) → neither shows — no test.
- `ConfirmationActions` › hidden outside `approval-requested` — existing.
- `ConfirmationAction` › `disabled` and `variant` forwarded to the Base UI button, click on disabled does nothing — (pinned); consumer `className` *replaces* `h-8 px-3 text-sm` (no `cn`, `confirmation.tsx:172`, same upstream) — no test; `render` (docs claim "use render instead of asChild") — no test.

Existing-test mutation checks (reasoned, not executed — tracked files are off-limits):
- `reasoning.test.tsx` "respects defaultOpen={false}": deleting `isExplicitlyClosed` from the auto-open condition would flip `aria-expanded` to true → caught. Deleting the `clearTimeout` cleanup → not caught (no test unmounts mid-timer; now pinned).
- `tool.test.tsx` "expands on click": misspelling `group-data-open:rotate-180` → not caught (asserts the attribute exists, not the rotation; now pinned via computed `rotate`).
- `task.test.tsx`: misspelling `group-data-panel-open:rotate-180` → not caught (now pinned).
- `plan.test.tsx` "shimmer": removing `<span className="shimmer">` → caught. Breaking the `className` merge on `PlanTrigger` → not caught (now pinned).
- `chain-of-thought.test.tsx`: swapping `stepStatusStyles.pending` back to `text-muted-foreground/50` → caught only by axe color-contrast on the pending step (fixture has one, so yes). Removing `aria-controls` → not caught (now pinned).
- `queue.test.tsx` "strikes through": re-adding `/50` → not caught because `color-contrast` is disabled (F5).
- `checkpoint.test.tsx`: dropping `{...props}` from the tooltip branch (losing `onClick`) → not caught (now pinned).
- `confirmation.test.tsx`: `state !== "approval-responded"` typo in `ConfirmationAccepted` → not caught (fixtures use `output-available`/`output-denied`; now pinned).

## Verified OK (claims you checked that hold; one line each, so the fixer does not re-check)

- All eight files: Apache header on lines 1-2, `"use client"` on line 3 (all eight upstream files have it), `cn` imported from `"cn"`, zero hits for `asChild|data-[state=|forceMount|onSelect|openDelay|@radix-ui|@/lib/utils`.
- Base UI Collapsible.Trigger emits `data-panel-open` (`node_modules/@base-ui/react/collapsible/trigger/CollapsibleTriggerDataAttributes.js`), Root emits `data-open`/`data-closed` (`root/CollapsibleRootDataAttributes.js`); Tailwind compiled `group-data-panel-open:rotate-0/rotate-180` and `group-data-open:rotate-180` (dev CSS lines 3329-3335, 3500) and the computed `rotate` flips in the pins for tool, task and queue.
- `aria-controls` is set only while open (`CollapsibleTrigger.js`: `'aria-controls': open ? panelId : undefined`) and equals the mounted panel id — pinned for reasoning, tool, task, plan, chain-of-thought, queue; Enter opens and Space closes for each.
- Base UI Panel unmounts when closed unless `keepMounted` (`CollapsiblePanel.js`, `shouldRender`) — matches the `tool`/`queue`/`task` docs claims.
- `onOpenChange` arity: `Tool`/`Plan` pass `(open, eventDetails)` with `reason: "trigger-press"` (docs claim); `Reasoning`/`ChainOfThought` pass exactly `(open)` (docs claim) — pinned.
- `render` composition: `mergeProps(props, render.props)` concatenates class names with the render element's first (`node_modules/@base-ui/react/merge-props/mergeProps.js` `mergeClassNames`) so `PlanTrigger className` wins through `cn`; Plan root is one element with `data-slot="plan"` and card classes; `PlanContent` is `data-slot="plan-content"` — pinned.
- Tooltip provider is optional (`tooltip/provider/TooltipProviderContext.js` default `undefined`, Root only reads it); `TooltipTrigger` merges `elementProps` last so the consumer `onClick` runs once — pinned (with and without tooltip, plus keyboard focus opens it, no console errors).
- Base UI Separator always renders `role="separator"` + `aria-orientation` (`separator/Separator.js`) — docs claim holds.
- Base UI ScrollArea viewport sets `tabIndex` 0 when content overflows (`scroll-area/viewport/ScrollAreaViewport.js:282`), `role="presentation"`, `overflow: scroll`; a 30-item `QueueList` scrolls inside `max-h-40` and passes axe `scrollable-region-focusable`.
- `shimmer` utility exists (`node_modules/shadcn/dist/tailwind.css:547`) and compiles (dev CSS line 1564); plan/reasoning use it.
- `ai@7` tool state union is exactly `input-streaming | input-available | approval-requested | approval-responded | output-available | output-error | output-denied` (`node_modules/ai/dist/index.d.ts:2162-2248`) and `statusLabels`/`statusIcons` keys match it one-to-one; `DynamicToolUIPart` is `type: 'dynamic-tool'` + `toolName` (`:2269-2272`).
- `tool` docs on icon colours (`text-primary`/`text-destructive`/`text-muted-foreground`, `tool.tsx:59-67`) and the `bg-card text-destructive` error container (`:165`) hold.
- `chain-of-thought` docs on the structure change hold: one `div[data-slot=collapsible]` root with the same `not-prose w-full space-y-4` + consumer class, trigger and panel as direct children; pending steps keep `text-muted-foreground` and dim only the icon.
- `task` docs hold: native `<button>` trigger, `<span>` label, custom children inside the button, `data-panel-open` chevron.
- Registry deps are coherent: tool → `badge`, `collapsible`, `@uifiles/code-block` (code-block → `button`, `select`, `shiki@^4.4`); reasoning → `collapsible` + `streamdown@^2.6` and four `@streamdown/*@^1` pins matching installed versions; confirmation/tool pin `ai@^7`; checkpoint → `button`, `separator`, `tooltip`; plan → `button`, `card`, `collapsible`; queue → `button`, `collapsible`, `scroll-area`; chain-of-thought → `badge`, `collapsible`.
- `ToolUIPartApproval` shapes used by `Confirmation` match ai@7's `approval` objects (`id`, optional `approved`, `reason`).
- React logs no nesting warning for `<div>`/`<p>` inside the Base UI trigger button (validateDOMNesting only flags `p`-in-`p`, `button`-in-`button`, etc.).
- Existing tests' animation `settle()` and `<main>` wrapping are sound; closed-state axe now runs for reasoning, task, plan, chain-of-thought and queue (all clean).
- `pnpm exec tsc --noEmit`: no errors from my file (the one error reported is in another lens's file, `tests/browser/qa-round1/chat-block-and-leaves.test.tsx:656`). `biome check` and `prettier --check` clean on my file.

## Could not reach

- `registry/ai/upstream.lock.json` hashes: they are sha256 of `files[0].content` from `elements.ai-sdk.dev/api/registry/<name>.json` (blocked); the raw sources in the clone hash differently by construction (import paths), so I could not confirm the eight ports were made from the pinned upstream. Diffed against the clone at 6a9d5b1 instead; no unexplained divergence beyond F9/F10.
- `pnpm dlx shadcn@latest add @uifiles/<name>` round-trip: all eight have bare upstream `registryDependencies`, which the egress proxy blocks.
- Real mutation testing of the existing tests (would require editing tracked files); mutation checks above are reasoned from the assertions.
- SSR/hydration of the preview pages under a production build (`next build` is off-limits); `curl localhost:3000/preview/task` served fine from the dev server.
- A note for whoever owns the tree: `registry/ai/reasoning.tsx` was rewritten in place at 21:54:22 by something else during this run (mtime changed, content identical to HEAD, `git status` briefly showed it modified); I did not touch it.

## Commands run (for the fixer to reproduce)

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>
pnpm exec vitest run --project browser tests/browser/qa-round1/disclosure-agent.test.tsx
#  ❯ tests/browser/qa-round1/disclosure-agent.test.tsx (30 tests | 6 failed)
#    ❯ reasoning (10)
#      × EXPECTED FAIL: auto-close still fires when the parent re-renders with an inline onOpenChange
#      × EXPECTED FAIL (inherited from upstream): a user closing the panel while streaming stays closed
#    ❯ tool (6)
#      × EXPECTED FAIL: ToolInput survives the undefined input of a fresh input-streaming part
#      × EXPECTED FAIL (inherited from upstream): ToolOutput shows falsy results such as 0 and false
#    ❯ queue (4)
#      × EXPECTED FAIL (inherited from upstream): hover-only action buttons become visible on keyboard focus
#    ❯ confirmation (3)
#      × EXPECTED FAIL (inherited from upstream): an approved tool that then errors still shows the accepted outcome
#  Tests  6 failed | 24 passed (30)   Duration ~16-23s
#  Assertion messages:
#    reasoning timer / user-close:   AssertionError: expected 'true' to be 'false'
#    ToolInput undefined:            [TypeError: Cannot read properties of undefined (reading 'split')]
#    ToolOutput 0:                   Cannot find element with locator: page.getByText('Result')
#    queue focus:                    AssertionError: expected '0' to be '1'
#    confirmation output-error:      Cannot find element with locator: page.getByText('You approved it.')  (ARIA tree: - alert)
pnpm exec biome check tests/browser/qa-round1/disclosure-agent.test.tsx     # clean
pnpm exec prettier --check tests/browser/qa-round1/disclosure-agent.test.tsx # clean (after --write on this new file)
pnpm exec tsc --noEmit   # only error: tests/browser/qa-round1/chat-block-and-leaves.test.tsx(656,26) — another lens's file
curl -s http://localhost:3000/preview/task | grep -o 'href="[^"]*\.css[^"]*"'   # then curl the chunk; grep -n -A3 "panel-open"
grep -n "\"tool-input-start\"" node_modules/ai/dist/index.js   # 7867ff: state "input-streaming", input: void 0
sed -n 2150,2400p node_modules/ai/dist/index.d.ts               # ToolUIPart / DynamicToolUIPart state union
```
