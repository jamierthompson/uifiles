# fix-cot-queue-checkpoint-confirmation

Files owned and changed: `registry/ai/{chain-of-thought,queue,checkpoint,confirmation}.tsx`,
`tests/browser/ai/{chain-of-thought,queue,checkpoint,confirmation}.test.tsx`,
`app/preview/confirmation/page.tsx`. The other three preview pages needed no change (verified in a
real browser, see Commands run). `tests/browser/qa-round1/disclosure-agent.test.tsx` was read only;
the reasoning/tool/task/plan fixer deletes it. All line numbers below are from the working tree.

## Fixed

- disclosure-agent:F3 (queue action invisible on keyboard focus) — `QueueItemAction` adds
  `group-focus-within:opacity-100` and `focus-visible:opacity-100` (the row `QueueItem` already
  carries `group`) — `registry/ai/queue.tsx:133` — test: `tests/browser/ai/queue.test.tsx` ›
  "QueueItemAction › is hidden at rest and revealed when focused from the keyboard" and "reveals
  every action in the row while one of them has focus" (failed before: `AssertionError: expected
  '0' to be '1'`; passes after, polled because `transition-opacity` takes 150 ms).
- disclosure-agent:F5 + tokens-css:F6 (docs claim the opposite of the code; stale contrast
  exclusion) — removed the `rules: { "color-contrast": { enabled: false } }` run and its comment;
  completed rows now go through `expectNoViolations()` with the full rule set —
  `tests/browser/ai/queue.test.tsx:625` › "queue integration › completed rows keep full-alpha muted
  text and pass color-contrast" (mutation `text-muted-foreground/50` back on completed content:
  caught by that test and by "QueueItemContent › applies completed styling with full-alpha text").
  Corrected `docs` sentence is under Registry entry changes.
- tokens-css:F6 (indicator dots 2.04:1 / 1.30:1) — `QueueItemIndicator` uses a full-alpha
  `border-muted-foreground` for both states; completed is filled with `bg-muted-foreground`, pending
  stays hollow (still quiet, ≥3:1 on both themes because the boundary is the full token) —
  `registry/ai/queue.tsx:61-62` — tests: "QueueItemIndicator › renders completed state as a filled
  full-alpha dot" / "renders pending state as a hollow full-alpha dot" (mutation back to `/50` and
  `/20`: both caught).
- disclosure-agent:F6 (approved tool that then errors shows an empty `role="alert"`) —
  `respondedStates` now includes `output-error` (ai@7 keeps `approval.approved === true` on such a
  part), so `ConfirmationAccepted` renders; and `Confirmation` returns `null` when neither the
  request nor an outcome can render (responded state without an `approved` boolean) instead of
  mounting an empty live region — `registry/ai/confirmation.tsx:55-60, 75-83, 124, 140` — tests:
  `tests/browser/ai/confirmation.test.tsx` › "shows the accepted outcome for an approved tool that
  then errored" (failed before: `Cannot find element with locator: page.getByText('You approved
  it.')`, ARIA tree `- alert`; passes after), "renders nothing for a responded state whose approval
  carries no decision", and the table "shows exactly one part in every ai state" (all 7 states).
- disclosure-agent:F12 (duplicated union member) — the second identical `{ approved: true }`
  member is gone; `reason` is `string | undefined` for strict consumers —
  `registry/ai/confirmation.tsx:12-33`.
- test-quality:M12 (accepted and rejected rendered in one tree) — every outcome test renders one
  `Confirmation` per tree and asserts the other outcome, the request and the actions are absent:
  "renders ConfirmationAccepted when approved and state is approval-responded", "renders
  ConfirmationRejected when not approved and state is output-denied", "shows only the accepted
  outcome, hides the actions, and passes axe", "shows only the rejected outcome and passes axe in
  dark mode" (mutation: swapping the `approved` conditions of Accepted/Rejected is caught).
- disclosure-agent:F2 (chain-of-thought note) — `ChainOfThought` keeps the latest `onOpenChange`
  in a ref; `setIsOpen` depends only on `isControlled`, so the context value is stable across
  parent renders — `registry/ai/chain-of-thought.tsx:64-77` — tests: "keeps the header from
  re-rendering when the parent re-renders with an inline onOpenChange" (counts calls of a stable
  `render` function on the memoised header: 3 parent re-renders add 0 header renders, a real toggle
  adds one; mutation back to `[isControlled, onOpenChange]`: `expected 4 to be 1`) and "calls the
  latest onOpenChange after the parent swaps the handler" (mutation: ref never re-synced → the old
  handler is called, caught).
