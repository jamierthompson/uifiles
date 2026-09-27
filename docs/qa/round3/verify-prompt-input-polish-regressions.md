# verify-prompt-input-polish-regressions

refuted: false

Lens: regressions and side effects on neighbours. HEAD `5643605`, checkpoint `9019bdf`,
working tree clean at the start (`git status --porcelain` empty; `git diff HEAD -- registry/ai/prompt-input.tsx`
empty, so the mutant line the coder's report warned about is not in HEAD). Scratch:
`.../scratchpad/qa/round3/verify-pip-regr/` (logs only; the one throwaway test file was created
under `tests/browser/ai/` and deleted in the same command, `git status` shows no untracked file).

## Problems

None that refute. Three low observations, none introduced by this group:

1. **Pre-existing, narrow, accurately described by the coder** (`registry/ai/inline-citation.tsx:196-204`
   `press`, `:210-217` the `[open]` effect; both unchanged since `9019bdf`): after a controlled parent
   refuses a press-close, `restoreFocusRef` stays armed, and a later close through `open` alone moves
   focus to the badge. Reproduced in a throwaway test (write, run, delete), outcomes:
   ```
   A: refused press-close, focus moved to <button>elsewhere</button>, then prop-close
      -> open-after-blur=true focus=example.com          (focus taken from "elsewhere" to the badge)
   B: refused press-close, focus inside the popup, then prop-close
      -> open-after-inside-focus=true focus=example.com  (badge; the control C lands on body)
   C: control, no refused press: pinned, focus inside, then prop-close
      -> focus=body
   D: refused press-close, focus left in the popup, prop-close, un-force, Tab away and back
      -> afterPress=popup afterClose=example.com openAfterUnforce=true focusNow=example.com peekOnRefocus=true
   ```
   Only A is a user-visible fault (focus leaves a control the user chose). It needs a controlled
   parent that refuses a press-close and then closes by prop, and it is not touched by this round's
   hunk (the reset at `:131-134` writes `pinned`, never `restoreFocusRef`). Rating: low, not a
   regression; the coder's suggested fix (clear the flag in an effect while `open` stays true) is
   sound. One wording nit that follows from it: the new `inline-citation` docs sentence "a press you
   refuse leaves nothing behind" is true of a refused press-open (the tested case) and not quite of
   a refused press-close (the armed flag). Cosmetic.
2. **Chat block prose not updated for the no-`onStop` case** (not this group's files, and not a
   regression: the text was equally loose before, when the button was *named* Stop but did nothing):
   `registry/blocks/chat/components/blocks/chat.tsx:697-698` ("a submit button that becomes a stop
   button while the response is in flight") and `registry/blocks/registry.json` chat `docs` ("Stop is
   the only action then"). Both are exact when `onStop` is passed (the `Chat` wrapper, `page.tsx`,
   the preview and the test `Demo` all pass it). The coder's report already hands this to the chat
   owner as a follow-up. Low.
3. **Concurrent mutation during verification** (process, not code): partway through, another verifier
   held `registry/ai/prompt-input.tsx:1542` at `const canStop = onStop !== undefined` (an `s03`-style
   mutant) plus `e2e/origin.ts`, `registry/blocks/registry.json`, `registry/ai/code-block.tsx`. My run 1
   passed 169/169 for `prompt-input`, which that mutant cannot do (it fails "stays a Submit button
   while ready/error even with onStop wired" ×2), so run 1 saw the committed source; I still re-ran
   the pair after waiting for a clean tree (run 4 below).

## Every hunk against `9019bdf`, accounted

- `registry/ai/prompt-input.tsx` (8 hunks): `ProviderFilesRefContext` → internal `ProviderRefsContext`
  `{ files, text }` (:229-238); provider `textInputRef` written synchronously by `setInput`/`clearInput`
  (:278-285); `controller` memo deps gain the stable `setInput`, `refs` memo (:357-375); provider render
  (:378-384); `PromptInput` reads `providerRefs` (:584); `currentFiles` reads `providerRefs.files`
  (:612-617); `handleSubmit`: text from the ref, `controller.textInput.clear()` at submit start,
  `commit()` no longer clears provider text, `restoreText` provider branch restores only when the
  provider text is still `""` (:920-985, deps :1021-1030); `PromptInputSubmit`: `canStop =
  isGenerating && onStop !== undefined` drives the label, the square glyph, the click branch and `type`
  (:1539-1575). The local path (`form.reset()`, `textarea.value === defaultValue`) is unchanged.
- `registry/ai/inline-citation.tsx` (1 hunk, :131-134): render-time `if (pinned && !open) setPinned(false)`.
- `registry/ai/registry.json` (2 hunks): the `inline-citation` docs sentence and the `prompt-input`
  (6)/(9) rewrites; nothing else in either string changed (single-paragraph JSON strings, Base UI
  sentence first in both).
- `CHANGELOG.md` (2 hunks, :146-151 and :164-166, under `## [0.1.0] - 2026-09-26` › `### Fixed`).
- `docs/architecture.md`: §3 `prompt-input` :182-183 and `inline-citation` :213 (the lead's three
  sentences); the §5 hunks (:271-275, :288-289) belong to `tests-polish`.
- `tests/browser/ai/prompt-input.test.tsx` (5 hunks): the restore test and the two attachment
  double-submit tests become local/provider `it.each`; new provider pending-typing test; the no-onStop
  Enter test covers submitted and streaming and asserts name/type/payload; "shows loading icon when
  submitted" now expects the Submit name; "shows stop icon when streaming" now passes `onStop` and
  expects `type="button"`; two new no-onStop Submit cases and two ready/error-with-onStop cases; the
  with-onStop Stop case also asserts no Submit button and the kept draft. `vi.spyOn(window, "fetch")`
  is a fetch spy, not a console spy, so `tests/unit/tooling.test.ts` is not tripped.
- `tests/browser/ai/inline-citation.test.tsx` (4 hunks): `useState` import, `ControlledCitation`
  fixture, the extended trigger-press test, the new parent-closes-through-open test.
- `tests/browser/blocks/chat.test.tsx` (2 hunks, both `tests-polish`): the :1707-1709 locator
  `"Stop"` → `"Submit"` with a comment, and an unrelated `ChatToolPart` "Parameters" + axe assertion.
- `AGENTS.md`, `e2e/*`, `tests/unit/*`, `code-block`/`suggestion` tests: `tests-polish`, nothing about
  prompt-input or inline-citation; the input-group rule (`AGENTS.md:142-144`) is untouched.

## (1) Chat block

`registry/blocks/chat/components/blocks/chat.tsx` uses `PromptInput` in **local mode**: no
`PromptInputProvider`, `usePromptInputController` or `useProviderAttachments` anywhere under
`registry/blocks/chat` (grep), only `usePromptInputAttachments` in `ChatComposerAttachments`. So the
provider-text hunk cannot reach it; text clearing on submit there is still `form.reset()` as before.
`ChatComposer` (:707-779) renders `<PromptInputSubmit onClick={handleSubmitClick}
status={status === "error" ? "ready" : status} {...(onStop !== undefined && { onStop })} />`;
`handleSubmitClick` calls `event.preventDefault()` while busy and `handleSubmit` returns `false`
while busy. `Chat` (:140-186) forwards `onStop`; `page.tsx:21` and `app/preview/chat/page.tsx:41` pass
`stop`.

Behaviour before → after:

| composer state                       | name            | `type`            | click                                     | draft |
| ------------------------------------ | --------------- | ----------------- | ----------------------------------------- | ----- |
| busy, `onStop` wired (Chat, previews) | Stop → Stop     | button → button   | calls `onStop` (unchanged)                | kept  |
| busy, no `onStop` (bare ChatComposer) | **Stop → Submit** | submit → submit | swallowed by `handleSubmitClick` (unchanged) | kept  |
| ready / error                        | Submit → Submit | submit → submit   | submits (unchanged)                       | reset |

Only the accessible name (and the streaming glyph: square → return arrow) changes, and only for a
`ChatComposer` used without `onStop`. Runs:

```
run1  chat.test.tsx + prompt-input.test.tsx   Test Files 2 passed  Tests 236 passed (236)  exit=0   (67 + 169)
run2  chat.test.tsx                           Test Files 1 passed  Tests  67 passed (67)   exit=0
run3  chat.test.tsx                           Test Files 1 passed  Tests  67 passed (67)   exit=0
run4  chat.test.tsx + prompt-input.test.tsx   Test Files 2 passed  Tests 236 passed (236)  exit=0
      (started after an 85 s wait for `git diff --quiet HEAD -- registry/ai/prompt-input.tsx
      registry/ai/inline-citation.tsx registry/blocks/chat tests/browser components/ui app/preview`;
      at its start only registry/ai/code-block.tsx and registry/blocks/registry.json were modified
      by others, plus two untracked tests/browser/__verify_cycle_*.ts that vitest's
      tests/browser/**/*.test.tsx include never runs; by its end another verifier had applied
      `? controller.textInput.value` in place of `? (providerRefs?.text.current ?? controller.textInput.value)`
      at prompt-input.tsx:924, the coder's p02 mutant, which the provider double-submit test catches,
      so a run that saw it could not have passed 169/169)
```

Every other `name: "Stop"` query in `chat.test.tsx` (:235 helper, :686, :1652, :1956, :2037, :2068)
renders with `onStop` (directly or through `Demo`, :186) and is unaffected.

## (2) Demos and site tests

- `app/preview/prompt-input/page.tsx:231` Streaming section: `<PromptInputSubmit onStop={() => {}}
  status="streaming" />` (already so at `9019bdf`; no `app/` diff), so it still shows Stop with the
  square. The Ready section (:180) is `status="ready"`. No demo lost its Stop.
- `app/preview/chat/page.tsx:41` passes `onStop={stop}`: Stop while streaming, as before.
- `app/preview/inline-citation/page.tsx`: both cards uncontrolled (no `open`/`onOpenChange`), so the
  reset never fires there (`pinned && !open` cannot hold in uncontrolled mode: open and pinned always
  change together in `press` and `handleOpenChange`).
- `pnpm exec vitest run --project unit tests/unit/ssr.test.ts tests/unit/site.test.ts tests/unit/registry.test.ts`
  → `Test Files 3 passed (3)  Tests 97 passed (97)`.

## (3) Public API

- `diff` of every `^export ` line of `prompt-input.tsx` at `9019bdf` vs HEAD: no differences.
- `PromptInputSubmitProps` (`status?: ChatStatus; onStop?: () => void`), `PromptInputProviderProps`,
  `PromptInputControllerProps`, `TextInputContext`, `AttachmentsContext`, `PromptInputMessage`,
  `PromptInputProps`: identical text before and after.
- Provider context value: same shape; `textInput.setInput` is now a `useCallback([])` wrapper with the
  same `(value: string) => void` signature (was the raw state setter; both stable). The replaced
  `ProviderFilesRefContext` was module-private; `ProviderRefsContext` is too.
- `pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals` → exit 0.
- A consumer rendering `<PromptInputSubmit status="streaming" />` without `onStop` gets **the same
  `type`** as before: at `9019bdf` `type={isGenerating && onStop ? "button" : "submit"}` was already
  `"submit"` without `onStop`; `canStop` is the same predicate (`onStop !== undefined` vs truthiness
  differ only for a non-function value the prop type forbids). Only `aria-label` and the streaming
  glyph differ. No consumer's prop types change.

## (4) Citation

- `pnpm exec vitest run --project browser tests/browser/ai/inline-citation.test.tsx` →
  `Tests 71 passed (71)  exit=0`, the three controlled tests included.
- The chat block does not import `InlineCitationCard` at all; the only non-test usages are the two
  uncontrolled cards in the preview.
- Focus-restore flag: reproduced and rated in Problems › 1.
- The render-time `setPinned(false)` is a same-component set during render (React re-renders once;
  the condition is false on the second pass), and the console guard stayed silent across the run.

## (5) Docs

- `registry/ai/registry.json`: both strings are one paragraph with the Base UI sentence first; the new
  (6) text matches `:1539-1575` (Stop name, `type="button"`, `onStop` call and square only under
  `canStop`; spinner while submitted either way; X on error), the new (9) text matches `:929-937` and
  `:962-975` (provider cleared at start, restored only when still empty, attachments and sources kept,
  controlled textarea left alone). `tests/unit/registry.test.ts` passed within the 97 above.
- `CHANGELOG.md` :146-151 (`prompt-input`) and :164-166 (`inline-citation`) sit under `[0.1.0]` › `Fixed`
  and describe exactly the two behaviour changes.
- `docs/architecture.md` §3: `prompt-input` :182-183 and `inline-citation` :213 say the same as the
  registry docs; the chat line :169-179 is unchanged and still true.
- `AGENTS.md:142-144` (do not disable `PromptInputSubmit`; the chat block swallows empty submits):
  still exact, `ChatComposer.handleSubmit` :715-729 still returns early on an empty message and the
  button is never disabled.

## (6) Static

```
pnpm lint              biome check: Checked 151 files in 284ms. No fixes applied.   exit=0
pnpm format:check      prettier --check .: All matched files use Prettier code style!  exit=0
pnpm registry:validate                                                             exit=0
```
