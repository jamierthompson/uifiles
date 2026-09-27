# verify-prompt-input-polish-correctness

refuted: false

Lens: correctness of the fix. HEAD `5643605`, checkpoint `9019bdf`. Scratch:
`/docs/qa/round3/verify-pip-correctness/`
(`runs/` four browser logs plus `chat.log`; `mut/` one `.orig`, one `.log` per mutation and `summary.txt`; `mutate.py`;
`foreign-diff-at-verdict.txt`).

## Problems

None that block. Nits and disclosed residue, none in the fix's logic:

1. `CHANGELOG.md:147` says the button "showed the stop square while generating without `onStop`". At the checkpoint
   the square showed only while streaming (`git show 9019bdf:registry/ai/prompt-input.tsx` line 1525:
   `} else if (status === "streaming") {`); while submitted it showed the spinner. Wording only.
2. `docs/architecture.md:182` (lead's sentence) says "it keeps the Submit name, type and glyph while generating".
   While submitted the return glyph is replaced by the spinner (`registry/ai/prompt-input.tsx:1545-1547`, with or
   without `onStop`). The registry docs string (6) says this precisely ("only the spinner shows while submitted");
   the architecture sentence is looser. Wording only.
3. `registry/blocks/chat/components/blocks/chat.tsx:697-699` JSDoc: "a submit button that becomes a stop button
   while the response is in flight" now holds only when `onStop` is passed. Not this group's file; block owner.
4. Disclosed by the coder, judged not blocking: `registry/ai/inline-citation.tsx:213` (`press`, the close branch)
   arms `restoreFocusRef` before asking the parent to close; a controlled parent that refuses that close leaves the
   flag armed until any later `handleOpenChange` close overwrites it (`:198-202`), so only a refused press/Escape
   close followed by a prop-only close moves focus to the badge. Pre-existing (present at
   `9019bdf:registry/ai/inline-citation.tsx:193`), narrow, not introduced or widened by the N13 reset.
5. Disclosed by the coder: the chat block without `onStop` while busy now has a button named Submit whose click
   `handleSubmitClick` swallows (`chat.tsx:748-752`). The name matches what a press does when it does anything, so
   the N16 name/action mismatch is gone; what remains is an inert control without `aria-disabled`, the block
   owner's trade-off against input-group's `has-disabled:` fade.

## (1) N16: Stop only with `onStop`

`registry/ai/prompt-input.tsx:1539-1575`: one predicate `const canStop = isGenerating && onStop !== undefined`
gates all four action-naming parts: `aria-label={canStop ? "Stop" : "Submit"}` (:1569),
`type={canStop ? "button" : "submit"}` (:1573), the square glyph `else if (status === "streaming" && canStop)`
(:1547) and the press route `if (canStop) { e.preventDefault(); onStop?.(); return }` (:1556-1560). The spinner
stays on `status === "submitted"` alone (:1545). Without `onStop` while submitted or streaming the button is named
Submit, `type="submit"`, shows spinner/return glyph, and a click or Enter submits.

Upstream (`scratchpad/upstream/ai-elements/packages/elements/src/prompt-input.tsx:1226-1262`):
`aria-label={isGenerating ? "Stop" : "Submit"}`, square on `status === "streaming"`, `type` and the click route
on `isGenerating && onStop`. The coder moved exactly the two action-naming parts (label, square) onto the condition
that already governed `type` and the press; the spinner and error glyph are untouched. "Smallest truthful change"
holds.

Chat block `chat.tsx:773-777`: `{...(onStop !== undefined && { onStop })}`, so without `onStop` the block gets
the Submit-named button; `handleSubmit` returns `false` while busy (:715), `handleKeyDown` blocks Enter (:729-739),
`handleSubmitClick` `preventDefault`s the click (:748-752). Coherent with a button named Submit (see nit 5).
`tests/browser/blocks/chat.test.tsx:1698-1712` now queries `name: "Submit"` and asserts no submit and the draft
kept. Every other `name: "Stop"` query wires `onStop`: :686 (`onStop={onStop}` at :678), :1652 (loop with
`onStop={() => {}}` at :1643), :1956, :2037, :2068 and `stopButton()` at :2210/:2224 (all `<Demo />`, which passes
`onStop={stop}` at :187).

## (2) N15: provider text snapshotted and cleared at submit start

`PromptInputProvider` (:279-285): `textInputRef`, `setInput` writes the ref then `setTextInput`, `clearInput`
goes through `setInput`. `grep setTextInput` shows only the `useState` line and `setInput` (:279, :283), so every
provider text write keeps the ref in sync, including the textarea's `onChange` (:1195,
`controller.textInput.setInput(e.currentTarget.value)`). `ProviderRefsContext` (`{ files, text }`, :235-238) is
memoised once (:371-374) and replaces `ProviderFilesRefContext`; `currentFiles` reads `providerRefs?.files.current`
(:612-616), same semantics as before.

