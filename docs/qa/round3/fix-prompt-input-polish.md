# fix-prompt-input-polish

Scratch: `/docs/qa/round3/fix-prompt-input-polish/`. It holds `*.orig` (the owned files before any change), `prompt-input-before.log` and `citation-before.log` (the new tests run against the unfixed sources), `runs/` (three runs of each file), `mut/` (one log per mutation plus `summary.txt`; harness `mutate.py`, driver `run-mutations.py`), `registry-strings.json` (the two new docs strings) and `tsc*.log`.

## Action needed from the lead first (HEAD holds a mutant line)

The lead amended the checkpoint to `79858f0` while mutation s01 was applied to `registry/ai/prompt-input.tsx`. The harness later restored the file byte-identically, so the **working tree is correct**. **HEAD is not.** At `registry/ai/prompt-input.tsx:1569` it carries the mutant `aria-label={isGenerating ? "Stop" : "Submit"}` instead of `aria-label={canStop ? "Stop" : "Submit"}`. `git diff HEAD -- registry/ai/prompt-input.tsx` shows exactly that one-line correction; `git status` shows no other change. Commit the working-tree file. Everything else of mine (tests, `inline-citation.tsx`, `registry.json`, `CHANGELOG.md`) went into `79858f0` as intended.

## Fixed

- critic N16 (low, inherited from upstream): `PromptInputSubmit` is a Stop button only while `status` is submitted/streaming **and** `onStop` is passed. That is the same condition (`canStop`) that makes it `type="button"` and makes a press call `onStop`. Without `onStop` a press submits, so the button keeps the name "Submit", `type="submit"` and the return glyph while streaming (no stop square). The submitted spinner shows either way. This is the smallest truthful behaviour. Before round 1, and in upstream AI Elements (`upstream/.../src/prompt-input.tsx:1226-1262`), the button was named "Stop" whenever `status` was generating and showed the square while streaming, with `type` flipping only with `onStop`. I changed only the parts that name an action: the label and the square. The spinner reports progress rather than naming an action, and upstream's ported test "shows loading icon when submitted" asserts it without `onStop`, so it stays. The `error` X glyph is unchanged. Code: `registry/ai/prompt-input.tsx:1539-1575`.
  Tests in `tests/browser/ai/prompt-input.test.tsx`:
  - › "still submits on Enter while %s when no onStop is wired, because the button stays a Submit button" ×2: submitted and streaming. Updated from the old single test at :2177, which only checked that Enter submits. It now also asserts the name is Submit, `type="submit"`, no Stop button, and the payload. Failed before: `Cannot find element with locator: getByRole('button', { name: 'Submit' })`.
  - › "shows loading icon when submitted": upstream name kept; now `submitButton()` with the spinner and `type="submit"`. Failed before: same locator error.
  - › "shows stop icon when streaming": upstream name kept; now with `onStop`, so Stop, the square and `type="button"`. Passes before; guard.
  - › "keeps the Submit name, type=submit and no stop glyph while %s without onStop, so a press submits the draft" ×2 (new): glyph per status, no square, axe, and a click submits `{ files: [], text: "go" }`, calls `onClick` and resets the textarea. Failed before: the locator error, then the poll timeout.
  - › "stays a Submit button while %s even with onStop wired" ×2 (new): ready and error. Passes before; guard for s03.
  - › "renders Stop as type=button while %s with onStop so clicking it never submits": the existing with-`onStop` case, which now also asserts no Submit button and that the draft is kept. Passes before; guard.

  The with-`onStop` cases cannot fail before, because that behaviour is unchanged. They pin that it stays so (s03).
