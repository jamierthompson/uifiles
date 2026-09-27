# prompt-input — QA round 1

## Summary

Attacked `registry/ai/prompt-input.tsx` (the Radix→Base UI port of AI Elements' chat composer) on API
parity, attachments lifecycle, submit semantics, Base UI correctness, screenshot capture, a11y,
SSR and the existing test's mutation resistance. The port is byte-for-byte upstream logic apart
from seven Base UI touch points (verified by `diff`), so most inherited upstream bugs are still
here, plus three port-specific ones. Findings: 1 high, 7 medium, 5 low, 2 nit. The worst thing is
**F1**: in any composer that has a `PromptInputSelect` in its footer (the preview page and the
canonical AI Elements composition), activating *any* action-menu item, by mouse or keyboard, moves
focus to the model select instead of returning it to the menu trigger; clicking the footer's own
padding does the same. Root cause is a three-way interaction that did not exist on Radix: React
portal event bubbling → shadcn `InputGroupAddon`'s default `onClick` → Base UI Select's
visually-hidden `<input>` whose `onFocus` forwards focus to its trigger. 45 reproducer/pin tests
were written (33 pass, 12 `[BUG]` tests fail as intended); the existing 5-test suite survives two
targeted mutations (post-submit clear removed; Stop button submits the form).

## Findings (most severe first)

### F1. Action-menu activation and footer clicks move focus to the model select — severity: high

- Where: `registry/ai/prompt-input.tsx:1073-1098` (`PromptInputHeader`/`PromptInputFooter` render
  `InputGroupAddon` and do not override its click handler); `components/ui/input-group.tsx:57-62`
  (`onClick`: if the target is not inside a `<button>`, `parentElement.querySelector("input")?.focus()`);
  `node_modules/@base-ui/react/select/root/SelectRoot.js:398-455` (Select renders a visually-hidden
  `<input>` — *not* `type="hidden"` — with `tabIndex=-1`, `aria-hidden`, and an `onFocus` that calls
  `store.state.triggerElement.focus({ focusVisible: true })`).
- What: Composer with `PromptInputActionMenu` + `PromptInputSelect` in `PromptInputFooter` (the
  preview page and the existing test fixture). (a) Open the menu, click "Add photos or files",
  "Take screenshot" or any `PromptInputActionMenuItem` → `document.activeElement` becomes the
  Model combobox (`aria-label="Model"`, `role="combobox"`) with a visible focus ring; the menu
  trigger never regains focus. (b) Same with the keyboard: ArrowDown to an item, Enter →
  activeElement is the Model combobox. (c) Click the footer's own whitespace (not a button) →
  focus jumps from the textarea to the Model combobox. Mechanism: the menu popup is portaled to
  `<body>` in the DOM, but React synthetic events bubble through the *React* tree, so the item's
  click reaches the footer addon's `onClick`; the item is a `div[role=menuitem]` so
  `closest("button")` is null; `querySelector("input")` finds the Select's hidden input; its
  `onFocus` focuses the Select trigger. floating-ui then skips returning focus to the menu trigger
  because focus already moved outside the popup (`node_modules/@base-ui/react/floating-ui-react/components/FloatingFocusManager.js:490-505`).
  On upstream/Radix the same bubbling happens but Radix Select renders a native `<select>`, so
  `querySelector("input")` finds nothing and nothing happens. Without a select in the footer the
  behaviour is correct (control test passes), which pins the cause to the Select's hidden input.
- Evidence: `tests/browser/qa-round1/prompt-input.test.tsx` › "[BUG] returns focus to the menu
  trigger after a mouse activation when the footer has a model select" →
  `AssertionError: expected 'Model' to be 'Add attachment'`; "[BUG] … after a keyboard activation …"
  → same; "[BUG] clicking the footer whitespace does not move focus to the model select" →
  `expected <button …> not to be <button …>` (activeElement is the combobox). Control:
  "returns focus to the menu trigger after activating an item when the footer has no select" passes.
- Why it matters: breaks the WAI-ARIA menu pattern (focus must return to the trigger after
  activation) for keyboard and screen-reader users; sighted users see the model picker light up
  every time they use the attachment menu. Reproduces on `/preview/prompt-input`, which is the
  page technical founders will click through, and in every consumer that follows the AI Elements
  docs composition. The chat block is unaffected (no select).
- Proposed fix: have `PromptInputHeader`/`PromptInputFooter` pass their own `onClick` (merged with
  the consumer's) that returns unless `e.currentTarget.contains(e.target)` and the target is not
  inside a button, and then focuses the group's `textarea` rather than the first `input`. That
  also gives the whitespace click a sensible target (the textarea) instead of nothing.
- Test written: `tests/browser/qa-round1/prompt-input.test.tsx` › the three `[BUG]` tests above
  (expected: FAIL now).

### F2. `PromptInputActionAddAttachments` silently drops a consumer `onClick`, while `docs` tells consumers to use `onClick` — severity: medium

- Where: `registry/ai/prompt-input.tsx:434` (`<DropdownMenuItem closeOnClick={false} {...props} onClick={handleClick}>`);
  `registry/ai/registry.json` `docs` item (2).
- What: `<PromptInputActionAddAttachments onClick={track} />` → `track` is never called; TypeScript
  accepts it (`ComponentProps<typeof DropdownMenuItem>` includes `onClick`). Upstream overrode
  `onSelect` but passed `onClick` through to the Radix item, so a consumer migrating from AI
  Elements loses a working handler with no error. `PromptInputActionAddScreenshot` (446-476) does
  it right (calls `onClick` first and honours `defaultPrevented`).
- Evidence: test "[BUG] a consumer onClick on PromptInputActionAddAttachments is invoked (docs say
  to use onClick)" → `expected "vi.fn()" to be called 1 times, but got 0 times`.
- Why it matters: API drift the `docs` string actively steers consumers into; analytics/side
  effects vanish silently.
- Proposed fix: mirror AddScreenshot: `props.onClick?.(e); if (e.defaultPrevented) return; openFileDialog()`,
  and drop the dead `e.preventDefault()` (see F10).
- Test written: as above (expected: FAIL now).

### F3. Enter submits a new message while `status` is `streaming`/`submitted` (Stop mode) — severity: medium (inherited from upstream)

- Where: `registry/ai/prompt-input.tsx:983-992` (`handleKeyDown` only bails when
  `form.querySelector('button[type="submit"]')` is disabled) and `:1258`
  (`PromptInputSubmit` becomes `type="button"` when generating with `onStop`).
- What: `status="streaming"` + `onStop`: type text, press Enter → `querySelector` finds no submit
  button → `submitButton?.disabled` is `undefined` → `form.requestSubmit()` → `onSubmit` fires,
  the textarea is cleared, `onStop` is not called. The only visible control is Stop. The chat block
  forwards this straight to `useChat().sendMessage`, which has no in-flight guard
  (`node_modules/ai/dist/index.js:22276-22300`), so a second request is started mid-stream.
- Evidence: test "[BUG] Enter while streaming does not submit a new message behind the Stop
  button" → `expected "vi.fn()" to not be called at all, but actually been called 1 times`.
- Why it matters: user-visible: a message disappears into an in-flight stream; contradicts the
  Stop affordance.
- Proposed fix: in `handleKeyDown`, `if (!submitButton || submitButton.disabled) return` (the
  composer always renders `PromptInputSubmit`), or mark the button with `data-status` and bail when
  generating.
- Test written: as above (expected: FAIL now).

### F4. `accept` extension patterns (`.pdf`, `.md`) and `*/*` never match; the native dialog offers the file and the component rejects it — severity: medium (inherited)

- Where: `registry/ai/prompt-input.tsx:557-578` (`matchesAccept` handles only `type/*` prefixes and
  exact MIME equality; the same `accept` string is put on the `<input accept>` at 908).
- What: `accept=".pdf"`, choose `doc.pdf` (`application/pdf`) → `onError({ code: "accept" })`, count
  stays 0. `accept="*/*"` rejects everything. Files whose `type` is `""` (common for `.md`, `.csv`,
  `.ts` on several OSes) are rejected by any `accept`.
- Evidence: test "[BUG] accept with an extension pattern rejects the file the native dialog
  offered" → `expected "vi.fn()" to not be called at all, but actually been called 1 times`.
- Why it matters: `accept=".pdf,.docx"` is the most common way consumers write the prop; the file
  picker shows the file, the composer refuses it.
- Proposed fix: match `.ext` patterns against `file.name.toLowerCase()`, treat `*/*` as
  match-all; document that empty-`type` files match only extension patterns.
- Test written: as above (expected: FAIL now).

### F5. Files that fail `maxFileSize`/`accept` are silently dropped when *some* files pass — severity: medium (inherited)

- Where: `registry/ai/prompt-input.tsx:583-600` (local) and `:647-664` (provider path): `onError`
  fires only when `accepted.length === 0` / `sized.length === 0`.
- What: `maxFileSize={10}`, choose `[5-byte, 50-byte]` → one attachment appears, `onError` never
  called. Same for `accept="image/*"` with `[png, txt]`.
- Evidence: test "[BUG] silently drops one of several files that fails maxFileSize without
  onError" → `expected "vi.fn()" to be called with arguments: [ { code: 'max_file_size', … } ]`
  (not called).
- Why it matters: data loss from the user's point of view (they dropped two files, one vanished,
  nothing said why). `max_files` *does* report partial truncation ("Some were not added"), so the
  inconsistency is surprising.
