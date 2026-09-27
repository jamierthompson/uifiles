# components-a — QA round 3

Scratch: `/docs/qa/round3/components-a/`
(`runs/` three consecutive runs of the six canonical files + `summary.txt`; `repro-run{1,2,3,4}.log`; `mut/` harness, `results.txt`,
per-mutation `logs/*.log` and `logs/*.diff`, `backup/`; `pages/probe.mjs` + `probe.json` (six previews × 2 contexts, axe, console,
network, interactions) and `pages/probe2.mjs` + `probe2.json` (citation keyboard/mouse flow, page titles) against the production server).
Reproducers: `tests/browser/qa-round3/components-a.test.tsx` (19 tests: 8 fail on the defects below, 11 pass as pins; identical set in
three runs).

## Summary

Attacked `registry/ai/{prompt-input,code-block,context,model-selector,inline-citation}.tsx`, `registry/blocks/chat/**`, their six
test files, their previews and their six registry entries after the round-2 fixes. Verified every round-2 finding in scope against the
code and the running production build (all six previews: 0 console output, 0 page errors, 0 external requests, 0 axe violations at
1280 light and 375 dark, no horizontal overflow), ran the six canonical files three times each (all green, stable), tried to re-break
each fix along the lines in the brief, ran 19 mutations against the fixers' tests, and read every sentence of the six `docs`/`description`
strings against the code.

Findings: **1 high, 2 medium, 3 low, 2 nits**, plus four test-quality items. Every round-2 fix in scope is really in place and the
new tests are load-bearing (all 19 mutations caught). **The single worst thing is new and sits in the round-2 inline-citation fix: on the
shipped preview (two sources) a keyboard user who pins the card and presses Enter on "Next" lands on the last slide, which sets
`disabled` on the button that has focus; Chromium drops focus to `<body>`, so Escape closes the card without returning focus and the next
Tab restarts from the top of the page** (reproduced on the production `/preview/inline-citation` and in Vitest; the fixer's test used
three sources and never reached the end). The other new items are contained: the pinned card exposes no ARIA relationship, the
provider-mode `maxFiles` counter only ever grows within a handler, a second submit during an attachment's blob conversion carries the
attachment twice, and `ChatComposer` drops a rejected `onSubmit` on the floor.

Verdict: **not yet** — one small fix (F1) blocks; see `## Verdict`.

## Fix verification

Evidence columns cite the current tree (`9857827`), the three-run logs in `runs/`, `pages/probe.json` / `probe2.json` (production
server, both stylesheets 200, `<title>` per page) and the mutation log below.

