# prompt-input-chat — QA round 2

Scratch dir: `/docs/qa/round2/prompt-input-chat/`
(logs, mutation script, page scripts, the round-1 reproducer files extracted from `13c7c90`).
Reproducers: `tests/browser/qa-round2/prompt-input-chat.test.tsx` (19 tests: 10 fail on the defects below, 9 pass as pins).

## Summary

Attacked `registry/ai/prompt-input.tsx` and `registry/blocks/chat/**` after the round-1 fixes: re-verified every
round-1 finding in scope against the code, the rewritten suites (134 + 50 tests, three runs each) and the original
round-1 reproducer files re-run against the current sources; then tried to re-break each fix (addon click handler,
Enter gating, `accept`, partial-drop errors, text restore, StrictMode, tooltips, the screenshot error path, the
`aria-label` default, a six-tool toolbar at 375 px), drove the block through `useChat` with custom transports at
414, 375×812 and 1280×800, drove the production `/preview/chat` page with Playwright, checked every sentence of both
registry entries against the code, and ran 12 mutations against the fixers' tests.

Findings: 1 high, 3 medium, 5 low, 1 nit, plus test-quality issues. **The single worst thing: the chat block hands
prompt-input the `sendMessage` promise, which only resolves when the answer has finished streaming, so prompt-input's
post-submit `clear()` is deferred to the end of the answer. Every sent attachment stays in the composer (with a live
Remove button) while it also appears in the user bubble, and any file attached while the answer streams is deleted
without notice when the answer ends** (reproduced on the production preview page and in Vitest). Every round-1 fix
in scope is really in place (all 12 former `[BUG]` reproducers from round 1 now pass); the new tests are mostly
load-bearing (11 of 12 mutations caught), but one hand-picked selector list in the addon click fix is untested and
too narrow.

Verdict: **not yet**. F1 is a data-loss bug on the flagship block's shipped wiring; F2–F4 are small, contained fixes.

## Fix verification