- Proposed fix: `if (sized.length < accepted.length) onError({ code: "max_file_size", … })` and the
  same for `accept`.
- Test written: as above (expected: FAIL now).

### F6. Uncontrolled textarea text is lost when `onSubmit` throws or rejects (attachments are kept) — severity: medium (inherited)

- Where: `registry/ai/prompt-input.tsx:855-859` (`form.reset()` before `onSubmit`) and `:887-899`
  (catch blocks comment "Don't clear on error - user may want to retry", but only attachments and
  sources survive).
- What: type "please retry me", `onSubmit` rejects → textarea is `""`; attachments and referenced
  sources remain. With `PromptInputProvider` the text *is* preserved (pinned by a passing test), so
  the two modes disagree.
- Evidence: test "[BUG] keeps the typed text when onSubmit rejects (uncontrolled textarea)" →
  `expected '' to be 'please retry me'`; "keeps the provider text when onSubmit rejects …" passes.
- Why it matters: a failed network call eats the user's message; upstream's own #126 tests only
  guard attachments.
- Proposed fix: after a failed submit, if `textarea.value === ""` (user has not typed since),
  restore the captured `text`; this preserves the #125 no-race behaviour.
- Test written: as above (expected: FAIL now).

### F7. No `keyCode === 229` guard: Safari's post-composition Enter submits — severity: medium (inherited; Safari trigger not verified here)

