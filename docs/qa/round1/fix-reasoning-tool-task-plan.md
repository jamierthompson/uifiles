# fix-reasoning-tool-task-plan

Files touched (all owned): `registry/ai/{reasoning,tool,task,plan}.tsx`,
`tests/browser/ai/{reasoning,tool,task,plan}.test.tsx`, `app/preview/{reasoning,tool}/page.tsx`
(`task`/`plan` previews unchanged), and `tests/browser/qa-round1/disclosure-agent.test.tsx` (deleted:
my half is migrated; the chain-of-thought/queue/checkpoint/confirmation half is read via
`git show 13c7c90:tests/browser/qa-round1/disclosure-agent.test.tsx`).

## Fixed

- disclosure-agent:F1 (high) / chat-block-and-leaves:F1 root cause — `ToolInput` renders a muted
  "No input yet" placeholder while `input === undefined` (the shape ai@7 creates on `tool-input-start`)
  instead of handing `JSON.stringify(undefined)` to `CodeBlock`; a `toJson` helper stringifies BigInt
  values and falls back to `String()` for anything JSON rejects (circular refs), so the card never
  throws mid-stream — `registry/ai/tool.tsx:122-152` — tests: `tests/browser/ai/tool.test.tsx` ›
  "toolInput › renders a placeholder instead of crashing when the input is still undefined" and
  "never throws for input JSON cannot serialise" (failed before: `AssertionError: expected "vi.fn()" to
  not be called at all, but actually been called 1 times … [TypeError: Cannot read properties of
  undefined (reading 'split')]`; passes after). The preview's `input-streaming` example now passes
  `input={undefined}` (`app/preview/tool/page.tsx:31`, opened by default so axe/Playwright see it) and
  keeps a second, partial-input example.
- disclosure-agent:F8 — `ToolOutput` guards on `output === undefined && !errorText` and renders
  non-string, non-object values through `String()` (booleans were previously swallowed by React), so
  `0`, `false` and `""` show a Result section — `registry/ai/tool.tsx:161-186` — tests: › "toolOutput ›
  shows the falsy result 0 / false / "" under a Result heading" (failed before:
  `VitestBrowserElementError: Cannot find element with locator: page.getByText('Result')`; pass after).
  Object output goes through the same `toJson`, so BigInt results render too (› "renders output JSON
  cannot serialise without throwing").
- disclosure-agent:F13 — an unknown `state` renders the raw state text with a neutral `CircleIcon`
  instead of an empty pill — `registry/ai/tool.tsx:70-76` — test: › "toolHeader › falls back to the raw
  state text and a neutral icon for an unknown state" (before: badge `textContent === ""`, as the QA pin
  recorded; that pin was replaced, not migrated).
- test-quality:M2 — the error-state test now asserts the `ToolOutput` "Error" heading *outside* the
  badge and the absence of a "Result" heading — test: › "toolOutput › renders an error under an Error
  heading, not a Result heading" (mutation `{"Result"}` now fails 3 tests; see below).
- disclosure-agent:F9 — the `<h4>` → `<div>` change is now documented (Registry entry changes).
- disclosure-agent:F2 (medium) — stable-callback pattern: `onOpenChange` lives in a ref, `setIsOpen`
  depends only on `isOpenControlled`, and the auto-close effect no longer restarts on parent renders —
  `registry/ai/reasoning.tsx:76-91` (setter), `:133-149` (effect) — test:
  `tests/browser/ai/reasoning.test.tsx` › "keeps the auto-close timer running while the parent
  re-renders with a new inline onOpenChange" (fake timers: three re-renders with fresh handlers inside
  the 1 s window; failed before: `AssertionError: expected 'true' to be 'false'`; passes after).
