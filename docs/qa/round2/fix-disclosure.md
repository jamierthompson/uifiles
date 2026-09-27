# fix-disclosure

Round 2 fixes for `registry/ai/{reasoning,tool,task,plan,chain-of-thought,queue,checkpoint,confirmation}.tsx`, their canonical browser tests, and their preview pages. Inputs: `qa/round2/disclosure.md` (F1–F8, mutation log, test-quality issues) plus the coordinator's three items from `qa/round2/rendered-surface.md` (N6, N10, F18/N12). The 14 round-2 reproducers are migrated and `tests/browser/qa-round2/disclosure.test.tsx` is deleted.

## Fixed

- disclosure:F1 (medium) — `QueueItemAction` is revealed on a coarse pointer: `pointer-coarse:opacity-100` added next to the hover/focus reveals (Tailwind 4.3.3 ships the variant as `@media (pointer: coarse)`; verified in `node_modules/tailwindcss/dist/lib.js`). Vitest browser mode has no media emulation, so the test proves it from the CSSOM: it walks every sheet (layers, nested media) and asserts a rule inside `(pointer: coarse)` sets the action to `opacity: 1` with no state pseudo-class, and that the hover reveal exists only inside `(hover: hover)`. — `registry/ai/queue.tsx:137` — test: `tests/browser/ai/queue.test.tsx` › "is always visible on a coarse pointer, where neither hover nor Tab exists" (failed before: `AssertionError: expected 0 to be greater than 0`; passes after). Docs sentence in Registry entry changes.
- disclosure:F2 (medium) — measured reasoning duration is at least 1 s: `Math.max(1, Math.ceil(...))`, so a stream whose start and end commits land in the same millisecond no longer measures 0 and shimmers "Thinking..." forever. The `duration === 0` prop semantics in the trigger are unchanged (upstream: an explicit `duration={0}` still reads as thinking; pinned by "renders the thinking message when duration is 0"); the sentinel is now reachable only while streaming or by that explicit prop, never from the measured path. — `registry/ai/reasoning.tsx:117` — test: `tests/browser/ai/reasoning.test.tsx` › "reports at least one second for a stream that starts and ends within the same millisecond" (frozen fake `Date`; failed before: `expected <span class="shimmer …">Thinking...</span> to be null`; passes after).
- disclosure:F3 (low, test gap) — the reviewer's mutation-killer migrated: a controlled parent re-opens the panel programmatically (not through the trigger) after the auto-close and it stays open. — test: `tests/browser/ai/reasoning.test.tsx` › "keeps open a panel that a controlled parent re-opens after the auto-close" (kills mutation R2: dropping `autoCloseSpentRef.current = true` in the timer callback now fails 1 test; was 39/39 green).
- disclosure:F5 (low, test infra) — every `vi.spyOn(console, …).mockImplementation` in my eight test files is gone (11 sites, not only the four listed: chain-of-thought:91, confirmation:134, checkpoint:169–170, task:105, plus reasoning:106/308/325, tool:326/360/516, plan:222/270). Tests that assert a thrown provider error keep `allowConsole("error")` and assert the boundary's `onError`; tests that previously asserted "nothing logged" through their own silenced spy now rely on the guard, which fails them on any output (reasoning unmount tests, checkpoint no-provider test, task custom-children test); tests where nothing throws (tool BigInt/circular/undefined) lost both the spy and the `allowConsole`. The one test that needs to read React's message (task nested `<button>`) uses a pass-through `vi.spyOn(console, "error")` without `mockImplementation`, so the guard's wrapper still records and prints, with `allowConsole("error")`.
- disclosure:F7 (nit) — "#86"/"#63" dropped: "does not auto-close a message that never streamed and was opened with defaultOpen", "rounds a sub-second stream up to 1 second".
- rendered-surface:N6 (low, checkpoint) — `CheckpointTrigger` mirrors the tooltip into an `sr-only` description referenced by `aria-describedby`, unless the tooltip equals `aria-label` or the string child (the `PromptInputButton` pattern). A consumer's own `aria-describedby` wins (spread after). — `registry/ai/checkpoint.tsx:59,72,80,95` — tests: `tests/browser/ai/checkpoint.test.tsx` › "exposes the tooltip text as the accessible description before it opens" (failed before: `expected null to be truthy`; passes after) and "adds no description when the tooltip only repeats the button's name" (three cases: same string child, same `aria-label`, no tooltip). The two existing tooltip tests now locate the popup by `[data-slot='tooltip-content']` instead of by text, since the text also lives in the description.
- rendered-surface:N10 (nit, confirmation) — `ConfirmationRejected` wraps its children in `<span className="text-destructive">` (optional `className` merged through `cn`), so the rejected outcome is distinguishable from the accepted one at a glance; the wording still names the outcome, so colour is not the only cue. A `<span>` keeps `ConfirmationTitle`'s inline flow. Contrast: light `oklch(0.52 0.245 27.325)` on the card is 5.62:1, dark passes axe too. — `registry/ai/confirmation.tsx:133,149` — tests: `tests/browser/ai/confirmation.test.tsx` › "colours only the rejected outcome with the destructive token" (computed `color` equals `--destructive` in light and dark, axe in both, accepted stays unstyled; failed before: `Expected the element to have class: text-destructive`) and "merges className into the rejected outcome".
- rendered-surface:F18/N12 (low, queue) — the clamp hides information (the title is the item's only content: 4 of 5 preview titles were cut at 375 px), so `QueueItemContent` is `line-clamp-2` (upstream `line-clamp-1`). — `registry/ai/queue.tsx:82` — test: `tests/browser/ai/queue.test.tsx` › "wraps a long title onto a second line before clamping" (computed `-webkit-line-clamp: 2` and a rendered height of two lines in a 224 px column; failed before: `expected '1' to be '2'`).
- Preview titles — the five server-component previews I own export `metadata` (`app/preview/{tool,task,plan,queue,checkpoint}/page.tsx`), rendering "Tool · uifiles" etc. through the root layout's `%s · uifiles` template (`node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`). `reasoning` and `confirmation` are `"use client"` (hooks) and `chain-of-thought` must stay client because it passes `icon={SearchIcon}` (a function) into a client component; none can export metadata. Not rendered against the server: the production server serves the pre-change build and `pnpm build` is off-limits; `pnpm typecheck` covers the exports.
- Reproducer migration — all 14 round-2 tests are in the canonical files (7 reasoning, 3 tool, 1 task, 2 queue, 1 confirmation); 2 were failing (F1, F2) and now pass, 12 pins. Two replaced weaker canonical tests in place ("asks a controlled parent to open when streaming starts" → "…once per stream even when it ignores the request and keeps re-rendering"; the 400 ms inline-handler test → "keeps exactly one auto-close timer while the parent re-renders every 50 ms…", which also asserts `vi.getTimerCount()`). The queue dot-contrast pin replaces the reviewer's 80-line oklch converter with a 1×1 canvas that composites the dot colour over each background and reads sRGB bytes (Chromium's canvas accepts `oklch()`), then the WCAG formula. The tool dark-mode axe pin was folded into the existing placeholder test. The chat-block reproducer ("shows a running call as Pending once the chat block reports the chat has stopped") is not migrated into my files: it tests `ChatToolPart`, which belongs to the chat fixer, and `tests/browser/blocks/chat.test.tsx:768` already asserts the "Pending" mapping; the text is in Requests for other owners.

