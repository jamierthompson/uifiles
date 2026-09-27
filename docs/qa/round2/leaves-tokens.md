# leaves-tokens — QA round 2

Scratch: `/docs/qa/round2/leaves-tokens/`
(`contrast.mjs` independent WCAG model, `parser-probe.mjs`, `cascade.mjs`, `live.mjs`/`live.log` Playwright pass,
`motion.mjs`, `mutate.py` + `mut-*.log`, `pristine/SHA256`, `shots*/` and `live/` screenshots, `served-live.css`).
Reproducers: `tests/browser/qa-round2/leaves-tokens.test.tsx` (18 tests: 2 fail by design, 16 pins) and
`tests/unit/qa-round2-leaves-tokens.test.ts` (11 tests: 1 fails by design, 10 pins). Both are Prettier/Biome clean and
`pnpm exec tsc --noEmit` is clean for the whole repo with them in place.

## Summary

Attacked the five leaves (`branch`, `response`, `sources`, `suggestion`, `image`: sources, canonical tests, previews,
registry entries, upstream parity), the token layer (`app/globals.css`, `scripts/sync-tokens.ts`, `registry/base`,
served/built CSS, the three token tests), and every round-1 fix claim in scope. Method: read every line of the sources
and tests; 18 browser + 11 unit reproducers; 20 mutation runs against the canonical tests (14 leaf behaviours, 5 token
behaviours; 2 leaf mutants and 1 token mutant survived the canonical files, all three are killed by my new tests);
three consecutive runs of every reviewed file; an independent oklch→sRGB→WCAG model checked against axe's own numbers
in the browser; a Playwright pass over the live previews after the coordinator's server restart.

Findings: **1 high, 0 medium, 5 low, 3 nit** plus test-quality notes. Every round-1 finding in scope is really fixed
except one half of one: the Streamdown **table** scroll region in `response` is still not keyboard-reachable (rendered-
surface F3 named it; the fix covered code blocks only), so `/preview/response` at phone width fails axe
`scrollable-region-focusable` in both themes today and the desktop-only e2e suite cannot see it. That is the single worst
thing. The token work is solid: my model reproduces every number in `docs/architecture.md` §4 to ±0.005, axe measures the
same ratios in the browser, the new parser holds up under pathological CSS (one cascade-order edge apart), and the served
CSS carries KaTeX (unlayered, after the Tailwind layers) and the reduced-motion guard (in `@layer base`, verified under
media emulation on the live site).

Verdict: **not yet** for `response` (F1 is a WCAG 2.1.1 failure on the flagship renderer and a one-selector fix);
everything else in this lens is ship-ready.

## Fix verification