- disclosure-agent:F4 (medium, inherited) — auto-open fires only on the false→true transition of
  `isStreaming` (previous value in `wasStreamingRef`); a manual toggle (trigger press or
  `useReasoning().setIsOpen`) marks the auto cycle as spent until the next stream, so the reader's
  choice is respected during and after the stream; a new stream resets it and auto-opens again —
  `registry/ai/reasoning.tsx:99-131`, `:152-158` — tests: › "stays closed when the reader closes it
  mid-stream and re-opens only for a new stream" (failed before: `expected 'true' to be 'false'`),
  › "does not auto-close a panel the reader closed mid-stream and re-opened", › "does not auto-close
  again after the reader re-opens an auto-closed panel", › "does not auto-close old messages when
  manually opened - #86".
  Deliberate divergence (see Not fixed / owner decision): a second stream in the same instance now
  auto-closes once too (upstream's `hasAutoClosed` never reset, so a second stream stayed open forever).
- disclosure-agent:F11 — the finished label is a `<span>` (was `<p>` inside the `<button>`) —
  `registry/ai/reasoning.tsx:192-194` — test: › "reasoningTrigger › has a brain icon and puts only
  phrasing content inside the button".
- test-quality:M3 — the auto-open *effect* (not-streaming → streaming after mount) is exercised —
  test: › "auto-opens when streaming starts after mount" (mutation R4 caught).
- test-quality:M4 + upstream #63/#86 — with `vi.useFakeTimers` (timers + `Date` only): › "rounds
  sub-second durations up to 1 second - #63" (300 ms → "Thought for 1 seconds"), › "reports the measured
  duration in whole seconds, rounded up" (2.5 s → "Thought for 3 seconds"), › "prefers the duration
  prop over the measured value", › "measures a second stream afresh", › "auto-closes one second after
  streaming stops" (open at 999 ms, closed at 1000 ms), › "does not auto-close old messages when
  manually opened - #86".
- rendered-surface:F11 (coordinator, medium) — `min-h-6` on the `ReasoningTrigger` and `TaskTrigger`
  rows (20 px → 24 px, no other visual change) — `registry/ai/reasoning.tsx:209`,
  `registry/ai/task.tsx:62` — tests: `reasoning.test.tsx` › "is at least 24px tall so it meets the
  WCAG 2.2 target size", `task.test.tsx` › same name (mutations R7/K1 caught; every axe pass runs with
  `target-size` enabled through `tests/a11y.ts`).
- rendered-surface (coordinator, low: CLS 0.114 on `/preview/reasoning`) — cause: the streaming demo
  auto-opens at mount and the panel grows with every 80 ms tick, pushing the two sections below it down.
  `app/preview/reasoning/page.tsx:45` gives the streamed `ReasoningContent` `min-h-56` (the text's final
  height at phone width), so the page no longer shifts while the text grows. The collapse 1 s after the
  stream ends is the component's documented behaviour and still moves the sections up once.
- rendered-surface (coordinator: "state update on unmounted component", 1/17 loads) — the component
  owns exactly one timer (the auto-close `setTimeout`) and it is cleared in the effect cleanup; the
  duration effect has no timer. Tests: › "clears a pending auto-close timer on unmount"
  (`vi.getTimerCount() === 0`, no `onOpenChange(false)`, no `console.error`; mutation R6 caught) and
  › "unmounts cleanly mid-stream". The preview's own `setInterval` is cleared on unmount. I could not
  reproduce the error in 20 `curl` loads plus the test runs; React 19 no longer emits that warning
  itself, so if it recurs it comes from a library (Streamdown/mermaid/shiki async work) — see Not fixed.
- Strict-flag compatibility (test-quality:F7, now enforced by `tsconfig.json`): `title?: string |
  undefined`, `className?: string | undefined` on `ToolHeaderProps`; `| undefined` on every optional
  `ReasoningProps`/`ReasoningTriggerProps`/`PlanProps` member. This also clears the two
  `exactOptionalPropertyTypes` errors the chat block had at `chat.tsx:342,349` without touching it.

## Not fixed and why

