# disclosure — QA round 2

## Summary

Attacked the eight Base UI disclosure/agent ports after the round-1 fixes: `registry/ai/{reasoning,tool,task,plan,chain-of-thought,queue,checkpoint,confirmation}.tsx`, their canonical tests (228 tests across eight files), previews and registry entries. Re-verified every round-1 finding in this lens (disclosure-agent F1–F13, rendered-surface F4/F11/F12, test-quality M2/M3/M4/M12 and the #63/#86 gap, tokens-css F6) against the code, then tried to re-break the fixes: the ref-held setter under a 50 ms re-render storm, controlled parents that ignore requests, StrictMode double effects, the second-stream policy, every `duration` edge, ai@7 shapes for tool input/output and confirmation, the compiled CSS behind the queue focus fix, indicator contrast from computed colours, the chat block's "Pending" mapping, and 27 source mutations.

Findings: 0 blocker, 0 high, 2 medium, 3 low, 3 nit. Reproducers: `tests/browser/qa-round2/disclosure.test.tsx` (14 tests: 2 fail by design, 12 pin correct-but-untested behaviour; stable over three runs).

Worst thing: `QueueItemAction` is still unreachable on touch devices. Tailwind v4 compiles `group-hover:opacity-100` inside `@media (hover: hover)`, so on a phone (no hover, no Tab) the row actions stay at `opacity: 0` and the docs/description sentence "revealed on hover or keyboard focus" describes two inputs the device does not have. Second: a reasoning stream whose start and end land in the same millisecond measures `Math.ceil(0) = 0`, which the trigger treats as "still thinking", so a finished part keeps a shimmering "Thinking..." forever (inherited from upstream, one-token fix).

All round-1 fixes in this lens hold; the canonical suites are load-bearing (26 of 27 mutations caught; the one survivor is a behaviour the canonical file does not exercise and my file now pins). Verdict: **ship after the two medium items** (both one-line changes) — nothing here blocks install, build or the directory listing.

## Fix verification

| round-1 finding | claimed fix | verified? | evidence |
| --- | --- | --- | --- |
| disclosure-agent F1 (high): `ToolInput` crashes on `input: undefined` | "No input yet" placeholder; `toJson` with BigInt replacer and `String()` fallback | yes | `registry/ai/tool.tsx:122-152`; canonical "renders a placeholder…" + "never throws for input JSON cannot serialise"; mutation T3 (placeholder keyed on `null` instead of `undefined`) caught by 2 tests; my "renders an empty object input and a null output as JSON literals" and the dark-mode axe pin pass; preview `app/preview/tool/page.tsx:31` passes `undefined` |
| disclosure-agent F2 (medium): auto-close timer restarts on inline `onOpenChange` | `onOpenChangeRef` + `setIsOpen` deps `[isOpenControlled]` | yes | `reasoning.tsx:76-90`; my "keeps exactly one auto-close timer while the parent re-renders every 50 ms…" passes: `vi.getTimerCount()` stays 0 during and exactly 1 after the stream through 29 re-renders with fresh handlers, fires at 1000 ms, then 0; mutation R1 caught |
| disclosure-agent F3 / rendered-surface F4 (high): queue action invisible on keyboard focus | `focus-visible:opacity-100 group-focus-within:opacity-100` | yes (keyboard only) | `queue.tsx:133`; compiled `.next/static/chunks/0jgcpcuv4iy7d.css` has `.focus-visible\:opacity-100:focus-visible{opacity:1}` and `.group-focus-within\:opacity-100:is(:where(.group):focus-within *){opacity:1}` outside any media query; `group` is on every `QueueItem` (`queue.tsx:41`, the only row element); mutations Q1 and Q3 caught. Touch devices remain broken: see F1 below |
| disclosure-agent F4 (medium): cannot close `Reasoning` while streaming | auto-open only on false→true of `isStreaming` (`wasStreamingRef`); manual toggle marks the cycle spent | yes | `reasoning.tsx:99-130, 152-158`; canonical "stays closed when the reader closes it mid-stream…"; mutation R4 caught by 2 tests; my controlled-parent tests confirm exactly one `onOpenChange(true)` per stream across re-renders and one `onOpenChange(false)` after it, and once each under `StrictMode` |
| disclosure-agent F5 + tokens-css F6: queue docs claim `/50` contrast defect; test disables `color-contrast` | docs rewritten; exclusion removed | yes | `registry/ai/registry.json` queue docs now describe full-alpha text and the dot change; `grep -n "color-contrast" tests/browser/ai/queue.test.tsx` → none; "completed rows keep full-alpha muted text and pass color-contrast" runs the full rule set |
| disclosure-agent F6 (medium): empty `role="alert"` for approved `output-error` | `output-error` in `respondedStates`; `Confirmation` returns null without request or boolean decision | yes | `confirmation.tsx:55-60, 75-83`; ai@7 `output-error` carries `approval?: { approved: true }` (`node_modules/ai/dist/index.d.ts` `UIToolInvocation`); mutations C1, C2 caught; preview section added |
| disclosure-agent F7 (medium): reasoning docs omit Streamdown CSS | CSS sentence added, `katex@^0.16` dependency | yes | docs carry `@source`, `styles.css`, KaTeX lines; `streamdown@2.6.0` exports `./styles.css` with `sd-fadeIn/blurIn/slideUp/markerIn` keyframes; "plugins ship no classes" holds (0 Tailwind-looking string literals in all four `@streamdown/*/dist/*.js`, 165 `className` hits in `streamdown/dist/chunk-*.js`); matches `app/globals.css:1-9` |
| disclosure-agent F8 (low): falsy outputs dropped | `output === undefined && !errorText`; `String()` for primitives | yes | `tool.tsx:161-186`; mutation T1 caught by 3 tests; my null-output pin renders "Result" + `null` |
| disclosure-agent F9 (low): `<h4>` → `<div>` undocumented | docs sentence | yes | tool docs: "The "Parameters" and "Result"/"Error" labels are <div>s (upstream <h4>)…" |
| disclosure-agent F10 (low): `shikiTheme` undocumented; "unless controlled" wording | docs mention theme pair; controlled wording | yes | docs: "ReasoningContent passes shikiTheme={[…high-contrast…]}"; "A controlled parent receives the auto-open and auto-close requests through onOpenChange" matches `reasoning.tsx:84-90, 128, 145` |
| disclosure-agent F11 (low): `<p>` in trigger button | `<span>` | yes | `reasoning.tsx:189-194`; canonical "puts only phrasing content inside the button" |
| disclosure-agent F12 (nit): duplicated union member | removed | yes | `confirmation.tsx:12-33` now `never / boolean / true / false`, the same four members as upstream `confirmation.tsx:10-31` |
| disclosure-agent F13 (nit): blank badge for unknown state | `?? status`, neutral `CircleIcon` | yes | `tool.tsx:69-76`; mutation T2 caught |
| rendered-surface F11 (medium): 20 px trigger rows | `min-h-6` on reasoning, task, chain-of-thought triggers | yes | `reasoning.tsx:209`, `task.tsx:62`, `chain-of-thought.tsx:112`; mutations R6, A1, K4 each caught by the 24 px test |
| rendered-surface F12 (low): no reduced-motion handling | global `@media (prefers-reduced-motion: reduce)` guard | yes (site and base item) | `app/globals.css:137-147` (`!important`, earliest layer); `registry/base/registry.json:116` ships the same block and its docs say so. Not per-component, so a consumer who does not install `base` gets nothing — acceptable, documented on the base item |
| test-quality M2: tool "Error" heading satisfied by the badge | `outsideBadge` helper asserts the heading outside the badge and no "Result" | yes | mutation T4 (`{"Result"}`) caught by 3 tests |
| test-quality M3: auto-open effect never exercised | "auto-opens when streaming starts after mount" | yes | mutation R4 caught; my StrictMode test exercises it with a controlled `open={false}` |
| test-quality M4: `/Thought for/` matched "a few seconds" | fake timers, exact strings | yes | mutation R3 (`Math.round`) caught by "#63" and "measures a second stream afresh" |
| test-quality M12: both outcomes rendered in one tree | one `Confirmation` per tree; table over all states | yes | "shows exactly one part in every ai state" (9 cases, unmount between) |
| test-quality F1 (#63/#86 upstream regressions absent) | ported with fake timers | yes | `reasoning.test.tsx:259, 376`; 18/18 upstream reasoning tests present |
| fix report: "second stream auto-closes once too" (deliberate divergence) | `autoCloseSpentRef.current = false` at stream start | yes, and I agree with the choice | see Findings F6 |

## Findings (most severe first)

### F1. `QueueItemAction` is unreachable on touch devices: the only non-keyboard reveal is gated on `(hover: hover)` — severity: medium (a11y/usability; inherited, but the fix and the docs claim otherwise)

- Where: `registry/ai/queue.tsx:133` (`opacity-0 … group-hover:opacity-100 … focus-visible:opacity-100 group-focus-within:opacity-100`); Tailwind 4.3.3 defines `hover` as `&:hover` wrapped in `@media (hover: hover)` (`node_modules/tailwindcss/dist/lib.js`: `i.static("hover",p=>{p.nodes=[H("&:hover",[B("@media","(hover: hover)",p.nodes)])]})`); compiled site CSS `.next/static/chunks/0jgcpcuv4iy7d.css` (re-fetched from the restarted server, byte-identical): `@media (hover:hover){….group-hover\:opacity-100:is(:where(.group):hover *){opacity:1}}`, while the two focus rules sit outside any media query. Docs: "QueueItemAction is also revealed on keyboard focus (focus-visible and group-focus-within), not only on row hover"; description: "action buttons revealed on hover or keyboard focus".
- What: on a coarse-pointer device (`hover: none`, which iOS and Android report) the `group-hover` rule does not exist, there is no Tab key, and a tap does not produce `:focus-visible` on a button. Every "Mark complete" / "Remove task" / "Send now" button on `/preview/queue` is therefore permanently `opacity: 0` on a phone: tappable but invisible. Upstream has the same class (`queue.tsx:129`), but the port fixed the keyboard half and now documents the control as reachable.
- Evidence: reproducer `queue › reveals row actions on devices without hover (fails today)` walks the CSSOM: it finds the hover reveal (1 rule, inside `hover:hover`) and zero rules that reveal the action under `hover: none` / `pointer: coarse` → `AssertionError: a rule that reveals the action when hover is unavailable: expected 0 to be greater than 0`. Round-1 rendered-surface tested 375 px with a mouse-emulating Playwright (`hover: hover` true), so it could not see this.
- Why it matters: the queue is "beside a prompt input" in a chat UI; phones are the common case, and the buttons are the only way to act on an item.
- Proposed fix: add `pointer-coarse:opacity-100` (Tailwind 4.3 ships the variant: `r("pointer-coarse",["@media (pointer: coarse)"])`) to the action class list, or `[@media(hover:none)]:opacity-100`; then say so in the docs sentence. Optional: `motion-safe` is not needed, the global reduced-motion guard already covers the transition.
- Test written: as named (expected: FAIL now).

### F2. `Reasoning` shows a shimmering "Thinking..." forever when a stream starts and ends in the same millisecond — severity: medium (edge case with a permanent wrong state; inherited)

- Where: `registry/ai/reasoning.tsx:112-115` (`setUncontrolledDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S))`) and `:188` (`if (isStreaming || duration === 0)` → shimmer "Thinking...").
- What: #63 rounds 0.3 s up to 1 s, but 0 ms rounds to 0, and 0 is the sentinel the trigger reads as "still thinking". Two React commits inside one millisecond (the start commit's effect stamps `startTimeRef`, the end commit's effect reads the clock) produce exactly that: a finished, collapsed part whose trigger keeps the infinite shimmer and never shows a duration. Same in upstream (`reasoning.tsx:95, 158`).
- Evidence: reproducer `reasoning › reports at least one second for a stream that starts and ends within the same millisecond (fails today)`: fake `Date` not advanced, `isStreaming` true → false → `AssertionError: expected <span class="shimmer …">Thinking...</span> to be null`.
- Why it matters: reachable in practice when the `reasoning-start` and `reasoning-end` chunks arrive in consecutive tasks on a fast connection (two separate `read()` results within a millisecond); the state is permanent for that message and looks like a hang. Not reachable from the chat block's scripted demo.
- Proposed fix: `Math.max(1, Math.ceil(...))` (a stream that happened took at least "1 seconds" by the component's own rounding rule), or make the trigger distinguish `duration === 0 && !isStreaming` from streaming. Port the reproducer into `reasoning.test.tsx` (it is the #63 test with `advance(0)`).
- Test written: as named (expected: FAIL now).

### F3. The auto-close callback's "spent" mark is not covered by the canonical suite (mutation survived) — severity: low (test gap; behaviour is correct)

- Where: `registry/ai/reasoning.tsx:143-146` (timer callback sets `autoCloseSpentRef.current = true` before `setIsOpen(false)`).
- What: deleting that line leaves `tests/browser/ai/reasoning.test.tsx` green (39/39; mutation R2). The line matters for a controlled parent that re-opens the panel programmatically after the auto-close (an "expand all" button, or `useReasoning().setIsOpen` is not involved): without it the second open is auto-closed again one second later. The canonical "does not auto-close again after the reader re-opens an auto-closed panel" re-opens through the trigger, which sets the flag in `handleOpenChange` (`:154`) and so cannot see the difference.
- Evidence: mutation log R2 (survived) vs R2b (my `keeps open a panel that a controlled parent re-opens after the auto-close` fails: `expected 'true' … received 'false'` after `advance(3000)`).
- Proposed fix: move my test into `reasoning.test.tsx`.
- Test written: as named (expected: PASS; fails under mutation R2).

### F4. Two different placeholders for the same "input not yet received" state — severity: low (cross-owner consistency; the tool fixer explicitly asked the chat fixer to align)

- Where: `registry/ai/tool.tsx:148` renders "No input yet"; `registry/blocks/chat/components/blocks/chat.tsx:529` renders "Streaming input…" for `part.state === "input-streaming" && part.input === undefined` and only mounts `ToolInput` when `input !== undefined` (`:517-518`).
- What: a consumer who uses `Tool*` directly sees "No input yet" (with the "Parameters" label, in the muted box); one who uses the block sees "Streaming input…" (no label, no box) for the identical ai@7 shape. `fix-reasoning-tool-task-plan.md` › Requests for other owners asked for one wording.
- Proposed fix: the block drops its branch and lets `<ToolInput input={part.input} />` render the placeholder (the block already relies on the item for every other state), or the two strings are made identical.
- Test written: none (wording); the block's "Pending after stop" mapping is pinned by my `shows a running call as Pending once the chat block reports the chat has stopped` (PASS).

### F5. The fail-on-console guard is bypassed by `vi.spyOn(console, "error").mockImplementation` — severity: low (test infrastructure)

- Where: `tests/setup.ts:47-57` wraps `console.error`/`console.warn` in `beforeEach`; `tests/browser/ai/chain-of-thought.test.tsx:91`, `confirmation.test.tsx:134` (both "throws when a part is used outside…"), `checkpoint.test.tsx:169-170`, `task.test.tsx:105` install spies afterwards without `allowConsole()`.
- What: a spy installed after `start()` replaces the wrapper, so React's error (the thrown provider error, the nested-`<button>` warning) never reaches the guard and the test passes with no opt-out, while `reasoning.test.tsx:105` and `plan.test.tsx:221, 269` do call `allowConsole("error")` for the same pattern and would pass without it. The porting doc's "nothing else opts out" (`docs/porting-ai-elements.md:209-210`) is therefore not enforced: any test can silence any warning by spying.
- Proposed fix: have the guard record from the original `console` binding (e.g. install once at module load and expose `allowConsole`, and in `stop()` detect that `target.error !== wrapper` and fail the test with "console.error was replaced; use allowConsole()"), or lint for `spyOn(console` in `tests/browser/**`.
- Test written: none (would need to edit `tests/setup.ts` to prove; the four call sites are the evidence).

### F6. Owner decision on the second-stream policy: the divergence is right; keep it — severity: n/a (write-up requested by the brief)

- Where: `registry/ai/reasoning.tsx:126` (`autoCloseSpentRef.current = false` when a stream starts) vs upstream `reasoning.tsx:84, 117` (`hasAutoClosed` state set once, never reset).
- Upstream behaviour for a second stream in the same instance: the auto-open effect re-opens it (it fires on every render while streaming), the auto-close never fires again, so the panel stays open with "Thought for N seconds" until the reader closes it. That is an accident of the #86 guard (added to stop re-closing a panel the reader opened), not a designed policy.
- Port behaviour: each stream owns one open/close cycle; a manual toggle during a cycle hands the panel to the reader until the next stream. The one arguable sub-case is: reader re-opens after the first auto-close, a second stream arrives, the panel (already open) auto-closes after that stream — the reader's earlier choice is overridden by new content. A chat user expects the transcript to tidy itself after thinking; a panel that re-collapses after new thinking is what the first stream taught them, and the docs say exactly this ("each new stream auto-opens and auto-closes once"). I would not restore upstream parity.
- Practical exposure is small anyway: in the chat block a `Reasoning` instance streams once — parts are keyed `${message.id}-${part.type}-${index}` (`chat.tsx:341`), `status` reaches only the last message (`chat.tsx:216`), `regenerate` allocates a new message id (`node_modules/ai/dist/index.js:22637-22638`), and the preview's "Restart stream" remounts via `key` (`app/preview/reasoning/page.tsx:70`). The only path to a true second stream is a stuck `state: "streaming"` part after Stop (rendered-surface F9's root cause in ai@7) followed by an automatic continuation of the same assistant message; that is the chat lens's `isLive` heuristic, not this component.
- Evidence: canonical "auto-opens and auto-closes again for a second stream" (R2/R4 mutations caught); my controlled-parent and StrictMode pins.

### F7. Test names carry upstream issue numbers — severity: nit

- Where: `tests/browser/ai/reasoning.test.tsx:259` ("…manually opened - #86"), `:376` ("…up to 1 second - #63").
- What: the brief's naming rule (no bug/review references) vs the porting doc's "keep upstream's test names" (`docs/porting-ai-elements.md:161-165`). Both behaviours are fully described by the rest of the name; the suffixes add nothing a reader without upstream access can use.
- Proposed fix: drop the suffixes.

### F8. Two description sentences are loose — severity: nit

- `tool` description: "Result or Error (output as JSON, string, or React node) in Code Blocks" — a React node renders in a plain `<div>` (`tool.tsx:169-170`), and numbers/booleans as text (docs say so). Reword to "(JSON and strings in Code Blocks, React nodes and primitives as-is)".
- `chain-of-thought` `title` is "Chain Of Thought" (capital "Of"); the description and every other title use sentence-style capitals. Cosmetic in the directory listing.

## Mutation log

Harness: `scratchpad/qa/round2/disclosure/mut/mutate.sh` (backup → `perl -0pi` → run the named test file(s) → restore → `cmp` + `git diff --stat`); batch in `mut/batch.sh`, raw output in `mut/results.log`. Every source restored byte-identically (`git diff --stat -- registry/ai/<file>` empty for all eight; the `branch.tsx` diff in the tree at the end belongs to another lens's concurrent run).

| behaviour | mutation | test file | caught? |
| --- | --- | --- | --- |
| reasoning: setter identity independent of `onOpenChange` | read the prop directly, deps `[isOpenControlled, onOpenChange]` (R1) | `ai/reasoning.test.tsx` | yes (1: "keeps the auto-close timer running…") |
| reasoning: auto-close marks the cycle spent | drop `autoCloseSpentRef.current = true` in the timer callback (R2) | `ai/reasoning.test.tsx` | **no** (39/39) |
| same | same (R2b) | `qa-round2/disclosure.test.tsx` | yes ("keeps open a panel that a controlled parent re-opens after the auto-close") |
| reasoning: sub-second rounds up | `Math.ceil` → `Math.round` (R3) | `ai/reasoning.test.tsx` | yes (2) |
| reasoning: auto-open only on stream start | `if (!started)` → `if (!isStreaming)` (R4) | `ai/reasoning.test.tsx` | yes (2) |
| reasoning: `defaultOpen={false}` blocks auto-open | drop `!isExplicitlyClosed` (R5) | `ai/reasoning.test.tsx` | yes (1) |
| reasoning: 24 px trigger | drop `min-h-6` (R6) | `ai/reasoning.test.tsx` | yes (1) |
| tool: falsy outputs render | `!(output \|\| errorText)` (T1) | `ai/tool.test.tsx` | yes (3) |
| tool: unknown state shows raw text | drop `?? status` (T2) | `ai/tool.test.tsx` | yes (1) |
| tool: placeholder keyed on `undefined` | `input === null ?` (T3) | `ai/tool.test.tsx` | yes (2) |
| tool: "Error" heading | always "Result" (T4) | `ai/tool.test.tsx` | yes (3) |
| queue: focus reveal | strip `focus-visible:` + `group-focus-within:` (Q1) | `ai/queue.test.tsx` | yes (2) |
| queue: full-alpha dot border | `border-muted-foreground/50` (Q2) | `ai/queue.test.tsx` | yes (2, class assertions) |
| same | same (Q2b) | `qa-round2/disclosure.test.tsx` | yes ("keeps the indicator dot at 3:1…", computed colours with alpha composited) |
| queue: row is the `group` | drop `group` from `QueueItem` (Q3) | `ai/queue.test.tsx` | yes (2) |
| confirmation: `output-error` is a responded state | remove from `respondedStates` (C1) | `ai/confirmation.test.tsx` | yes (2) |
| confirmation: no alert without a decision | drop the boolean check (C2) | `ai/confirmation.test.tsx` | yes (1) |
| confirmation: action className merges | `className ?? defaults` (C3) | `ai/confirmation.test.tsx` | yes (1) |
| chain-of-thought: unknown status neutral | drop `?? complete` (K1) | `ai/chain-of-thought.test.tsx` | yes (1) |
| chain-of-thought: stable setter | deps `[isControlled, onOpenChange]` (K2) | `ai/chain-of-thought.test.tsx` | yes (1) |
| chain-of-thought: empty results render nothing | guard disabled (K3) | `ai/chain-of-thought.test.tsx` | yes (1) |
| chain-of-thought: 24 px header | drop `min-h-6` (K4) | `ai/chain-of-thought.test.tsx` | yes (1) |
| checkpoint: props reach the tooltip button | drop `{...props}` in tooltip branch (X1) | `ai/checkpoint.test.tsx` | yes (1) |
| plan: trigger className forwarded | drop `className={className}` (P1) | `ai/plan.test.tsx` | yes (1) |
| plan: root carries `data-slot="plan"` | drop the attribute (P2) | `ai/plan.test.tsx` | yes (2) |
| task: 24 px trigger | drop `min-h-6` (A1) | `ai/task.test.tsx` | yes (1) |
| task: chevron variant | `group-data-panel-open` → `group-data-open` (A2) | `ai/task.test.tsx` | yes (1, computed `rotate`) |

27 mutations, 26 caught by canonical tests, 1 survived (R2, now pinned by the new file).

## Test-quality issues (file › test name → problem)

- `tests/browser/ai/chain-of-thought.test.tsx › throws when a part is used outside ChainOfThought`; `confirmation.test.tsx › throws when a part is used outside Confirmation`; `checkpoint.test.tsx › opens the tooltip on keyboard focus without a TooltipProvider and logs nothing`; `task.test.tsx › renders custom children inside the button and ignores title` → `vi.spyOn(console, …).mockImplementation` without `allowConsole()`; passes only because the spy bypasses the guard (F5). The checkpoint and task tests additionally assert "nothing logged" through their own spy, which is fine, but the guard is the mechanism the repo advertises.
- `tests/browser/ai/reasoning.test.tsx › … - #86`, `… - #63` → issue references in names (F7).
- `tests/browser/ai/queue.test.tsx › renders completed state as a filled full-alpha dot / renders pending state as a hollow full-alpha dot` → class-string assertions (`not.toContain("border-muted-foreground/")`) rather than a colour measurement; the mutation is caught, but a future `border-muted-foreground/[.5]` or a token change would not be. My computed-colour test with alpha compositing is the stronger form (contrast measured: light 5.28:1 vs panel, 4.84:1 vs hovered row; dark 7.63:1 vs panel, 6.91:1 vs card, 5.83:1 vs hovered row).
- `tests/browser/ai/tool.test.tsx › shows the falsy result "" under a Result heading` → for `""` only the heading is asserted (the `if (text)` branch skips the value); acceptable, the heading is the behaviour.
- Fixtures: every axe run in the eight files sits in `<main>`; no disabled rules, no `test.skip`, no sleeps (fake timers via `act`), no `region`/`color-contrast` exclusions. Names describe behaviour throughout except the two above.
- Flakiness: three consecutive runs of the eight files → 228/228 each (9.5 s, 10.3 s, 8.3 s). My file: 12 pass / 2 fail by design in three consecutive runs (7.5 s, 7.9 s, 4.7 s). One run of my file during the mutation batch timed out on the chat-block cross-check test while another lens was mutating `registry/ai/branch.tsx` (Vite re-optimised mid-run); not reproducible in isolation.

## Verified OK

- All eight `docs`/`description` strings match the code sentence by sentence (checked each claim against source lines: Base UI sentence, `(open, eventDetails)` for tool/task/plan/queue vs `(open)` for reasoning/chain-of-thought, `keepMounted` on Panels, `PlanContent` typed as `CardContent` props, `render` composition and `nativeButton`, `data-panel-open` chevrons, semantic status colours, `bg-card text-destructive` error box, `<div>` labels, "No input yet", BigInt/`String()` fallback, falsy outputs, unknown state, shikiTheme pair, `min-h-6`, CSS lines, `katex@^0.16` declared, `pending hollow / completed filled` dots, focus reveal, `output-error` accepted, null-instead-of-empty-alert, tooltip without provider, always-exposed separator).
- Dependencies vs imports for all eight entries: every bare import declared (`cn`, `lucide-react`, `ai@^7` for tool/confirmation, streamdown + four plugins + katex for reasoning), every `@/components/ui/*` import has its bare `registryDependencies` entry, `tool → @uifiles/code-block`; `tests/unit/registry.test.ts` 22/22 and `tests/unit/ssr.test.ts` pass (43 tests over the two files).
- Reasoning: exactly one `onOpenChange(true)` for a controlled closed panel per stream and exactly one `onOpenChange(false)` after it, however often the parent re-renders and ignores them; once each under `StrictMode`; a reader who closes and re-opens inside the 1 s window keeps the panel; `duration={0}` shows "Thinking..." (upstream semantics); `duration` prop wins while measured is discarded; unmount during stream and during the window leaves `vi.getTimerCount() === 0`; `Collapsible` `onOpenChange` is only called from the trigger (`node_modules/@base-ui/react/collapsible/root/useCollapsibleRoot.js:41`), so no non-user path marks the cycle spent.
- Tool: `{}` → `{}`, `null` input → `null`, `null` output → "Result" + `null`, React element output as-is, `errorText` + output both render, unknown state → raw text; "No input yet" passes axe in dark mode; the chat block maps `input-available` + non-live status to `input-streaming` → header "Pending", back to "Running" when live (`chat.tsx:495-497`).
- Task: custom children with a nested `<button>` are not prevented (React logs `In HTML, <button> cannot be a descendant of <button>`), which the docs state as the contract; `render` + `nativeButton={false}` substitutes the element.
- Plan: `render={<Card />}` yields one element with `data-slot="plan"` (the `<Card />` render element carries no `data-slot` prop, so the root's `data-slot="plan"` reaches `Card` through its props and the `{...props}` spread overrides the internal `data-slot="card"`), `PlanTrigger` className overrides `size-8` through the Button's `cn`, `PlanContent` has no `keepMounted` (type-level, documented), no headings anywhere.
- Chain-of-thought: header memoised on a stable context (3 parent re-renders add 0 header renders), unknown status → neutral, `min-h-6`, empty `SearchResults` → null for `[].map`, `false` and no children; image alt contract documented and pinned.
- Queue: `group` on every row; keyboard reveal computed `opacity` 1 after the 150 ms transition; ScrollArea viewport `tabIndex` 0 only when overflowing (`ScrollAreaViewport.js:282`), `role="presentation"`; `data-panel-open` chevron `-90deg`/`0deg`; indicator dots are not the only state cue (line-through on content and description).
- Confirmation: all nine state/approval combinations show exactly one part and an alert only when something renders; an `approval-requested` part that already carries `approved: true` still shows the request and actions (my pin); `ConfirmationAction` `className` merges and `render={<a/>}` composes with `role="button"`.
- Checkpoint: tooltip opens on Tab without a provider and logs nothing; `onClick` once with and without tooltip; `type="button"`; separator last child, `role="separator"` + `aria-orientation="horizontal"`.
- Previews: `tool` opens the `input={undefined}` example, `confirmation` has the `output-error, approved` section, `reasoning` reserves `min-h-56` and restarts via `key`, `checkpoint`/`queue`/`task`/`plan`/`chain-of-thought` unchanged and consistent with the sources; each has one `<h1>` and `<h2>` sections.
- rendered-surface F12 is closed globally (`app/globals.css:137-147`, shipped by the base item).

## Could not reach

- Real touch emulation: Vitest browser mode cannot switch `(hover: none)` on, so F1 is proven from the CSSOM rather than a rendered tap. Playwright with `hasTouch`/`isMobile` on `/preview/queue` would show the invisible buttons directly.
- Production server note: during this run the server at `:3000` was stale (its HTML referenced `/_next/static/chunks/3g4d4pl8l91w7.css`, which returned HTTP 500), so my first CSS fetch failed and I read the compiled chunk from disk. The coordinator restarted the server on the current build mid-run; I re-fetched `/preview/queue` and both stylesheets afterwards (200, 152,869 + 3,701 bytes, byte-identical to `.next/static/chunks/*.css`) and re-confirmed F1's rule placement against the served CSS. Nothing else in this report used the server (no screenshots, no computed styles from `:3000`; every rendered assertion ran in Vitest browser mode).
- `pnpm dlx shadcn@latest add @uifiles/<name>` round-trip: bare upstream `registryDependencies` need `ui.shadcn.com` (blocked).
- Whether two React commits inside one millisecond actually occur against a live `useChat` stream (F2): argued from the effect timing and `Date.now()` resolution, reproduced with a faked clock only.
- `git status` note: the lead committed the round-2 reproducer files as `df9f0c3` while this lens ran, so `tests/browser/qa-round2/disclosure.test.tsx` shows as tracked and clean; no tracked source, test, preview or docs file was modified by this lens (every mutation was restored byte-identically and `git diff --stat -- registry/ tests/browser/ai app/ docs/` is empty).
- `registry/ai/upstream.lock.json` hashes (upstream registry endpoint blocked); diffed against the clone instead — no unexplained divergence beyond the documented ones.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
pnpm exec vitest run --project browser tests/browser/ai/{reasoning,tool,task,plan,chain-of-thought,queue,checkpoint,confirmation}.test.tsx
#   x3: Test Files 8 passed (8) / Tests 228 passed (228) / 9.48s, 10.27s, 8.34s
pnpm exec prettier --write tests/browser/qa-round2/disclosure.test.tsx; pnpm exec biome check tests/browser/qa-round2/disclosure.test.tsx   # clean
pnpm exec tsc --noEmit | grep qa-round2/disclosure                                                                                        # none
pnpm exec vitest run --project browser tests/browser/qa-round2/disclosure.test.tsx
#   x3: Tests 2 failed | 12 passed (14)
#   × reasoning › reports at least one second for a stream that starts and ends within the same millisecond (fails today)
#       AssertionError: expected <span class="shimmer [--shimmer-duration:1s]">Thinking...</span> to be null
#   × queue › reveals row actions on devices without hover (fails today)
#       AssertionError: a rule that reveals the action when hover is unavailable: expected 0 to be greater than 0
bash scratchpad/qa/round2/disclosure/mut/batch.sh   # 27 mutations → mut/results.log; sources restored (cmp + git diff --stat)
pnpm exec vitest run --project unit tests/unit/registry.test.ts tests/unit/ssr.test.ts   # 43 passed
sed -n 2150,2290p node_modules/ai/dist/index.d.ts            # UIToolInvocation: output-error approval is { approved: true }
grep -o '.\{0,60\}(hover: hover).\{0,120\}' node_modules/tailwindcss/dist/lib.js   # hover variant wrapped in @media (hover: hover)
python3 …  .next/static/chunks/0jgcpcuv4iy7d.css              # group-hover:opacity-100 inside @media (hover:hover); focus rules outside
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/_next/static/chunks/3g4d4pl8l91w7.css   # 500 before the restart (stale server)
curl -s http://localhost:3000/preview/queue | grep -o 'href="[^"]*\.css[^"]*"'   # after the restart: 0jgcpcuv4iy7d.css + 3x59cvfd7p2ai.css, both 200, byte-identical to .next/static/chunks
grep -n "tabIndex" node_modules/@base-ui/react/scroll-area/viewport/ScrollAreaViewport.js           # :282 hidden x&&y ? -1 : 0
grep -n "onOpenChange" node_modules/@base-ui/react/collapsible/root/useCollapsibleRoot.js           # :41 only from the trigger
grep -n "messageId: this.generateId()\|regenerate-message" node_modules/ai/dist/index.js            # :22637-22638
```