| round-1 finding | claimed fix | verified? | evidence |
| --- | --- | --- | --- |
| chat-block-and-leaves F4 `className` reveals every branch | `className` destructured and merged after the visibility class | yes | M3 (className back into the spread) → 2 canonical tests fail; `branch.tsx:117-147` |
| F6 null/conditional child crashes `MessageBranchContent` | `Children.toArray` | yes | M2 (raw array) → 2 tests fail; live `/preview/branch` console clean |
| F7 `defaultBranch` out of range shows nothing / "8 of 3" | `clampBranch` in provider and content | yes | M1 (no clamp) → 4 tests fail; negative and controlled clamps also pinned |
| F8 no overflow re-check on resize | per-body `ResizeObserver` | yes | M7 (never observe) → "adds and removes the tab stop as a resize…" fails |
| F9 "Used 1 sources" | pluralised | yes | M9 → 4 tests fail; live trigger reads "Used 4 sources" |
| F10 `alt` optional → `image-alt` | `alt` required at the type level | yes (as scoped) | `@ts-expect-error` line in `image.test.tsx:111` is load-bearing under `tsc`; runtime omission still renders no attribute, as the fixer decided |
| F12 memo test not load-bearing | render counter through `components.p` | yes | M8 (comparator → `false`) → "re-renders only when children or isAnimating change" fails |
| other notes: `<p>` inside trigger button; `Source` without `href` | `<span>`; `<span>` instead of `<a>` | yes | live trigger has no `p`/`div`; M10 shows the link/span branch is exercised |
| rendered-surface F2 KaTeX stylesheet missing | `@import "katex/dist/katex.min.css"` | yes | served `0jgcpcuv4iy7d.css` has 393 `.katex` rules incl. `.katex .katex-mathml{…position:absolute;width:1px;height:1px}`; live `/preview/response` `.katex-mathml` computed absolute/1px in light and dark, one `<math>`; T5a/T5b mutants caught |
| rendered-surface F6 hydration mismatch at 375 px | mark only React-claimed bodies, rAF re-poll | yes | live `/preview/response` at 375 px logs nothing (light and dark); M6 (mark dehydrated DOM) → SSR/hydrate test fails |
| rendered-surface F7 RSC key warning | `Children.toArray` | yes | live `/preview/branch` console empty; hand-built lazy nodes pinned in the canonical file |
| rendered-surface F11 `SourcesTrigger` 16 px target | `min-h-6` on trigger and rows | yes | live trigger and every `Source` row measure 24 px; M11 (class removed) → "24px target" fails |
| rendered-surface F12 no `prefers-reduced-motion` | global guard in `@layer base` + base item `css` | yes | served CSS: guard inside `@layer base` with `!important`; `motion.mjs` on the live site: collapsible enter animation 150 ms → 0.01 ms under `reducedMotion: "reduce"`; T2 caught |
| rendered-surface F3 (table half: "extend the response marker to the table wrapper") | not claimed by any fixer | **no** | F1 below |
| tokens-css F1 destructive variants 3.99:1 | light `--destructive` 0.52, dark 0.74 | yes | axe in-browser: light `/10` 4.68, `/80` 4.64, `/90` 5.21, white 5.62, muted 5.15; dark `/20` 5.59, `/30` 4.55, `/80` 4.66 (my reproducer); T1a → 9 unit failures, T1b → 6 browser failures |
| tokens-css F2 `sync-tokens.ts` drops tokens silently | brace/string/comment-aware walker + invariants + exit 1 before write | yes (one edge, F3) | robustness fixtures pass; BOM+CRLF copy through the real binary is byte-identical to the committed JSON; T3 (parity check removed) → 2 failures; missing file / no `base` item → exit 1, registry untouched |
| tokens-css F3 alpha-faded destructive text | fixed by the token | yes | `/80` on card 4.64 light / 4.66 dark (axe and model agree) |
| tokens-css F4 ring 2.59:1 (input/border left open) | light `--ring` 0.64 | yes | model 3.36 on white, 3.08 on muted; T4a → 7 unit failures (T4b: `button.test.tsx` survives, see test quality); input/border still in `awaitingOwnerDecision` as documented |
| tokens-css F8 / registry-contract F10 base item deps and docs | `next-themes`, `shadcn` removed; docs rewritten; dead `@source` lines removed | yes | manifest diff vs `86bbd82`; single `@source`; CLI adds `@custom-variant dark (&:is(.dark *))` itself on Tailwind v4 (`update-css-vars.ts:91-94`), so the docs' "class-based" claim holds for a fresh consumer |
| tokens-css F9 reduced motion | same as rendered-surface F12 | yes | as above |
| registry-contract F5 parser | same as tokens-css F2 | yes | as above |
| fix-registry-manifest: five leaf `docs`/`description` strings and base `docs` | every sentence checked against code | yes | see "Verified OK"; two wording nits only |

## Findings (most severe first)