| round-1 finding | claimed fix | verified? | evidence |
| --- | --- | --- | --- |
| prompt-input F1 (menu activation / footer click focuses the model select) | `useAddonClick` on Header/Footer: bail unless the click landed on the addon's own surface and not on `button, a, input, select, textarea, [role=menuitem]`; focus the textarea | yes (with a gap, F2 below) | `prompt-input.tsx:1106-1130`; round-1 `[BUG]` tests "returns focus … mouse/keyboard activation … model select" and "footer whitespace" now pass; the extra selectors beyond `button` are untested (mutation m01 survived) and miss other focusable controls |
| prompt-input F2 (AddAttachments drops consumer `onClick`) | call `onClick` first, honour `defaultPrevented` | yes | `:434-443`; test "calls a consumer onClick first and skips the file dialog when it prevents default" |
| prompt-input F3 / chat F2 / rendered-surface F1 (Enter submits behind Stop) | Enter only through an enabled `button[type=submit]`; block adds three guards | yes | `:1011-1024`; `chat.tsx:675-709`; through `useChat` "ignores Enter mid-stream: one response, unique ids, no duplicate-key errors, draft kept" passes 3/3; my "keeps the draft on Enter while generating when no onStop is wired" passes |
| prompt-input F4 (`accept` `.ext`, `*/*`, empty type) | `matchesAccept` rewritten | yes | `:581-612`; `.PDF` uppercase name, `.pdf,.MD` mixed case, `*/*`, empty type covered by tests; each comma pattern is evaluated independently so `image/*,.pdf` works by construction |
| prompt-input F5 (silent partial drops) | one `acceptFiles` with partial `onError` | yes | `:616-666`; tests "reports max_file_size/accept when only some …", provider path too |
| prompt-input F6 (text lost on failed submit) | `restoreText` when `value === defaultValue` | yes for uncontrolled; writes into controlled textareas too (F6 below) | `:875-885`; three restore tests pass; mutation m02 caught |
| prompt-input F7 (keyCode 229) | guard added | yes | `:999-1005`; test passes (Chromium-only shape, as in round 1) |
| prompt-input F8 (StrictMode double `onError`/object URLs) | validation and `createObjectURL` outside updaters, `filesRef`/`attachmentsRef` | yes | `:177-183, 286-293, 668-680`; two StrictMode tests pass; provider path still has a stale-count hole (F4 below) |
| prompt-input F9 (tooltip 600 ms) | `TooltipTrigger delay={0}` | yes | `:1237`; test measures < 300 ms |
| prompt-input F10 (dead `preventDefault`, docs) | removed; docs (1) says the menu still closes | yes | no `preventDefault` in `PromptInputActionAddAttachments`; `AddScreenshot` passes `{...props}` with no `closeOnClick`, so it closes |
| prompt-input F11 (`syncHiddenInput` comment) | comment + docs (10) | yes | `:523-526` |
| prompt-input F12 / rendered-surface F15 (screenshot rethrow) | `onError({ code: "screenshot" })` or `console.error` | yes | `:466-499`; two tests; `PromptInputError` exported `:383` |
| prompt-input F13 (suite blind to clear/stop) | asserts added; shared `settle` | yes | tests "clears attachments … when async onSubmit resolves", "renders Stop as type=button …", "submits exactly once …"; no local settle copy |
| prompt-input F14 (no accessible name) | `aria-label="Message"` default | yes (see F8 below for the `<label>` interaction) | `:1087` |
| prompt-input F15 (error X labelled Submit; spinner role) | not fixed (documented) | n/a | still `XIcon` + "Submit" `:1326-1327, 1344`; the block sidesteps it by passing `status="ready"` |
| chat F1 (tool card crash on `input: undefined`) | guard + per-part error boundary | yes | `chat.tsx:373-463, 517-530`; tests pass; mutation m07 caught |
| chat F3 (no error state) | `error`/`onRetry`, `ChatErrorMarker`, both pages pass them | yes, opt-in (F5 and F9 below) | `chat.tsx:96-116, 169-227, 611-647`; `registry/blocks/chat/page.tsx:18-20`; `app/preview/chat/page.tsx:37-39`; my standalone and mid-stream-error pins pass; the round-1 fixture without `error` still shows nothing |
| chat F5 (empty bubble for files-only turn) | whitespace text renders nothing | yes | `chat.tsx:287-298, 390-393` |
| chat F11 (approvals not wired) | documented | yes | block `docs` sentence present; `addToolApprovalResponse` still unused |
| chat F13 (duplicate `getMessageText`) | single definition in `chat.tsx`, imported by the lib | yes | `chat.tsx:762`, `demo-conversation.ts:2` |
| rendered-surface F8 (toolbar overlaps Submit at 375) | `flex-wrap` tools, `shrink-0` submit | yes | `:1181, 1345`; six tools at 375×812: two rows (tops 71/107), submit 316–348 × 89–121 inside the footer 17–358 × 65–147, no overlaps, `scrollWidth == clientWidth` (285), axe clean, no "obscured" |
| rendered-surface F9 (stuck "Thinking…" after Stop) | status only to the last message; `isLive` | yes | `chat.tsx:216, 361-363, 408, 495-498`; mutation m08 caught by three tests; my mid-stream-error pin shows "Thought for" + "Pending" under `status: "error"` |
| test-quality M10/M11/F13 | demo e2e asserts follow, `aria-busy`, reasoning trigger, console spies | yes | `chat.test.tsx:1500-1597`; mutation m09 (`scrollAnchor`) caught |

Round-1 reproducer files re-run against the current sources (extracted from `13c7c90`, run through
`vitest.round1.config.ts` in the scratch dir with a `node_modules` symlink so bare imports resolve):
`prompt-input.round1.test.tsx` → 44 passed, 1 failed (45): all 12 former `[BUG]` tests pass; the one failure is
the old F14 state pin "names the textarea only through its placeholder" (`expected 'Message' to be null`), i.e. the
flip the fix intended. `chat-block-and-leaves.round1.test.tsx -t "chat block"` → 18 passed, 2 failed, 19 skipped
(leaves): four of the six former `BUG:` tests pass; "a tool part in input-streaming with no input yet must not crash
when opened" fails only on its stale expectation (`getByText('Parameters')`; the card now says "Streaming input…"
and does not crash, ARIA tree in the log), and "a transport error must surface in the transcript, not vanish" still
fails because its fixture does not pass `error` to `<Chat>` — the error surface is opt-in (F9 below).

## Findings

### F1. Chat block: sent attachments linger in the composer for the whole answer, and a file attached while an answer streams is deleted when it ends — severity: high

- Where: `registry/blocks/chat/components/blocks/chat.tsx:675-684` (`ChatComposer.handleSubmit` returns
  `onSubmit(message)`), `registry/blocks/chat/page.tsx:22` and `app/preview/chat/page.tsx:41`
  (`onSubmit={({ text, files }) => sendMessage({ text, files })}`), `registry/ai/prompt-input.tsx:865-870,
  906-916` (`commit()` runs only after the returned promise resolves and `clear()` drops *every* attachment, not
  just the ones that were submitted).