| round-2 finding | claimed fix | verified? | evidence |
| --- | --- | --- | --- |
| prompt-input-chat F1 / rendered-surface N2 (high): sent attachments linger, mid-stream attachment wiped | `void onSubmit(message)` in `ChatComposer`; `void sendMessage` in both pages; per-submit id snapshot in prompt-input | **yes** | `chat.tsx:697-701`; `registry/blocks/chat/page.tsx:22-25`; `app/preview/chat/page.tsx:41-44`; `prompt-input.tsx:905-916` (`submittedFileIds`, `removeAttachments`). Production `/preview/chat` (`probe.json` › `chat.chatMid`): after Enter with `notes.txt`, `composerChips: 0, transcriptChips: 1, removeButtons: 0` while Stop is shown; a file attached mid-stream is still listed after the answer (`chatAfter.composerChips: 1`). Tests › "clears sent files … not when the answer ends", › "keeps a file attached while the previous answer streams" pass 3/3; mutations m06, m10 caught. Residual: F4 below (the snapshot is not exclusive). |
| prompt-input-chat F2 (medium): addon click steals focus from non-button controls | `INTERACTIVE_SELECTOR` (`prompt-input.tsx:1163-1184`, used at `:1204`) | **yes** | Tests › "leaves focus on a role=switch control / a plain tabindex=0 element inside the footer" pass; my pin › "leaves focus with a label's control and with a role=button inside a label in the footer" passes (a `<label htmlFor>` hands focus to its checkbox, a `[role=button]` inside a `<label>` keeps it); mutation m03 (old six-entry list) caught. |
| prompt-input-chat F3 (medium): programmatic submit while generating wipes the draft | `ChatComposer.handleSubmit` returns `false` (`chat.tsx:697`); `onSubmit` may return `false` (`prompt-input.tsx:539-543, 953-958`) | **yes** | Production: `form.requestSubmit()` while streaming with a draft and `later.txt` attached → `draft: "queued draft", composerChips: 1, stopVisible: true` and both still there after the answer (`probe.json` › `chat.chatRejected/chatAfter`). Tests › "keeps the draft and the attachments when a programmatic form submit is rejected while generating", › "keeps the draft, attachments and sources when a sync / an async onSubmit returns false" pass; my pin › "keeps the provider text and the attachments when onSubmit returns false" passes; mutations m01, m07 caught. |
| prompt-input-chat F4 (low): provider mode, two `add()` calls bypass `maxFiles` | `providerCountRef` advanced per `add()` (`prompt-input.tsx:588-592, 711-720`) | **partial** | Fixed for `add(); add()` (test passes 3/3, mutation m02 caught). Not for `remove(); add()` or `clear(); add()` in one handler: the counter is never decreased, so the freed slot is refused (F3 below, two failing reproducers). Local mode is right on every path (`:695, :706, :728`). |
| prompt-input-chat F5 (low): rejecting `onRetry` is an unhandled rejection | `Promise.resolve().then(onRetry).catch(console.error)` (`chat.tsx:633-638`) | **yes** (first half) | Test › "reports a rejected onRetry through console.error instead of an unhandled rejection" passes; mutation m09 caught. Second half (hide Retry on an empty transcript) declined by design and documented in `docs`. Note the asymmetry with `onSubmit` (F5 below). |
| prompt-input-chat F6 (low): `restoreText` writes into a controlled textarea | `TextareaControlContext` ref set by `PromptInputTextarea` (`prompt-input.tsx:395, 1038-1044, 923`) | **yes** | Test › "leaves a controlled textarea to its owner after a rejected submit…" passes; mutation m04 caught. The flag is an effect-synced ref; a controlled→uncontrolled switch mid-submit is a React-warned pattern and not pursued. |
| prompt-input-chat F7 (low): tooltip description repeats visible text; `tooltip=""` dangling id | `repeatsName` via `textOf(children)`; `hasTooltip = Boolean(content)` (`:1306-1319, 1332`) | **yes** | Tests › "does not describe a button whose tooltip repeats its visible text", › "treats an empty tooltip as none…" pass; production `/preview/prompt-input`: "Voice input" (tooltip = label) has no `aria-describedby`, "Search" is described by "Search the web" (`probe.json` › `promptInput.described`); mutation m05 caught. Residual: the `shortcut` goes with the dropped description (F6 below). |
| prompt-input-chat F8 (docs): default `aria-label` outranks a visible label | docs (11) says `aria-label={undefined}` | **yes** | `registry/ai/registry.json` prompt-input docs (11) matches `prompt-input.tsx:1147`. |
| prompt-input-chat F9 (design): `status: "error"` without `error` vanished | row for `error \|\| status === "error"`, generic text (`chat.tsx:222-224, 647`) | **yes** | Test › "shows a generic error row with Retry when status is error and no error object is given" passes; mutation m08 caught. |
| prompt-input-chat F10 (nit): description overstated Stop | "…turns into a stop button while submitted or streaming when onStop is provided" | **yes** | `registry/ai/registry.json` prompt-input description; `prompt-input.tsx:1450`. |
| prompt-input-chat test-quality (names, `mockImplementation`, sleeps, `.flex-wrap`) | renamed, call-through spies, `settled`/`deferred`, `composerGeometry()` | **yes** | No `mockImplementation` on console anywhere in the six files; `settled(read, expected, holdMs)` in both files; `.flex-wrap` gone (`prompt-input.test.tsx:3223-3262`). |
| meta F2: wall-clock tooltip/hover assertions | fake timers + native hover (`prompt-input.test.tsx:100-133, 2903-2919, 2650-2684`) | **yes** | No `performance.now()`-based assertion outside the bounded `settled` hold. |
| rendered-surface F19 / N11 (low): prompt-input preview hides the chosen file and submits empty text | attachment list + `return false` on empty (`app/preview/prompt-input/page.tsx:56-99, 109-118`) | **yes** | Production: empty Enter → no "Submitted:" line; a chosen `shot.png` is listed with a Remove button; "go" + file → "Submitted: “go” with 1 file(s)" and the chip clears (`probe.json` › `promptInput`). |
| code-context-model-citation 1 (high): badge does nothing on tap/click | `InlineCitationCard` owns `open`, `press()` toggles/pins (`inline-citation.tsx:110-206, 250-253`) | **yes** | Production, iPhone-13 emulation: `tap` opens, second `tap` closes (`probe.json` › `inlineCitation.tapOpen/tapClosed`); desktop click pins and focus moves into the popup (`probe2.json` › `mouseClickPinned`), pointer leaving keeps it open, second click closes and returns focus to the badge; tests › "opens the card from a click…", › "opens the card on a tap…", › "keeps a clicked card open after the pointer leaves…" pass; mutations m11, m12, m14 caught. Residuals: F1 and F2 below. |
| rendered-surface N3 (medium): carousel unreachable by keyboard | pin moves focus into the body, `cycleTab`, Escape returns focus (`:266-303, 161-163, 189-194`) | **partial** | Enter → focus on the popup, Tab → Next, Next pages, Shift+Tab/Tab wrap, Escape returns focus: all true while the focused control stays enabled (tests 3/3; my pins › "opens again from keyboard focus after Escape once the badge has been left and re-entered", › "does not reopen on a delayed focus timer after Escape…", › "moves Shift+Tab from the freshly focused card to its last control" pass; mutation m13 caught). **Paging to the last slide from the keyboard loses focus** (F1 below). |
| code-context-model-citation 2 (medium): `80K / NaN` header | `formatTokens` → `count()` (`context.tsx:88-92, 269-270`) | **yes** | Tests › "renders 0 in the header when…undefined", › "renders 0% instead of NaN%…" pass; my pin › "draws an empty ring for NaN, infinite and negative counts on either side" passes (ring at `:167-206` goes through `usedPercent`); production card reads `40%80K / 200K…Total cost$0.32` = Σ rows (`probe.json` › `context`); mutation m18 caught. |
| code-context-model-citation 3 (low): prototype-key language | `Object.hasOwn` (`code-block.tsx:205`) | **yes** | Test › "renders a language named after an Object.prototype key…" passes; mutation m15 caught. |
| code-context-model-citation 4 / rendered-surface N7 / meta F4 (medium): logos from models.dev, non-hermetic preview | `src` prop (`model-selector.tsx:234, 245`), preview passes inline `data:` marks (`app/preview/model-selector/logos.ts`, `model-selector-demo.tsx`) | **yes** | Served HTML of `/preview/model-selector`: `https://models.dev` 0×, `models.dev/logos` 0×; the one `models.dev` string is the prose "…so the page makes no request to models.dev." in the `<p>` and its RSC copy (inert, `scratchpad/ms.html`); all four `<img src>` start with `data:image/svg+xml,`; Playwright: 0 non-localhost requests, images `complete` with `naturalWidth 150`, filter "opus" → one option, Enter selects (`probe.json` › `modelSelector`); mutation m19 caught. |
| code-context-model-citation 5 (low): cache key colon collision | `\0` separator (`code-block.tsx:180-181`) | **yes** | Test › "keeps two blocks apart when the language string contains a colon" passes; mutation m16 caught. |
| code-context-model-citation 6 (low): `URL.canParse` floor | `safeHostname` try/catch (`inline-citation.tsx:216-222`) | **yes** | No `canParse` in the five sources (grep). |
| code-context-model-citation 7 (low): empty array children | `Children.toArray(...).some(...)` (`inline-citation.tsx:553-556`) | **yes** | Tests › "renders nothing for an empty array, null children or whitespace" ×2 pass. |
| code-context-model-citation 8 (nit): over-promising docs | strings replaced | **yes** | Every sentence of the six strings re-read against the code (Registry entries section). |
| code-context-model-citation 9 (test): survivors M6/M10/M15 | tests added | **yes** | › "becomes a scroll container when streamed code grows past the block", › "omits a row whose own count is negative or NaN", › "unsubscribes every carousel listener…" present and green. |
| rendered-surface N5 (low): two `region`s named "Code" | `role="group"`, language-derived name (`code-block.tsx:184-195, 596-598`) | **yes** | Production `/preview/code-block` at 375: three groups "TypeScript code" / "JSON code" / "Fetch example", all `tabindex=0`, no `role=region` (`probe.json` › `codeBlock`); my pin › "names the scroll container from shiki aliases…" (`sh`/`bash` → "Shell code", `tsx` → "TSX code", `js` → "JavaScript code", `yml` → "YAML code", `plaintext` → "Code") passes; mutation m17 caught. |
| rendered-surface N9 (nit): every preview titled "uifiles" | `metadata.title` per page | **partial** | `code-block`, `context`, `model-selector`, `inline-citation` carry "<Name> · uifiles"; `/preview/prompt-input` and `/preview/chat` still "uifiles" (`probe2.json` › `titles`; both pages are `"use client"` and cannot export `metadata`). F7 below. |
| disclosure F4 (low, cross-owner): block's own "Streaming input…" | `<ToolInput input={part.input} />` (`chat.tsx:531`; placeholder at `tool.tsx:148`) | **yes** | Test › "shows the tool item's No input yet placeholder…" passes. |