`handleSubmit` (:923-937): `text = providerRefs?.text.current ?? controller.textInput.value`, then
`controller.textInput.clear()` in provider mode / `form.reset()` locally, before the first `await`, so a second
`requestSubmit` in the same tick reads `""`. `commit()` (:959-962) only removes attachments and sources.
`restoreText()` (:967-984): provider mode restores through `setInput(text)` only when `text.current === ""`, the
counterpart of local mode's `textarea.value === textarea.defaultValue`; a controlled local textarea is still left
alone. Local path unchanged (the only edit is splitting the early return into two `if`s). Public API unchanged:
`TextInputContext.setInput` was already typed `(v: string) => void` (:209), `usePromptInputController` returns the
same shape, `useProviderAttachments` reads the untouched `ProviderAttachmentsContext`. Docs claim "upstream clears
the provider's text only once `onSubmit` succeeds" checked against upstream :880-897 (`controller.textInput.clear()`
after `await result` and after a sync return; nothing at submit start): true.

## (3) N13: a closed card is never pinned

`registry/ai/inline-citation.tsx:131-134`: `if (pinned && !open) setPinned(false)` in render, after `open` is
resolved from prop or state. A refused press (`press` :216-217 sets `pinned` then asks the parent) renders
pinned/closed once and resets; an accepting parent's `setOpen(true)` batches with `setPinned(true)` in the same
click, so no reset and the pinned dialog appears; a parent closing through `open` alone resets. A `startTransition`
parent gets the sync render first (pinned, still closed) and so a peek; docs string and architecture say so, and a
second press pins. Uncontrolled mode always commits `open` and `pinned` together. The reset cannot loop (`pinned`
is false after it) and is same-component, so no console output; the guard stayed clean across all runs.
`contextValue.pinned` is `open && pinned` (:236), consistent. The armed-flag note is judged in Problems 4.

## (4) Docs, CHANGELOG, architecture describe the code

- `registry/ai/registry.json` prompt-input (6): "PromptInputSubmit is a Stop button (named \"Stop\",
  `type=\"button\"`, a press calls `onStop`, the square glyph while streaming) only while `status` is
  submitted/streaming and `onStop` is passed; without `onStop` a press still submits, so it keeps the Submit name,
  type and glyph, and only the spinner shows while submitted (upstream names it Stop and shows the square either
  way)." Matches :1539-1575 and upstream.
- prompt-input (9): "A submit clears the text as it starts, also text held by PromptInputProvider (upstream clears
  the provider's text only once `onSubmit` succeeds, so a second submit in the meantime sent it again and text typed
  meanwhile was wiped). When it throws, rejects or returns `false`, an uncontrolled PromptInputTextarea or the
  provider gets its text back unless you typed since, and attachments and referenced sources are kept (as
  upstream); a textarea you control through `value` is left to you." Matches :923-984.
- inline-citation: "With a controlled `open`, a press pins the card only if your `onOpenChange` opens it in the same
  update; a press you refuse leaves nothing behind, and a card you close through `open` drops its pin, so the next
  time you open it, it is the non-modal peek." Matches :131-134 and :216-217.
- `CHANGELOG.md:146-151`: "`PromptInputSubmit` was named Stop and showed the stop square while generating without
  `onStop`, although a press submitted (it is a Stop button only when `onStop` is passed); in provider mode a second
  submit during the first one sent the same text again, and text typed while a submit was pending was wiped once it
  succeeded (the provider's text is now cleared as a submit starts and given back if the submit fails, as without a
  provider)." True bar nit 1. `:162-166`: "with a controlled `open`, opened as a pinned dialog that took focus after
  a press the parent had refused, or after the parent closed a pinned card through `open`." True.
- `docs/architecture.md:182`: "`PromptInputSubmit` is a Stop button only when `onStop` is passed (without it a press
  submits, so it keeps the Submit name, type and glyph while generating; upstream names it Stop and shows the square
  either way);" (nit 2). `:183`: "a submit clears the text as it starts, also the provider's (upstream clears
  provider text only after `onSubmit` succeeds); a throwing or rejecting `onSubmit` restores the typed text unless
  the user typed since". `:214`: "with a controlled `open` the pin holds only if `onOpenChange` opens the card in
  the same update, and a closed card is never pinned;". All three present and true.