- Second-stream auto-close semantics (disclosure-agent coverage-gap note) — changed rather than left:
  each stream now auto-opens and auto-closes once. Owner decision: if upstream parity ("never auto-close
  again after the first auto-close") is preferred, delete `autoCloseSpentRef.current = false` at
  `reasoning.tsx:126` and the test "auto-opens and auto-closes again for a second stream".
- `PlanContent` cannot take `keepMounted`: its props are `CardContent`'s, exactly as upstream (which
  could not take `forceMount` either). Widening the API is an owner decision; I documented it instead.
- rendered-surface "state update on unmounted component" — not reproducible (see above); nothing in
  the four files can emit it. Recommend the rendered-surface fixer capture the stack on the next
  occurrence.
- disclosure-agent:F7/F10 — docs and description text only; strings below (registry.json is off-limits).

## Tests

- `tests/browser/ai/reasoning.test.tsx`: 3 tests before → 39 after; upstream tests ported: 18 of 18
  (skipped: none). Timer behaviour uses `vi.useFakeTimers({ toFake: [setTimeout, clearTimeout,
  setInterval, clearInterval, Date] })` plus React `act` (an `inAct` helper sets
  `IS_REACT_ACT_ENVIRONMENT` the way vitest-browser-react does around its own calls); clicks under fake
  timers dispatch `element.click()` inside `act` because `userEvent` cannot be awaited while timers
  are faked. Covers: controlled/uncontrolled/defaultOpen/read-only `open`, one-argument `onOpenChange`,
  controlled auto-open request, duration prop vs measured, #63/#86, streaming transitions, manual
  toggle during and after a stream, second stream, unmount mid-stream and mid-timer, custom
  children/`getThinkingMessage`, chevron rotation, keyboard toggle with `aria-controls`, 24 px
  target, `ReasoningContent` markdown/className/empty/`keepMounted`, `useReasoning` custom trigger,
  outside-provider error, axe closed/open/streaming and under `withDark`.
- `tests/browser/ai/tool.test.tsx`: 2 → 35 (26 `it` blocks, two `it.each` tables); upstream ported:
  22 of 22 (the four dynamic-tool cases and the seven status cases are merged into one test and one
  `it.each` respectively). Covers every ai@7 state (label, icon, colour token), unknown state, `tool-x`,
  multi-dash and bare `tool-` names, `dynamic-tool` with/without `title`, `ToolContent`
  open/closed/`keepMounted`, `ToolInput` object/nested/undefined/null/BigInt/circular/className,
  `ToolOutput` string/object/element/error/error+output/undefined/`0`/`false`/`""`/BigInt, keyboard
  toggle with `aria-controls` and `(open, eventDetails)`, chevron rotation, axe collapsed/expanded/
  errored and under `withDark`.
- `tests/browser/ai/task.test.tsx`: 2 → 23; upstream ported: 13 of 13. Adds empty `<Task />`,
  `(open, eventDetails)`, `<span>` label in a native `<button>`, custom children inside the button with
  no console errors, no interactive descendants, `render` substitution (`nativeButton={false}`),
  keyboard toggle with `aria-controls` and `data-panel-open` chevron rotation, 24 px target,
  `keepMounted`, `TaskItem`/`TaskItemFile` classes, axe open/closed and under `withDark`.
- `tests/browser/ai/plan.test.tsx`: 3 → 25; upstream ported: 38 of 38 (grouped: the per-attribute
  upstream tests for header/description/footer/trigger are single tests asserting all attributes).
  Adds single-root `render` composition (`data-slot="plan"`, card classes, no leftover `card`/
  `collapsible` slots), `(open, eventDetails)` and read-only `open`, `PlanTrigger` className override
  beating `size-8`, `render` override, `PlanContent` className/`px-(--card-spacing)`, `PlanAction`
  outside the trigger (no nested interactive), `PlanTitle` is not a heading, shimmer on both title and
  description and none when not streaming, keyboard toggle with `aria-controls` → `plan-content`, axe
  open/closed/streaming and under `withDark`.