- chain-of-thought unknown `status` — falls back to the neutral (`complete`) style instead of an
  unstyled row; the default `DotIcon` renders undimmed — `registry/ai/chain-of-thought.tsx:163` —
  test: "ChainOfThoughtStep › styles every status and falls back to neutral for an unknown one"
  (also pins pending = icon opacity 0.5, text opacity 1; mutation back to
  `text-muted-foreground/50` caught by it and by the axe run).
- chain-of-thought `ChainOfThoughtSearchResults` empty — returns `null` when
  `Children.toArray(children)` is empty (`[].map(...)`, `false`, no children), so an empty list adds
  no gap — `registry/ai/chain-of-thought.tsx:188` — test: "renders nothing without results"
  (mutation: guard removed, caught).
- chain-of-thought `ChainOfThoughtImage` without `caption` — the component is a frame around the
  image the consumer passes as children (upstream shape kept); the contract that the child carries
  its own `alt` is now pinned and documented: no `<p>` is rendered without a caption, the child
  `img` keeps its `alt`, and axe (`image-alt`) passes — test: "renders no caption node without one
  and keeps the child's own alt"; docs sentence under Registry entry changes. See Not fixed for
  the `require alt` reading.
- checkpoint pins — tooltip works with no `TooltipProvider` (asserted absent) and opens on Tab with
  no console error/warn; `onClick` fires exactly once with and without a tooltip (through
  `render={<Button/>}`); `type="button"`; separator is `role="separator"` with
  `aria-orientation="horizontal"` and is the last child of the row —
  `tests/browser/ai/checkpoint.test.tsx:29, 110, 138, 168` (mutations: `{...props}` dropped from
  the tooltip branch → "fires onClick once…" fails; `<Separator/>` removed → separator test fails).
- Inherited wart, ConfirmationAction `className` replaced the default `h-8 px-3 text-sm` (no `cn`,
  same upstream) — now merged through `cn` — `registry/ai/confirmation.tsx:174` — test: "merges
  className with its size defaults" (mutation caught); `render` composition pinned by "composes
  another element through render" (`nativeButton={false} render={<a/>}` → `<a role="button">` with
  the classes). Documented.
- Strict-flag hygiene — every optional prop on the four items is `T | undefined`
  (`open/defaultOpen/onOpenChange`, `icon/description/status`, `caption`, `completed`, `count/icon`,
  `QueueTodo`/`QueueMessagePart` fields, `tooltip`, `reason`). This also removed the one strict error
  that the old `chain-of-thought.test.tsx:30` produced.
- Preview — `app/preview/confirmation/page.tsx` gained an "output-error, approved" section so the
  Playwright axe pass exercises F6 (4 alerts on the page, 0 empty, no console errors).
- rendered-surface:F11 (coordinator follow-up; `ChainOfThoughtHeader` trigger row measured 20 px,
  under the WCAG 2.2 24 px target size) — `min-h-6` added to the trigger's class string; type size
  and weight unchanged (`text-sm`, no `font-medium`), so the visual weight is the same and the row
  only gains 4 px of hit area — `registry/ai/chain-of-thought.tsx:110-112` — test:
  `tests/browser/ai/chain-of-thought.test.tsx` › "ChainOfThoughtHeader › meets the 24 px target
  size while keeping its text-sm weight" (asserts `getBoundingClientRect().height >= 24`, the
  `text-sm` class, no `font-medium`, and `expectNoViolations()` with `target-size` enabled; mutation
  removing `min-h-6`: `AssertionError: expected 20 to be greater than or equal to 24`, caught).
  Note for the record: axe's `target-size` never flagged the 20 px row because the rule's spacing
  exception passes a full-width target with no adjacent targets; the explicit height assertion is
  what pins this.