## Not fixed and why

- disclosure:F4 (low) — no change needed on my side: "No input yet" stays in `ToolInput`, and the chat block now passes `part.input` straight through (`registry/blocks/chat/components/blocks/chat.tsx:531`, changed concurrently by the chat fixer), so there is one placeholder. Not exported as a constant: no consumer needs the string now that the block relies on the item.
- disclosure:F5, the guard itself (`tests/setup.ts`) — not owned. The four call sites the reviewer named are gone, but the guard still cannot detect a silencing spy in other files; recommendation in Requests for other owners.
- disclosure:F6 — owner decision recorded by the reviewer (keep the second-stream policy); nothing to change.
- disclosure:F8 (nits) — registry manifests are off-limits; exact strings under Registry entry changes.

## Tests

- `tests/browser/ai/reasoning.test.tsx`: 39 → 44 (+5 new, 2 replaced in place, 2 renamed, 3 spies removed)
- `tests/browser/ai/tool.test.tsx`: 35 → 36 (+1, dark-mode axe added to the placeholder test, 3 spies removed)
- `tests/browser/ai/task.test.tsx`: 23 → 24 (+1 nested-button pin, 1 spy removed)
- `tests/browser/ai/plan.test.tsx`: 25 → 25 (2 spies removed)
- `tests/browser/ai/chain-of-thought.test.tsx`: 30 → 30 (spy → `allowConsole`)
- `tests/browser/ai/queue.test.tsx`: 42 → 45 (+3: coarse pointer, two-line clamp, dot contrast)
- `tests/browser/ai/checkpoint.test.tsx`: 8 → 10 (+2 description tests, 2 spies removed, no-provider test relies on the guard)
- `tests/browser/ai/confirmation.test.tsx`: 26 → 29 (+3, spy → `allowConsole`)
- `tests/browser/qa-round2/disclosure.test.tsx`: 14 → deleted (2 failing → passing, 12 pins migrated; 1 chat-block test handed to its owner)
- Total 228 → 243. Upstream tests: unchanged from round 1 (18/18 reasoning present).
- Mutation checks (harness `qa/round2/fix-disclosure-mut/mutate.sh`, log `results.log`; every source restored byte-identically, `git diff --stat` shows only the intended changes):
  - M1 drop `pointer-coarse:opacity-100` → caught by "is always visible on a coarse pointer…"
  - M2 `line-clamp-2` → `line-clamp-1` → caught by "wraps a long title onto a second line before clamping"
  - M3 dot border `border-muted-foreground/50` → caught by 3 (both class tests and "keeps both dots at 3:1…")
  - M4 drop `Math.max(1, …)` → caught by "reports at least one second for a stream that starts and ends within the same millisecond"
  - M5 drop `autoCloseSpentRef.current = true` in the timer callback (reviewer's R2, previously survived) → caught by "keeps open a panel that a controlled parent re-opens after the auto-close"
  - M6 drop `aria-describedby` → caught by "exposes the tooltip text as the accessible description before it opens"
  - M7 `describes = true` → caught by "adds no description when the tooltip only repeats the button's name"
  - M8 drop `text-destructive` → caught by 2 confirmation tests
- Three consecutive runs of the eight files together (after the mutation batch, clean sources): `Test Files 8 passed (8) / Tests 243 passed (243)` at 11.02 s, 8.19 s, 7.86 s; a fourth and fifth run (per-file counts, JSON reporter) also 243/243.
- Test-quality issues from the report: no `vi.spyOn(console, …)` silencing left in my files; every axe fixture in `<main>`; no sleeps (fake timers via `act`, `expect.poll` elsewhere); no wall-clock assertions; no `test.skip`/`retry`; no rule exclusions added. The checkpoint description test parks the pointer on a neutral element first so a tooltip left open by an earlier test cannot leak in.
- One wrinkle worth knowing for the next reviewer: `Element.matches()` throws on at least one selector in the compiled sheet, and `:hover` in `matches()` is live state. My first CSSOM walk guarded the whole sheet, so it aborted before the `(pointer: coarse)` block and the hover check passed only because the pointer happened to be on the button. The helper now guards each `matches()` call and strips state pseudo-classes before matching, so the result depends on neither.

## Registry entry changes (exact strings for registry/ai/registry.json; the registry owner applies them)

- queue › description: "Queued work panel for agent chat: collapsible sections with a count label, a scrollable list of items with a status indicator, strike-through completed state, a description line, image and file attachments, and action buttons revealed on hover, keyboard focus, or always on coarse pointers. Use it for pending todos and queued messages beside a prompt input. Composes shadcn collapsible, scroll-area and button; exports QueueTodo, QueueMessage and QueueMessagePart types."
- queue › docs: replace the last sentence "QueueItemAction is also revealed on keyboard focus (focus-visible and group-focus-within), not only on row hover." with "QueueItemAction is revealed on row hover, on keyboard focus (focus-visible and group-focus-within), and always on coarse pointers (pointer-coarse:opacity-100), because Tailwind gates the hover variant on (hover: hover) and a phone has neither hover nor a Tab key. QueueItemContent clamps titles to two lines (upstream one) so a phone-width title is not cut off after a few words."
- reasoning › docs: after "…each new stream auto-opens and auto-closes once (upstream never auto-closed a second stream)." add "The measured duration is at least 1 second, so a stream that starts and ends within the same millisecond shows \"Thought for 1 seconds\" rather than upstream's permanent \"Thinking...\" (duration 0 is the trigger's streaming sentinel; pass duration={0} only to mean still thinking)."
- checkpoint › docs: after "…it works without a TooltipProvider (wrap one to share delay)." add "Base UI tooltips are visual only, so CheckpointTrigger mirrors the tooltip text into a visually hidden description referenced by aria-describedby, unless it equals the button's aria-label or its text; your own aria-describedby wins."
- confirmation › docs: after "…and its className is merged with the default h-8 px-3 text-sm through cn instead of replacing it." add "ConfirmationRejected wraps its children in a <span className=\"text-destructive\"> (upstream returned them bare in the foreground colour) so the rejected outcome reads differently from the accepted one; pass className to adjust, and keep the children phrasing content."
- tool › description: "Collapsible tool-call card for AI chat: header with wrench icon, tool name derived from the part type (or toolName for dynamic tools), and a status badge for every AI SDK tool state (input-streaming, input-available, approval-requested, approval-responded, output-available, output-denied, output-error); expandable content showing Parameters (input as JSON) and Result or Error (JSON and strings in Code Blocks, React nodes and primitives rendered as given). Use it to render ToolUIPart and DynamicToolUIPart parts from useChat messages."
- chain-of-thought › title: "Chain of Thought"

## Requests for other owners

- `tests/setup.ts` (test-infra owner): the guard cannot see a `vi.spyOn(console, "error").mockImplementation` installed after `start()`. In `stop()`, compare `target[level]` with the wrapper installed in `start()` and fail the test with "console.<level> was replaced during the test; use allowConsole()" when it differs (a pass-through `vi.spyOn` still ends up restored to the wrapper by `vi.restoreAllMocks`, which runs first because `afterEach` hooks run in reverse registration order, so that pattern keeps working). Alternatively lint `spyOn\(console` under `tests/browser/**`.
- `tests/browser/blocks/chat.test.tsx` (chat fixer): the round-2 pin below was in my file and tests your component; `chat.test.tsx:768` already covers "Pending", so add it only if you want the stop → live round trip pinned explicitly:
  ```tsx
  it("shows a running call as Pending once the chat reports it has stopped, and Running again when live", async () => {
    const part = { type: "tool-read_file", toolCallId: "call_1", state: "input-available", input: { path: "app/page.tsx" } } as ToolUIPart
    const screen = await render(<main><ChatToolPart part={part} status="ready" /></main>)
    await expect.element(screen.getByText("Pending")).toBeVisible()
    expect(screen.getByText("Running").query()).toBeNull()
    await screen.rerender(<main><ChatToolPart part={part} status="streaming" /></main>)
    await expect.element(screen.getByText("Running")).toBeVisible()
    expect(screen.getByText("Pending").query()).toBeNull()
  })
  ```
  Note: one run of your file during my session showed "shows Streaming input… instead of parameters while input-streaming with no input yet" failing while `chat.tsx` and `chat.test.tsx` were both mid-edit in the tree (the test now expects "No input yet"); not caused by my files.
- `registry/ai/registry.json` (registry owner): the six entry changes above.
- `components/ui/tooltip.tsx` (vendored, off-limits): the sr-only description pattern now lives in two items (`PromptInputButton`, `CheckpointTrigger`); a `description` prop on the wrapper would let both drop it. Not required.

## Strict-flag typecheck

- Errors remaining in files I own: none (`tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`, filtered to the 24 files).
- Errors in files I do not own: `registry/ai/suggestion.tsx:49` TS2345 (also fails plain `pnpm typecheck`; appeared with another fixer's concurrent `package.json`/lockfile change), `tests/unit/test-setup.test.ts:140,149` TS2322, `tests/unit/tooling.test.ts:208,233,245` TS2741 (strict flags only).

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
grep -o '.\{0,80\}pointer-coarse.\{0,80\}' node_modules/tailwindcss/dist/lib.js   # r("pointer-coarse",["@media (pointer: coarse)"]); tailwindcss 4.3.3
pnpm exec vitest run --project browser tests/browser/qa-round2/disclosure.test.tsx        # baseline: 2 failed | 12 passed (F2, F1)
pnpm exec vitest run --project browser tests/browser/ai/{reasoning,tool,task,plan,chain-of-thought,queue,checkpoint,confirmation}.test.tsx
#   with new tests, unchanged sources: 6 failed | 237 passed (F1, F2, F18, N6, N10 x2)
#   after the source fixes: 8 passed / 243 passed, x3 consecutive (11.02s, 8.19s, 7.86s) + 2 more
bash scratchpad/qa/round2/fix-disclosure-mut/mutate.sh <id> <src> <perl> <test>          # 8 mutations, 8 caught, sources restored (cmp + git diff --stat)
pnpm exec prettier --write <my 24 files>; pnpm exec prettier --check <my 24 files>        # clean
pnpm exec biome check <my 24 files>                                                       # Checked 24 files. No fixes applied.
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals   # 0 errors in my files (others listed above)
pnpm typecheck                                                                            # fails only on registry/ai/suggestion.tsx (not mine)
pnpm registry:validate                                                                    # Registry is valid.
pnpm exec vitest run --project unit tests/unit/registry.test.ts tests/unit/ssr.test.ts    # 45 passed
pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx                 # 49 passed | 1 failed (chat fixer's file mid-edit; see Requests)
rm tests/browser/qa-round2/disclosure.test.tsx
```