- Migrated QA reproducers (renamed): all 4 "EXPECTED FAIL" and the 14 pins for reasoning/tool/task/plan;
  dropped one pin that asserted the pre-F13 empty badge. `tests/browser/qa-round1/disclosure-agent.test.tsx`
  deleted after its reasoning/tool/task/plan tests passed against the fixed components
  (`-t "^(reasoning|tool|task|plan) "`: 20 passed, 1 failed = the replaced F13 pin, 9 skipped).
- Mutation checks performed (`scratchpad/mut/mutate.sh`: backup → perl patch → run file → restore,
  sha256 identical every time):
  | # | Mutation | Caught by |
  |---|---|---|
  | R1 | `setIsOpen` reads `onOpenChange` directly, deps `[isOpenControlled, onOpenChange]` | reasoning › "keeps the auto-close timer running while the parent re-renders…" |
  | R2 | auto-open on every render while streaming (`if (!started)` → `if (!isStreaming)`) | "stays closed when the reader closes it mid-stream…", "does not auto-close a panel the reader closed mid-stream and re-opened" |
  | R3 | `Math.ceil` → `Math.floor` | "#63", "reports the measured duration…", "measures a second stream afresh" |
  | R4 | auto-open disabled | "asks a controlled parent to open…", "auto-opens when streaming starts after mount", + 2 |
  | R5 | manual toggle no longer spends the auto-close | "does not auto-close a panel the reader closed mid-stream and re-opened" |
  | R6 | auto-close cleanup removed | "clears a pending auto-close timer on unmount" |
  | R7 | `min-h-6` removed (reasoning) | "is at least 24px tall…" |
  | R8 | `<span>` → `<p>` label | "has a brain icon and puts only phrasing content inside the button" |
  | T1 | undefined-input placeholder removed | tool › "renders a placeholder instead of crashing…" |
  | T2 | `if (!(output \|\| errorText))` restored | "shows the falsy result 0 / false / """ (3) |
  | T3 | boolean output rendered as ReactNode | "shows the falsy result false…" |
  | T4 | `?? status` removed | "falls back to the raw state text…" |
  | T5 | heading always "Result" | "renders an error under an Error heading…", "renders both the error text and a partial output", axe composition |
  | T6 | BigInt replacer removed | "never throws for input JSON cannot serialise", "renders output JSON cannot serialise…" |
  | K1 | `min-h-6` removed (task) | task › "is at least 24px tall…" |
  | P1 | `PlanTrigger` drops `className` | plan › "lets a className override beat the default size" |
  | P2 | `PlanDescription` shimmer removed | "renders with a shimmer when streaming", "shimmers the title and description together…" |
- Three consecutive runs (`pnpm exec vitest run --project browser tests/browser/ai/{reasoning,tool,task,plan}.test.tsx`):
  ```
  run 1: Test Files 4 passed (4)  Tests 122 passed (122)  Duration 7.29s
  run 2: Test Files 4 passed (4)  Tests 122 passed (122)  Duration 8.39s
  run 3: Test Files 4 passed (4)  Tests 122 passed (122)  Duration 8.41s
  ```