- What: `sendMessage` resolves only when `makeRequest` has consumed the whole stream
  (`node_modules/ai/dist/index.js:22356`, `22561-22745`), so prompt-input's post-submit `commit()` is deferred to
  the end of the answer while the textarea was reset synchronously. Until the answer finishes, the sent file is shown
  twice (user bubble and composer header, the latter with a working Remove button), and anything the user attaches
  meanwhile is revoked and cleared by `commit()` when the answer ends. `sendMessage` never rejects (errors go to
  `status`/`error`), so nothing is gained by waiting for it.
- Evidence: production `/preview/chat` (restarted on the current build, console clean) driven by
  `preview-chat-attachments.mjs`: `duringStream: { composer: 1, transcript: 1, stopVisible: true }`, `midStream: 2`,
  `afterStream: { composer: 0, laterStillListed: 0 }`; `preview-chat-attachments-2.mjs` shows the user row
  `notes.txttext/plainwith a file` with `attachments: 1` while `form [data-slot=attachment]` is still 1, and the
  blob → data URL fetch succeeding (`fetch ok blob:… status=200`), so the file was really sent.
  Vitest: › "clears sent files from the composer once the message is sent, not when the answer ends" →
  `expected 1 to be +0`; › "keeps a file attached while the previous answer streams" → `Cannot find element …
  'Remove later.txt'` once the answer had ended.
- Why it matters: it is the shipped wiring of the flagship block (both pages); a duplicated preview on every
  attachment send, and data loss ("I attached the screenshot while it was answering and it vanished").
- Proposed fix: in `ChatComposer.handleSubmit` do not return the `sendMessage` promise (`void onSubmit(message)`),
  so prompt-input commits immediately, the way the textarea already clears; and harden prompt-input so `commit()`
  clears only the ids it submitted (`filesRef.current.filter((f) => !submitted.has(f.id))`), which also protects
  standalone consumers with a slow async `onSubmit`. Add the two tests below to `tests/browser/blocks/chat.test.tsx`.
- Test written: the two above (FAIL now).

### F2. `useAddonClick` steals focus from any focusable control in the header/footer that is not in its hand-picked list — severity: medium

- Where: `registry/ai/prompt-input.tsx:1119-1127`.
- What: the round-1 fix exempts only `button, a, input, select, textarea, [role="menuitem"]`. A `tabIndex={0}`
  element (`role="switch"`, a custom chip, a Base UI Slider thumb, a `[contenteditable]`, a `<label>`) receives focus
  on mousedown and loses it to the textarea on click. Mutation m01 (list reduced to `button`) survived the 134-test
  suite, so nothing exercises the other five selectors either.
- Evidence: › "leaves focus on a focusable control inside the footer that is not a button" →
  `expected <textarea …> to be <div aria-checked="false" … role="switch" tabindex="0">`.
- Why it matters: the fix replaced shadcn's behaviour for every consumer; a composer toolbar with a non-button
  control now fights the user for focus.
- Proposed fix: bail when the click already moved focus inside the addon
  (`currentTarget.contains(document.activeElement) && document.activeElement !== currentTarget`), or widen the
  exemption to `'button, a[href], input, select, textarea, label, [tabindex], [contenteditable], [role]'`; add
  tests for an `<a>`, an `<input>` and a `[tabindex]` element inside the footer.
- Test written: the one above (FAIL now).

### F3. A programmatic submit while generating wipes the draft and the attachments, although the fix report and `docs/architecture.md` §3 say it is ignored "and the draft is kept" — severity: medium

- Where: `chat.tsx:675-684` (the guard returns `undefined`, which prompt-input treats as a successful sync
  submit); `prompt-input.tsx:861-863` (`form.reset()` before `onSubmit`) and `:913-916` (`commit()`).
- What: `form.requestSubmit()` (a Cmd+Enter shortcut, an external send button, a `<button>` without `type`) while
  `status` is `submitted`/`streaming` sends nothing, but the textarea is reset and `commit()` clears the
  attachments. The existing test "ignores a programmatic form submit while generating" only asserts `onSubmit` was
  not called, so the claim was never checked.
- Evidence: › "keeps the draft and the attachments when the submit is ignored mid-stream" →
  `expected '' to be 'queued'`.
