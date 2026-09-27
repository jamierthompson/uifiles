# fix-leaves-tokens

Scratch: `/docs/qa/round2/fix-leaves-tokens/`
(`mutate.sh` harness, `batch1.sh`/`batch2.sh`, `mut.log` mutation results, `runs.log` three consecutive runs).

Files changed: `registry/ai/{branch,response,sources,suggestion}.tsx`, `scripts/sync-tokens.ts`,
`app/preview/{branch,response,sources,image}/page.tsx`, `tests/browser/ai/{branch,response,sources,suggestion,image}.test.tsx`,
`tests/browser/{tokens,button}.test.tsx`, `tests/unit/tokens.test.ts`, new `tests/unit/branch.test.ts`;
deleted `tests/browser/qa-round2/leaves-tokens.test.tsx` and `tests/unit/qa-round2-leaves-tokens.test.ts`.
`registry/ai/image.tsx` and `app/preview/suggestion/page.tsx` are unchanged (nothing to fix; the suggestion page is a client
component and cannot export `metadata`, see Requests).

## Fixed

- leaves-tokens:F1 + rendered-surface:N1 (high) — `response` marks every Streamdown scroller, not only code-block bodies: the
  div Streamdown scrolls a table in (the `[data-streamdown="table"]`'s parent inside `[data-streamdown="table-wrapper"]`) gets
  the same overflow check, `ResizeObserver`/`MutationObserver` re-checks and hydration guard as code bodies. Both kinds are
  now marked `tabindex="0"` + `role="group"` + `aria-label` ("Code" / "Table") while they overflow and stripped of all three
  when they fit (`group`, not `region`, per the coordinator: several blocks on one page would otherwise trip axe
  `landmark-unique`) — `registry/ai/response.tsx:23-71` — tests: `tests/browser/ai/response.test.tsx` › "makes a table wider
  than a phone a named tab stop and releases it when the table fits" (375 px, axe clean in light and dark, then 1400 px →
  unmarked, then 375 px → marked again; failed before: `expected { tabindex: null, role: null, label: null } to deeply equal
  { tabindex: '0', role: 'group', label: 'Table' }`; passes after) and › "names a table and a code block in the same response
  separately" (both `getByRole("group", { name })` resolve, axe clean).