## (5) Runs

```
run1  (collided with another verifier's mutation; tree showed registry/ai/prompt-input.tsx | 2 +- during it)
      Tests  5 failed | 235 passed (240)  -- VitestBrowserElementError: Cannot find element with locator: getByRole('button', { name: 'Submit' })
run1b (after waiting for a clean tree)   Test Files  2 passed (2)   Tests  240 passed (240)
run2                                     Test Files  2 passed (2)   Tests  240 passed (240)
run3                                     Test Files  2 passed (2)   Tests  240 passed (240)
chat.test.tsx                            Test Files  1 passed (1)   Tests   67 passed (67)
pnpm exec vitest run --project unit tests/unit/registry.test.ts   Tests  30 passed (30)
pnpm registry:validate   exit 0
pnpm exec tsc --noEmit   exit 0
pnpm exec prettier --check <8 changed files>   "All matched files use Prettier code style!"  exit 0
pnpm exec biome check <6 code/json files>      "Checked 6 files in 161ms. No fixes applied." exit 0
```
240 = 169 (prompt-input) + 71 (inline-citation), as claimed. Run 1's five failures are exactly the coder's s01
signature and the tree carried a foreign one-line edit to `prompt-input.tsx` at that moment; the file was also
re-mutated right after runs 1b, 2 and 3 finished, so each run waited for `git diff --quiet` first.

## (6) Mutations (`mutate.py`: wait for a clean file, snapshot only when it equals `git show HEAD:`, patch, run,
restore from the snapshot, assert `filecmp` and `git diff --quiet`)

```
m1-stop-name-when-generating  (aria-label={isGenerating ? "Stop" : "Submit"})
   CAUGHT | Tests  5 failed | 164 passed (169)
   × still submits on Enter while submitted/streaming when no onStop is wired ... (×2)
   × shows loading icon when submitted
   × keeps the Submit name, type=submit and no stop glyph while submitted/streaming without onStop ... (×2)
   -> Cannot find element with locator: getByRole('button', { name: 'Submit' })
m2-provider-clear-only-in-commit  (no provider clear at start; commit() clears it again)
   CAUGHT | Tests  3 failed | 166 passed (169)
   × clears the text as a submit starts and restores it when async onSubmit rejects ... with a PromptInputProvider
   × keeps what the user types while a provider-mode submit is pending ...   -> expected 'First message' to be ''
   × carries the text and an attachment through exactly one submit ... with a PromptInputProvider
        -> second call received "text": "hi" (the critic's probe result)
m3-keep-pinned-on-close  (drop `if (pinned && !open) setPinned(false)`)
   CAUGHT | Tests  2 failed | 69 passed (71)
   × reports a press to onOpenChange as trigger-press and leaves a controlled open alone
   × pins a card its parent opens from onOpenChange, and drops the pin once the parent closes it through open
        -> expected <div data-open …> to be null  (the dialog query)
```
After each restore the harness asserted a byte-identical file and an empty `git diff` for it (all three passed).
At the moment of the final `git status`, other verifiers' edits were live in `registry/ai/prompt-input.tsx` (2 +-)
and `registry/blocks/registry.json` (1 +); by the time the lines were captured a moment later only the
`registry.json` edit (`+ "css": { ".katex-display": { "overflow": "visible" } }`) was still live, recorded in
`foreign-diff-at-verdict.txt`. None is mine: my harness asserted a byte-identical restore and an empty `git diff`
for each of my three mutations before returning.

## Every hunk accounted for

`prompt-input.tsx`: ProviderRefs context (+ref type), provider `textInputRef`/`setInput`/`clearInput`, controller
memo deps, `refs` memo and provider JSX, `providerRefs` in `PromptInput`, `currentFiles`, `handleSubmit` text
snapshot/clear/commit/restore and deps, `PromptInputSubmit` `canStop`. `inline-citation.tsx`: the four-line reset.
`registry.json`: docs (6), (9) and the inline-citation sentence only. `CHANGELOG.md`: the two bullets.
`architecture.md` §3: the three sentences (the §5 hunks in the same diff belong to tests-polish). `chat.test.tsx`:
the `Submit` locator at :1709 with its comment (the :1382-1384 hunk is tests-polish's N6 axe). Test files: the
`it.each` pairs, the new provider pending-typing test, the Submit/Stop table tests, `ControlledCitation` fixture and
the two controlled-citation tests, all matching the coder's list.