- Proposed fix: make the guard return a rejected promise (`Promise.reject(new Error("A response is still
  generating"))`), which prompt-input already handles by restoring the text and keeping attachments; or give
  `PromptInput` a real veto (`onSubmit` returning `false`, or checking the submit button's `type` in
  `handleSubmit` the way `handleKeyDown` does). Fix the architecture sentence either way.
- Test written: the one above (FAIL now).

### F4. Provider mode: two `add()` calls before a re-render bypass `maxFiles` — severity: low

- Where: `prompt-input.tsx:692-700` (`addWithProviderValidation` reads `filesRef.current.length` for the capacity
  but never advances the ref; `addLocal` at `:676` does).
- What: with `<PromptInputProvider>` and `maxFiles={2}`, `add([a]); add([b, c])` in one handler adds three files and
  `onError` never fires; the same calls in local mode add two and report `max_files`. The ref catches up only in the
  `useEffect` at `:573-575`, i.e. after React commits.
- Evidence: › "caps at maxFiles with a PromptInputProvider" → `expected '3' to be '2'`; "… with local state" passes.
- Proposed fix: after `controller?.attachments.add(capped)` advance the mirror (`filesRef.current =
  [...filesRef.current, ...capped.map(() => ({ id: "", type: "file", url: "", mediaType: "" }))]` is enough, since in
  provider mode `filesRef` is used only for its length), or have the provider's `add` return the added items.
- Test written: the pair above (provider FAILS now, local PASSES).

### F5. A rejecting `onRetry` becomes an unhandled promise rejection, and the shipped `regenerate` rejects when the transcript is empty — severity: low

- Where: `chat.tsx:637` (`onClick={() => void onRetry()}`), `chat.tsx:221` (the error row renders next to the empty
  state when `messages.length === 0`); `node_modules/ai/dist/index.js:22366-22383` (`regenerate()` throws
  `InvalidArgumentError` when there is no message to regenerate).