### F1. `response`: a Streamdown table that overflows is a scroll region with no keyboard access — severity: high
- Where: `registry/ai/response.tsx:27` (`CODE_BLOCK_BODY = '[data-streamdown="code-block-body"]'` is the only selector the marker handles); Streamdown renders tables as `[data-streamdown="table-wrapper"] > div.border-collapse.overflow-x-auto.overflow-y-auto` (`node_modules/streamdown/dist/chunk-*.js`), which also honours `tableMaxHeight` vertically.
- What: any assistant answer with a table wider than its column (every phone, and any sidebar layout) becomes a horizontally scrollable region that Tab never reaches. axe reports `scrollable-region-focusable` (serious). Round-1 rendered-surface F3 named exactly this ("`.border-collapse`") and proposed extending the response marker; the fix covered code blocks only.
- Evidence: `tests/browser/qa-round2/leaves-tokens.test.tsx › response › makes a table that overflows its container a keyboard-reachable scroll region` — FAIL: `.border-collapse: expected [ 'scrollable-region-focusable' ] to not include 'scrollable-region-focusable'`, three of three runs. Live `/preview/response` at 375 px (`live.log`): `table: {overflow: true, tabindex: null, sw: 312, cw: 289}` and `violations=[["scrollable-region-focusable",[".border-collapse"]]]` in light and dark; screenshot `live/response-light-375.png` shows the clipped "Highes"/"Lowes" cells. The code block on the same page is correctly `tabindex="0"`.
- Why it matters: WCAG 2.1.1 on the component every chat answer flows through; the docs promise "code-block bodies that overflow … become keyboard-focusable" and a consumer will assume tables too. `playwright.config.ts` runs Desktop Chrome only, so CI never renders the width at which this fails.
- Proposed fix: make the marker generic over the two scrollers, e.g. `const SCROLLERS = '[data-streamdown="code-block-body"], [data-streamdown="table-wrapper"] .overflow-x-auto'` and give tables the same `ResizeObserver`/mutation treatment (the `isClaimedByReact` guard applies unchanged; tables are not inside Streamdown's lazy Suspense but the check is harmless). Consider `role="region"` + `aria-label` as `code-block.tsx:566-568` does, so the tab stop has a name. Add a 375 px project to the e2e suite (app-tooling lens).
- Test written: the name above (expected: FAIL now).

### F2. `sources`: a `Source` whose `title` is `""` renders a link with no accessible name — severity: low
- Where: `registry/ai/sources.tsx:94` (`title ?? (href ? hostnameOf(href) || href : undefined)`): `??` only catches `undefined`/`null`.
- What: `<Source href="https://example.com/report" title="" />` renders `<a>` with a book icon and an empty `<span>`; the hostname fallback the docs advertise ("a missing `title` falls back to the URL's hostname") never fires. `SourceUrlUIPart.title` in `ai@7` is optional and providers do return empty titles; the chat block does not render `Source` today, so only direct consumers hit it.
- Evidence: `› sources › labels a source whose title is an empty string with its hostname` — FAIL: `expected '' to be 'example.com'` (and `expectNoViolations` would report `link-name`).
- Proposed fix: `title || (href ? hostnameOf(href) || href : undefined)` and the same for `children` if an empty string should not win.
- Test written: the name above (expected: FAIL now).

### F3. `sync-tokens.ts` merges `:root` blocks in source order, but an unlayered `:root` beats a later layered one — severity: low
- Where: `scripts/sync-tokens.ts:103-121` (`collectTokens`: "merged in source order so a later block overrides an earlier one like the cascade"; `@layer` preludes are made transparent at `:118`).
- What: for `:root { --a: 1 } @layer base { :root { --a: 2 } }` the browser resolves `--a` to `1` (unlayered normal declarations outrank layered ones whatever the order; Chromium check in `cascade.mjs`: `1` in both orders) while the script publishes `2`. The registry would then ship a value the site does not paint, which is exactly the drift the script exists to prevent. Today's stylesheet has one block per mode, so nothing is wrong now; it bites the first person who adds a `@layer base { :root { … } }` override below the token block.
- Evidence: `tests/unit/qa-round2-leaves-tokens.test.ts › scripts/sync-tokens.ts cascade semantics › lets an unlayered :root win over a later :root inside @layer` — FAIL: `expected '2' to be '1'`.
- Proposed fix: either refuse (throw) when a token is declared in more than one `:root`/`.dark` rule with different layering, or rank rules (unlayered > layered, then source order) before merging. The first is simpler and matches the script's "fail loudly" design.
- Test written: the name above (expected: FAIL now).

### F4. `branch`: a controlled parent is not told when clamping changes the branch it shows — severity: low
- Where: `registry/ai/branch.tsx:71-73,127` (clamp is applied on read; `setBranch`, and so `onBranchChange`, only runs from Previous/Next).
- What: with `branch={2}` and the list shrinking to two children, the UI shows and announces "2 of 2" (index 1) while the parent still holds `2`. Anything the parent derives from `branch` (which regeneration to send, which message id to copy) is off by one until the user presses a button. Upstream has no controlled prop, so this is new API surface.
- Evidence: `› branch › clamps a controlled branch when the list shrinks without reporting the new index` (passes; pins that `onBranchChange` is not called). The uncontrolled sibling `returns to the remembered uncontrolled index when a removed branch comes back` pins that a removed-then-restored branch snaps back to the remembered index (3 → 2 → 3 of 3), which is defensible but undocumented.
- Proposed fix: decide and document: either call `onBranchChange(clamped)` from the layout effect when the clamp changes the effective index, or state in `docs` that the parent must clamp its own state. Add the sentence either way.
- Test written: the two names above (both pass; they pin current behaviour so a change is deliberate).

### F5. `branch`: the selector is missing from server-rendered HTML and pops in after hydration — severity: low
- Where: `registry/ai/branch.tsx:130-133` (`useLayoutEffect` registration; effects do not run on the server, so `totalBranches` is `0` during SSR) and `:159-161` (`MessageBranchSelector` returns `null` for ≤ 1).
- What: `renderToString` of the preview fixture contains no Previous/Next buttons and a `MessageBranchPage` outside a selector reads "0 of 0"; both appear after hydration (layout shift, text flash, no selector without JS). No hydration mismatch (the client's first render agrees). Upstream behaves the same (it used `useEffect`); the port's `docs` sentence about "0 of 0" describes this state without saying it is what every server page shows first.
- Evidence: `tests/unit/qa-round2-leaves-tokens.test.ts › branch on the server › renders the first branch, hides the rest and defers the selector to the client` (passes; pins the current shape with a clean console); live `curl /preview/branch` has 0 `aria-label="Next branch"` while the hydrated page has it (`live.log`).
- Proposed fix: none required for launch; if wanted, `MessageBranch` could take an optional `count`/`branches` prop so SSR can render the selector, or the docs can say the selector renders on the client only.
- Test written: the name above (passes).

### F6. Canonical tests leave three behaviours unpinned (survived mutants) — severity: low (test quality)
- `tests/browser/ai/response.test.tsx`: removing `characterData: true` from the `MutationObserver` options (M5a) leaves all 16 tests green; streamed text that only rewrites a text node would stop re-checking overflow. My `› response › re-checks overflow when a text node inside the code block changes in place` kills it (M5b).
- `tests/browser/ai/branch.test.tsx`: removing the layout-effect cleanup `return () => setTotalBranches(0)` (M4) leaves all 35 tests green; an unmounted `MessageBranchContent` would leave a stale count and an enabled selector over nothing. My `› branch › resets the count when the content unmounts so the selector hides and the page reads 0 of 0` kills it (M4b).
- `tests/browser/button.test.tsx › keyboard focus › shows a ring and a ring-coloured border`: reverting light `--ring` to `0.708` (T4b) leaves all 12 tests green because the test only asserts the border colour changed and is not transparent; the ring token is pinned by the unit file alone. Assert the computed border equals the ring token (or ≥ 3:1 against the surface).
- Proposed fix: fold the three pins into the canonical files.

### F7. `MessageBranchPageProps` is typed as `HTMLAttributes<HTMLSpanElement>` but renders a `<div>` — severity: nit
- Where: `registry/ai/branch.tsx:221`, `components/ui/button-group.tsx:41-62` (`ButtonGroupText` defaults to `div`). Upstream parity; refs and `onClick` event types are subtly wrong for consumers. Change the type or pass `render={<span />}`.

### F8. Parser silently drops or truncates exotic custom-property values — severity: nit
- `--x: {}` and `--x: { a: b }` are dropped without error; an unquoted `url(http://h/*x*/y)` is read as `url(http://hy)`; an unquoted `url(data:text/plain;base64,…)` is cut at the `;` (`parser-probe.mjs`). None can occur in an oklch token file; worth a comment in the script's docstring at most.

### F9. `AGENTS.md` still points at `docs/plan.md`, which does not exist — severity: nit (docs lens)
- `ls docs` → `architecture.md`, `porting-ai-elements.md`. The architecture doc is the replacement; update the two references in `AGENTS.md`.

Environment notes (not repo defects):
- Until ~00:10 the production server on :3000 was started before the last rebuild and served HTML pointing at a deleted stylesheet chunk (500), so every page was unstyled. The coordinator restarted it mid-run; everything under "live" above was redone afterwards, and `served-live.css` is byte-identical to `.next/static/chunks/0jgcpcuv4iy7d.css`, which is what I had analysed in the meantime.
- Other lenses mutate tracked files in this shared tree (`code-block.tsx`, `prompt-input.tsx`, `tool.tsx`, `inline-citation.tsx`, `queue.tsx`, `chat.tsx` appeared modified at various points). My harness refuses to mutate a file that is not pristine and verifies the sha256 after every restore (`pristine/SHA256`, all `OK`); my screenshot fixture rendered `Tool` while `tool.tsx` carried a foreign one-line mutation of unknown-state labels, which does not affect the error state shown.
- A checkpoint commit (`6b8666f`) captured my files mid-work. An earlier version of my browser file wrote review screenshots into `tests/browser/qa-round2/__screenshots__/`; I removed that block (the images live in scratch) and no PNG is tracked now, but please make sure none survives into the curated PR.

## Mutation log

| behaviour | mutation | test file | caught? |
| --- | --- | --- | --- |
| branch clamps the index into range | `clampBranch` → identity | `tests/browser/ai/branch.test.tsx` | yes (4) |
| branch ignores null/boolean children, keys elements | `Children.toArray` → raw array | same | yes (2) |
| branch `className` cannot override visibility | `className` left inside the spread | same | yes (2) |
| branch resets the count when content unmounts | layout-effect cleanup removed | same | **no** (35 pass) |
| same | same | `tests/browser/qa-round2/leaves-tokens.test.tsx` | yes (1) |
| response re-checks overflow on text-node edits | `characterData: true` removed | `tests/browser/ai/response.test.tsx` | **no** (16 pass) |
| same | same | `tests/browser/qa-round2/leaves-tokens.test.tsx` | yes (1, plus the F1 test that fails anyway) |
| response never touches dehydrated bodies | `isClaimedByReact` check bypassed | `tests/browser/ai/response.test.tsx` | yes (1) |
| response re-checks overflow on resize | `ResizeObserver.observe` never called | same | yes (1) |
| response memo skips same children/isAnimating | comparator → `false` | same | yes (1) |
| sources pluralises the count | always "sources" | `tests/browser/ai/sources.test.tsx` | yes (4) |
| sources relative links stay in-tab | `isExternal` → always true | same | yes (1) |
| sources trigger is a 24 px target | `min-h-6` removed from trigger | same | yes (1) |
| image falls back to `image/png` | fallback removed | `tests/browser/ai/image.test.tsx` | yes (1) |
| suggestion passes its string to `onClick` | `onClick?.("")` | `tests/browser/ai/suggestion.test.tsx` | yes (2) |
| light `--destructive` tuned for AA | reverted to `oklch(0.577 …)` | `tests/unit/tokens.test.ts` / `tests/browser/tokens.test.tsx` | yes (9) / yes (6) |
| base item ships the reduced-motion guard | `@media` block deleted from `registry/base/registry.json` | `tests/unit/tokens.test.ts` | yes (1) |
| sync-tokens rejects light/dark drift | `lightOnly` problem no longer pushed | `tests/unit/tokens.test.ts` | yes (2) |
| light `--ring` tuned to 3:1 | reverted to `oklch(0.708 0 0)` | `tests/unit/tokens.test.ts` / `tests/browser/button.test.tsx` | yes (7) / **no** (12 pass) |
| KaTeX stylesheet imported | `@import` line deleted | `tests/unit/tokens.test.ts` / `tests/browser/tokens.test.tsx` | yes (1) / yes (1) |

All 20 runs restored byte-identically (`sha256sum -c pristine/SHA256` → 8 × OK; `git diff --stat` empty for every mutated file).

## Test-quality issues (file › test name → problem)

- `tests/browser/ai/response.test.tsx › code block focusability › adds and removes the tab stop as a resize changes whether the code overflows` → `domQuiet(500)` is a timing sleep dressed as a quiet-period wait; a poll on "no tabindex after highlight" would do. Stable in 3 + 3 runs here, so noted, not failed.
- `tests/browser/ai/response.test.tsx › leaves server-rendered code blocks untouched until React has hydrated them` → `setTimeout(100)` to prove a negative; acceptable, but the assertion would pass trivially on a slow machine if the effect had not run yet. Consider asserting the rAF poll is active (e.g. count `requestAnimationFrame` calls) before checking the attribute.
- `tests/browser/ai/response.test.tsx` → no coverage for `characterData` (survived) or for Streamdown tables (F1).
- `tests/browser/ai/branch.test.tsx › messageBranch › throws error when components used outside MessageBranch provider` → fixture is not inside `<main>` (no axe in that test, so cosmetic).
- `tests/browser/ai/branch.test.tsx` → no coverage for the unmount reset (survived), for state preservation across navigation, or for a Fragment child (both pinned in my file).
- `tests/browser/button.test.tsx › keyboard focus › shows a ring and a ring-coloured border on the %s variant` → does not assert the ring token (T4b survived); `› does not show the focus ring after a pointer click` → `setTimeout(250)` sleep.
- `tests/browser/tokens.test.tsx › token wiring › renders destructive text with the tuned token in both themes` → asserts the literal oklch string (a value pin, fine as a tripwire; it will read `lab(...)` in production because Next's Lightning CSS rewrites the tokens, so it is Vite-only by construction).
- `tests/unit/tokens.test.ts › token layer › sync-tokens is a no-op on the clean tree` → runs the real script in a tmpdir where `pnpm exec prettier` finds no `.prettierrc`; it passes because Prettier's JSON defaults coincide with the repo's config. Copy `.prettierrc` next to the fixtures or compare after formatting both sides.
- `tests/unit/ssr.test.ts › registry components render on the server` → asserts only `html.length > 0` and does not spy on the console; it cannot tell the selector-less HTML of F5 from a full render. My unit file pins the actual shape.
- `tests/browser/ai/image.test.tsx › requires alt and treats an empty alt as decorative` → the `@ts-expect-error` line is load-bearing only under `tsc` (Vitest does not type-check); fine because `pnpm gate` runs `typecheck`, worth a comment.
- Names, `<main>` fixtures, shared helpers, no `test.skip`, no disabled axe rules: clean across the seven reviewed files.
- Flakiness: three consecutive runs of the seven browser files (124 tests) and `tokens.test.ts` (146) all green; three runs of each of my files identical (2/16 and 1/10).

## Verified OK

- Contrast model: my own oklch→sRGB→WCAG script (`contrast.mjs`) reproduces every number in `docs/architecture.md` §4 (light destructive 5.62 white, 4.68 `/10`, 3.86 `/20`, 4.64 `/80`, 5.21 `/90`, 5.15 muted; dark 5.59 `/20`, 4.55 `/30`, 4.66 `/80`, 4.86 popover; ring 3.36/3.08; old values 4.76/3.99/2.59/4.37/4.36) to ±0.005, and axe measures the same ratios on rendered swatches in both themes (my reproducer, `toBeCloseTo(…, 1)`). Hex: light `#d20000` (was `#e7000b`), dark `#ff7072` (was `#ff6467`), ring `#8c8c8c`.
- Every other use of `destructive` in `components/ui/**` and `registry/**` is text-on-tint, `text-destructive` on background/card/muted, `aria-invalid:border-destructive` (darker → better in light), or an icon; no solid `bg-destructive` + `text-white` anywhere, so nothing regressed by darkening the light token. Dark `/30` hover: axe/model 4.55 (the doc's "Chromium paints 4.43" is a canvas read-back I did not repeat).
- Visual read (`live/tool-*.png`, live `/preview/tool` error state with the baseline injected for "before"): light after is a deeper crimson that reads unambiguously as danger; dark after is marginally lighter and a touch pinker than before, still a clear error red, not salmon. Same conclusion from the Vitest-rendered fixture (`shots/`).
- Served/built CSS (`0jgcpcuv4iy7d.css`, live and on disk identical): `@layer properties, theme, base, components, utilities` then unlayered `tw-animate`/shadcn/streamdown/KaTeX rules, so `.katex` sits after the layers and beats utilities on its own elements; 9 KaTeX `@font-face` families bundled under `/_next/static/media`; the reduced-motion guard is inside `@layer base` with `!important` (beats every later layer and inline styles); shadcn's own shimmer guard is separate; tokens emitted as gamut-mapped hex plus `lab()` under `@supports`.
- `app/globals.css`: `@import`s precede everything, one `@source`, `@custom-variant dark (&:is(.dark *))`, tokens in both modes with `--radius` light-only, `@theme inline` maps every colour.
- `sync-tokens.ts`: runs directly under Node 24 type stripping (the unit tests spawn `node scripts/sync-tokens.ts`); BOM + CRLF copy → byte-identical committed JSON; `content: ";"`, `"}"`, escaped quotes, `!important`, multi-line values, comments with braces, nested at-rules, nested selectors, selector lists, `:root` under `@media` all handled as documented; missing file or no `base` item → exit 1 with a `sync-tokens: <path>: …` message and the registry untouched; `pnpm registry:build` is `node scripts/sync-tokens.ts && shadcn registry validate && shadcn build`, so a build regenerates the same bytes.
- `registry/base`: `dependencies` `cn`, `class-variance-authority`, `lucide-react`, `@base-ui/react`; `devDependencies` `tw-animate-css` (imported by the stylesheet); `registryDependencies` `utils`, `font-geist`, `font-heading-geist`; `css` nests `@layer base` → `@media (prefers-reduced-motion: reduce)` → `"*, ::before, ::after"` with string declarations, the shape `update-css.ts` `processAtRule`/`processRule` merges (an existing `@media` with the same params is reused, declarations replaced, so no duplication on re-init); `pnpm registry:validate` → "Registry is valid. Checked 8 registry files and 83 items"; 63 `registry:ui` aliases with no `files`; root `registry.json` unchanged vs `86bbd82`; `registry/ui` differs only by the `Input OTP` title.
- `docs`/`description` strings: branch (controlled `branch`, clamp, "0 of 0", null/boolean, RSC lazy nodes, Base UI Button), response (identical export/props, high-contrast shiki pair overridable — pinned in the canonical file, focusable overflow re-checked on stream/resize/after hydration, `@source` line, `styles.css` animations, KaTeX with `katex@^0.16` declared, `singleDollarTextMath` off by default — `@streamdown/math` dist `?? false`, plugins ship no classes — grep of the four dists), sources (Trigger/Panel props, data-open classes, typed `open`/`defaultOpen`/`onOpenChange`/`disabled`, plural, 24 px, span without href, absolute vs relative, hostname/href fallback), suggestion (ScrollArea.Root props), image (required `alt`, only alt/class/src reach the element — live and Vitest, `image/png` fallback, nothing on empty base64, `DefaultGeneratedFile` spread renders nothing — and `tsc` agrees the spread type lacks `base64`/`uint8Array`), base (class-based dark via the CLI's own `@custom-variant`, guard, generated cssVars) all match the code. `Experimental_GeneratedImage` is indeed the deprecated alias (`ai/dist/index.d.ts:1159-1162`).
- `branch`: keys are stable across navigation (an `<input>` inside a branch keeps its value and the same wrapper node after Next/Previous); a Fragment child counts as one branch ("1 of 1", selector hidden) as upstream; `Children.toArray` drops `undefined`/`null`/`false`; wrap both ways with `onBranchChange` on wrap; buttons disabled with ≤ 1 branch; accessible names "Previous branch"/"Next branch" survive custom children; `renderToString` is silent (React 19 has no `useLayoutEffect` SSR warning: not present in `react-dom/cjs`).
- `response`: default `codeBlockMaxHeight` is 400 (Streamdown), and a 60-line block becomes a tab stop through vertical overflow; `characterData` mutations re-check overflow; SSR + `hydrateRoot` test is load-bearing (M6); memo comparator load-bearing (M8); `shikiTheme` override pinned upstreamwise.
- `sources`: `disabled` disables the trigger and blocks `onOpenChange`; `onOpenChange(open, { reason: "trigger-press" })`; `mailto:` and `//cdn…` are external (new tab, `noreferrer noopener`), label falls back to the href when there is no parseable hostname; React 19 rewrites a `javascript:` href to its blocked stub, so a model-supplied URL cannot execute (pinned).
- `suggestion`: viewport `tabindex="0"` only while overflowing (live at 375 px and in Vitest), ArrowLeft/Right scroll it, `onClick(suggestion)` (M13), `size`/`variant` forwarded, `xs` still ≥ 24 px.
- `image`: `image/svg+xml;charset=utf-8` yields a valid `data:image/svg+xml;charset=utf-8;base64,…` URL; live preview `<img>` attributes are exactly `alt,class,src` and both decode at 640 px.
- Live previews (after the restart): `/preview/{branch,response,sources,suggestion,image,tool}` log no console error or warning in light and dark, hydrate, and the reduced-motion guard is effective under media emulation.

## Could not reach

- A real `shadcn init @uifiles/base` / `add` round trip: `ui.shadcn.com` is blocked, and the base item's correctness for a fresh consumer (`index` supplying `@import "shadcn/tailwind.css"` and its package) is reasoned from `packages/shadcn/src` (`update-css-vars.ts`, `update-css.ts`) rather than executed.
- Painted-pixel (canvas) contrast of the dark `/30` hover tint; I report axe/model numbers only.
- The `lab()`-rewritten production tokens were inspected in the CSS, not measured with axe (Vitest serves the `oklch()` source through Vite).
- `pnpm registry:build` end to end (forbidden by the brief); reasoned from `package.json` and the script.
- Screen-reader behaviour; DOM/ARIA only.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round2/leaves-tokens

# reproducers (final shape: browser 2 failed | 16 passed (18) ×3; unit 1 failed | 10 passed (11) ×3)
pnpm exec vitest run --project browser tests/browser/qa-round2/leaves-tokens.test.tsx --reporter=verbose
pnpm exec vitest run --project unit tests/unit/qa-round2-leaves-tokens.test.ts --reporter=verbose
pnpm exec prettier --check tests/browser/qa-round2/leaves-tokens.test.tsx tests/unit/qa-round2-leaves-tokens.test.ts   # clean
pnpm exec biome check <same>                                                                               # clean
pnpm exec tsc --noEmit                                                                                     # 0 errors

# stability, three runs each (stability.log, stability-qa2*.log)
pnpm exec vitest run --project browser tests/browser/ai/{branch,response,sources,suggestion,image}.test.tsx tests/browser/tokens.test.tsx tests/browser/button.test.tsx   # 124 passed ×3
pnpm exec vitest run --project unit tests/unit/tokens.test.ts                                                                                                          # 146 passed ×3
pnpm exec vitest run --project unit tests/unit/test-setup.test.ts tests/unit/registry.test.ts                                                                          # 29 passed

# mutations (harness: python3 $S/mutate.py <label> <file> <old> <new> <test> [-t filter]; logs mut-*.log; sha256sum -c $S/pristine/SHA256 -> all OK)

# tokens
node $S/contrast.mjs                      # independent WCAG model vs docs/architecture.md §4
node $S/parser-probe.mjs                  # sync-tokens edge cases
node $S/cascade.mjs                       # Chromium: unlayered :root wins in both orders
pnpm registry:validate                    # Registry is valid. Checked 8 registry files and 83 items.
curl -s http://localhost:3000/preview/response | grep -o 'href="[^"]*\.css"'   # after the restart: 0jgcpcuv4iy7d.css 200 (152869 B), 3x59cvfd7p2ai.css 200
cmp $S/served-live.css .next/static/chunks/0jgcpcuv4iy7d.css               # identical
node -e '…postcss walk of the built sheet…'                                  # .katex unlayered after the layers; reduced-motion inside @layer base

# live previews (after the coordinator's restart; live.log, live/*.png)
node $S/live.mjs                          # tool light/dark after/before, response@375 axe + katex, branch/sources/image/suggestion checks, console capture
node $S/motion.mjs                        # reducedMotion emulation: enter animation 150ms -> 0.01ms
curl -s http://localhost:3000/preview/branch | grep -c 'aria-label="Next branch"'   # 0 (selector renders on the client)
```