## Not fixed and why

- Brief item "`QueueItem` unknown status renders the raw status" — not applicable: `QueueItem` has
  no `status` prop and renders nothing derived from one; `QueueItemIndicator`/`Content`/`Description`
  take a boolean `completed`; `QueueTodo.status` is a type only. Nothing to render, nothing changed.
  (The analogous case in this lens is `ChainOfThoughtStep`, fixed above.)
- Brief item "`ChainOfThoughtImage` … require `alt` or default `""`" — `ChainOfThoughtImage` renders
  a `div` frame plus an optional `<p>`; the image is whatever the consumer passes as children, so
  there is no `alt` attribute on the component to require or default. Pinned the real contract and
  documented it instead. If the owner wants the caption semantically bound to the image, the
  change is `<figure>`/`<figcaption>`, which alters `ChainOfThoughtImageProps` from
  `ComponentProps<"div">` to `ComponentProps<"figure">` (ref type) — an API decision, so not done.
- disclosure-agent reproducer "queue › EXPECTED FAIL … hover-only action buttons become visible on
  keyboard focus" still reports `expected '0' to be '1'` after the fix because it reads
  `getComputedStyle(...).opacity` synchronously the instant focus lands, which races the 150 ms
  `transition-opacity` (the same race its author polled around for `rotate`). The migrated test
  polls, fails without the fix (mutation check) and passes with it. I did not add
  `focus-visible:transition-none` just to make a synchronous read pass. The deleter of that file
  needs no action beyond deleting.
- The checkpoint separator is always announced (`role="separator"`; upstream's `decorative` Radix
  separator was `role="none"`): already stated in the item `docs`; left as is.

## Tests

- `tests/browser/ai/chain-of-thought.test.tsx`: 2 tests before → 30 after (29 + the F11
  target-size test); upstream tests ported: 16 of 16 (skipped: none). Migrated from
  disclosure-agent: 1 (split into the root-structure, keyboard/chevron, unknown-status and
  no-caption tests).
- `tests/browser/ai/queue.test.tsx`: 3 → 42; upstream ported: 30 of 30 (skipped: none; 3 adapted
  to the documented divergence: "renders completed state"/"renders pending state" assert the
  full-alpha dot classes, "applies completed styling" for content and description assert
  full-alpha text). Migrated from disclosure-agent: 4.
- `tests/browser/ai/checkpoint.test.tsx`: 2 → 8; upstream has no `checkpoint.test.tsx` (0 of 0).
  Migrated: 1 (split into onClick/tooltip-focus/separator tests). The tooltip axe run no longer
  disables `region`: the portal subtree is excluded from the page run and covered by a second run
  on the popup.
- `tests/browser/ai/confirmation.test.tsx`: 3 → 26; upstream ported: 17 of 17 (skipped: none).
  Migrated: 3.
- All four files use `tests/a11y.ts` (`expectNoViolations`, `withDark`); per-file `settle` copies
  are gone; every fixture that runs axe sits in `<main>`; each component has axe closed/open (or
  every state) plus one `withDark` composition.
- Mutation checks performed (fix → test that caught it), sources restored byte-for-byte afterwards:
  - queue: focus-reveal classes stripped → "is hidden at rest and revealed when focused from the
    keyboard", "reveals every action in the row while one of them has focus"
  - queue: indicator back to `/50` + `/20` → both QueueItemIndicator state tests
  - queue: completed content back to `/50` → "applies completed styling with full-alpha text",
    "completed rows keep full-alpha muted text and pass color-contrast"
  - confirmation: `output-error` removed from `respondedStates` → "shows the accepted outcome for
    an approved tool that then errored", "shows exactly one part in every ai state"
  - confirmation: empty-alert guard disabled → "renders nothing for a responded state whose
    approval carries no decision", "shows exactly one part in every ai state"
  - confirmation: Accepted/Rejected conditions swapped → "renders ConfirmationAccepted when
    approved…", "shows only the accepted outcome, hides the actions, and passes axe"
  - confirmation: action `className` replaces defaults → "merges className with its size defaults"
  - chain-of-thought: setter deps back to `[isControlled, onOpenChange]` → "keeps the header from
    re-rendering…" (`expected 4 to be 1`)
  - chain-of-thought: ref never re-synced → "calls the latest onOpenChange after the parent swaps
    the handler"
  - chain-of-thought: unknown status unstyled → "styles every status and falls back to neutral…"
  - chain-of-thought: empty SearchResults container rendered → "renders nothing without results"
  - chain-of-thought: pending text `/50` again → "styles every status…", "passes axe closed and open"
  - checkpoint: `{...props}` dropped from tooltip branch → "fires onClick once with and without a
    tooltip"
  - checkpoint: `<Separator/>` removed → "renders a checkpoint with an always-exposed horizontal
    separator"