- Where: `registry/ai/prompt-input.tsx:975` (`isComposing || e.nativeEvent.isComposing` only).
- What: a `keydown` with `key: "Enter"`, `isComposing: false`, `keyCode: 229` submits. Safari
  fires `compositionend` *before* the confirming Enter `keydown`, so both the state flag and
  `nativeEvent.isComposing` are already false and only `keyCode 229` identifies it (the standard
  mitigation in chat UIs). I could only dispatch the event shape in Chromium; I could not run Safari.
- Evidence: test "[BUG] Enter with keyCode 229 (Safari fires this after compositionend) does not
  submit" → `expected "vi.fn()" to not be called at all, but actually been called 1 times`.
- Why it matters: CJK users on Safari submit half-composed text.
- Proposed fix: add `|| e.nativeEvent.keyCode === 229` to the guard.
- Test written: as above (expected: FAIL now; Safari behaviour unverified).

### F8. `onError` and `URL.createObjectURL` run inside the `setItems` updater: duplicate errors and leaked object URLs under StrictMode — severity: low (dev-only; inherited)

- Where: `registry/ai/prompt-input.tsx:602-626` (local) and `:265-274` (provider `add`).
- What: React double-invokes state updaters in StrictMode (Next 16 app router has it on by
  default: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactStrictMode.md`
  "Strict Mode is `true` by default with `app` router"). `maxFiles={1}`, add 2 files → `onError`
  called twice (two toasts); add 1 file → `createObjectURL` called twice and the discarded URL is
  never revoked.
- Evidence: tests "[BUG] under StrictMode a single over-limit add reports max_files once" →
  `expected "vi.fn()" to be called 1 times, but got 2 times`; "[BUG] under StrictMode one object URL
  is created per added file" → `expected "createObjectURL" to be called 1 times, but got 2 times`.
- Why it matters: every consumer's `next dev` shows doubled error toasts and leaks a blob per
  attachment; production is unaffected.
- Proposed fix: compute `capped`/URLs and call `onError` outside the updater (track the count in
  a ref), then `setItems(prev => [...prev, ...next])`.
- Test written: as above (expected: FAIL now).

### F9. `PromptInputButton` tooltips open after ~670 ms; upstream opens them instantly — severity: low (port-specific)

- Where: `registry/ai/prompt-input.tsx:1153-1155` (`<Tooltip><TooltipTrigger render={button} />`);
  `components/ui/tooltip.tsx:19-25` (base-nova `Tooltip` does not wrap a `TooltipProvider`);
  `node_modules/@base-ui/react/tooltip/trigger/TooltipTrigger.d.ts` (`delay` default 600).
  Upstream shadcn Radix wrapper wraps every `Tooltip` in `<TooltipProvider delayDuration={0}>`
  (`scratchpad/upstream/ai-elements/packages/shadcn-ui/components/ui/tooltip.tsx:9,25`).
- Evidence: test "[BUG] button tooltip opens promptly like upstream (delayDuration 0), not after
  Base UI's 600 ms" → `tooltip took 671ms to open: expected 671 to be less than 300`.
- Why it matters: UX regression vs upstream on every toolbar button with a `tooltip` prop.
- Proposed fix: `<TooltipTrigger delay={0} render={button} />` (or document that consumers must
  mount a `TooltipProvider`).
- Test written: as above (expected: FAIL now).

### F10. Dead `e.preventDefault()` and stale comment in `PromptInputActionAddAttachments`; AddScreenshot `preventDefault` no longer keeps the menu open — severity: low

- Where: `registry/ai/prompt-input.tsx:423-434`, `:453-458`; `registry.json` `docs` (1).
- What: Base UI closes a menu item only via `closeOnClick`
  (`node_modules/@base-ui/react/menu/item/useMenuItemCommonProps.js:53-60`); `e.preventDefault()`
  in the item's `onClick` is a no-op, yet the handler still calls it and the comment above says
  "Base UI's equivalent is `closeOnClick`". For `PromptInputActionAddScreenshot`, a consumer
  `event.preventDefault()` skips the capture (docs claim holds; test "skips capture when the
  consumer onClick prevents default …" passes) but the menu now closes, whereas Radix `onSelect`
  `preventDefault` also kept it open. Not documented.
- Proposed fix: remove the call; add "the menu still closes; pass `closeOnClick={false}` to keep
  it open" to `docs` (1).
- Test written: none (documentation).

### F11. `syncHiddenInput` is a dead prop with a misleading type comment — severity: low (inherited)

- Where: `registry/ai/prompt-input.tsx:500-501` ("Render a hidden input with given name and keep it
  in sync for native form posts") vs `:723-729` ("no longer functional"; the effect only blanks the
  input when there are no files). The hidden `<input type="file">` (907-916) has no `name` and sits
  *outside* the `<form>`, so it never takes part in a native post.
- Why it matters: consumers reading the prop type will expect native form posts to carry files.
- Proposed fix: mention in `docs`, or drop the prop from the port.
- Test written: none.

### F12. `PromptInputActionAddScreenshot` rethrows non-DOMException failures from an async click handler — severity: low (inherited)

- Where: `registry/ai/prompt-input.tsx:465-473`.
- What: `getDisplayMedia` rejecting with anything other than `NotAllowedError`/`AbortError`
  (e.g. `NotSupportedError`, `TypeError` in insecure contexts, or the "Failed to load screen
  stream" `Error` from 123) is rethrown inside `async handleClick` → unhandled promise rejection;
  there is no `onError` channel. Not reproduced as a test because vitest fails the test on any
  unhandled rejection.
- Proposed fix: swallow all `DOMException`s and route others to `PromptInput`'s `onError` (new
  code) or `console.error`.

### F13. Existing suite is blind to two behaviours it appears to cover — severity: low (tests)

- Where: `tests/browser/ai/prompt-input.test.tsx:104-116` ("submits … and clears the textarea") and
  `:149-161` ("shows a stop button while streaming").
- What (mutation check, scratch config that aliases the component import to a mutant copy):
  - Mutant A (both post-submit `clear()` calls removed, `form.reset()` kept): **5/5 existing tests
    pass**. The "clears the textarea" assertion is satisfied by the synchronous `form.reset()`
    before `onSubmit`; nothing checks that attachments/sources clear after success or survive
    failure.
  - Mutant B (`PromptInputSubmit` always `type="submit"`, no `preventDefault`): **5/5 pass**. The
    stop test never asserts `onSubmit` was not called (its `onSubmit` is `() => {}`).
  - Mutant C (`onSubmit` invoked twice): 2/5 fail — caught by `toHaveBeenCalledTimes(1)`.
  - Also: `settleAnimations()` there awaits every animation including infinite ones; a fixture with
    `status="submitted"` (Spinner `animate-spin`) would hang to the 15 s timeout. The chat block
    test already filters `iterations !== Infinity`.
- Test written: the new file pins both (`"keeps attachments and referenced sources when onSubmit
  throws or rejects, clears them when it resolves"`, `"renders Stop as type=button while generating
  so clicking it never submits; error shows Submit"`), both PASS today.

### F14. Textarea's only accessible name is its placeholder — severity: nit (inherited)

- Where: `registry/ai/prompt-input.tsx:1053-1064` (no `aria-label`, no label association). axe's
  `label` rule accepts `non-empty-placeholder`, so the suites are green, but the name disappears
  from the visible UI once the user types and is weak under WCAG 1.3.1/2.5.3.
- Proposed fix: default `aria-label="Message"` overridable by props.
- Test written: "names the textarea only through its placeholder (no label / aria-label)" (PASS,
  pins the current state).

### F15. `status="error"` announces "Submit" over an X icon; Spinner nests a second live role inside the Stop button — severity: nit (inherited)

- Where: `registry/ai/prompt-input.tsx:1236-1237, 1254`; `components/ui/spinner.tsx:8-9`
  (`role="status" aria-label="Loading"` inside a button labelled "Stop"). Both from upstream; axe
  passes (pinned by "passes axe with attachments listed, with the select open, and in
  submitted/error status").

## Coverage gaps (behaviours with no test today; no bug found, but untested)

Legend: **[new]** = now covered by `tests/browser/qa-round1/prompt-input.test.tsx` or
`tests/unit/qa-round1-prompt-input.test.ts` (passing); everything else still has no test.

- `PromptInput` › `onSubmit` message shape: files are `FileUIPart` with data URLs and no `id` — **[new]**
- `PromptInput` › `onSubmit` receives the `FormEvent` as second argument — untested — assert `calls[0][1].type === "submit"`
- `PromptInput` › blob→data URL conversion failure keeps the blob URL (`convertBlobUrlToDataUrl` returns null) — untested — stub `fetch` to reject
- `PromptInput` › `onSubmit` sync return clears attachments; throw/reject keeps them; resolve clears — **[new]**
- `PromptInput` › referenced sources (`usePromptInputReferencedSources` add/remove/clear, cleared after success, kept on failure) — **[new]** (add/clear-after-submit); `remove(id)` and `add(array)` still untested
- `PromptInput` › empty/whitespace submits are not gated; rapid double Enter sends an empty second message — **[new]**
- `PromptInput` › `maxFiles` exact fit / one over / partial truncation and the `max_files` error — **[new]**
- `PromptInput` › `maxFiles={0}` rejects everything; `maxFileSize={0}` means "no limit" (falsy) — untested — boundary pins
- `PromptInput` › `maxFileSize` inclusive limit; zero-byte file accepted — **[new]**
- `PromptInput` › `accept` wildcard, exact MIME, comma list with whitespace, empty-type file — **[new]**; `accept=" "` (whitespace only → all files) and duplicate patterns — untested
- `PromptInput` › duplicate files (same name/size) are added twice — untested — pin or decide
- `PromptInput` › `globalDrop` document drop / form drop / dragover `preventDefault` — **[new]** (drop); `dragover` default prevented only when `types` includes "Files" — untested
- `PromptInput` › drop with non-file `dataTransfer` (text) is ignored — untested
- `PromptInput` › `syncHiddenInput` clears the input value when files become empty — untested (dead prop, see F11)
- `PromptInput` › hidden input attributes (`accept`, `multiple`, `aria-label`, value reset after change) — **[new]** (accept/multiple/value)
- `PromptInput` › `className`/rest props land on the `<form>`; `PromptInputBody` renders `contents` — untested
- `PromptInput` › removing a file while a submit's blob conversion is in flight — untested — fetch of a revoked blob URL returns null → blob URL forwarded (see F12-adjacent)
- `PromptInput` › unmount revokes pending object URLs (local mode) — **[new]**; provider mode unmount cleanup — untested
- `PromptInput` › adding files while a submit is in flight (captured `files` closure) — untested
- `PromptInput` › SSR `renderToString` works and `"use client"` header present — **[new]** (unit)
- `PromptInputProvider` › `initialInput` seeds the textarea; text kept on rejection, cleared on resolve — **[new]**
- `PromptInputProvider` › `textInput.setInput`/`clear` from outside the composer update the textarea — untested
- `PromptInputProvider` › validation only applies through `PromptInput`; provider `add` bypasses `maxFiles`/`accept` — **[new]** (pinned as documented gap)
- `PromptInputProvider` › `openFileDialog` from outside clicks the registered hidden input — **[new]**
- `PromptInputProvider` › `remove`/`clear` revoke URLs; `fileInputRef` points at the input — untested
- `PromptInputProvider` › two `PromptInput`s under one provider (last registration wins) — untested
- `usePromptInputController` / `useProviderAttachments` › throw outside provider — **[new]** (controller); `useProviderAttachments` throw — untested
- `usePromptInputAttachments` › throws outside both contexts; prefers local over provider — untested
- `PromptInputTextarea` › Enter submits, Shift+Enter newline — existing
- `PromptInputTextarea` › IME: `nativeEvent.isComposing`, `compositionstart`/`end` state — **[new]**
- `PromptInputTextarea` › consumer `onKeyDown` veto via `preventDefault` — **[new]**; consumer `onKeyDown` still called on every key — untested
- `PromptInputTextarea` › Backspace on empty textarea removes last attachment; with text does not — **[new]**
- `PromptInputTextarea` › paste with files adds them and prevents default; text paste untouched — **[new]**; paste with files *and* text (text is dropped) — untested
- `PromptInputTextarea` › disabled submit button blocks Enter (`submitButton.disabled`) — untested
- `PromptInputTextarea` › `defaultValue` is restored (not cleared) after submit — **[new]**
- `PromptInputTextarea` › consumer-controlled `value`/`onChange` without provider — **[new]**
- `PromptInputTextarea` › provider mode: consumer `onChange` still called; consumer `value` overridden — untested
- `PromptInputTextarea` › `placeholder` override, `className` merge, `name="message"` — **[new]** (name via submit); placeholder override untested
- `PromptInputSubmit` › `type` switches to `button` only with `onStop` and generating; click calls `onStop` and not `onSubmit`; error/submitted icons — **[new]**
- `PromptInputSubmit` › `onClick` passthrough when not generating; `aria-label` override via props; custom children replace the icon; `variant`/`size` defaults — untested
- `PromptInputButton` › tooltip string vs object, shortcut rendering, size from child count — **[new]**; `tooltip.side` forwarded to the positioner — untested
- `PromptInputButton` › `type="button"` (does not submit the form) — untested
- `PromptInputActionMenu*` › trigger `aria-haspopup`/`aria-expanded`, Escape closes, keyboard activation, `closeOnClick` override, custom item `onClick` — **[new]**; `PromptInputActionMenuContent` `align="start"` default — untested; custom trigger children replace the Plus icon — untested; trigger `className` merge — untested
- `PromptInputActionAddAttachments` › clicks the hidden input and keeps the menu open — **[new]**; custom `label` — untested
- `PromptInputActionAddScreenshot` › capture path, name pattern, tracks stopped, video released, denied permission, `preventDefault` opt-out, unsupported browser — **[new]**; `AbortError`, zero-size video (`videoWidth === 0` → null), `toBlob` returning null, non-DOMException rethrow (F12) — untested
- `PromptInputSelect*` › `onValueChange(value, details)`, `SelectValue` label via `items`, value survives `form.reset()` — **[new]**; `SelectValue` without `items` renders the raw value (docs claim 4) — untested; controlled `value` + `null` — untested; `PromptInputSelectTrigger` `aria-expanded` styling — untested
- `PromptInputHoverCard*` › opens on hover with delays 0; axe — **[new]**; non-zero `openDelay`/`closeDelay` actually delay; trigger `delay` prop overrides context; `align="start"` default — untested
- `PromptInputCommand*` › filter + empty state — **[new]**; `PromptInputCommandSeparator`, `CommandGroup` heading, item `onSelect` — untested
- `PromptInputTab*` › heading + items — **[new]**; `className` merges — untested
- `PromptInputHeader`/`PromptInputFooter`/`PromptInputTools` › `align="block-end"` forced, `order-first` on header, `className` merge — untested; footer/header click focus behaviour — **[new]** (F1, failing)
- Accessibility › axe with attachments, select open, submitted, error — **[new]**; axe with the hover card open — **[new]**; axe with the command palette open inside a hover card — untested
- Registry entry › every `registryDependencies` name is actually imported by the file and nothing imported is missing (`command`, `dropdown-menu`, `hover-card`, `input-group`, `select`, `spinner`, `tooltip`) — untested (could be a unit test over the source)

## Verified OK (claims you checked that hold; one line each, so the fixer does not re-check)

- Export surface is identical to upstream (all 36 value exports and every `*Props` type; `diff` of `^export` lines is empty). Upstream at commit 6a9d5b1 has no `PromptInputSpeechButton`, so nothing is missing there.
- Non-Base-UI logic is byte-for-byte upstream (diff shows only semicolons/import order plus the seven Base UI touch points), so every inherited finding above is also present upstream.
- `docs` (1): `PromptInputActionAddScreenshot` `onClick` + `preventDefault` skips capture — test passes.
- `docs` (2): `PromptInputActionMenuItem onClick` fires and closes the menu; `closeOnClick={false}` default on AddAttachments keeps it open and `closeOnClick` prop overrides (prop order `closeOnClick={false} {...props}` is correct) — tests pass. The `onClick`-dropped part is F2.
- `docs` (3): Base UI PreviewCard delays live on `Trigger` (`delay` default 600, `closeDelay` 300; `PreviewCardTrigger.d.ts`), `PromptInputHoverCard` forwards `openDelay`/`closeDelay` (default 0) via context and the trigger opens immediately on hover — test passes.
- `docs` (4): `Select.Root` `onValueChange` is `(value | null, eventDetails)` (`SelectRoot.d.ts`), `items` makes `Select.Value` render the label — test asserts `("gpt-5", { reason })` and the label.
- `docs` (5): Base UI handlers are typed `WithBaseUIEvent<…>` (`internals/types.d.ts:16-21`), i.e. `React.MouseEvent & { preventBaseUIHandler }` — claim holds.
- No Radix leftovers: no `asChild`, `onSelect`, `data-[state=`, `group-data-[state` in the file; `render` used for `TooltipTrigger` and `DropdownMenuTrigger`; `side`/`align` are forwarded by the base-nova wrappers to the positioners (`tooltip.tsx:41-48`, `dropdown-menu.tsx:33-40`, `hover-card.tsx:30-36`, `select.tsx:73-81`).
- `form.reset()` on submit does not reset the Base UI Select (no `reset` listener in `@base-ui/react/select`; React syncs `defaultValue` for controlled inputs) — test "select … survives submit" passes.
- `PromptInputActionMenuTrigger` with a `tooltip` still opens the menu (nested `render` composition works) — test passes.
- Menu trigger exposes `aria-haspopup="menu"`/`aria-expanded`; Escape closes and (absent a select) returns focus to the trigger; ArrowDown+Enter activates items.
- `PromptInputSelect: typeof Select` keeps the generic so `onValueChange` is typed (`tsc` clean on tests that use it).
- Screenshot capture stops tracks, pauses the video and nulls `srcObject` in `finally`; file is `screenshot-YYYY-MM-DD_HH-MM-SS-mmm.png`, `image/png`; `NotAllowedError` is swallowed; unsupported `getDisplayMedia` returns null without throwing.
- Object URLs are revoked on `remove`, `clear`, and unmount (local mode) — tests pass. Data URLs (not blob URLs) reach `onSubmit`; `id` is stripped.
- Paste with files calls `preventDefault` and adds them; text paste is untouched. Form drop adds; document drop is ignored without `globalDrop`.
- SSR: `"use client"` is line 3 (after the two-line port header); `renderToString` in node succeeds with the full composition; no module-scope `window`/`document`/`navigator` access (`navigator` is guarded in `captureScreenshot`, `document` only in handlers/effects, `nanoid` only in handlers/updaters).
- `ai@7` types used (`ChatStatus`, `FileUIPart`, `SourceDocumentUIPart`) match `node_modules/ai/dist/index.d.ts:2060-2100, 5724`.
- Registry: `/r/prompt-input.json` is served (200), `files[0].content` equals the source file byte-for-byte, `target` is `components/ai/prompt-input.tsx`, deps pinned (`ai@^7`, `nanoid@^6`).
- `/preview/prompt-input` renders (200) with the expected `aria-label`s (Add attachment ×2, Model ×2, Stop, Submit, Upload files ×2, Voice input).
- axe: zero violations with attachments listed, with the select open (region rule off), in `submitted` with spinner, in `error`, and with the hover card open.

## Could not reach

- Safari IME behaviour for F7: only Chromium is available; the test dispatches the event shape Safari is known to produce (`keyCode 229`, `isComposing false`), the real trigger is unverified.
- Real native file chooser and real `getDisplayMedia`: headless Chromium; the hidden input `.click()` is spied and screen capture is mocked exactly as upstream's own test does.
- `registry/ai/upstream.lock.json` sha256 for `prompt-input` (`9402979f…`) does not match the sha256 of the cloned upstream source file (`cf43baf5…`); the lock hashes the registry JSON `files[0].content` (rewritten imports), and `elements.ai-sdk.dev` is blocked, so provenance could not be confirmed.
- `pnpm dlx shadcn add @uifiles/prompt-input` round trip: bare upstream `registryDependencies` cannot resolve here (ui.shadcn.com blocked).
- Hydration warnings on `/preview/prompt-input` in a real browser session: only the SSR HTML was fetched; no console capture of the hydrated page.
- F12 (unhandled rejection from `AddScreenshot`) has no test: vitest fails any test with an unhandled rejection, so a reproducer would be indistinguishable from a harness error.

## Commands run (for the fixer to reproduce)

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>

# Reproducers + pins (12 [BUG] tests fail, 33 pass)
pnpm exec vitest run --project browser --reporter=verbose tests/browser/qa-round1/prompt-input.test.tsx
# SSR pins (2 pass)
pnpm exec vitest run --project unit tests/unit/qa-round1-prompt-input.test.ts
# Hygiene on the new files
pnpm exec tsc --noEmit | grep qa-round1        # empty
pnpm exec biome check tests/browser/qa-round1/prompt-input.test.tsx tests/unit/qa-round1-prompt-input.test.ts   # 4 warnings (non-null assertions), 0 errors
pnpm exec prettier --check tests/browser/qa-round1/prompt-input.test.tsx tests/unit/qa-round1-prompt-input.test.ts

# Mutation check of the existing suite (scratch config aliases the component import to a mutant copy)
S=/docs/qa/round1/prompt-input
MUTANT=pi-no-clear.tsx      pnpm exec vitest run --config $S/mutants/vitest.mutants.config.ts   # 5 passed (mutant survives)
MUTANT=pi-stop-submits.tsx  pnpm exec vitest run --config $S/mutants/vitest.mutants.config.ts   # 5 passed (mutant survives)
MUTANT=pi-double-submit.tsx pnpm exec vitest run --config $S/mutants/vitest.mutants.config.ts   # 2 failed (caught)

# Static checks quoted above
diff <(grep -oE "^export (const|type|interface) [A-Za-z_]+" $S/../../../upstream/ai-elements/packages/elements/src/prompt-input.tsx | awk '{print $3}' | sort) \
     <(grep -oE "^export (const|type|interface) [A-Za-z_]+" registry/ai/prompt-input.tsx | awk '{print $3}' | sort)   # empty
diff -u $S/../../../upstream/ai-elements/packages/elements/src/prompt-input.tsx registry/ai/prompt-input.tsx
grep -nE "data-\[state|asChild|onSelect" registry/ai/prompt-input.tsx   # only comments
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/preview/prompt-input
curl -s http://localhost:3000/r/prompt-input.json | node -e '…files[0].content === fs.readFileSync("registry/ai/prompt-input.tsx","utf8")'   # true
```

### Final verbose run (`tests/browser/qa-round1/prompt-input.test.tsx`)

```
 ✓ prompt-input attachments > submits chosen files as data URLs without the internal id and clears them
 ✓ prompt-input attachments > enforces maxFiles at the boundary and truncates a partial overflow
 ✓ prompt-input attachments > truncates to the remaining capacity when more files arrive than slots
 ✓ prompt-input attachments > enforces maxFileSize inclusively and accepts zero-byte files
 ✓ prompt-input attachments > rejects files that do not match accept, including files with no type
 × prompt-input attachments > [BUG] accept with an extension pattern rejects the file the native dialog offered
 × prompt-input attachments > [BUG] silently drops one of several files that fails maxFileSize without onError
 ✓ prompt-input attachments > adds files pasted from the clipboard and swallows the paste; text-only paste is untouched
 ✓ prompt-input attachments > accepts drops on the form and ignores document drops unless globalDrop is set
 ✓ prompt-input attachments > Backspace in an empty textarea removes the last attachment; remove and clear revoke object URLs
 ✓ prompt-input attachments > revokes pending object URLs on unmount
 × prompt-input attachments > [BUG] under StrictMode a single over-limit add reports max_files once
 × prompt-input attachments > [BUG] under StrictMode one object URL is created per added file
 ✓ prompt-input attachments > validates through PromptInput when a provider is present, and openFileDialog reaches the hidden input
 ✓ prompt-input submit > does not gate empty or whitespace text; a second Enter sends an empty message
 ✓ prompt-input submit > keeps attachments and referenced sources when onSubmit throws or rejects, clears them when it resolves
 × prompt-input submit > [BUG] keeps the typed text when onSubmit rejects (uncontrolled textarea)
 ✓ prompt-input submit > keeps the provider text when onSubmit rejects and clears it when it resolves
 ✓ prompt-input submit > does not submit during IME composition and submits once composition ends
 × prompt-input submit > [BUG] Enter with keyCode 229 (Safari fires this after compositionend) does not submit
 × prompt-input submit > [BUG] Enter while streaming does not submit a new message behind the Stop button
 ✓ prompt-input submit > renders Stop as type=button while generating so clicking it never submits; error shows Submit
 ✓ prompt-input submit > lets a consumer onKeyDown that prevents default veto Enter submission
 ✓ prompt-input submit > resets a defaultValue textarea to its default (not empty) after submit
 ✓ prompt-input submit > leaves a consumer-controlled textarea (no provider) under consumer control after submit
 ✓ prompt-input submit > throws a helpful error when usePromptInputController is used without a provider
 ✓ prompt-input action menu > opens the file dialog from 'Add photos or files' and keeps the menu open; closeOnClick can override
 × prompt-input action menu > [BUG] a consumer onClick on PromptInputActionAddAttachments is invoked (docs say to use onClick)
 ✓ prompt-input action menu > activates items from the keyboard
 ✓ prompt-input action menu > runs PromptInputActionMenuItem onClick and closes the menu
 ✓ prompt-input action menu > still opens the menu when the trigger also has a tooltip
 ✓ prompt-input action menu > returns focus to the menu trigger after activating an item when the footer has no select
 × prompt-input action menu > [BUG] returns focus to the menu trigger after a mouse activation when the footer has a model select
 × prompt-input action menu > [BUG] returns focus to the menu trigger after a keyboard activation when the footer has a model select
 ✓ prompt-input screenshot > captures a PNG named screenshot-*.png, stops the tracks and releases the video
 ✓ prompt-input screenshot > skips capture when the consumer onClick prevents default, swallows a denied permission, and no-ops when unsupported
 ✓ prompt-input tools > select: picking an item reports (value, details), renders the label, and survives submit
 × prompt-input tools > [BUG] clicking the footer whitespace does not move focus to the model select
 ✓ prompt-input tools > button tooltip shows content and shortcut on hover; size follows child count
 × prompt-input tools > [BUG] button tooltip opens promptly like upstream (delayDuration 0), not after Base UI's 600 ms
 ✓ prompt-input tools > hover card forwards openDelay/closeDelay to the trigger and opens on hover
 ✓ prompt-input tools > command filters items and shows the empty state
 ✓ prompt-input tools > tab components render a heading label and items
 ✓ prompt-input accessibility > passes axe with attachments listed, with the select open, and in submitted/error status
 ✓ prompt-input accessibility > names the textarea only through its placeholder (no label / aria-label)

 Test Files  1 failed (1)
      Tests  12 failed | 33 passed (45)
   Duration  11.56s

Assertion each [BUG] test fails on:
  accept extension     → expected "vi.fn()" to not be called at all, but actually been called 1 times
  silent partial drop  → expected "vi.fn()" to be called with arguments: [ { code: 'max_file_size', … } ]
  StrictMode onError   → expected "vi.fn()" to be called 1 times, but got 2 times
  StrictMode objectURL → expected "createObjectURL" to be called 1 times, but got 2 times
  text lost on reject  → expected '' to be 'please retry me'
  keyCode 229          → expected "vi.fn()" to not be called at all, but actually been called 1 times
  Enter while streaming→ expected "vi.fn()" to not be called at all, but actually been called 1 times
  AddAttachments onClick → expected "vi.fn()" to be called 1 times, but got 0 times
  focus (mouse)        → expected 'Model' to be 'Add attachment'
  focus (keyboard)     → expected 'Model' to be 'Add attachment'
  footer whitespace    → expected <button …> not to be <button …>   (activeElement is the Model combobox)
  tooltip delay        → tooltip took 671ms to open: expected 671 to be less than 300
```

### Unit run (`tests/unit/qa-round1-prompt-input.test.ts`)

```
 ✓ prompt-input SSR > starts with the port header and the use client directive
 ✓ prompt-input SSR > renders the composer to a string without touching browser globals
 Test Files  1 passed (1)   Tests  2 passed (2)
```