- leaves-tokens:F2 — `Source` falls back to the hostname for an empty `title` and to the default content for empty
  `children` (`||` instead of `??`) — `registry/ai/sources.tsx:90-99` — tests: `tests/browser/ai/sources.test.tsx` › "labels
  the link with the hostname when the title is an empty string" (failed before: `Unable to find role="link" and name
  "example.com"`; passes after) and › "falls back to the icon and title when children is an empty string".
- leaves-tokens:F3 — `collectTokens` resolves a token declared more than once the way the cascade does: an unlayered
  `:root`/`.dark` declaration beats a layered one whatever the order, the later of two equally layered ones wins, and a
  token declared in two *different* layers throws `TokenError` ("--a is declared in both `@layer base` and `@layer theme`;
  declare it in one layer") because ranking named layers needs the `@layer` statement order the walker does not track.
  Documented in the script header — `scripts/sync-tokens.ts:9-19,117-150` — tests: `tests/unit/tokens.test.ts` › "lets an
  unlayered :root win over a :root inside @layer whatever their order" (the reviewer's fixture; failed before: `expected '2'
  to be '1'`; passes after), › "lets the later of two equally layered blocks win", › "refuses a token declared in two
  different layers". The pre-existing test "merges :root inside @layer and later .dark blocks in cascade order" encoded the
  wrong semantics (a later layered `:root` overriding the unlayered one); it is now "lets the unlayered :root beat a later
  :root inside @layer and a later unlayered .dark win" and asserts the browser's answer.
- leaves-tokens:F4 — when clamping moves a controlled `branch` (out of range, or the list shrank below it) `MessageBranch`
  calls `onBranchChange(clamped)` once from an effect, guarded by `totalBranches > 0` so a parent is not reset while no content
  is mounted; a parent that ignores it is not asked again (effect deps unchanged). The uncontrolled index is deliberately
  left unclamped in state so a removed-then-restored branch shows again (documented) — `registry/ai/branch.tsx:105-112` —
  tests: `tests/browser/ai/branch.test.tsx` › "tells a controlled parent once when the list shrinks below its branch"
  (failed before: `expected "vi.fn()" to be called 1 times, but got 0 times`), › "keeps a controlled parent's state in step
  with the clamped branch", › "clamps a controlled branch that is out of range and tells the parent once", › "does not
  report a clamp while there is no content to clamp against", › "returns to the remembered uncontrolled index when a removed
  branch comes back".
- leaves-tokens:F5 — the branch count is known while rendering: `MessageBranch` reads it off its own children with
  `countBranches` (finds the first `MessageBranchContent` element through fragments and host elements, `Children.toArray`
  resolving lazy RSC nodes, and counts `Children.toArray(content.props.children).length`, the same `branchesOf` the content
  uses to clamp), so server HTML carries "2 of 3" and the selector and hydration is warning-free. No layout-effect
  registration on that path. Content that `MessageBranch` cannot see (rendered by a custom component) still registers its
  count in a layout effect, only when the derived count is `undefined`, so that shape works on the client and shows
  "0 of 0"/no selector in server HTML (documented) — `registry/ai/branch.tsx:52-76,95-98,166-175` — tests:
  `tests/unit/branch.test.ts` (node, `renderToString`) › "renders the selector, the page count and the requested branch"
  (failed before: `expected '<div class="grid w-full…' to contain 'aria-label="Previous branch"'`), › "counts the content
  through a wrapping element or fragment, before or after the selector", › "clamps an out-of-range branch and hides the
  selector for a single branch", › "cannot see content a custom component renders, so that selector waits for the client";
  `tests/browser/ai/branch.test.tsx` › "renders the selector and page count on the server and hydrates them without a
  warning" (renderToString + `hydrateRoot`, console guard enforces no hydration warning, Next works after hydration),
  › "is counted through a wrapping element or fragment", › "is counted after mount when a custom component renders it, and
  uncounted when that unmounts".
- leaves-tokens:F6 — the three survived-mutation tests are in the canonical files: response `characterData`
  (`tests/browser/ai/response.test.tsx` › "re-checks overflow when only a text node inside the code block changes"), branch
  count reset on unmount (`tests/browser/ai/branch.test.tsx` › "resets the count when the content unmounts so the selector
  hides and the page reads 0 of 0" and the custom-component variant, which is what now carries the layout-effect cleanup),
  button ring token (`tests/browser/button.test.tsx` › "shows a ring and a border in the ring token that clears 3:1 on the
  %s variant": the settled border colour equals the computed `--ring` (both painted through a canvas so the browser does
  the oklch → sRGB conversion) and its WCAG contrast against the page background is ≥ 3). Mutation results below.
- leaves-tokens:F7 — `MessageBranchPageProps = ComponentProps<typeof ButtonGroupText>` (the div it renders, with Base UI's
  `render` prop) instead of `HTMLAttributes<HTMLSpanElement>` — `registry/ai/branch.tsx:271` — test: `branch.test.tsx` ›
  "renders a div by default and another element through the render prop".
- leaves-tokens:F8 — the walker throws `TokenError("unsupported block value in `--x: {`")` instead of dropping `--x: {}` /
  `--x: { a: b }`, and copies an unquoted `url(…)` verbatim up to its closing parenthesis so `;`, `{` and `/*` inside it are
  part of the value (quoted URLs go through the string branch as before; `url(` inside a comment is still a comment; an
  unterminated `url(` throws). Both documented in the header — `scripts/sync-tokens.ts:76-98` — tests: `tokens.test.ts` ›
  "refuses a block value instead of dropping the token" (failed before: `expected function to throw`), › "reads an unquoted
  url() whole, with ; and /* inside it, and a quoted one through the string" (failed before: `glob: 'url(http://hy)'`).
- meta:F6 — the `awaitingOwnerDecision` comment cites `docs/architecture.md` §4; the test name "(plan §5 departure)" is now
  "(architecture §4 departure)" — `tests/unit/tokens.test.ts:583-586,712`.
- rendered-surface:N4 (low) — `Suggestion` composes an `onFocus` that calls `scrollIntoView({ block: "nearest", inline:
  "nearest" })` on the focused chip after the consumer's handler, so Tab onto a chip that straddles the row's edge scrolls it
  fully into view (Chromium only does that for fully hidden targets) — `registry/ai/suggestion.tsx:36-59` — test:
  `tests/browser/ai/suggestion.test.tsx` › "scrolls a pill that straddles the row's edge fully into view when it is tabbed
  to" (the window is sized to the third pill's midpoint at runtime so a straddle exists whatever the font metrics; failed
  before: `expected false to be true` on the inside-the-viewport poll; passes after; the consumer's `onFocus` is called too).
- rendered-surface:N9 (nit, my pages) — `app/preview/{branch,response,sources,image}/page.tsx` export
  `metadata: Metadata = { title }` ("Branch", "Response", "Sources", "Image"; the root layout's template renders
  "Branch · uifiles").
- Test quality (reviewer's list): `response.test.tsx` resize test is now deterministic instead of `domQuiet(500)` — it renders
  a fixed-content `code-block-body` through a custom paragraph, so with no Shiki pass and no streaming a size change is the
  only thing that can prompt a re-check (mutation M6 still caught); the hydration test replaces `setTimeout(100)` with a
  `requestAnimationFrame` spy: it waits until the marker's hydration poll has run ≥ 3 more frames and then asserts the
  dehydrated body is still untouched (M7 caught). `button.test.tsx` › "does not show the focus ring after a pointer click"
  replaces `setTimeout(250)` with `settle()` (a ring that were appearing would be a running CSS transition, which `settle`
  awaits). `tokens.test.ts` › "sync-tokens is a no-op on the clean tree" now writes the repo's `.prettierrc` (minus `plugins`
  and `tailwind*`, which only format other languages and do not resolve from a temp dir) beside the fixture, and a new test
  "formats the registry with Prettier, not with JSON.stringify" proves the Prettier step is load-bearing (a raw
  `JSON.stringify` registry is rewritten to the committed bytes). No `vi.spyOn(console, …).mockImplementation` remains in my
  files: tests that expect a warning use `allowConsole()`, all others rely on the console guard. The branch "outside
  provider" fixture is inside `<main>`.
- Round-2 reproducers migrated: 18 browser + 11 unit, renamed by behaviour, and both round-2 files deleted. Dropped as
  reproducers but kept as behaviour: the two "pin" tests whose behaviour changed (F4 controlled clamp, F5 SSR selector)
  now assert the fixed behaviour.

## Not fixed and why

- leaves-tokens:F9 (`AGENTS.md` cites `docs/plan.md`) — docs lens, not my file.
- rendered-surface:N9 for `app/preview/suggestion/page.tsx` — a `"use client"` page cannot export `metadata`; see Requests.
- Destructive button focus border contrast (found while writing the F6 ring test) — `components/ui/button.tsx` (vendored)
  uses `focus-visible:border-destructive/40`, ≈ 2.2:1 over white, so the ring-token contrast assertion is limited to the
  five ring-bordered variants; see Requests.

## Tests

- `tests/browser/ai/response.test.tsx`: 16 → 20 (table at 375 px with resize, table + code block named separately,
  vertical overflow past `codeBlockMaxHeight`, characterData; resize and hydration tests made deterministic).
- `tests/browser/ai/branch.test.tsx`: 35 → 46 (SSR + hydration, wrapper/fragment counting, custom-component fallback and
  unmount reset, controlled clamp ×4, remembered uncontrolled index, state kept across navigation, fragment child, render
  prop).
- `tests/unit/branch.test.ts`: new, 4 (node `renderToString`).
- `tests/browser/ai/sources.test.tsx`: 22 → 27 (empty title, empty children, disabled + eventDetails, protocol-relative,
  javascript: href).
- `tests/browser/ai/suggestion.test.tsx`: 15 → 17 (straddling chip on Tab; size/variant + 24 px).
- `tests/browser/ai/image.test.tsx`: 8 → 10 (media-type parameters, `DefaultGeneratedFile` spread).
- `tests/browser/tokens.test.tsx`: 6 → 9 (axe-measured light/dark destructive ratios vs `docs/architecture.md` §4, tool error
  state axe both themes).
- `tests/browser/button.test.tsx`: 7 → 8 (ring token + 3:1 on five variants, destructive border, click without ring).
- `tests/unit/tokens.test.ts`: 28 → 42 (cascade ×4, block value, url(), !important/strings, nested at-rule/selector, BOM+CRLF,
  Prettier formatting, missing stylesheet exit 1, no base item exit 1, all problems at once, base deps, reduced-motion shape).
- Upstream tests: already ported in round 1; nothing further to port for these five leaves.
- Mutation checks (harness restores byte-identically, sha256 verified; `mut.log`):

  | mutation | test file | caught? |
  | --- | --- | --- |
  | M1 response: tables never collected | response.test.tsx | yes (2) |
  | M2 response: `role="region"` instead of `group` | response.test.tsx | yes (8) |
  | M3 response: every scroller labelled "Code" | response.test.tsx | yes (2) |
  | M4 response: role not removed when it stops overflowing | response.test.tsx | yes (2) |
  | M5 response: `characterData: false` (first version of the migrated test, real code block) | response.test.tsx | **no** — a horizontal scrollbar appearing changes the body's content-box height, so the ResizeObserver re-checks anyway; the test was rewritten around a fixed-size `overflow: hidden` body (M5b) |
  | M5b response: `characterData: false` (rewritten test) | response.test.tsx | yes (1) |
  | M6 response: ResizeObserver never observes | response.test.tsx | yes (2) |
  | M7 response: dehydrated scrollers marked anyway | response.test.tsx | yes (1) |
  | M8 branch: no render-time count | tests/unit/branch.test.ts | yes (3) |
  | M8b branch: no render-time count | branch.test.tsx | yes (1, the SSR test; the client fallback covers the rest, as designed) |
  | M9 branch: fallback registers 0 | branch.test.tsx | yes (1) |
  | M10 branch: fallback cleanup removed | branch.test.tsx | yes (1) |
  | M11 branch: clamp never reported | branch.test.tsx | yes (3) |
  | M12 branch: walk stops at host elements | tests/unit/branch.test.ts | yes (1; the browser file passes by design through the mount-time fallback) |
  | M13 branch: clamp reported with no content | branch.test.tsx | yes (1) |
  | M14 sources: `title ??` | sources.test.tsx | yes (1) |
  | M15 sources: `children ??` | sources.test.tsx | yes (1) |
  | M16 suggestion: focus handler not wired | suggestion.test.tsx | yes (1) |
  | M17 sync-tokens: layered beats unlayered | tokens.test.ts | yes (2) |
  | M18 sync-tokens: cross-layer conflict not refused | tokens.test.ts | yes (1) |
  | M19 sync-tokens: block value dropped silently | tokens.test.ts | yes (1) |
  | M20 sync-tokens: unquoted url() not copied whole | tokens.test.ts | yes (1) |
  | T4b tokens: light `--ring` reverted to 0.708 | button.test.tsx | yes (5: every ring-bordered variant) |

- All 23 runs restored byte-identically (`restored=OK` on every `mut.log` line; `git diff HEAD` empty for every patched file afterwards).
- Three consecutive runs (`runs.log`): browser (7 files) `Tests 151 passed (151)` ×3; unit (`tokens.test.ts` + `branch.test.ts`) `Tests 164 passed (164)` ×3.
- Neighbouring suites that import my sources: `tests/unit/{ssr,test-setup,site,registry}.test.ts` → `Tests 101 passed (101)`.

## Registry entry changes (exact strings; the registry owner applies them)

- branch › docs: "Built for the Base UI styles (base-nova): it composes the Base UI wrappers from components/ui and relies on their render prop and event signatures, so it does not work on Radix or React Aria styles. Extracted from AI Elements message.tsx (the MessageBranch* family only; shadcn's own message replaces the rest). Same export names and props as upstream, plus an optional controlled `branch` prop (pair it with `onBranchChange`; `defaultBranch` stays uncontrolled). MessageBranch counts the branches of its MessageBranchContent while rendering (it looks through fragments and plain elements among its own children), so the selector and MessageBranchPage (\"2 of 3\") are in server-rendered HTML and hydrate without a warning; content rendered by a custom component cannot be counted that way and registers after mount, so its selector appears on the client. The current branch is clamped into range, so an out-of-range `defaultBranch`/`branch` or a shrinking branch list never shows an empty page, and MessageBranchPage reads \"0 of 0\" while no content is mounted. When clamping moves a controlled `branch` (out of range, or the list shrank below it), `onBranchChange` is called once with the clamped index so the parent's state follows; an uncontrolled index is remembered, so a branch that is removed and restored shows again. MessageBranchContent ignores null/boolean children (conditional branches) and accepts children rendered by a Server Component (RSC lazy nodes resolve without key warnings). MessageBranchPage renders ButtonGroupText (a div; upstream typed it as a span) and accepts its `render` prop. The buttons are the Base UI Button primitive (nativeButton), so onClick/disabled/type behave as before; no asChild anywhere."
- response › docs: "Built for the Base UI styles (base-nova); the file imports no style wrappers, so nothing in it is style-specific. Extracted from AI Elements message.tsx (MessageResponse only; shadcn's own message replaces the rest). Export name and props identical (ComponentProps<typeof Streamdown>). No Radix code in this component. MessageResponse passes shikiTheme={[\"github-light-high-contrast\", \"github-dark-high-contrast\"]} to Streamdown because Streamdown's default GitHub light theme fails AA on orange tokens; your own shikiTheme prop overrides it. Code-block bodies and tables that overflow (horizontally, or vertically past codeBlockMaxHeight / tableMaxHeight) become keyboard-focusable scroll regions on the client: tabindex=0 plus role=\"group\" and an aria-label (\"Code\" or \"Table\"; a group, not a region landmark, so several blocks on one page do not collide), re-checked as tokens stream in and on resize, removed again when the content fits, and applied only after React has hydrated them, so server-rendered blocks never cause a hydration mismatch. CSS: Streamdown's own Tailwind classes only compile if your stylesheet can see them: add `@source \"../node_modules/streamdown/dist/*.js\"` next to your `@import \"tailwindcss\"` (the `@streamdown/*` plugins ship no classes). `@import \"streamdown/styles.css\"` provides the `[data-sd-animate]` fade/blur/slide keyframes and the list-marker fade; without it streamed blocks appear instantly instead of animating in. Math needs KaTeX's stylesheet: add `@import \"katex/dist/katex.min.css\";` to your globals.css (this item installs katex, which @streamdown/math uses); without it every formula renders twice, KaTeX's HTML plus the MathML fallback the stylesheet hides. Inline `$...$` math is off by default in @streamdown/math (singleDollarTextMath: false); `$$` blocks work."
- sources › docs: "Built for the Base UI styles (base-nova): it composes the Base UI wrappers from components/ui and relies on their render prop and event signatures, so it does not work on Radix or React Aria styles. Ported to Base UI Collapsible: SourcesTrigger and SourcesContent accept Base UI Trigger/Panel props (render instead of asChild; keepMounted instead of forceMount). Open/closed animation classes use data-open/data-closed instead of data-[state=open|closed]. Sources types `open`, `defaultOpen`, `onOpenChange` and `disabled` (Base UI root props) on top of upstream's div props. Divergences from upstream: the trigger pluralises (\"Used 1 source\") and is a 24px-tall target; Source without `href` renders a <span> rather than an anchor; absolute URLs get target=\"_blank\" rel=\"noreferrer noopener\" while relative links open in the same tab; a missing or empty `title` falls back to the URL's hostname (or the href itself when it has none), and empty `children` fall back to the icon and title, so a provider's empty title never yields an unlabelled link."
- suggestion › docs: "Built for the Base UI styles (base-nova): it composes the Base UI wrappers from components/ui and relies on their render prop and event signatures, so it does not work on Radix or React Aria styles. Same API as AI Elements. Built on the Base UI ScrollArea and Button wrappers; Suggestions accepts ScrollArea.Root props (Radix-only props such as `type` and `scrollHideDelay` no longer exist). Suggestion scrolls itself fully into view when it receives focus (browsers only do that for a chip that is entirely hidden, not one cut off at the row's edge) and still calls the `onFocus` you pass."

## Requests for other owners

- `app/preview/suggestion/page.tsx` (client page, N9): split into a server `page.tsx` that exports `metadata = { title: "Suggestion" }` and renders a client `suggestion-demo.tsx` holding the `useState` (as the model-selector preview was split); I could not add the sibling file under my ownership.
- `components/ui/button.tsx` (vendored shadcn): the destructive variant's focus border is `border-destructive/40`, ≈ 2.2:1 over white (the ring-token assertion in `button.test.tsx` therefore excludes it). Either use `border-destructive` (5.6:1) for the focus border or accept the halo as the indicator and record it with the other `awaitingOwnerDecision` debts.
- `registry/ai/code-block.tsx`: switch the scroller from `role="region"` to `role="group"` as the coordinator said, so a transcript of `code-block` and `response` blocks uses one vocabulary (my tests in `code-block.test.tsx` are not mine to change).
- `tests/unit/ssr.test.ts`: its branch case now renders the selector; consider asserting `aria-label="Next branch"` there too (I put the assertions in `tests/unit/branch.test.ts` instead of editing that file).
- Checkpoint commit `b85cea8` was taken while my mutation harness was running; I verified afterwards that `git diff HEAD` is empty for every file the harness patched (`branch`, `sources`, `response`, `suggestion`, `sync-tokens.ts`, `app/globals.css`), so the snapshot holds the pristine versions.

## Strict-flag typecheck

- `pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`: no errors in files I own.
- Errors in files I do not own: none at the final check (`pnpm exec tsc --noEmit` exit 0 for the whole repo). Earlier in the session, while other fixers were mid-edit, `tests/browser/ai/inline-citation.test.tsx`, `tests/unit/tooling.test.ts` and `registry/ai/inline-citation.tsx` showed transient errors; they are gone.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round2/fix-leaves-tokens
MINE="registry/ai/response.tsx registry/ai/branch.tsx registry/ai/sources.tsx registry/ai/suggestion.tsx scripts/sync-tokens.ts app/preview/{branch,response,sources,image}/page.tsx tests/browser/ai/{branch,response,sources,suggestion,image}.test.tsx tests/browser/tokens.test.tsx tests/browser/button.test.tsx tests/unit/tokens.test.ts tests/unit/branch.test.ts"
pnpm exec prettier --check $MINE; pnpm exec biome check $MINE          # clean (18 files)
pnpm exec tsc --noEmit                                                  # exit 0 (whole repo)
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals   # clean for my files
# before the fix, with the round-2 reproducers still in place (F1/F2/F3 fail, F4/F5 pins pass):
pnpm exec vitest run --project browser tests/browser/qa-round2/leaves-tokens.test.tsx tests/browser/ai/{branch,response,sources,suggestion,image}.test.tsx tests/browser/tokens.test.tsx tests/browser/button.test.tsx
pnpm exec vitest run --project unit tests/unit/qa-round2-leaves-tokens.test.ts tests/unit/tokens.test.ts tests/unit/ssr.test.ts
# after the source fix, before migrating: only the two behaviour pins and the wrong cascade test fail (see Fixed)
# probe (temporary tests/browser/qa-round2/probe-leaves.test.tsx, deleted): renderToString does not stamp contexts for later client renders; renderToReadableStream does
# mutations: $S/batch1.sh, $S/batch2.sh (harness $S/mutate.sh: copy, patch, run, restore, sha256) -> $S/mut.log
# stability: $S/batch2.sh -> $S/runs.log (browser 7 files x3, unit 2 files x3)
pnpm exec vitest run --project unit tests/unit/ssr.test.ts tests/unit/test-setup.test.ts tests/unit/site.test.ts tests/unit/registry.test.ts   # 101 passed
git diff HEAD --stat -- registry/ai/{branch,sources,response,suggestion}.tsx scripts/sync-tokens.ts app/globals.css   # empty after the harness
```