- Three consecutive runs of the four files (`pnpm exec vitest run --project browser <4 files>`),
  before the F11 follow-up:
  - run 1: `Test Files 4 passed (4)` / `Tests 105 passed (105)` / 8.46s
  - run 2: `Test Files 4 passed (4)` / `Tests 105 passed (105)` / 10.82s
  - run 3: `Test Files 4 passed (4)` / `Tests 105 passed (105)` / 5.44s
- F11 follow-up, `tests/browser/ai/chain-of-thought.test.tsx` alone, three consecutive runs after
  adding `min-h-6` and the target-size test (prettier, biome and strict tsc clean on both files):
  - run 1: `Test Files 1 passed (1)` / `Tests 30 passed (30)` / 5.51s
  - run 2: `Test Files 1 passed (1)` / `Tests 30 passed (30)` / 4.68s
  - run 3: `Test Files 1 passed (1)` / `Tests 30 passed (30)` / 4.18s
  - mutation (`min-h-6` removed → "meets the 24 px target size while keeping its text-sm weight":
    `expected 20 to be greater than or equal to 24`, caught; source restored, `cmp` clean).
  Grand total across the four files: 106 tests.

## Registry entry changes (exact strings for registry.json; the registry owner applies them)

- queue › docs: "Base UI port of AI Elements queue. QueueSectionTrigger is the Collapsible trigger's own native <button> (upstream wrapped a <button> in asChild); its chevron rotates on the trigger's data-panel-open attribute. QueueSectionContent unmounts when closed (Base UI Panel default; pass keepMounted to retain). QueueList is a Base UI ScrollArea, so Radix `type` and `scrollHideDelay` props do not exist. onOpenChange receives (open, eventDetails). Contrast changes: completed items use full-alpha text-muted-foreground with line-through instead of upstream's 50% and 40% alpha, which fail AA; QueueItemIndicator uses a full-alpha border-muted-foreground (pending hollow, completed filled with bg-muted-foreground) instead of upstream's 50% and 20% borders, which fall below 3:1. QueueItemAction is also revealed on keyboard focus (focus-visible and group-focus-within), not only on row hover."
  (Wording deliberately never contains the contiguous token `text-muted-foreground/50`, which the
  tokens-css unit reproducer keyed on.)
- queue › description: "Queued work panel for agent chat: collapsible sections with a count label, a scrollable list of items with a status indicator, strike-through completed state, a description line, image and file attachments, and action buttons revealed on hover or keyboard focus. Use it for pending todos and queued messages beside a prompt input. Composes shadcn collapsible, scroll-area and button; exports QueueTodo, QueueMessage and QueueMessagePart types."
- confirmation › docs: "No Radix primitives upstream; only imports changed. ConfirmationAction is the Base UI Button: use `render` instead of `asChild` (add nativeButton={false} when the rendered element is not a <button>), and its className is merged with the default h-8 px-3 text-sm through cn instead of replacing it. ConfirmationAccepted also shows for output-error, because ai@7 keeps approval.approved === true on an approved tool whose execution then failed (the error itself is ToolOutput's to show). Confirmation renders nothing, rather than an empty role=\"alert\" box, when a responded state carries no approved boolean."
- confirmation › description: "Human-in-the-loop approval prompt for AI tool calls, rendered as an Alert. Reads the tool part's state and approval object and shows exactly one of: the pending request with Approve/Reject action buttons (approval-requested), the accepted outcome (approval-responded, output-available or output-error with approved: true), or the rejected outcome (approval-responded or output-denied with approved: false); renders nothing while input is streaming, before an approval exists, or when a responded part carries no decision. Use it with useChat addToolApprovalResponse for tools that require user consent."
- chain-of-thought › docs: append to the existing string: " A status value ChainOfThoughtStep does not know falls back to the neutral (complete) styling. ChainOfThoughtSearchResults renders nothing when it has no children, so an empty results list adds no spacing. ChainOfThoughtImage is a frame around the image you pass as children: that element must carry its own alt text (alt=\"\" if decorative); the optional caption renders as a paragraph below it."
- checkpoint: no change. dependencies: unchanged for all four.