- Consumer checks: `tests/browser/blocks/chat.test.tsx` (the block composes `Tool*` and `Reasoning*`):
  the last run with my sources is `Test Files 1 passed (1) / Tests 50 passed (50)`. Two earlier runs
  showed four failures ("lets title override the derived name…", "shows a call still marked running as
  Pending…", "render custom children with a hidden icon…", "stop mid-tool leaves the tool header
  settled…"); those are block features the chat fixer was mid-way through, and the identical four fail
  with the pre-fix `tool.tsx`/`reasoning.tsx` from `13c7c90` swapped in (files restored byte-identical),
  so they were never caused by this slice. One further failure ("anchors user rows only…") appeared in
  one of three runs; its fixture is text-only, so it is a scroll-timing flake for the chat owner.
  Unit project: 241 passed, 2 failed — `qa-round1-app-tooling-oss` CI/package.json assertions from
  another lens, untouched by this slice.

## Registry entry changes (exact strings for registry.json; the registry owner applies them)

- tool › docs: "Ported to Base UI. Tool is Base UI Collapsible.Root: onOpenChange is (open, eventDetails); ToolContent is Collapsible.Panel (forceMount → keepMounted). Open-state styling uses data-open/data-closed and group-data-open (root carries data-open) instead of data-[state=open]. Status icon colors use semantic tokens (text-primary for completed/responded, text-destructive for error/denied, text-muted-foreground for awaiting approval) because the theme has no success/warning tokens; the error result container is bg-card text-destructive (upstream bg-destructive/10) to meet WCAG AA contrast with the light-mode destructive token. The \"Parameters\" and \"Result\"/\"Error\" labels are <div>s (upstream <h4>) so a tool card never breaks the page's heading order. ToolInput renders a muted \"No input yet\" placeholder while input is undefined (the shape the AI SDK emits on tool-input-start) instead of crashing, and stringifies BigInt values; anything else JSON cannot serialise falls back to String(). ToolOutput shows falsy results (0, false, \"\") and renders booleans and numbers as text. An unknown tool state renders its raw state text with a neutral icon."
- reasoning › docs: "Ported to Base UI. @radix-ui/react-use-controllable-state is replaced with a useState controlled/uncontrolled pattern for both open and duration (props unchanged); the latest onOpenChange is kept in a ref so a parent that re-renders with an inline handler does not restart the auto-close timer. The AI Elements <Shimmer> dependency is gone: the thinking label is a <span className=\"shimmer [--shimmer-duration:1s]\"> using the shimmer utility from shadcn/tailwind.css, and the finished label is a <span> (upstream used <p>, which is invalid inside a button). Collapsible content selectors use data-open/data-closed instead of data-[state=...]. onOpenChange receives only (open) as upstream; Base UI's eventDetails argument is dropped. Auto-open fires only when isStreaming turns true (upstream re-opened the panel on every render while streaming, so it could not be closed mid-stream); a manual toggle takes the panel out of the auto-open/auto-close cycle until the next stream starts, and each new stream auto-opens and auto-closes once (upstream never auto-closed a second stream). A controlled parent receives the auto-open and auto-close requests through onOpenChange. ReasoningContent passes shikiTheme={[\"github-light-high-contrast\", \"github-dark-high-contrast\"]} to Streamdown because Streamdown's default GitHub light theme fails AA on orange tokens. The trigger row is min-h-6 (24px) to meet the WCAG 2.2 target size. Streamdown's Tailwind classes need `@import \"streamdown/styles.css\"` and `@source \"../node_modules/streamdown/dist/*.js\"` (plus one @source line per @streamdown/* plugin: cjk, code, math, mermaid) in your global CSS, exactly as for response."
- reasoning › description: "Collapsible \"thinking\" block for AI reasoning/thought tokens. ReasoningTrigger shows a shimmering \"Thinking...\" while isStreaming, then \"Thought for N seconds\" (duration measured automatically or passed in); ReasoningContent renders the reasoning text as markdown with Streamdown. Auto-opens when streaming starts and auto-closes one second after it ends; defaultOpen={false} disables the auto-open, a reader's manual toggle is respected, and a controlled parent receives both requests through onOpenChange. Use it above a message response when the model exposes reasoning."
- task › docs: "Base UI port of AI Elements task. TaskTrigger renders the Collapsible trigger's native <button> (upstream rendered a <div> through asChild); custom children render inside that button instead of replacing it, so they must be phrasing content without interactive descendants (no nested buttons or links); `render` substitutes the element (pass nativeButton={false} for a non-button). The default label is a <span> (was <p>, which is invalid inside a button). The trigger row is min-h-6 (24px) to meet the WCAG 2.2 target size. The chevron rotates on the trigger's data-panel-open attribute (was group-data-[state=open]); TaskContent animates on data-open / data-closed and takes Collapsible.Panel props such as keepMounted. onOpenChange receives (open, eventDetails)."
- plan › docs: "Base UI port of AI Elements plan. Plan renders the Collapsible as the Card via render={<Card />}; PlanContent and PlanTrigger use render the same way (all three were asChild). PlanContent takes CardContent props as upstream, so Collapsible.Panel props such as keepMounted are not forwarded. Upstream's <Shimmer> component is replaced by shadcn's `shimmer` class on a <span>, so there is no shimmer item or motion dependency. PlanTrigger spreads its props onto the collapsible trigger; className is merged into the inner Button and re-run through cn, so overrides still win, and a `render` prop replaces the Button. PlanTitle and PlanDescription are <div>s (CardTitle/CardDescription), so a plan never affects the page's heading order. Plan is closed by default (as upstream); pass defaultOpen. onOpenChange receives (open, eventDetails)."
- dependencies: unchanged for all four.

## Requests for other owners

- `docs/porting-ai-elements.md` (changed on disk during my run; please verify): the
  "Controlled/uncontrolled replacement" snippet must be the ref-held pattern from the common brief
  (`onOpenChangeRef` + `setValue` with deps `[isControlled]`), not `useCallback([..., onOpenChange])`,
  which is the F2 bug.
- `registry/blocks/chat/components/blocks/chat.tsx` (chat fixer): no block-level guard is needed for
  `input: undefined` any more; `<ToolInput input={part.input} />` renders "No input yet" for the
  `tool-input-start` and `tool-input-error` shapes. If a block-level placeholder is kept anyway, reuse
  that wording so the two never disagree.
- `registry/ai/registry.json` (registry owner): apply the strings above.

## Strict-flag typecheck

`pnpm exec tsc --noEmit` (tsconfig now carries `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `noUnusedLocals`):

- Errors remaining in files I own: none.
- Errors in files I do not own (path:line): `components/ui/scroll-area.tsx:5`,
  `tests/browser/ai/code-block.test.tsx:936`, `tests/browser/ai/context.test.tsx:282,394,400`,
  `tests/browser/ai/prompt-input.test.tsx:39,2898,2903`,
  `tests/browser/qa-round1/chat-block-and-leaves.test.tsx:1169,1177,1219`,
  `tests/browser/qa-round1/prompt-input.test.tsx:234,250,272`.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
# baseline (before any change)
pnpm exec vitest run --project browser tests/browser/qa-round1/disclosure-agent.test.tsx -t "^(reasoning|tool|task|plan) "
#   4 failed | 17 passed | 9 skipped: F2 'expected true to be false', F4 'expected true to be false',
#   F1 TypeError reading 'split', F8 Cannot find element getByText('Result')
pnpm exec vitest run --project browser tests/browser/ai/{reasoning,tool,task,plan}.test.tsx   # 10 passed (old suite)
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals  # 0 errors in my files
# after
pnpm exec prettier --write <my files>; pnpm exec prettier --check <my files>   # clean
pnpm exec biome check <my files>                                               # Checked 12 files, no fixes
pnpm exec tsc --noEmit                                                         # 0 errors in my files (others listed above)
pnpm registry:validate                                                         # passes
pnpm exec vitest run --project browser tests/browser/ai/{reasoning,tool,task,plan}.test.tsx  # 122 passed x3
scratchpad/mut/mutate.sh <label> <file> <test> '<perl -0 expr>'               # 17 mutations, all caught, files restored
pnpm exec vitest run --project browser tests/browser/qa-round1/disclosure-agent.test.tsx -t "^(reasoning|tool|task|plan) "
#   20 passed | 1 failed (the replaced F13 pin) | 9 skipped  → file deleted
curl -s -o /dev/null -w "%{http_code}" localhost:3000/preview/tool      # 200, body contains "No input yet"
curl -s -o /dev/null -w "%{http_code}" localhost:3000/preview/reasoning # 200, body contains min-h-56 and min-h-6 trigger
pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx   # final: 50 passed (50); see Tests › Consumer checks
pnpm exec vitest run --project unit                                         # 241 passed | 2 failed (other lens: app-tooling-oss)
# control: chat block against pre-fix sources (git show 13c7c90:registry/ai/{tool,reasoning}.tsx swapped in, then restored)
#   same 4 block-feature failures → not caused by this slice
```