## Findings (most severe first)

### F1. inline-citation: paging to the last (or first) slide from the keyboard drops focus to `<body>`, and Escape then closes the card without returning it — severity: high

- Where: `registry/ai/inline-citation.tsx:511` (`InlineCitationCarouselPrev` `disabled={!canScrollPrev}`) and `:541` (`InlineCitationCarouselNext` `disabled={!canScrollNext}`), fed by `useCarouselSnap` (`:367-400`) on embla's `select`; `:161-163` (`restoreFocusRef` is set only when `popupRef.current?.contains(document.activeElement)`); `app/preview/inline-citation/page.tsx:21-37` (the shipped preview has two sources, so one Enter on Next reaches the end).
- What: a press pins the card and `PinnedFocus` puts focus on the popup; Tab reaches Next; Enter on Next scrolls to 2/2 and the `select` re-render sets `disabled` on Next while it is `document.activeElement`. A disabled element cannot hold focus, so Chromium moves focus to `<body>` (no `focusout` target, no ring, nothing announced). Escape still closes the card (Base UI's dismiss listens on the document) but `handleOpenChange` sees `activeElement` outside the popup, leaves `restoreFocusRef` false, and focus stays on `<body>`; the next Tab starts from the top of the page. The same happens from slide 2 with Shift+Tab → Prev → Enter (Prev becomes disabled on 1/2). The fixer's test uses three sources, so Enter on Next goes 1/3 → 2/3 and Next stays enabled; it never reaches an end. The docs promise "closes on Escape (focus returns to the badge…)".
- Evidence: production `/preview/inline-citation` (`pages/probe2.json`): `afterEnterOnNext: { tag: "BODY", index: "2/2", nextDisabled: true }`, `afterEscape: { tag: "BODY", popup: false }`, `afterTabFromBody: { tag: "A", text: "uifiles" }` (the header link, i.e. the page's first tab stop); the control run without paging (`escapeFromNextWithoutPaging`) returns focus to the badge as designed. Vitest › "keeps focus inside the card when the control it is on becomes disabled at the last slide" → `expected false to be true` on `popup().contains(document.activeElement)` after Enter on Next (3/3 runs).
- Why it matters: it is the keyboard flow the round-2 fix was made for (N3), on the item's own preview with its default two-source data; a keyboard or screen-reader user loses their place mid-interaction (WCAG 2.4.3 focus order / 2.4.7 visible focus) and the documented "Escape returns focus" contract is false at exactly the point a two-source citation is fully read.
- Proposed fix: keep the buttons focusable at the bounds: render `aria-disabled={!canScrollNext}` instead of `disabled` (no-op the click and drop the `disabled:` styles to `aria-disabled:` ones), or, before the `disabled` flip lands, move focus to the popup (`(event.currentTarget.closest('[data-slot="hover-card-content"]') as HTMLElement)?.focus()` in the click handler when the next snap will disable the button, or an effect in Prev/Next: `if (disabled && document.activeElement === buttonRef.current) popup.focus()`). Either way the fixer's Enter/Tab/Escape test should page to the end with the preview's two sources, and the assertion `popup().contains(document.activeElement)` should follow every Enter.
- Test written: the one above (FAIL now).

### F2. inline-citation: the pinned card has no ARIA relationship with the badge — severity: medium (a11y)

- Where: `registry/ai/inline-citation.tsx:238-259` (the trigger renders `<button>` with only Base UI's props: `id`, `data-popup-open`; Base UI's PreviewCard trigger adds no `aria-*` — `node_modules/@base-ui/react/preview-card/trigger/PreviewCardTrigger.js`, grep for `aria-expanded|aria-haspopup|aria-controls` over `preview-card/` is empty); `:305-340` (the body is Base UI's popup: `tabindex="-1"`, no `role`, no name).
- What: hover/focus peeking was fine without ARIA (a Radix hover card has none either). The round-2 fix turned the badge into a press-to-open control that moves focus into the popup, i.e. a disclosure/dialog pattern, and nothing tells assistive technology that the button opens something, whether it is open, or what the focused `<div>` is. A screen-reader user presses Enter on "ai-sdk.dev +1" and focus lands on an unnamed generic container.
- Evidence: production, pinned state (`pages/probe2.json` › `badgeAttrsWhilePinned`): `{ type, data-slot, data-variant, id, data-popup-open }` only; `popupAttrs`: `{ data-open, data-side, data-align, data-instant: "focus", tabindex: "-1", data-base-ui-focusable, data-slot }`. Vitest › "exposes the pinned card to assistive technology through aria-expanded on the badge" → `expected null to be 'true'`.
- Why it matters: WCAG 4.1.2 name/role/value for the new press behaviour; axe has no rule for it, so the green axe runs do not cover it.
- Proposed fix: in `InlineCitationCardTrigger` add `aria-expanded={card?.open}` (and `aria-controls` pointing at a `useId()` put on the popup) so the button reads as a disclosure; when pinned, give the body `role="dialog"` + `aria-label` (e.g. "Sources") or `aria-labelledby` the badge, so the element that receives focus has a role and a name. Document in `docs` next to the press sentence.
- Test written: the one above (FAIL now).

### F3. prompt-input, provider mode: the `maxFiles` counter only ever grows inside a handler, so `remove()`/`clear()` followed by `add()` refuses the freed slot — severity: medium

- Where: `registry/ai/prompt-input.tsx:588-592` (`providerCountRef` synced from `files.length` in an effect), `:716` (advanced only in `addWithProviderValidation`), `:722-726` (`clearAttachments` in provider mode calls `controller.attachments.clear()` and touches no counter), `:758` (`remove` in provider mode is the provider's `remove` directly), `:713` (`acceptFiles(fileList, providerCountRef.current)`). Local mode keeps `filesRef` in step on every path (`:695, :706, :728, :741`).
- What: with `<PromptInputProvider>` and `maxFiles={1}`, a handler that replaces the attachment (`remove(current.id); add([next])`, the "retake screenshot" / "swap the file" pattern) or resets it (`clear(); add([a, b])` with `maxFiles={2}`) computes capacity from the stale count, drops the new files and reports `max_files`. Only after React commits does the effect re-sync. The round-2 fix made the count go up synchronously but never down; the pre-fix `filesRef.current.length` had the same staleness, so this is an incomplete fix rather than a regression, but docs (7) now advertise "in provider mode `maxFiles` is enforced across several `add()` calls in one handler".
- Evidence: Vitest › "lets a handler remove an attachment and add another within maxFiles (provider: true)" and › "…clear… (provider: true)" → `expected '0' to be '1'` (the replacement was refused, `onError` `max_files`); both local-state cases pass.
- Proposed fix: route provider-mode `remove`/`clear` through wrappers that adjust `providerCountRef` (`providerCountRef.current = Math.max(0, providerCountRef.current - 1)` / `= 0`), or give `PromptInputProvider` a synchronous count (it already keeps `attachmentsRef`) and expose it on the controller so `acceptFiles` reads `controller.attachments.__count()` instead of a mirror.
- Test written: the two above (FAIL now) plus the local-state controls (PASS).

### F4. prompt-input / chat: a second submit that lands while the first is converting blob URLs carries the same attachment again — severity: low

- Where: `registry/ai/prompt-input.tsx:899-908` (`form.reset()` and the id snapshot happen synchronously, but the attachments stay in `files` until `commit()`), `:936-948` (`await Promise.all(convertBlobUrlToDataUrl…)`, i.e. `fetch(blob:)` + `FileReader.readAsDataURL`), `:950-958` (`onSubmit` runs only after that); `chat.tsx:697-701` (`handleSubmit` lets a message with files through even with empty text, then `void onSubmit`), `node_modules/ai/dist/index.js:22276-22356, 22561-22625` (`sendMessage` has no in-flight guard; a second call starts a second `makeRequest`).
- What: Enter/click/`requestSubmit()` twice within the conversion window submits `{ text: "hi", files: [a] }` and then `{ text: "", files: [a] }`; both `commit()`s remove the same id. Through the chat block that is two `sendMessage` calls, the second a files-only user turn, while the first request is in flight. Without attachments the window is one microtask and unreachable; with a pasted screenshot it is the base64 encoding of the image (milliseconds to tens of milliseconds on a phone), reachable by a double press. Upstream has the same shape; the round-2 "only what the submit carried" design makes the snapshot the natural place to also make it exclusive.
- Evidence: Vitest › "carries an attachment through exactly one submit when a second submit lands during the blob conversion (PromptInput / ChatComposer)" → `expected [ 'once.txt', 'once.txt' ] to deeply equal [ 'once.txt' ]` (the conversion is gated by a `fetch` stub so the window is deterministic).
- Proposed fix: keep an `inFlightIds` ref: `handleSubmit` snapshots `files` minus in-flight ids, adds its ids to the set, and removes them in both `commit()` and `restoreText()`; or refuse re-entry while a conversion is pending (`if (submittingRef.current) return`).
- Test written: the two above (FAIL now; they pin the proposed contract).

### F5. chat: `ChatComposer` voids the consumer's `onSubmit` promise, so its rejection is unhandled — severity: low

- Where: `registry/blocks/chat/components/blocks/chat.tsx:701` (`void onSubmit(message)`), `:99` and `:668` (`onSubmit: (message) => void | Promise<void>` invites a promise), versus `:633-638` where the same file catches and reports a rejected `onRetry`.
- What: before round 2 the promise was returned and prompt-input handled a rejection (draft restored); now a rejecting `onSubmit` (`async ({ text }) => { await api.send(text) }` that throws) is an `unhandledrejection` and the composer is cleared as if accepted. The shipped pages never reject (`void sendMessage` routes errors to `status`), so this is a contract asymmetry for consumers who wire their own submit.
- Evidence: Vitest › "reports a rejected onSubmit instead of leaving an unhandled rejection" → `expected [ Error: send failed ] to deeply equal []` (the `unhandledrejection` listener caught it; `console.error` received only the runtime's report).
- Proposed fix: `Promise.resolve().then(() => onSubmit(message)).catch((reason) => console.error(reason))`, mirroring `ChatErrorMarker`, and a docs sentence; or narrow `ChatProps.onSubmit` to `void`.
- Test written: the one above (FAIL now).

### F6. prompt-input: the tooltip `shortcut` is dropped with the description when the content repeats the button's name — severity: low

- Where: `registry/ai/prompt-input.tsx:1314-1319` (`repeatsName` compares `tooltipContent` only), `:1323` and `:1347-1352` (the description, shortcut included, is rendered only when `describes`).
- What: `<PromptInputButton tooltip={{ content: "Search", shortcut: "⌘K" }}><GlobeIcon /><span>Search</span></PromptInputButton>` shows "Search ⌘K" to sighted users and exposes nothing extra to AT; the round-2 rule correctly avoids "Search, button, Search" but throws the shortcut away with it.
- Evidence: Vitest › "still describes the shortcut when the tooltip content repeats the visible text" → `expected null not to be null` (`aria-describedby`).
- Proposed fix: when `repeatsName && shortcut`, describe the shortcut alone (`<span className="sr-only" id={descriptionId}>{shortcut}</span>`) or set `aria-keyshortcuts` on the button.
- Test written: the one above (FAIL now).

### F7. `/preview/prompt-input` and `/preview/chat` are still titled "uifiles" (rendered-surface N9 residual) — severity: nit

- Where: `app/preview/prompt-input/page.tsx:1` and `app/preview/chat/page.tsx:1` are `"use client"` pages with no `metadata`; the other four previews in scope export `metadata.title`.
- Evidence: `pages/probe2.json` › `titles: { "prompt-input": "uifiles", "chat": "uifiles" }` against the production build; the sweep shows "Code Block · uifiles", "Context · uifiles", "Model selector · uifiles", "Inline citation · uifiles" for the others.
- Proposed fix: the same server/client split the manifest-docs fixer applied to code-block and suggestion (`page.tsx` with `metadata` + a `"use client"` demo file).

### F8. prompt-input docs (13) over-generalises "tabindex elements" — severity: nit (docs)

- `INTERACTIVE_SELECTOR` deliberately excludes `[tabindex="-1"]` (`prompt-input.tsx:1172`), but such an element does take focus on click, so a `tabindex="-1"` wrapper inside the footer hands focus to the textarea on click. Fine as behaviour; the sentence "clicks on anything that takes focus … (`tabindex` elements …) leave focus where they put it" should say "elements in the tab order (`tabindex` ≥ 0)". Everything else in the six strings matches the code (below).

## Mutation log

Harness `mut/mutate.sh`: copy the source to `mut/backup/`, one `perl -0pi` substitution (refused if it does not change the file),
the whole canonical test file, byte-identical restore proved by `cmp`; diffs in `mut/logs/<label>.diff`, output in `mut/logs/<label>.log`,
one line per mutation in `mut/results.txt`. **19 of 19 caught**; `git status --short registry/` after the batch is empty (every source
restored byte-identically).

| behaviour | mutation | test file › test | caught? |
| --- | --- | --- | --- |
| `onSubmit` returning `false` rejects the submit | m01 `if (accepted === false)` → `if (false)` | ai/prompt-input › "keeps the draft, attachments and sources when a sync / an async onSubmit returns false" | yes (2 fail / 147) |
| provider `maxFiles` across two `add()` calls | m02 `providerCountRef.current += capped.length` → `void 0` | same › "caps two add() calls from one handler at maxFiles with a PromptInputProvider" | yes |
| addon click exempts every interactive control | m03 `INTERACTIVE_SELECTOR` → old six-entry list | same › "leaves focus on a role=switch control / a plain tabindex=0 element inside the footer" | yes (2) |
| restore skips a controlled textarea | m04 `usingProvider \|\| textareaControlledRef.current` → `usingProvider` | same › "leaves a controlled textarea to its owner after a rejected submit…" | yes |
| tooltip description skipped when it repeats visible text | m05 compare with `aria-label` only | same › "does not describe a button whose tooltip repeats its visible text" | yes |
| commit clears only the submitted ids | m06 `removeAttachments/removeReferencedSources` → `clearAttachments/clearReferencedSources` | same › "clears only what the submit carried once a pending onSubmit resolves, with local state / a PromptInputProvider" | yes (2) |
| block vetoes a programmatic submit while generating | m07 `if (busy) return false` → `return` | blocks/chat › "keeps the draft and the attachments when a programmatic form submit is rejected while generating" | yes |
| generic error row on `status: "error"` | m08 `error \|\| status === "error"` → `error` | same › "shows a generic error row with Retry when status is error and no error object is given" | yes |
| rejected `onRetry` reported, not unhandled | m09 `.then(onRetry).catch(console.error)` → `void onRetry()` | same › "reports a rejected onRetry through console.error instead of an unhandled rejection" | yes |
| block does not return `sendMessage`'s promise | m10 `void onSubmit(message)` → `return onSubmit(message)` | same › "clears sent files from the composer once the message is sent, not when the answer ends" | yes |
| press opens/pins the citation card | m11 `card?.press(event)` never called | ai/inline-citation › press / click / tap / pointer-leaves / Enter tests | yes (6 fail / 61) |
| pinned card ignores the hover close | m12 `pinned && reason === "trigger-hover"` → `false` | same › "keeps a clicked card open after the pointer leaves…" | yes |
| Escape returns focus to the badge | m13 `restoreFocusRef.current = …` → `false` | same › "moves focus into the card on Enter, cycles Tab … returns focus on Escape" | yes |
| pin moves focus into the popup | m14 `PinnedFocus` never focuses | same › click / tap / pointer-leaves / Enter / no-controls tests | yes (5) |
| own-key language check | m15 `Object.hasOwn` → `in` | ai/code-block › "renders a language named after an Object.prototype key…" | yes |
| NUL-separated cache key | m16 `\0` → `:` | same › "keeps two blocks apart when the language string contains a colon" | yes |
| scroller is a group, not a landmark | m17 `role: "group"` → `"region"` | same › "makes an overflowing block a focusable, named scroll container", › "keeps two overflowing blocks … free of landmark violations", › "becomes a scroll container when streamed code grows…" | yes (3) |
| header counts through `count()` | m18 `formatTokens` → raw `compactFormat.format` | ai/context › "renders 0% instead of NaN% or ∞%…", › "renders 0 in the header when … undefined" | yes (2) |
| `src` overrides the models.dev URL | m19 `src ?? url` → `url` | ai/model-selector › "loads a custom src…", › "hides a custom src that fails…", › "requests no logo from models.dev" | yes (3) |

## Test-quality issues (file › test name → problem)

- `tests/browser/blocks/chat.test.tsx` › "shows the tool item's No input yet placeholder while input-streaming with no input yet" (`:1157`) and › "shows the raw input as text when a call errored before its input parsed" (`:1205`) → `allowConsole("error")` with no console assertion in the test; both assert the part does *not* crash, so the opt-out is a leftover from the crashing era and would mask a regression that logs. The porting recipe (`docs/porting-ai-elements.md:209-210`) says only a test that asserts the warning opts out.
- `tests/browser/ai/code-block.test.tsx` › "keeps two blocks apart when the language string contains a colon" (`:316`) and › "names the scroll container after the language and falls back to Code" (`:720`) → `allowConsole("warn")` tolerates the unknown-language warning without asserting it (a `vi.spyOn(console, "warn")` + `toHaveBeenCalledTimes` would make it load-bearing, as the sibling tests at `:284` and `:538` do).
- `tests/browser/ai/inline-citation.test.tsx` › "moves focus into the card on Enter, cycles Tab through its controls and returns focus on Escape" → renders three sources, so Enter on Next never reaches the last slide and F1 (which the preview's two sources hit on the first Enter) is invisible; page to an end and assert `popup().contains(document.activeElement)` after every activation.
- `tests/browser/blocks/chat.test.tsx` › "throw a clear error outside a MessageScrollerProvider" → name grammar ("throws").
- Otherwise clean: three runs each identical and green (`runs/summary.txt`: prompt-input 147 ×3 in 25–27 s, chat 61 ×3 in 36 s, code-block 52 ×3, context 50 ×3, model-selector 65 ×3, inline-citation 61 ×3); no `test.skip`/`.only`, no `BUG`/`QA`/round/reviewer/"pins" words, no disabled axe rules, every axe call through `tests/a11y.ts`; the only `setTimeout`s are the bounded `settled` hold, the fake-timer helper and the timed transport; every `vi.spyOn(console, …)` is a call-through spy under `allowConsole` in a test that asserts the call (`prompt-input.test.tsx:2462`, `chat.test.tsx:1398`, `code-block.test.tsx:284/538/605`, `context.test.tsx:189`). My file: 19 tests, prettier/biome/tsc clean, fixtures in `<main>`, no sleeps beyond `settled`, identical results in four runs (`repro-run{1,2,3,4}.log`; run 4, after the mutation batch had restored every source, includes the two
"removed while pending" pins: 8 failed / 11 passed, the same eight as before).

## Verified OK

- `onSubmit` returning `false`: sync and async paths keep the draft, attachments and sources (fixer's tests), provider text and attachments are kept too (my pin), a `defaultValue` textarea gets its edited text back after `form.reset()` (`prompt-input.tsx:929-931` compares against `defaultValue`, which `reset()` restored; fixer's test); an async function that resolves `undefined` commits, one that throws later rejects through the same `catch`.
- Per-submit clearing: a file the user removes while its submit is pending is revoked once by the removal and not again by the commit, in local and provider mode (my pins › "tolerates a file the user removes while its submit is pending…", `removeAttachments` filters `filesRef` first at `:740-742`); a file attached mid-submit survives (fixer's tests, production probe).
- `useAddonClick`: `<label htmlFor>` hands focus to its control, `[role=button]` inside a `<label>` keeps it, portaled listbox/menu clicks never reach the textarea (`currentTarget.contains(target)` guard); a consumer `onClick` with `preventDefault` vetoes (fixer's tests).
- Tooltips: object form with `shortcut` is described as "Search the web ⌘K" when the content differs from the name; `describes` is recomputed per render so a label that changes to equal the tooltip drops the description on the next render (`:1314-1319`); empty content renders no tooltip.
- Chat error row: explicit `error` wins over the generic line; Retry rejections go to `console.error`; with `useChat` an `error` cannot coexist with `streaming` (`makeRequest` clears it at `index.js:22625`), so "Retry while streaming" is only reachable with hand-rolled state, where the row renders whatever the consumer passes; "No input yet" comes from `tool.tsx:148` through `chat.tsx:531`; both shipped pages `void sendMessage` (`page.tsx:24`, `app/preview/chat/page.tsx:43`); production chat: draft and attachment kept through a rejected programmatic submit and through the whole answer.
- Inline citation: second click closes and returns focus; click on a hover-opened card pins it and the pointer leaving keeps it (production `mouseAwayStillOpen: true`); after a close-by-click the pointer leaving does not reopen (Base UI binds `mousemove` only with `move: true`, `useHoverReferenceInteraction.js:260-264`); Escape returns focus without reopening at `delay={0}` (fixer) and at `delay={300}` (my pin: closed through a 600 ms hold; Base UI's `useFocus` blocks the reopen after an `escape-key` change and the component's `ignoreFocusOpenRef` covers the timer); after Escape, leaving and re-entering the badge by keyboard opens the peek again (my pin; `applyPopupOpenChange` at `popupStoreUtils.js:194` calls `onOpenChange` even when already closed, so the blur resets the ignore flag); Tab wraps last→first and Shift+Tab first→last; Shift+Tab from the freshly focused popup goes to the last control (my pin); a card with no controls keeps Tab on the popup (documented: Escape is the exit).
- model-selector: the `src` prop replaces the URL and re-shows after a failed source changes (fixer's tests); the served preview is hermetic (0 external requests, all `data:` images loaded).
- context: every formatted count goes through `count()` (`:91-92`, rows at `:95-101`, header at `:269-270`, `TokensWithCost` at `:342`), the trigger, bar and ring through `usedPercent()`; `roundCents` guards non-finite prices.
- code-block: `Object.hasOwn`, NUL-separated key, `role="group"` (no landmark) named "<Language> code" for ids and aliases and "Code" for text/plaintext/unknown; a Streamdown response block and a Tool's `CodeBlock` in one transcript are sibling groups with no nesting and no landmark rule to trip (chat test › "passes axe at 375px with a wide code block and a tool call in the transcript"; production `/preview/chat` 375 dark: 0 violations).
- Registry entries: prompt-input description and docs (1)–(13), chat description and docs, code-block, context, model-selector and inline-citation descriptions and docs checked sentence by sentence against the sources named above, `dependencies`/`registryDependencies` against the imports (`ai@^7`, `nanoid@^6`, `shiki@^4.4`, `tokenlens@^1`, `@ai-sdk/react@^4`, `@shadcn/helpers@^0.2`; every `@/components/ui/*` and `@/registry/ai/*` import declared). The only inaccuracies are the over-generalisations in F3 (docs (7) is true for `add()`+`add()` only) and F8, and the silence about ARIA in the inline-citation press sentence (F2).

## Could not reach

- Real touch hardware and a screen reader (touch via Playwright's iPhone-13 emulation; ARIA read from attributes).
- A real slow blob conversion for F4 (gated with a `fetch` stub; the real window is the `readAsDataURL` time of the image).
- `regenerate` against a real backend (the empty-transcript rejection is asserted with a rejecting `onRetry`, as in round 2).
- `pnpm dlx shadcn add @uifiles/<name>` round-trips (`ui.shadcn.com` blocked).
- Concurrent mutation harnesses: another lens patched `registry/ai/checkpoint.tsx` while my batch ran (seen once in `git status`, restored seconds later); my harness restores each source byte-identically after every run (`cmp`), and my whole-file runs are the ones in `runs/` made before any mutation, but a run of another lens that imports `prompt-input.tsx` during one of my m01–m06 windows would have seen the mutation. Not a product finding; noted for the lead.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
cd <repo>
S=/docs/qa/round3/components-a

# production server: both stylesheet links 200; served model-selector page grep
curl -s http://localhost:3000/preview/chat | grep -o '/_next/static/chunks/[^"]*\.css'   # 0l32h8t1mbqja.css, 3x59cvfd7p2ai.css → 200
curl -s http://localhost:3000/preview/model-selector > ../scratchpad/ms.html; grep -c 'https://models\.dev' ms.html   # 0

# three runs of the six canonical files (runs/loop.sh → runs/summary.txt, *-run{1,2,3}.log)
bash $S/runs/loop.sh

# library facts: Base UI 1.8.0 PreviewCardTrigger.js / useFocus.js / popupStoreUtils.js / useHoverReferenceInteraction.js;
# ai 7.0.114 AbstractChat sendMessage/makeRequest; shiki 4.4.3 bundledLanguagesInfo alias names (node probe)

# reproducers: prettier, biome, tsc, four runs (repro-run{1,2,3,4}.log)
pnpm exec prettier --write tests/browser/qa-round3/components-a.test.tsx
pnpm exec biome check tests/browser/qa-round3/components-a.test.tsx; pnpm exec tsc --noEmit
pnpm exec vitest run --project browser --reporter=verbose tests/browser/qa-round3/components-a.test.tsx

# production pages (scripts copied into node_modules/ to resolve playwright, then removed)
node node_modules/.qa3-probe.mjs  > $S/pages/probe.json    # six previews × {1280 light, 375 dark}: axe, console, network, overflow + interactions
node node_modules/.qa3-probe2.mjs > $S/pages/probe2.json   # citation keyboard/mouse flow, page titles

# mutations (mut/mutate.sh: backup → perl -0pi → whole test file → restore → cmp; mut/batch.sh → mut/results.txt, logs/)
bash $S/mut/batch.sh
git status --short registry/   # empty after the batch
```