- critic N15 (low): in provider mode a submit now takes the text and clears the provider's text **as it starts**, the same way the local path calls `form.reset()`. The provider's text is no longer cleared in `commit()` after an accepted `onSubmit`. A rejected submit (throw, reject or `false`) gives the text back through `setInput` unless the provider text is non-empty by then, which is local mode's "unless you typed since". To keep a second submit in the same tick from reading a stale closure, `PromptInputProvider` keeps a synchronously updated `textInputRef`: `setInput` and `clear` write it before `setTextInput`. `PromptInput` reads it through the internal context, now `ProviderRefsContext` holding `{ files, text }`, which replaces `ProviderFilesRefContext`. The public `TextInputContext` is unchanged. Code: `registry/ai/prompt-input.tsx:229-238`, `:278-285`, `:357-383`, `:584`, `:612-617`, `:920-985`, `:1024`. A side effect, also fixed and pinned: in provider mode, text typed while a submit was pending used to be wiped when that submit succeeded; local mode had fixed that as upstream #125.
  Tests:
  - › "carries the text and an attachment through exactly one submit when a second submit lands during the blob conversion, with %s" ×2: local and provider. It replaces the local-only test at :866 and adds a check that the textarea is empty at the end. The provider case failed before with `"text": "hi"` received where `""` was expected on the second call (the critic's probe result).
  - › "leaves a file out of a second submit while an async onSubmit carrying it is pending, and gives back its text and file once that submit is rejected, with %s" ×2. This is the "rejected first submit still restores text and files" case. The provider case failed before: `expected '' to be 'first'`.
  - › "clears the text as a submit starts and restores it when async onSubmit rejects, unless the user typed since, with %s" ×2. It replaces the local-only :703 test. The provider case failed before: `expected 'please retry me' to be ''`.
  - › "keeps what the user types while a provider-mode submit is pending, instead of clearing it once the submit is accepted" (new). Failed before: `expected 'First message' to be ''`.
  - The existing provider tests › "keeps the provider text when onSubmit rejects and clears it when it resolves" and › "keeps the provider text and the attachments when onSubmit returns false" still pass. Their end state is unchanged, and they now catch p01, p03 and p06.
- critic N13 (low): I chose the fix, not a docs note. `InlineCitationCard` resets `pinned` during render whenever the card is closed (`if (pinned && !open) setPinned(false)`, `registry/ai/inline-citation.tsx:131-134`), so a closed card is never pinned. A press a controlled parent refuses leaves nothing behind. A pinned card the parent closes through `open`, without going through `onOpenChange`, also drops its pin. Before this, its next hover-open was a `role="dialog"` that pulled focus into the card. A parent that accepts the press from `onOpenChange` in the same update still gets the pinned dialog, and uncontrolled mode is unaffected (open and pinned always commit together). The one parent that loses the pin is one that defers its answer to a later commit (for example `startTransition`); it gets the peek, and a second press pins. The docs say this.
  Tests in `tests/browser/ai/inline-citation.test.tsx`:
  - › "reports a press to onOpenChange as trigger-press and leaves a controlled open alone": updated to the new contract. After the refused press and a parent-driven open, the card is the peek (no dialog, focus not inside). A press then pins it (a dialog named "example.com", focus in the popup) without calling `onOpenChange` again. A second press reports `false`/`trigger-press`, and the card stays open unpinned. Failed before: `expected <div data-open …> to be null` on the dialog query.
  - › "pins a card its parent opens from onOpenChange, and drops the pin once the parent closes it through open" (new): a stateful parent with a `forceClosed` prop, axe on the popup and on the page. Failed before: same assertion.

  Both tests fail with the "document it" choice. They pass only with the reset.

## Not fixed and why

- Found in passing, left as is (narrow, not in N13's scope): if a controlled parent refuses a press-**close**, `restoreFocusRef` stays armed while the card stays open. A later close by the parent through `open` then moves focus to the badge. Every other close path (Escape, outside press, hover leave) overwrites the flag in `handleOpenChange`, so only a refused close followed by a prop-only close hits it. Suggested fix if wanted: clear the flag in an effect with no dependency list whenever `open` is still true after a commit.
- In the `chat` block without `onStop`, while busy, the submit button is now named "Submit", but the block's own `handleSubmitClick` swallows the click. Before, it was named "Stop" and did not stop. The block owns that choice. `aria-disabled` there would not trip input-group's `has-disabled:` fade, so it could be a follow-up for the chat owner.

## Tests

- `tests/browser/ai/prompt-input.test.tsx`: 160 → 169. Four tests became local+provider `it.each` pairs (+4). There is one new provider #125-style test (+1). The no-onStop Enter test covers both statuses (+1). There are 2 new no-onStop Submit cases and 2 new ready/error-with-onStop cases (+4 − 1 replaced). Upstream tests: "shows loading icon when submitted" and "shows stop icon when streaming" keep upstream's names. The streaming one now passes `onStop`, because the stop icon requires it; the no-onStop streaming case is the new table test. No new upstream tests apply.
- `tests/browser/ai/inline-citation.test.tsx`: 70 → 71 (one updated, one new; `ControlledCitation` fixture added).
- Before-fix run (`prompt-input-before.log`): 9 failed / 160 passed. `citation-before.log`: 2 failed / 69 passed. Every failure is at the new assertion (quoted above).
- Mutation checks: 13 of 13 caught. Each ran on the whole test file and was restored byte-identically (`filecmp`).

| id | mutation | caught by |
| --- | --- | --- |
| s01 | `aria-label={isGenerating ? "Stop" : "Submit"}` (old name) | no-onStop Enter ×2, "shows loading icon when submitted", no-onStop Submit ×2 (5) |
| s02 | stop square on every streaming button | "keeps the Submit name … while streaming without onStop" |
| s03 | `canStop = onStop !== undefined` (ignores status) | "stays a Submit button while ready/error even with onStop wired" ×2 |
| s04 | `type` is button whenever generating | no-onStop Enter ×2, loading icon, no-onStop Submit ×2 (5) |
| s05 | spinner only with `onStop` | "shows loading icon when submitted", "keeps the Submit name … while submitted without onStop" |
| p01 | no provider clear at submit start (the old behaviour) | provider restore, provider pending-typing, provider double submit, provider reject-then-offer, "keeps the provider text when onSubmit rejects …" (5) |
| p02 | provider text snapshotted from the render closure, not the ref | provider double submit |
| p03 | provider text never restored after a rejection | provider restore, provider reject-then-offer, the two existing provider keep tests (4) |
| p04 | provider text restored even when the user typed since | provider restore (the "new draft" step) |
| p05 | `commit()` also clears the provider text | "keeps what the user types while a provider-mode submit is pending …" |
| p06 | provider `setInput` skips the ref | 6 provider tests |
| c01 | no pin reset | both controlled citation tests |
| c02 | reset pins whenever controlled (too eager) | both controlled citation tests |

- Three consecutive runs (`runs/*.log`):
  ```
  run1 prompt-input: Tests 169 passed (169)   run1 inline-citation: Tests 71 passed (71)
  run2 prompt-input: Tests 169 passed (169)   run2 inline-citation: Tests 71 passed (71)
  run3 prompt-input: Tests 169 passed (169)   run3 inline-citation: Tests 71 passed (71)
  ```
- The console guard stays clean: no `allowConsole` was added, and the render-time `setPinned` logs nothing.

## Docs strings (applied to `registry/ai/registry.json`, docs only; full text in `registry-strings.json`)

- prompt-input › (6) now reads: "(6) PromptInputSubmit is a Stop button (named \"Stop\", `type=\"button\"`, a press calls `onStop`, the square glyph while streaming) only while `status` is submitted/streaming and `onStop` is passed; without `onStop` a press still submits, so it keeps the Submit name, type and glyph, and only the spinner shows while submitted (upstream names it Stop and shows the square either way). Enter submits only through an enabled `button[type=\"submit\"]` inside the form, so while PromptInputSubmit shows Stop Enter does nothing and the draft is kept; a disabled or missing submit button blocks Enter the same way."
- prompt-input › (9): the sentence ending "…and text held by PromptInputProvider is never cleared on failure." is replaced by: "A submit clears the text as it starts, also text held by PromptInputProvider (upstream clears the provider's text only once `onSubmit` succeeds, so a second submit in the meantime sent it again and text typed meanwhile was wiped). When it throws, rejects or returns `false`, an uncontrolled PromptInputTextarea or the provider gets its text back unless you typed since, and attachments and referenced sources are kept (as upstream); a textarea you control through `value` is left to you."
- inline-citation: after "…on an outside press or on a second press." this is added: "With a controlled `open`, a press pins the card only if your `onOpenChange` opens it in the same update; a press you refuse leaves nothing behind, and a card you close through `open` drops its pin, so the next time you open it, it is the non-modal peek."
- The Base UI sentence stays first, each docs string is still one paragraph, and there are no other changes. `pnpm exec prettier --write registry/ai/registry.json` produced a 2-line diff. `pnpm registry:validate` exits 0, and `tests/unit/registry.test.ts` passes 30/30.

## CHANGELOG (`[0.1.0]` › Fixed)

- The `prompt-input` bullet gains: "`PromptInputSubmit` was named Stop and showed the stop square while generating without `onStop`, although a press submitted (it is a Stop button only when `onStop` is passed); in provider mode a second submit during the first one sent the same text again, and text typed while a submit was pending was wiped once it succeeded (the provider's text is now cleared as a submit starts and given back if the submit fails, as without a provider)."
- The `inline-citation` sentence gains: "…and, with a controlled `open`, opened as a pinned dialog that took focus after a press the parent had refused, or after the parent closed a pinned card through `open`."

## Requests for other owners

- `tests/browser/blocks/chat.test.tsx` (tests-polish): this is **needed for a green suite**. In › "ChatComposer › keeps the draft when the button is clicked while generating without an onStop" (≈:1696-1707), `screen.getByRole("button", { name: "Stop" })` must become `screen.getByRole("button", { name: "Submit" })`. That test renders `ChatComposer` without `onStop` at `status="streaming"`. By N16 the button is now named Submit, so the old locator cannot resolve. I did not run that file, per my prompt; this is from reading the block (`chat.tsx:773-777`) and the test. The test's intent still holds: the block's `handleSubmitClick` swallows the click, so nothing is submitted and the draft stays. The other `name: "Stop"` queries in that file (≈:1650, 1952, 2033, 2064) all wire `onStop` (directly or through `Demo`, :187) and are unaffected.
- `docs/architecture.md` §3 (lead; not in either 3c group), to match the new docs:
  - `prompt-input`: before "Enter submits only through an enabled `button[type="submit"]`, so it does nothing while Stop is shown;" insert "`PromptInputSubmit` is a Stop button only when `onStop` is passed (without it a press submits, so it keeps the Submit name, type and glyph while generating; upstream names it Stop and shows the square either way);".
  - `prompt-input`: replace "a throwing or rejecting `onSubmit` restores the typed text" with "a submit clears the text as it starts, also the provider's (upstream clears provider text only after `onSubmit` succeeds); a throwing or rejecting `onSubmit` restores the typed text unless the user typed since".
  - `inline-citation`: after "reports `trigger-press` to `onOpenChange`;" insert "with a controlled `open` the pin holds only if `onOpenChange` opens the card in the same update, and a closed card is never pinned;".

## Strict-flag typecheck

- `pnpm exec tsc --noEmit` exits 0. So does `pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`.
- Errors remaining in files I own: none. Errors in files I do not own: none.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
pnpm exec vitest run --project browser tests/browser/ai/prompt-input.test.tsx tests/browser/ai/inline-citation.test.tsx   # baseline 230 passed
# tests written first, then against the unfixed sources:
pnpm exec vitest run --project browser tests/browser/ai/prompt-input.test.tsx      # 9 failed | 160 passed → prompt-input-before.log
pnpm exec vitest run --project browser tests/browser/ai/inline-citation.test.tsx   # 2 failed | 69 passed → citation-before.log
# after the fixes
pnpm exec prettier --write <my 6 files>; pnpm exec biome check <my 5 code/json files>; pnpm exec prettier --check <my 6 files>
pnpm exec tsc --noEmit; pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals
node docs.mjs; pnpm exec prettier --write registry/ai/registry.json; pnpm registry:validate
pnpm exec vitest run --project unit tests/unit/registry.test.ts   # 30 passed
pnpm exec vitest run --project unit                               # 338 passed (read-only check)
python3 run-mutations.py                                          # 13/13 caught → mut/summary.txt
pnpm exec vitest run --project browser tests/browser/ai/{prompt-input,inline-citation}.test.tsx   # ×3 → runs/
git status --porcelain; git diff HEAD -- registry/ai/prompt-input.tsx; git show --stat HEAD; git reflog   # found the amend-during-mutation
```
