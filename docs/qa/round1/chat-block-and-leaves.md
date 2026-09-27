# chat-block-and-leaves — QA round 1

## Summary

Attacked the `chat` block (`registry/blocks/chat/**`) and the five leaves `branch`, `response`,
`sources`, `suggestion`, `image`: read every line of the sources, their registry entries, the
shadcn wrappers they compose, the installed `ai@7` / `@ai-sdk/react@4` / `@shadcn/helpers@0.2` /
`@shadcn/react@0.3` / `streamdown@2.6` runtime and types, and the upstream AI Elements files and
tests; then drove everything in Vitest browser mode (39 new tests, 13 failing reproducers,
26 passing pins) and mutation-checked one assertion per existing test file against scratch
copies of the sources. **13 findings: 4 high, 3 medium, 5 low, 1 nit** (plus doc/hygiene notes).
The worst: with any real tool-calling backend the block **crashes the whole page** the moment a
tool card is rendered with `input: undefined` (the AI SDK emits exactly that on
`tool-input-start` and on `tool-input-error`), and **pressing Enter while a response is
streaming corrupts the transcript** (30 messages with 4 unique ids, 24 React duplicate-key
errors) because the textarea's Enter handler bypasses the Stop button. There is also no error
surface at all: a failing route leaves the user with a silently vanished spinner.

## Findings (most severe first)