- What: a failed `resumeStream()`/`useChat({ resume: true })` on a fresh chat leaves `status: "error"` with no
  messages; the block shows the empty state plus an error row with Retry; clicking Retry calls `regenerate()`, which
  rejects, and nothing catches it (Next's dev overlay in development, `unhandledrejection` in production).
- Evidence: › "does not turn a rejected onRetry into an unhandled rejection" →
  `expected [ Error: message undefined not found ] to deeply equal []` (the console guard also reports it).
- Proposed fix: `onClick={() => { Promise.resolve().then(onRetry).catch(console.error) }}` in `ChatErrorMarker`, and
  render Retry only when there is something to regenerate (`messages.length > 0`) in `ChatMessages`.
- Test written: the one above (FAIL now); plus "renders ChatErrorMarker standalone inside a MessageScroller with a
  working Retry" (PASS).

### F6. `restoreText` writes into a controlled textarea, leaving the DOM and the consumer's state disagreeing — severity: low

- Where: `prompt-input.tsx:875-885`; docs (9) scopes the restore to "an uncontrolled PromptInputTextarea", but the
  code cannot tell the two apart.
- What: a consumer that mirrors the draft in state and clears it in `onSubmit` (the preview page's pattern with an
  async `onSubmit`) gets a phantom restore: React keeps `defaultValue` in sync for a controlled textarea, so the
  check at `:882` passes and `textarea.value = text` runs without an `onChange`; the consumer's state stays `""`,
  and the next render of the textarea wipes the restored text again.
- Evidence: › "keeps the consumer's state and the DOM value in agreement after the failure" →
  `expected 'please retry' to be ''` (DOM vs. rendered state).
- Proposed fix: restore through React so `onChange` fires (set the value with the native setter from
  `HTMLTextAreaElement.prototype` and dispatch `new Event("input", { bubbles: true })`), which also keeps
  uncontrolled-with-`onChange` consumers in sync; or skip the restore when `PromptInputTextarea` was given `value`.
- Test written: the one above (FAIL now).

### F7. Tooltip description duplicates a visible text label, and `tooltip=""` leaves a dangling `aria-describedby` — severity: low

- Where: `prompt-input.tsx:1216-1217` (`describes` compares the content only with `aria-label`), `:1221`, `:1230`
  (`!tooltip` returns the bare button after `aria-describedby` was already computed from `tooltip !== undefined`).
- What: `<PromptInputButton tooltip="Search"><GlobeIcon /><span>Search</span></PromptInputButton>` is announced
  "Search, button, Search"; `tooltip=""` (e.g. an optional label) yields `aria-describedby="_r_0_"` with no such
  element.
- Evidence: › "does not describe a button whose tooltip repeats its visible text" → `expected '_r_0_' to be null`;
  › "points aria-describedby only at a node that exists" → `expected false to be true`.
- Proposed fix: `const describes = Boolean(tooltip) && tooltipContent !== props["aria-label"] && tooltipContent !==
  visibleText` where `visibleText` is the string children when they are strings; treat an empty tooltip as absent.
- Test written: the two above (FAIL now).

### F8. The default `aria-label="Message"` silently overrides a consumer's visible `<label htmlFor>` — severity: low (docs)

- Where: `prompt-input.tsx:1087`; registry `docs` (11) "override it via props".
- What: `aria-label` outranks a native label in name computation, so a consumer who adds `<label
  htmlFor="q">Your question</label>` gets an accessible name of "Message" and a visible label that does not match
  (WCAG 2.5.3 territory). The only way to hand naming to the label is `aria-label={undefined}`, which the docs do
  not say.
- Evidence: › "keeps the default aria-label over a consumer's visible label until it is unset" (PASS; pins the
  current behaviour).
- Proposed fix: docs (11): "if you associate a visible `<label>` or `aria-labelledby`, pass `aria-label={undefined}`";
  or only default the label when none of `aria-label`, `aria-labelledby`, `id` is given.
- Test written: the one above (PASS).

### F9. `status: "error"` without an `error` prop still vanishes silently — severity: low (design)

- Where: `chat.tsx:220-221` (`ChatThinkingMarker` on `submitted`, `ChatErrorMarker` only when `error` is given);
  `chat.tsx:731` (`ChatComposer` maps `error` to `ready`, so the composer shows nothing either).
- What: the round-1 F3 fix is opt-in. A consumer who wires `useChat` themselves and forgets `error` (the round-1
  fixture, and anyone copying the block into an existing page) gets exactly the round-1 symptom: the marker
  disappears, no row, a plain Submit. The docs say to pass `error`, so this is a design gap rather than a wrong
  claim.
- Evidence: the original round-1 reproducer "BUG: a transport error must surface in the transcript, not vanish"
  (fixture passes `messages`, `status`, `onStop`, `onSubmit` only) still fails: `expected 'hiScroll to end' to
  contain 'Upstream exploded'`; my › "shows a generic error row when status is error and no error object is given".
- Proposed fix: in `ChatMessages`, render `ChatErrorMarker` when `status === "error"` even without `error`
  (`error ?? new Error("Something went wrong.")`), keeping Retry conditional on `onRetry`.
- Test written: the one above (FAIL now, by the fixer's design choice; decide and either fix or convert it into a
  pin of the opt-in contract).

### F10. prompt-input `description` overstates the stop button — severity: nit (docs)

- Where: `registry/ai/registry.json` prompt-input `description`: "a submit button that turns into a stop button
  while the response is streaming".
- What: it turns into Stop while `submitted` or `streaming` and only when `onStop` is passed; without `onStop` it
  stays a submit button and Enter still submits (docs (6) and the test "still submits on Enter while generating when
  no onStop is wired" say so). Every other sentence of both `description`/`docs` strings checked out against the
  code (list in Verified OK).
- Proposed fix: "… a submit button that becomes a stop button while a response is in flight when `onStop` is given".

## Mutation log

Each row: `mutate.sh` copied the tracked file to scratch, applied one `perl -0pi` substitution in place, ran the
named test file(s) in full, restored the copy and proved `git diff --quiet` for the file (all 12 restored clean;
`git status` at the end shows only other lenses' files). Logs: `mut-<label>.log` in the scratch dir.

| behaviour | mutation | test file | caught? |
| --- | --- | --- | --- |
| addon click ignores clicks on `a`, `input`, `select`, `textarea`, `[role=menuitem]` | m01: `target.closest('button, a, input, select, textarea, [role="menuitem"]')` → `target.closest('button')` | `tests/browser/ai/prompt-input.test.tsx` | **no** — 134 passed |
| failed submit restores a `defaultValue` textarea | m02: `textarea.value === textarea.defaultValue` → `textarea.value === ""` | same | yes — "restores the edited text of a defaultValue textarea after a failed submit" |
| `.ext` patterns match case-insensitively | m03: `name.endsWith(pattern)` → `f.name.endsWith(pattern)` | same | yes — "matches extension patterns case-insensitively …" |
| tooltip description skipped when it repeats `aria-label` | m04: `describes` → `tooltip !== undefined` | same | yes — "exposes the tooltip text as an accessible description unless it repeats the label" |
| Stop is `type=button` only with `onStop` | m05: `isGenerating && onStop ? "button"` → `isGenerating ? "button"` | same | yes — 3 tests ("still submits on Enter … no onStop", "shows loading icon when submitted", "shows stop icon when streaming") |
| Enter blocked by a disabled submit button | m06: `!submitButton \|\| submitButton.disabled` → `!submitButton` | same | yes — "does not submit on Enter while the submit button is disabled" |
| part error boundary retries when the part's state changes | m07: `previous.resetKey !== this.props.resetKey` → `false` | `tests/browser/blocks/chat.test.tsx` | yes — "shows an inline error row for a part that throws and retries it when its state changes" |
| settled `input-available` reads Pending | m08: `part.state === "input-available" && !isLive(status)` → `false` | same | yes — 3 tests (stale parts, Pending once not generating, stop mid-tool) |
| user rows are scroll anchors | m09: `scrollAnchor={isUser}` → `scrollAnchor={false}` | same + `qa-round2/prompt-input-chat.test.tsx` | yes — "anchors user rows only …" and both of my viewport tests |
| error row falls back to "Something went wrong." | m10: `error.message \|\| "Something went wrong."` → `error.message` | same | yes — "render custom children with a hidden icon, the shimmer class and a role=alert row" (misnamed, see below) |
| block's own Enter guard while generating | m11: `busy && event.key === "Enter"` → `false && …` | `chat.test.tsx` + mine | **no by the fixers' file** (all 50 pass, as fix-chat-block already admitted); yes by my "keeps the draft on Enter while generating when no onStop is wired" |
| suggestion click ignored while generating | m12: `if (busy) return` removed in `handleSuggestion` | `chat.test.tsx` | yes — "ignores a suggestion click while a response is in flight" |

## Test-quality issues (file › test name → problem)

- `tests/browser/ai/prompt-input.test.tsx` › "focuses the textarea, not the model select, when the footer or header
  whitespace is clicked" / "leaves focus alone for clicks on controls inside the footer" → only a `button` (the
  combobox trigger) is exercised; the other five selectors of the fix are dead weight for the suite (mutation m01
  survived).
- `tests/browser/blocks/chat.test.tsx` › "ignores a programmatic form submit while generating" → asserts only that
  `onSubmit` is not called; the property the fix report attributes to this layer (draft kept) is false (F3), so the
  test is vacuous for the claim it backs.
- `chat.test.tsx` › "keeps the draft and submits nothing on Enter while a response is in flight" → always passes
  `onStop`, so prompt-input's Stop button blocks Enter before the block's guard runs; the block's guard is only
  load-bearing without `onStop` (see m11 and my "keeps the draft on Enter while generating when no onStop is wired").
- `chat.test.tsx` › "render custom children with a hidden icon, the shimmer class and a role=alert row" → the body
  asserts only the "Something went wrong." fallback of an empty error message; no custom children, no icon, no
  shimmer. Rename to what it asserts.
- `chat.test.tsx` › "show custom marker children with an aria-hidden spinner and shimmer text" → renders the default
  "Thinking…"; `ChatThinkingMarker`'s `children` prop has no test at all.
- `chat.test.tsx` › "stop mid-tool leaves the tool header settled rather than Running" → `expect(tool.element().
  textContent).toContain("Running")` right after visibility races the script's 900 ms `sleep` before the output
  (3/3 green here; timing-sensitive on a slow runner).
- `chat.test.tsx` › "drives the scripted demo end to end …" and "ignores Enter mid-stream …" → spy
  `console.error`/`console.warn` with `mockImplementation`, which silences the setup guard, then assert the spies
  are empty; equivalent today, but the guard's own message is lost when it fails.
- `prompt-input.test.tsx` › "throws error when usePromptInputController used outside provider", "throws when
  useProviderAttachments or usePromptInputAttachments have no provider", "throws when
  usePromptInputReferencedSources is used outside PromptInput" → silence React's error log with
  `vi.spyOn(console, "error").mockImplementation` instead of `allowConsole("error")`, contrary to the recipe in
  `docs/porting-ai-elements.md` §4 ("nothing else opts out").
- `prompt-input.test.tsx` → 40+ `sleep(30–250)` waits before negative assertions and in the restore tests; the
  positive half of each is polled, the negative half is a fixed sleep (acceptable pattern, but the 250 ms in "does
  not lose user input typed immediately after submission" and the 200 ms pair in "restores the typed text when async
  onSubmit rejects …" are pure timing).
- `prompt-input.test.tsx` › "keeps every toolbar control clear of the submit button at phone width" → finds the
  toolbar with `document.querySelector(".flex-wrap")` (a utility class; brittle) and covers 4 tools; six tools also
  pass (Verified OK).
- No `BUG`/`QA`/round/reviewer words, no `test.skip`, no `.only`, no disabled axe rules, every axe call goes
  through `tests/a11y.ts`; fixtures are in `<main>` except the three boundary-crash tests that render only a crash
  `<div>` and run no axe (fine). Three consecutive runs each: prompt-input 134/134 ×3 (19.9–27.9 s), chat 50/50 ×3
  (27.3–38.2 s); my file 9 failed / 9 passed in runs 2 and 3 with an identical failing set (run 1 additionally
  failed the six-tool test on a deliberate geometry probe that was removed before runs 2 and 3), and 10 failed /
  9 passed in run 4 after the F9 test was added (the same nine plus that one), ~25 s each.

## Verified OK

- Six-tool toolbar at 375×812 (menu, mic, Search, Think, Improve, Model select + Submit): two rows (tops 71 and 107),
  tools 285 px wide with no horizontal scroll, Submit 316–348 × 89–121 vertically centred in the 65–147 footer and
  right of every tool, textarea ends at 65 so nothing sits on the textarea line, no overlaps, no page overflow, axe
  zero violations and no "obscured" incompletes.
- Enter gating: no-op (and no newline) with a Stop button, a disabled submit, or no submit button; still submits
  without `onStop` (documented); Shift+Enter inserts a newline in every status including the block while streaming
  (my pin); `keyCode 229` and `isComposing` each block alone; consumer `onKeyDown` `preventDefault` vetoes.
- `accept`: `.PDF` file name against `.pdf`, `.pdf,.MD` mixed case, `*/*` with an empty type, `image/*,
  application/pdf`, empty and whitespace-only `accept`; extension and MIME patterns in one list are evaluated per
  pattern, so `image/*,.pdf` works by construction; a file with no extension and empty type matches only `*/*`.
- Partial-drop messages: accept "Some files do not match the accepted types and were not added.", size "Some files
  exceed the maximum size and were not added.", count "Too many files. Some were not added."; all-rejected variants
  distinct; the order accept → size → count is what the docs (7) describe.
- Text restore: kept when the user typed during the in-flight submit (existing test), `defaultValue` restored,
  provider text never cleared on failure.
- StrictMode: one `onError` and one `createObjectURL` per add on both paths (existing tests); revocation on remove,
  clear and unmount; a double revoke after a pending submit is a no-op.
- Screenshot: `NotAllowedError`/`AbortError` swallowed; `NotSupportedError` and plain `Error` → `onError({ code:
  "screenshot", message })`; `console.error` without a handler; unsupported `getDisplayMedia` is a no-op.
- Tooltip: opens < 300 ms; description text "Search the web ⌘K" mirrored in a sibling `sr-only` span (outside the
  button, so it is not part of the name); skipped when equal to `aria-label`.
- `aria-label="Message"` is overridable through props (existing test) and removable with `aria-label={undefined}`.
- Chat error boundary: a throwing part renders `role="alert"` "Could not render the text part: …", the rest of the
  transcript and the composer stay; a `state` change retries; no reset loop when the retry throws again
  (`componentDidUpdate` compares the previous `resetKey`).
- `error`/`onRetry`: Retry calls `regenerate` with the trigger `regenerate-message`; the row disappears as soon as
  the next request starts (`setStatus({ status: "submitted", error: undefined })`); an error mid-stream (after
  reasoning and a tool input) leaves the reasoning at "Thought for", the tool at "Pending", the composer at a plain
  Submit and the row with Retry (my pin); `ChatErrorMarker` works standalone inside a `MessageScroller` with
  `className` forwarded (my pin).
- Status to the last message only: older `streaming`/`input-available` parts render settled; `status: "error"`
  settles the last message too; without `status` a part's own state decides.
- Suggestion click while generating: guarded in `Chat.handleSuggestion`, but unreachable through the block (the
  empty state disappears the moment `sendMessage` pushes the user message); not surprising, only reachable through a
  standalone `ChatEmpty`.
- Whitespace-only text parts render nothing for both roles; a files-only turn with a non-image file shows the
  `FileIcon` attachment with its media type and no bubble.
- `getMessageText` has one definition (`chat.tsx:762`), imported by `lib/demo-conversation.ts`; both shipped pages
  pass `error` and `onRetry={regenerate}`.
- `MessageScroller` through `useChat` at 1280×800 and 375×812: the answer streams to within 4 px of the bottom, the
  next user turn is anchored 0–70 px from the top of the viewport, the following answer ends at the bottom again, no
  page overflow.
- Console clean under the guard: both existing files 3/3 with no `allowConsole` outside the five boundary tests;
  my 8 passing pins are clean.
- Registry entries: every numbered sentence of the prompt-input `docs` (1)–(13), its `dependencies`
  (`ai@^7`, `cn`, `lucide-react`, `nanoid@^6` all imported) and `registryDependencies` (the seven `@/components/ui`
  imports), and the chat `docs` (target `app/chat/page.tsx`, `DefaultChatTransport` from `ai`, `error`/`onRetry`,
  Enter behaviour, settled parts / Pending, approvals not wired, `h-svh`, suggestions as-is, Streamdown
  `@import`/`@source`, `katex/dist/katex.min.css` with `katex@^0.16` declared on `response` and `reasoning`),
  `description` (all ten named exports exist), `dependencies` and `registryDependencies` (`button` added for Retry;
  every `@/components/ui` and `@/registry/ai` import declared) match the code. The only inaccuracies are F9 and the
  docs gap in F8.

## Could not reach

- Safari's real keyCode-229 Enter (Chromium only, as in round 1).
- A real `getDisplayMedia` (mocked as upstream does).
- `regenerate` on a real HTTP backend; the empty-transcript rejection in F5 was reproduced with a rejecting
  `onRetry` and confirmed by reading `AbstractChat.regenerate`.
- Vitest reports an `unhandledrejection` through `console.error` (`{"isTrusted":true}`) even when the event's
  default is prevented; the F5 test therefore also trips the console guard until the block catches the rejection.
- The production server on :3000 was stale during my first page-level runs (its HTML referenced a CSS chunk that
  500'd); the coordinator restarted it on the current build and I re-ran both page scripts: identical results
  (`duringStream: { composer: 1, transcript: 1, stopVisible: true }`, `midStream: 2`, `afterStream: { composer: 0,
  laterStillListed: 0 }`) with an empty console and both stylesheets 200. The numbers quoted in F1 are from the
  re-run; no other check in this report used the production server.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>
S=/docs/qa/round2/prompt-input-chat

# existing suites, three runs each (logs $S/pi-run{1,2,3}.log, $S/chat-run{1,2,3}.log)
for i in 1 2 3; do
  pnpm exec vitest run --project browser tests/browser/ai/prompt-input.test.tsx > $S/pi-run$i.log 2>&1
  pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx > $S/chat-run$i.log 2>&1
done
# → 134 passed ×3; 50 passed ×3

# reproducers, four runs (logs $S/repro-run{1,2,3,4}.log; failing sets $S/repro-fail{1,2,3,4}.txt)
pnpm exec vitest run --project browser --reporter=verbose tests/browser/qa-round2/prompt-input-chat.test.tsx

# mutations (script $S/mutations.sh → $S/mutate.sh; logs $S/mutations.log, $S/mut-<label>.log)
bash $S/mutations.sh

# round-1 reproducers against the current sources (files from git show 13c7c90:… in $S/round1/)
pnpm exec vitest run --config $S/vitest.round1.config.ts $S/round1/prompt-input.round1.test.tsx
pnpm exec vitest run --config $S/vitest.round1.config.ts $S/round1/chat-block-and-leaves.round1.test.tsx -t "chat block"

# production page (Playwright against the running server)
node $S/preview-chat-attachments.mjs      # lingering + mid-stream wipe
node $S/preview-chat-attachments-2.mjs    # transcript DOM dump, blob fetch log, failing responses

# hygiene on the new file
pnpm exec tsc --noEmit                    # no qa-round2 errors
pnpm exec biome check tests/browser/qa-round2/prompt-input-chat.test.tsx
pnpm exec prettier --write tests/browser/qa-round2/prompt-input-chat.test.tsx
git status --porcelain                    # no tracked file of this lens modified
```