## Requests for other owners

- `registry/ai/registry.json` owner: apply the four strings above.
- Deleter of `tests/browser/qa-round1/disclosure-agent.test.tsx`: the chain-of-thought (1), queue
  (4), checkpoint (1) and confirmation (3) tests are fully migrated into the canonical files; no
  content from those sections needs to survive. The queue reproducer's synchronous opacity read is
  a known race (see Not fixed); it will still show as failing until the file is deleted.
- `components/ui/scroll-area.tsx:5` has a strict-flag error (`TS6133`, unused import) in a vendored
  file; not touched.
- No change needed in `docs/porting-ai-elements.md` from this lens (its snippet was already being
  updated by its owner while this ran; not verified by me).

## Strict-flag typecheck

- Errors remaining in files I own: none (`registry/ai/*` four items, their four tests, four preview
  pages; plain `tsc --noEmit` also clean for them).
- Errors in files I do not own (`tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`):
  `components/ui/scroll-area.tsx:5`, `tests/browser/ai/branch.test.tsx:290`,
  `tests/browser/ai/code-block.test.tsx:930`, `tests/browser/ai/context.test.tsx:282 (×2), 394, 400`,
  `tests/browser/ai/prompt-input.test.tsx:39, 2898, 2903`,
  `tests/browser/qa-round1/chat-block-and-leaves.test.tsx:1169, 1177, 1219`,
  `tests/browser/qa-round1/prompt-input.test.tsx:234, 250, 272`.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
# before
pnpm exec vitest run --project browser tests/browser/qa-round1/disclosure-agent.test.tsx \
  -t "hover-only action buttons become visible on keyboard focus|approved tool that then errors"
#   queue:        AssertionError: expected '0' to be '1'
#   confirmation: Cannot find element with locator: page.getByText('You approved it.')  (ARIA tree: - alert)
pnpm exec vitest run --project browser tests/browser/ai/{chain-of-thought,queue,checkpoint,confirmation}.test.tsx
#   Tests 10 passed (10)   (baseline)
# after
pnpm exec prettier --write <owned files>; pnpm exec prettier --check <owned files>   # clean
pnpm exec biome check <owned files>                                                   # clean (biome-ignore on 3 test <img> fixtures)
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals | grep <owned>   # none
pnpm exec tsc --noEmit | grep <owned>                                                 # none
pnpm exec vitest run --project browser tests/browser/ai/{chain-of-thought,queue,checkpoint,confirmation}.test.tsx  # x3: 105/105
bash scratchpad/mutations.sh  # 14 mutations, 14 caught, sources restored (cmp -s against pre-mutation copies)
pnpm registry:validate        # valid
pnpm exec vitest run --project unit   # 224 passed; one transient failure in tests/unit/registry.test.ts
                                      # ("every bare package … declared") while another fixer edited
                                      # registry.json; re-run of that file: 22/22 passed
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/preview/{chain-of-thought,queue,checkpoint,confirmation}   # 200 x4, new markup present
node scratchpad/hydrate.mjs   # Playwright against the dev server: 4 pages hydrate with 0 console errors/warnings/pageerrors;
                              # confirmation: 4 alerts, 0 empty; checkpoint: 2 separators; queue: first dot filled
```