### F1. Tool card crashes the block when `input` is `undefined` (input-streaming, tool-input-error) — severity: high
- Where: `registry/blocks/chat/components/blocks/chat.tsx:352` (`<ToolInput input={part.input} />`), root cause `registry/ai/tool.tsx:127` (`JSON.stringify(input, null, 2)` → `undefined`) → `registry/ai/code-block.tsx:145,171` (`code.slice` / `code.split` on `undefined`).
- What: The SDK creates `{state:"input-streaming", input: void 0}` on `tool-input-start` before any delta (`node_modules/ai/dist/index.js:7867-7897`) and `{state:"output-error", input: void 0, rawInput}` on `tool-input-error` for static tools (`index.js:7970-7995`). `ChatToolPart` opens errored tools by default (`chat.tsx:340`), so the second case throws on mount; the first throws as soon as the user clicks the header. `Chat` has no error boundary, so the entire chat unmounts: `TypeError: Cannot read properties of undefined (reading 'split')` in `<CodeBlockContent>`.
- Evidence: `tests/browser/qa-round1/chat-block-and-leaves.test.tsx` › "BUG: a tool part in input-streaming with no input yet must not crash when opened" and "BUG: a static tool that errored before its input parsed must not crash on mount" — both FAIL with `Received: <div data-testid="crash">Cannot read properties of undefined (reading 'split')</div>`.
- Why it matters: The demo transport never emits `input-streaming` (it jumps straight to `tool-input-available`), so the shipped demo hides it; the first consumer who wires `streamText` with tools and opens a card mid-call, or whose model emits malformed tool JSON, gets a white page.
- Proposed fix: in `ChatToolPart` render `<ToolInput>` only when `part.input !== undefined` (show "Streaming input…" otherwise); harden `ToolInput` with `JSON.stringify(input ?? null, null, 2)`; harden `CodeBlock` to coerce `code ?? ""`. (Root-cause half belongs to the tool/code-block lens; the block-level guard is this lens's.)
- Test written: `tests/browser/qa-round1/chat-block-and-leaves.test.tsx` › the two names above (expected: FAIL now)

### F2. Enter while streaming submits a second request and corrupts the transcript — severity: high
- Where: `registry/blocks/chat/components/blocks/chat.tsx:455-463` (`ChatComposer.handleSubmit` never looks at `status`), `registry/blocks/chat/page.tsx:18` (`sendMessage` called unconditionally); root cause `registry/ai/prompt-input.tsx:983-995` (Enter → `form.requestSubmit()`, guarded only by `submitButton.disabled`, but `PromptInputSubmit` turns into an *enabled* `type="button"` Stop while generating, `prompt-input.tsx:1256`).
- What: Type while the first answer streams and press Enter. `onSubmit` fires (the click path correctly stops). Through `useChat`, the SDK does not abort the previous request; both streams keep writing, and each time the last message changes the older stream pushes a fresh copy of its message (`node_modules/ai/dist/index.js:22690-22700`). Observed: 30 messages with 4 unique ids, statuses `ready→submitted→streaming→submitted→streaming→ready→streaming`, 24× `Encountered two children with the same key` (because `ChatMessage` keys on `message.id`).
- Evidence: › "BUG: Enter while a response is streaming must not fire onSubmit (the button is a Stop)" (FAIL: `expected "vi.fn()" to not be called at all, but actually been called 1 times`) and › "BUG: Enter mid-stream through useChat must not corrupt the transcript with duplicated turns" (FAIL: `expected 4 to be 30`). Raw exploratory dump: `scratchpad/qa/round1/chat-block-and-leaves/explore.txt`.
- Why it matters: "Oh, and also…" while the model is still typing is the most common chat interaction; the flagship block turns it into a garbage transcript.
- Proposed fix: in `ChatComposer.handleSubmit` return early (or call `onStop`) when `status === "submitted" || status === "streaming"`; additionally make `PromptInputTextarea`'s Enter handler bail when the submit button's `type !== "submit"` (prompt-input lens).
- Test written: the two names above (expected: FAIL now)

### F3. No error state: a failing transport leaves nothing on screen — severity: high
- Where: `registry/blocks/chat/components/blocks/chat.tsx:87-97` (`ChatProps` has no `error`), `:192` (only `submitted` renders anything), `registry/blocks/chat/page.tsx:11` (`error` from `useChat` is never read); `registry/ai/prompt-input.tsx:1236-1252` shows an `XIcon` still labelled "Submit".
- What: Drive `useChat` with a transport that streams an `error` chunk: `status` becomes `"error"`, `error.message` is set, the marker disappears, the transcript contains only the user's line, and the submit button shows an X with `aria-label="Submit"`.
- Evidence: › "BUG: a transport error must surface in the transcript, not vanish" — FAIL: `expected 'hiScroll to end' to contain 'Upstream exploded'` (the block's text content).
- Why it matters: The `docs` string tells consumers to swap in `DefaultChatTransport({ api: "/api/chat" })`; a missing API key or a 500 is the first thing they hit, and the UI shows nothing.
- Proposed fix: add `error?: Error` to `ChatProps`/`ChatMessagesProps`, render a `Marker`/`Empty`-style row with the message (and a retry via `regenerate`), pass `error` from the page.
- Test written: the name above (expected: FAIL now)

### F4. `MessageBranchContent` shows every branch when `className` is passed — even `className={undefined}` — severity: high
- Where: `registry/ai/branch.tsx:102-131` — `className` is not destructured, so `{...props}` (which contains `className`) is spread *after* the computed `"… block"/"… hidden"` class and replaces it.
- What: `<MessageBranchContent className="p-2">` (or any wrapper that forwards `className={className}` with `undefined`) renders all branches stacked; "1 of 3" is shown while three answers are visible.
- Evidence: › "BUG: className on MessageBranchContent must not reveal every branch at once" and › "BUG: even className={undefined} (any forwarding wrapper) reveals every branch" — both FAIL (`Received element is visible: <p />` for "Second answer").
- Why it matters: `MessageBranchContentProps = HTMLAttributes<HTMLDivElement>` advertises `className`; upstream has the same bug (`message.tsx:199-228`), but consumers copying the preview will style it.
- Proposed fix: `({ children, className, ...props })` and `cn("grid …", index === currentBranch ? "block" : "hidden", className)`.
- Test written: the two names above (expected: FAIL now)

### F5. Files-only user turn renders an empty text bubble — severity: medium
- Where: `registry/blocks/chat/components/blocks/chat.tsx:310-318`; the SDK always appends `{type:"text", text:""}` for `sendMessage({ text: "", files })` (`node_modules/ai/dist/index.js:22317`), and `ChatComposer` deliberately allows files without text (`chat.tsx:457`).
- What: Attach a file, press Submit with no text: the transcript shows the attachment and then an empty primary-colored pill (`[data-slot=bubble]` with empty `BubbleContent`).
- Evidence: › "BUG: a files-only user turn must not render an empty text bubble" — FAIL (received the empty `<div data-slot="bubble">…<div data-slot="bubble-content" /></div>`).
- Proposed fix: in `ChatMessagePart`, `case "text"` for `role === "user"`: return `null` when `part.text.trim() === ""`.
- Test written: the name above (expected: FAIL now)

### F6. `MessageBranchContent` crashes on a `null`/conditional child — severity: medium
- Where: `registry/ai/branch.tsx:107-110,125` (`childrenArray` keeps `null`; `key={branch.key}` dereferences it).
- What: `<MessageBranchContent><p key="a">…</p>{cond ? <p key="b"/> : null}</MessageBranchContent>` → `TypeError: Cannot read properties of null (reading 'key')`; the same for `undefined`. (`false` from `cond && …` does not crash, so the failure is intermittent depending on how the consumer writes the conditional.)
- Evidence: › "BUG: a null/conditional child must not crash MessageBranchContent" — FAIL with that message in the boundary.
- Proposed fix: `Children.toArray(children)` (drops null/boolean and assigns stable keys) instead of `Array.isArray(children) ? children : [children]`.
- Test written: the name above (expected: FAIL now)

### F7. `defaultBranch` out of range shows nothing and "8 of 3" — severity: low
- Where: `registry/ai/branch.tsx:55,66-76` (no clamp; wrap-around math assumes range).
- What: `defaultBranch={7}` with 3 branches: no branch visible, page reads "8 of 3", Previous goes to 6, 5, … Next jumps to 0.
- Evidence: › "BUG: defaultBranch past the end must clamp instead of showing nothing" — FAIL (found "8 of 3").
- Proposed fix: clamp `currentBranch` to `[0, branches.length - 1]` when branches register.
- Test written: the name above (expected: FAIL now)

### F8. `MessageResponse` does not re-check code-block overflow on resize — severity: low
- Where: `registry/ai/response.tsx:42-51` (`MutationObserver` with `childList/subtree` only; no `ResizeObserver`).
- What: A code block that fits at 900px and then gets 200px (window resize, phone rotation, sidebar opening) scrolls horizontally but never receives `tabindex="0"`, i.e. exactly the axe `scrollable-region-focusable` case commit `c9b0d6b` set out to fix. Stream-time re-checks do work (pinned).
- Evidence: › "BUG: a code block that starts to overflow after a resize must become a tab stop" — FAIL (tabindex stays absent after the container is narrowed).
- Proposed fix: also observe the root with a `ResizeObserver` (and/or `window` `resize`).
- Test written: the name above (expected: FAIL now)

### F9. `SourcesTrigger` says "Used 1 sources" — severity: low
- Where: `registry/ai/sources.tsx:39` (upstream parity, `sources.tsx:37`).
- Evidence: › "BUG: SourcesTrigger should not say 'Used 1 sources'" — FAIL.
- Proposed fix: `Used {count} {count === 1 ? "source" : "sources"}`.
- Test written: the name above (expected: FAIL now)

### F10. `Image` allows a missing `alt`, producing an axe `image-alt` violation — severity: low
- Where: `registry/ai/image.tsx:9,22` (`alt?: string`, `alt={props.alt}` → no attribute when omitted). Upstream parity; its own test "renders without alt text" endorses it.
- Evidence: › "BUG: an Image without alt is an axe image-alt violation; alt should be required" — FAIL: `expected [ 'image-alt' ] to deeply equal []`.
- Proposed fix: make `alt` required in `ImageProps` (and note the API change in `docs`), or default to `alt=""` only when explicitly decorative.
- Test written: the name above (expected: FAIL now)

### F11. Approval-requested tool calls have no way to respond — severity: low (documentation)
- Where: `registry/blocks/chat/components/blocks/chat.tsx:338-357`; `page.tsx` never wires `addToolApprovalResponse`.
- What: A `tool-*`/`dynamic-tool` part in `approval-requested` renders a card with the "Awaiting Approval" badge and nothing else; `@uifiles/confirmation` exists but is not composed. The description claims only "input and output", so this is a doc gap rather than a wrong claim.
- Evidence: rendered in › "renders every other UI part type without crashing or leaking raw objects" (passes; badge visible, no controls).
- Proposed fix: say so in the block `docs` ("human-in-the-loop approvals are not wired; compose @uifiles/confirmation with addToolApprovalResponse"), or wire it.
- Test written: none (not a failure today).

### F12. `tests/browser/ai/response.test.tsx` › "does not re-render when children and isAnimating are unchanged" is not load-bearing — severity: low (test quality)
- Where: `tests/browser/ai/response.test.tsx:66-73` — it re-renders and asserts visibility only; nothing counts renders.
- Evidence: mutant `response-nomemo.tsx` (comparator replaced by `false`, i.e. always re-render) → `Tests 2 passed (2)` (`scratchpad/qa/round1/chat-block-and-leaves/mutants/results.txt`). The other six mutants were each killed by exactly the assertion they targeted.
- Proposed fix: count renders through a `components={{ p }}` renderer as my pin "merges className onto Streamdown's root and skips re-rendering blocks for identical children" does; note Streamdown's own `memo` also masks the comparator, so the assertion is on the composition.

### F13. `getMessageText` is duplicated — severity: nit
- Where: `registry/blocks/chat/components/blocks/chat.tsx:509-514` and `registry/blocks/chat/lib/demo-conversation.ts:67-72` (identical bodies; the page/tests import from both).
- Proposed fix: keep the lib one, import it in `chat.tsx` (the block installs both files).

Other notes that are not findings on their own:
- During the `start`/`start-step` window (real backends emit these before the first token) the block renders an empty assistant `MessageScrollerItem` (0px) above the marker, so the transcript shows one extra `gap-6` (24px) of blank between the user bubble and "Thinking…". Cosmetic. The marker itself correctly stays up (pinned).
- `ChatMessage`'s JSDoc (`chat.tsx:249-253`) does not say it needs a `MessageScrollerProvider`; `ChatMessages`'s does. Standalone use throws `MessageScrollerItem must be used within a MessageScroller.` (pinned as the contract).
- `SourcesTrigger` nests `<p>` inside `<button>` (invalid content model; React does not warn). Upstream parity.
- `ToolOutput` hides falsy outputs (`0`, `false`, `""`) because of `!(output || errorText)` (`tool.tsx:143`); a tool returning `0` shows "Completed" with no Result. Tool lens.
- `ChatEmpty` keys suggestions by their text; duplicate suggestions would warn.
- `registry/blocks/chat/page.tsx` is not routed in this repo (`app/chat` does not exist); only the preview variant is rendered/hydrated in CI.
- The other lens file `tests/browser/qa-round1/prompt-input.test.tsx` currently has 6 `tsc` errors (lines 708, 1102-1169); not mine, but `pnpm typecheck` will fail until it is fixed.

## Coverage gaps (behaviours with no test today; no bug found, but untested)

`chat` block (`registry/blocks/chat/components/blocks/chat.tsx`):
- `Chat` › `className`/rest props reach the root `[data-slot=chat]`; `placeholder`, `emptyTitle`, `emptyDescription` flow through — cheap prop-forwarding pin.
- `Chat` › behaviour when the parent has no fixed height (documented contract): the viewport never scrolls and the page grows — pin the documented limitation so a future "fix" is deliberate.
- `ChatMessages` › `aria-busy` on the `role="log"` content while submitted/streaming — assert the attribute flips.
- `ChatMessages` › `MessageScrollerButton` appears after the user scrolls up during a stream and `scrollToEnd` resumes following — needs a scroll gesture test.
- `ChatMessage` › `scrollAnchor` is `true` only for user rows (`data-scroll-anchor`), `messageId` set — assert the data attributes.
- `ChatMessage` › a system message with no text parts renders an empty separator marker — decide and pin.
- `ChatMessagePart` › `text` part with `state:"streaming"` passes through `MessageResponse` with `parseIncompleteMarkdown` (default true) — assert an unclosed `**bo` does not render literal asterisks.
- `ChatMessagePart` › `reasoning` with `state:"done"` shows "Thought for …" and auto-closes; `isStreaming` wiring — only the preview exercises it.
- `ChatToolPart` › `defaultOpen` is true only for `output-error` — pin (`aria-expanded`).
- `ChatToolPart` › `dynamic-tool` header shows `toolName`, `title` overrides the derived name — pin.
- `ChatAttachments` › non-image parts show `mediaType` as description; `onRemove` omitted → no action button; `key` collision with the same URL twice — pin.
- `ChatThinkingMarker` › custom `children`, `aria-hidden` icon, `shimmer` class — pin.
- `ChatComposer` › `Shift+Enter` newline and Backspace-removes-last-attachment inside the block (only tested in prompt-input tests).
- `ChatComposer` › `onSubmit` returning a rejected promise keeps the text (prompt-input keeps input on error) — pin at block level.
- `ChatComposer` › `status="error"` renders the X icon still labelled "Submit" (prompt-input) — decide the label and pin.
- `getMessageText` › only concatenates `text` parts (ignores `reasoning`) — pinned indirectly; add a direct case with mixed parts.

`registry/blocks/chat/lib/demo-conversation.ts`:
- `transport` › a first user message that does not match the script still gets the first scripted answer (role/text fallback in `@shadcn/helpers`) — pin the intended "any question works" behaviour.
- `transport` › `stop()` mid-tool-call leaves the tool in `input-available` ("Running") forever — decide and pin.
- `demoConversation` › ids are deterministic (`demo-message-2`, `demo-call-1`) — pin so the prefix options are exercised.

`registry/blocks/chat/page.tsx`: no test renders this file (see notes); an e2e hitting an `app/chat` route (or a unit render) would cover hydration.

`branch`:
- `MessageBranchContent` › children without `key`s → React key warning (`key={branch.key}` is `null`) — pin or fix with `Children.toArray`.
- `MessageBranchContent` › a single fragment child counts as one branch; an array-of-arrays flattens wrongly — pin.
- `MessageBranch` › `onBranchChange` identity change re-creates `goToNext`/`goToPrevious` (memo deps) — no behavioural risk, skip.
- `MessageBranchPage` › custom `className` merges — pin.
- `MessageBranchPrevious/Next` › custom `children` replaces the chevron; `disabled` when rendered outside a selector with one branch — pin.
- `MessageBranchSelector` › returns `null` for 0 branches (no `MessageBranchContent` at all) while `MessageBranchPage` would read "1 of 0" — pin the pairing rule.

`response`:
- `MessageResponse` › `isAnimating` toggles re-render (second half of the memo comparator) — pin with the render counter.
- `MessageResponse` › `shikiTheme` override via props wins over the high-contrast default (`{...props}` after) — pin.
- `MessageResponse` › `content-visibility: auto` ancestors (`MessageScrollerItem`) report 0 layout for offscreen code blocks, so the overflow check runs against a skipped subtree — verify a code block far up a long transcript becomes focusable when scrolled into view (likely the same gap as F8).
- `MessageResponse` › mermaid fence renders a diagram (plugin registered) — untested anywhere.
- `MessageResponse` › `data-slot="message-response"` wrapper is `display: contents` (no layout impact) — pin.

`sources`:
- `Sources` › `defaultOpen`/`onOpenChange` work at runtime but are not typed (documented) — pin the runtime behaviour with a cast so a type fix does not regress it.
- `SourcesTrigger` › custom `children` replaces the count text; chevron rotation on open (there is none; upstream parity) — pin.
- `Source` › `href` undefined renders an `<a>` without `href` (not a link, `target=_blank` dangling) — decide and pin.
- `SourcesContent` › enter/exit animation classes (`data-open:animate-in`) — visual only.

`suggestion`:
- `Suggestions` › `className` lands on the inner flex row, not the ScrollArea (upstream parity; surprising) — pin.
- `Suggestions` › hidden horizontal `ScrollBar` (`className="hidden"`) means no visible affordance; wheel/drag still scroll — pin with `wheel` event.
- `Suggestion` › `children` falsy (`""`) falls back to `suggestion` (`||`) — pin.

`image`:
- `Image` › `className` merges with the size classes (existing test covers `size-8`).
- `Image` › `mediaType` other than PNG (`image/svg+xml` in the preview) — pin.
- `Image` › `uint8Array` is required by the type but unused; passing a `DefaultGeneratedFile` instance (getters) works — pin so the API stays `GeneratedFile`-shaped.

## Verified OK (claims you checked that hold; one line each, so the fixer does not re-check)

- Block `docs`: target `app/chat/page.tsx` (`registry/blocks/registry.json:40-42`); `DefaultChatTransport` is exported from `ai` and `toUIMessageStreamResponse` exists (`node_modules/ai/dist/index.d.ts:3037,10170`); "fills its parent / h-svh" (`page.tsx:14`); "suggestions submitted as-is" (pinned); `@source` requirement matches streamdown's README (`node_modules/streamdown/README.md:31-44`), and `streamdown/styles.css` only holds `[data-sd-animate]` keyframes, so "optionally" is accurate.
- Block description: all 9 named exports plus `getMessageText`, `ChatMessagePartType`, `ChatSubmitMessage` and every `*Props` type exist and type-check (my test imports them; `tsc --noEmit` clean for this file).
- Demo transport end to end (pinned, no console errors/warnings on the happy path): empty state → suggestion → user bubble → "Thinking…" + Stop while `submitted` → reasoning "Thinking" shimmer → `readFile` Completed → markdown ("Then:") → marker gone → Submit back; `status` sequence exactly `ready→submitted→streaming→ready`; second turn gets the second scripted answer; third turn streams the fallback; the Messages viewport ends within 4px of the bottom.
- `stop()` during streaming returns the composer to ready and nothing later in the script arrives (pinned).
- Marker survives `start`/`start-step` until the first token (SDK: `start` writes with `updateStatus:false`, `start-step` does not write — `ai/dist/index.js:8140-8160`) (pinned).
- Every other `UIMessagePart` type in `ai@7`'s union (`index.d.ts:1992`) — `step-start`, `source-url`, `source-document`, `file` (image and non-image), `reasoning-file`, `custom`, `data-*`, empty streaming `reasoning`, streaming `text`, `dynamic-tool` in `approval-requested`/`output-denied`, string tool output — renders without crashing and without `[object Object]`/`undefined` text (pinned).
- `isToolUIPart` covers `tool-*` and `dynamic-tool` (`index.d.ts:2431`); `ChatToolPart` renders the right header for each (pinned via labels).
- Composer: whitespace-only submits are swallowed; nothing inside `[data-slot=input-group]` is `:disabled` in `ready` or `streaming` (no `has-disabled` fade) (pinned); files are handed over as `FileUIPart[]` without the internal `id`, blob → data URL, preview with "Remove <name>" then cleared (pinned); `sendMessage` accepts `FileUIPart[]` (`index.d.ts:5852`).
- Layout: in a height-constrained parent the `role="region"` "Messages" viewport is the only vertical scroll container and the page itself does not scroll (pinned); at 375px the empty state with the long demo suggestion and a transcript with a tool call and a wide code block have no horizontal page overflow and pass axe (pinned).
- `ChatEmpty`, `ChatAttachments`, `ChatComposer` work standalone and pass axe; `ChatMessage`/`ChatThinkingMarker` throw a clear error outside `MessageScrollerProvider` (pinned).
- `demoConversation.get(1)` returns the first configured message (the opening user question), `get()` returns 4, `next([])` is the same question (pinned; `@shadcn/helpers` `get(count)` = "first count configured messages", `chat-BPYN7JVI.d.ts`).
- Fallback ids: `@shadcn/helpers` allocates fresh `demo-message-N` ids per fallback turn (`chunk-BUVP5LXC.js` `nextMessageId`), so repeated fallbacks never collide.
- Install-time import specifiers (for the registry-contract reviewer), from `public/r/chat.json`: `chat.tsx` → `ai`, `cn`, `lucide-react`, `react`, `@/components/ui/{attachment,bubble,empty,marker,message,message-scroller}`, `@/registry/ai/{prompt-input,reasoning,response,suggestion,tool}`; `demo-conversation.ts` → `@shadcn/helpers/ai-sdk`, `ai`; `page.tsx` → `@ai-sdk/react`, `@/registry/blocks/chat/components/blocks/chat`, `@/registry/blocks/chat/lib/demo-conversation`. The CLI rewrites `@/registry/<x>/components/…` → components alias and `@/registry/<x>/lib/…` → lib alias, and the catch-all `@/registry/<x>/…` → components alias (`packages/shadcn/src/utils/transformers/transform-import.ts:125-152`), which lands `@/registry/ai/response` at `@/components/ai/response` = the `response` item's target.
- `branch`: wrap-around both ways with `onBranchChange` on wrap (existing test; mutant "no wrap" killed); hidden branches are `display:none`; focus stays on the control after navigating; missing-context error text; Apache header "message.tsx" accurate; `"use client"` parity; no `asChild`/`data-[state=`/`forceMount`/Radix imports in any of the six files (grep).
- `response`: plugins `{cjk, code, math, mermaid}` identical to upstream; `github-light-high-contrast`/`github-dark-high-contrast` exist in `node_modules/@shikijs/themes/dist`; `parseIncompleteMarkdown` defaults to `true` (`streamdown/dist/chunk-YOKDWASO.js`); overflowing code-block body gets `tabindex="0"`, non-overflowing gets none, axe clean (pinned; re-check on streamed mutations works, resize does not — F8); raw HTML is sanitized (`rehype-sanitize`/`rehype-harden`: no `<script>`, no `onerror`) (pinned); links default to Streamdown's link-safety `<button data-streamdown="link">` + confirm modal (`Gn={enabled:true}`), and with `linkSafety={{enabled:false}}` are `<a target="_blank" rel="noopener noreferrer">` (pinned); empty/undefined children render nothing without crashing; `className` merges with `size-full` on Streamdown's root; identical children do not re-render blocks (pinned); `singleDollarTextMath` defaults to `false` in `@streamdown/math` (docs claim); memo comparator is upstream-identical.
- `sources`: `keepMounted` keeps links in the DOM hidden until opened (pinned); `Source` props override `target`/`rel` and `children` replaces the title (pinned); `data-open`/`data-closed` classes as documented; `SourcesProps = ComponentProps<"div">` as documented.
- `suggestion`: overflowing row at 375px — Base UI viewport has `tabIndex=0` (`@base-ui/react/scroll-area/viewport/ScrollAreaViewport.js:282`), focusing the last pill scrolls it into view, axe clean (pinned); `onClick` receives the suggestion string (existing test; mutant killed); `disabled`/`variant` forwarded (pinned).
- `image`: only `alt`, `class`, `src` reach the element, no console warnings (pinned); `uint8Array`/`providerMetadata` stripped; `Experimental_GeneratedImage` is a deprecated alias of `GeneratedFile` (`ai/dist/index.d.ts:1160-1162`) as the docs say; data URL format (existing test; mutant killed).
- Preview routes `/preview/{chat,branch,response,sources,suggestion,image}` return 200 with a single `<h1>` inside the layout's `<main>`; `pnpm registry:validate` passes.
- Mutation checks against scratch copies (no tracked file touched): chat marker removed → `chat.test.tsx` "shows a thinking marker…" fails; branch no-wrap → "navigates … wraps around" fails; response without `math` → "…table and math" fails; sources without `href` → "expands to reveal…" fails; suggestion `onClick("")` → "calls onClick…" fails; image wrong data URL → "renders a generated image…" fails. (`scratchpad/qa/round1/chat-block-and-leaves/mutants/results.txt`)

## Could not reach

- A real `shadcn add @uifiles/chat` round-trip: bare upstream deps (`attachment`, `bubble`, …) resolve against `ui.shadcn.com`, which is blocked here; I inspected `public/r/chat.json` and the CLI transformer source instead.
- A real HTTP backend (`DefaultChatTransport`): emulated the SDK chunk sequences with `@shadcn/helpers` transports, which go through the same `AbstractChat` code path (`start`, `start-step`, `error`, concurrent requests). `tool-input-start`/`tool-input-error` were reproduced at the part level (the helpers never emit `input-streaming`).
- Rendering `registry/blocks/chat/page.tsx` itself: not routed in this repo; the preview page is a variant with an auto-send effect.
- Physical mutation of tracked sources: not allowed by the brief, so mutants are scratch copies aliased into the existing tests through a scratch vitest config (`mutants/vitest.mut.config.mjs`, `resolve.dedupe` for bare imports).
- `useChat` `regenerate`/`resumeStream` and `addToolApprovalResponse` flows: the block exposes no hooks for them (F11).

## Commands run (for the fixer to reproduce)

Note: the reproducer file `tests/browser/qa-round1/chat-block-and-leaves.test.tsx` (1241 lines) is
already in the tree as part of commit `13c7c90 test(qa): round 1 adversarial reproducers`; the
working tree was clean after my last run, so that commit holds the final version. Until F1-F10
are fixed, `pnpm test` will report these 13 tests as failing by design.

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>

# baseline (6 files / 15 tests pass, 11s)
pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx tests/browser/ai/branch.test.tsx tests/browser/ai/response.test.tsx tests/browser/ai/sources.test.tsx tests/browser/ai/suggestion.test.tsx tests/browser/ai/image.test.tsx

# the reproducer/pin suite (39 tests: 13 "BUG:" FAIL, 26 pass)
pnpm exec vitest run --project browser tests/browser/qa-round1/chat-block-and-leaves.test.tsx
pnpm exec prettier --check tests/browser/qa-round1/chat-block-and-leaves.test.tsx   # clean
pnpm exec biome check tests/browser/qa-round1/chat-block-and-leaves.test.tsx        # clean
pnpm exec tsc --noEmit   # clean for this file; 6 errors remain in tests/browser/qa-round1/prompt-input.test.tsx (other lens)
pnpm registry:validate   # passes
curl -s -o /dev/null -w "%{http_code}" localhost:3000/preview/chat   # 200 (same for branch, response, sources, suggestion, image)
curl -s localhost:3000/r/chat.json | node -e '…print files[].path/target and import lines…'

# mutation checks (scratch copies; see scratchpad/qa/round1/chat-block-and-leaves/mutants/)
M=/docs/qa/round1/chat-block-and-leaves/mutants
node $M/make.mjs $M
MUT_DIR=$M MUT_TARGET=registry/ai/branch MUT_FILE=branch.tsx pnpm exec vitest run --config $M/vitest.mut.config.mjs tests/browser/ai/branch.test.tsx
# … same for chat.tsx, response-nomath.tsx, response-nomemo.tsx, sources.tsx, suggestion.tsx, image.tsx
```

Final run output (`scratchpad/qa/round1/chat-block-and-leaves/run4.txt`, trimmed to the summary):

```
 ❯ |browser (chromium)| tests/browser/qa-round1/chat-block-and-leaves.test.tsx (39 tests | 13 failed) 49537ms
   ❯ chat block: part coverage (5)
     × BUG: a tool part in input-streaming with no input yet must not crash when opened 275ms
     × BUG: a static tool that errored before its input parsed must not crash on mount 113ms
     × BUG: a files-only user turn must not render an empty text bubble 128ms
   ❯ chat block: streaming through useChat (6)
     × BUG: Enter while a response is streaming must not fire onSubmit (the button is a Stop) 322ms
     × BUG: Enter mid-stream through useChat must not corrupt the transcript with duplicated turns 5990ms
     × BUG: a transport error must surface in the transcript, not vanish 174ms
   ❯ branch (6)
     × BUG: className on MessageBranchContent must not reveal every branch at once 14980ms
     × BUG: even className={undefined} (any forwarding wrapper) reveals every branch 14980ms
     × BUG: a null/conditional child must not crash MessageBranchContent 91ms
     × BUG: defaultBranch past the end must clamp instead of showing nothing 91ms
   ❯ response (6)
     × BUG: a code block that starts to overflow after a resize must become a tab stop 1077ms
   ❯ sources (3)
     × BUG: SourcesTrigger should not say 'Used 1 sources' 81ms
   ❯ image (2)
     × BUG: an Image without alt is an axe image-alt violation; alt should be required 102ms
 Test Files  1 failed (1)
      Tests  13 failed | 26 passed (39)
   Duration  55.75s (tests 91%, worker 6%, import 3%)
```

Key failure messages: F1 `Cannot read properties of undefined (reading 'split')` (both tool tests); F2 `expected "vi.fn()" to not be called at all, but actually been called 1 times` and `expected 4 to be 30` (unique ids vs messages); F3 `expected 'hiScroll to end' to contain 'Upstream exploded'`; F4 `Received element is visible: <p />`; F5 received `<div data-slot="bubble">…`; F6 `Cannot read properties of null (reading 'key')`; F7 found `8 of 3`; F8 tabindex never set; F9 found `Used 1 sources`; F10 `expected [ 'image-alt' ] to deeply equal []`.

The 26 passing pins are the non-`BUG:` tests in the same file: part coverage (2), demo end-to-end, stop(), marker through start/start-step, composer contract (3), layout/a11y (3), exports/helpers (3), branch (2), response (5), sources (2), suggestion (2), image (1).
