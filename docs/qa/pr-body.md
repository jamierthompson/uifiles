## What

Adversarial QA of the whole registry before public release, run as fresh-agent rounds: nine independent QA lenses attacked the untouched codebase, ten independent fixers (disjoint file ownership) fixed every confirmed finding and ported the upstream AI Elements test suites, then a second set of fresh reviewers verified each fix and re-attacked; a third round, an integration round and a polish round repeated that until every group ended not refuted and a completeness critic returned ship. The raw briefs, reports and verdicts are committed under `docs/qa/` (index in `docs/qa/README.md`). No agent that found a defect fixed it, and no agent that fixed one verified it.

**Before:** 52 tests, gate green. **After:** 1,258 Vitest tests (344 unit, 914 browser-mode with axe), 98 Playwright e2e tests (desktop and mobile, light and dark) against the production build, per-file coverage thresholds (80/80/70; measured ~99% lines), strict TypeScript (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`), a fail-on-console guard, WCAG 2.2 AA axe tags with `target-size` enabled, hardened CI.

## Registry directory question

The requirement "the `files` array must NOT include a `content` property" applies to the index (`/r/registry.json`). `shadcn build` strips `content` from the index and puts it in each `/r/<name>.json`, which the CLI needs to install. Verified against the CLI source (`loader.ts` `stripRegistryItemFileContent`) and the health monitor. uifiles already complied; nothing changed there.

## QA log, round 1 (defect → fix → re-check)

### prompt-input (1 high, 7 medium, 5 low)
- Menu-item activation and footer whitespace clicks moved focus to the model select (shadcn `InputGroupAddon` focuses the first `<input>`, which under Base UI is the Select's hidden input) → header/footer own the click handler and focus the textarea → verified by keyboard and mouse tests.
- Enter submitted a second message while streaming (Stop is `type="button"`, so the "disabled submit" check found nothing) → Enter only submits through an enabled `button[type=submit]`.
- `accept=".pdf"`/`*/*` never matched; partial drops (`maxFileSize`, `accept`) were silent; failed `onSubmit` erased the typed text; no `keyCode 229` guard; `onError`/`createObjectURL` inside the state updater doubled under StrictMode; consumer `onClick` on `PromptInputActionAddAttachments` swallowed; tooltips opened after 600 ms vs upstream's 0; screenshot failures became unhandled rejections; toolbar overlapped the submit button at 375 px; textarea named only by placeholder. All fixed, each with a test that failed first.
- Tests: 5 → 127 (81 upstream tests ported).

### chat block (4 high, 3 medium)
- Whole page crashed when the AI SDK emitted a tool part with `input: undefined` (it does on every `tool-input-start`) → guarded in the block and at the root in `tool`/`code-block`, plus a per-part error boundary.
- Enter mid-stream started a second concurrent request (40 messages, thousands of duplicate-key errors) → submits blocked while generating; draft kept.
- No error surface at all when a transport failed → `error`/`onRetry` props and `ChatErrorMarker` with Retry.
- "Thinking…" stuck forever after Stop → only the last message is live.
- Files-only turns rendered an empty bubble; empty assistant rows during `start`; duplicated helper. Tests: 5 → 50.

### code-block, context, model-selector, inline-citation (3 high, 7 medium)
- Token cache keyed on length + first/last 100 chars showed stale code after mid-snippet edits → keyed on full code, in-flight dedupe.
- Overflowing code was not keyboard reachable (axe serious) → focusable named region when overflowing, hydration-safe.
- Shiki dual-theme `bg`/`fg` strings were discarded → split into colour + custom properties.
- `new URL(relative)` crashed the message tree → `URL.canParse` fallback. Citation badge unreachable by keyboard → real button trigger. Carousel index stale on slide changes; `1/0` with no slides.
- Context showed `NaN%`/`∞%` at `maxTokens: 0`; reasoning always priced `$0.00`; footer ignored cache/reasoning → partitioned rows that sum to the total.
- Model selector empty state failed `aria-required-children`; logo alt polluted every option name; fuzzy filter matched "Sonnet" for "opus". Tests: 7 → 178.

### reasoning, tool, task, plan, chain-of-thought, queue, checkpoint, confirmation (1 high, 6 medium)
- `ToolInput` crashed on `input: undefined`; `ToolOutput` hid `0`/`false`/`""`; unknown state rendered a blank badge.
- Reasoning auto-close timer restarted on every parent render (the `useCallback([onOpenChange])` port pattern) → ref-held stable setter, documented as the pattern for every port; auto-open re-opened a panel the user closed mid-stream → transition-based.
- Queue action buttons were invisible when focused (hover-only opacity) → visible on focus; indicator dots below 3:1 → full-alpha.
- Confirmation rendered an empty `role="alert"` for approved-then-errored calls. Trigger rows under 24 px → `min-h-6`. Tests: 10 → 228 (upstream regression tests #63/#86 included).

### branch, response, sources, suggestion, image (1 high, 2 medium)
- `MessageBranchContent` showed every branch when `className` was passed (even `undefined`) → className merged after the visibility class; `null` children crashed → `Children.toArray`; out-of-range `defaultBranch` clamped; RSC lazy children no longer warn.
- Response self-inflicted a hydration mismatch at narrow widths; no resize re-check → hydration-aware marking plus `ResizeObserver`.
- "Used 1 sources"; 16 px trigger; `<p>` in button; `Image` without `alt` → `alt` required. KaTeX stylesheet was never loaded, so every formula rendered twice. Tests: 10 → 96.

### tokens and CSS (1 high, 4 medium)
- Every destructive variant failed AA in light mode (3.99:1) → light `--destructive` `oklch(0.577…)` → `oklch(0.52…)` (5.62:1 on white, 4.68:1 on the `/10` tint); dark nudged to `0.74` for the `/80` and hover rows; light `--ring` `0.708` → `0.64` (3.36:1). `--input`/`--border` left as Nova's; the 3:1 values are recorded for a deliberate decision.
- `sync-tokens.ts` silently dropped tokens on a trailing comment or nested at-rule → comment/string-aware brace parser with parity and count invariants, exits non-zero.
- No reduced-motion handling → global guard in `@layer base`, mirrored into the base item. Base item no longer forces `next-themes`/`shadcn` on consumers. Line numbers at 2:1 fixed.

### registry contract, tooling, CI (0 blocker, 4 medium)
- 19 items imported `cn` without declaring it → declared. GitHub-path README example pinned a tag that did not exist. `upstream.lock.json` tracked unported items and missed `branch`/`response`; the weekly drift workflow could never open an issue (`| tee` masked the exit code) and had no dedupe → fixed, label auto-created, exit codes 0/1/2.
- CI: SHA-pinned actions, least-privilege permissions, concurrency, timeouts, browser cache, `pnpm audit`, `git diff --exit-code -- registry` after build, e2e against `pnpm start` with html + github reporters and artifacts. Dependabot added.
- Test infra: shared `tests/a11y.ts`, fail-on-console `tests/setup.ts`, coverage thresholds, SSR test for every component, registry invariants (undeclared imports, unknown deps, target collisions, version drift).

### site, docs, OSS hygiene (3 high, 9 medium)
- Production `/` and `/llms.txt` baked `http://localhost:3000` unless an env var was set → Vercel-aware origin resolution that fails a production build loudly.
- GitHub reported the licence as "Other": the MIT file had an appended paragraph and a second root `LICENSE*` file → pristine MIT, Apache text moved to `licenses/`, attribution completed in `NOTICE` (vendored `components/ui`, `registry/ai`, tracked third-party skills).
- `docs/plan.md` was a second-person planning memo (with a naming section) → replaced by `docs/architecture.md`. Skill pointed at a non-existent `references/` dir; porting doc's fences were malformed; README claims corrected.
- Added `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue/PR templates, `CODEOWNERS`, `CHANGELOG.md`; metadata, `not-found`, `robots`, a visible theme toggle; `package.json` metadata and `0.1.0`.

### rendered surface (5 high, 6 medium)
Real-browser pass over every page in both themes at phone and desktop widths, keyboard tab order, the chat demo end to end. Its findings are folded into the sections above (chat Enter-mid-stream, KaTeX, code-block focus, queue focus visibility, citation keyboard access, response hydration, toolbar overlap, stuck Thinking, target sizes).

## QA log, round 2 (fresh reviewers verified round 1, then re-attacked)

Every round-1 fix was verified (all 24 in the code/context/model/citation lens, all 20 in the disclosure lens, all in the leaves, tokens, meta and prompt-input/chat lenses; 15 of 23 rendered-surface items fixed outright, the rest partial and picked up below). Reviewers ran 100+ real mutations against the new tests; the survivors became new tests. New findings and their fixes:

- **Chat**: the composer's submit handler returned the streaming promise, so attachments stayed in the composer (with a live Remove button) until the reply finished → `void` submit, per-submit attachment clearing; a rejected submit (`onSubmit` returning `false`) restores the draft; a generic error row when `status === "error"` and no `error` prop; `onRetry` rejections caught; one placeholder ("No input yet") for tool parts without input.
- **Prompt input**: the footer click handler stole focus from any non-button control → generic interactive-element check; provider-mode `maxFiles` bypass with two `add()` calls; controlled-textarea restore; tooltip descriptions never duplicate the visible label; wall-clock timing assertions replaced by fake timers.
- **Inline citation**: the new button trigger opened on hover and focus but not on tap, so phones could not open it, and Tab skipped the popup → click/tap toggles and pins the card, focus moves into it, Tab cycles, Escape returns focus without reopening; `URL.canParse` replaced with try/catch (older Safari); empty children render nothing.
- **Model selector**: `ModelSelectorLogo` gained a `src` prop; the docs-site preview no longer loads logos from models.dev (inline data URIs), so e2e is hermetic; e2e now blocks every non-localhost request.
- **Code block**: prototype-key language names (`constructor`) bypassed the fallback; cache key collided on a colon; scroll containers are `role="group"` named by language so two blocks do not trip `landmark-unique`.
- **Context**: `undefined` counts rendered `NaN` in the header → every count path guarded.
- **Queue**: hover-revealed actions were unreachable on touch devices (Tailwind compiles `group-hover` inside `@media (hover: hover)`) → `pointer-coarse:opacity-100`; clamped titles wrap to two lines.
- **Reasoning**: a stream that started and ended within the same second showed "Thinking…" forever → at least 1 s.
- **Checkpoint / confirmation**: tooltip mirrored into an accessible description; rejected outcome visually distinct.
- **Response**: Streamdown tables were not focusable scroll regions at phone width (axe serious) → every overflowing scroller is a named group.
- **Branch**: the selector and "n of N" now render on the server (count derived during render, not in a layout effect); a controlled index clamped on shrink reports through `onBranchChange`.
- **Sources / suggestion**: empty-string title falls back to the hostname; chips scroll into view on focus.
- **Tokens script**: an unlayered `:root` beats a later layered one, matching the cascade; two layers for one token throws.
- **Tooling/CI**: built-output schema tests skipped silently in CI (they ran before the build) → build first, fail instead of skip; `react-dom/*` pre-bundled; `NEXT_PUBLIC_BASE_URL` asserted in the workflow and required by e2e in CI; console guard runs cleanup first and cannot be bypassed with a spy; workflow tests parse YAML; a mobile (375×812) Playwright project; `waitForIdle` without sleeps; audit moved after tests.
- **Docs/site**: home install `<pre>` wraps instead of scrolling; every preview page has its own title; `demo-conversation.ts` typed `registry:lib`; architecture doc counts corrected; CHANGELOG written for outsiders.

## QA log, round 3 (fresh reviewers verified round 2, then re-attacked)

Every round-2 fix was verified by four fresh reviewers (two component lenses, a meta lens over the test infrastructure and CI, and a real-browser pass over every page in both themes at phone and desktop width). Three highs and a handful of mediums remained; each fix below was then checked by three independent verifiers per group (correctness, test quality with mutation testing, regressions), followed by a completeness critic over the whole tree. The verifiers refuted two of the three groups on first pass (a reasoning formula the global math rule made keyboard-unreachable; a clamped queue title without its `title` mirror) and the integration round below closed both; every group ended not refuted, with 29 of 29 mutations caught on the response/branch group alone. A completeness critic then re-ran the whole gate on the final tree (format, lint, typecheck, registry validation, unit and browser suites, coverage with per-file thresholds, audit), re-checked every blocker and high from all three rounds against the source, sampled 32 documentation claims against the code, and returned **ship**, with sixteen low notes; the polish round below closed the code-level ones and the rest are recorded in `docs/qa/round3/critic.md`.

- **Inline citation** (high): paging to the first or last slide with Enter or Space disabled the arrow under focus, so keyboard focus fell to `<body>` → the arrows are `aria-disabled` at the ends and stay in the Tab order; Escape returns focus to the badge also from a pinned card whose focus was lost. The badge exposes `aria-expanded`/`aria-controls`; a pinned card is a `role="dialog"` named by its badge; the card shows a focus ring when keyboard focus lands on it.
- **Response** (high): a display formula wider than a phone widened the whole page → `.katex-display` scrolls sideways and is a named "Math" tab stop only while it overflows; a pixel test guards that tall constructs are not clipped. Streamdown's fullscreen table view is a named tab stop too. The link-safety modal is replaced through Streamdown's own `renderModal` with a native `<dialog>` (focus moves in, page inert, focus returns on close, whole URL wraps, translations respected).
- **Theme toggle** (high, WCAG 2.1.4): the bare `d` hotkey is removed; the toggle is the only theme control.
- **Branch**: on the App Router the branch count was wrong in the first HTML because client references arrive as lazy element types → `componentOf()` resolves lazy, `memo` and `forwardRef` types and suspends on a module still loading; proven by a real Flight round trip (server render in a `react-server` child process, decoded by Next's Flight client, prerendered by Fizz). A controlled clamp is reported once under StrictMode.
- **Prompt input**: provider-mode `maxFiles` kept a count that only grew, so `remove(); add()` in one handler was refused → the check reads the live attachment list; a double submit during blob conversion sends each file once; `onSubmit` calls are ordered; a tooltip `shortcut` becomes `aria-keyshortcuts`.
- **Chat block**: a rejected or throwing `onSubmit` is reported through `console.error` and the draft is kept, instead of an unhandled rejection.
- **Checkpoint / confirmation / queue**: the tooltip-versus-name check compares text (arrays, fragments, numbers) rather than identity; a consumer's `aria-describedby` wins; the rejected outcome's colour can be overridden; a truncated queue chip carries the whole name in `title`, and the two-line clamp holds under WCAG 1.4.12 text spacing.
- **Console guard**: a swallowing console spy restored before the check (file- or describe-level `restoreAllMocks`, or `mockRestore()`) bypassed the guard → the guard wraps every level from installation and charges exactly the calls that never reached it; a static check rejects any `vi.spyOn(console, …).mockImplementation` in browser tests.
- **CI and site**: the SHA-pin test rejected Dependabot's `# v5.0.1` comments; the production-origin warning tests could pass on a tripped flag; `expectsPublicOrigin` demanded a localhost-free page when `.env.example` was exported locally; five client preview pages and the 404 page had no title.
- **Manifests**: `docs` strings updated for the citation, response, branch, prompt-input and queue items (Base UI sentence first, the KaTeX stylesheet requirement, the link-safety dialog).

### Integration round (what the round-3 fixers left for other owners, plus the two refutations)

- **Reasoning** now renders through Message Response, so reasoning content gets the same named scroll regions, the accessible link dialog and the AA syntax colour pair; the `reasoning` item depends on `@uifiles/response` and declares only what it imports. A test pins each of those on the reasoning surface, including the exact 375 px formula probe a verifier used.
- **Code block** creates one Shiki highlighter and loads grammars on demand; ten distinct languages no longer trigger Shiki's "10 instances" warning or reload both themes. The start-up-failure test is order-independent (the file passes under `--sequence.shuffle`).
- **Stylesheets ship with the item**: the `response` item's `css` field carries `@import "streamdown/styles.css"`, `@import "katex/dist/katex.min.css"` and the `.katex-display` scroll rule, which the CLI inserts after the consumer's existing imports and merges into dependants (`reasoning`, `chat`); only the `@source` line stays manual because its path is relative to the consumer's CSS file.
- **Queue**: the item title mirrors its text in `title` like the chip, so a title clamped under WCAG 1.4.12 text spacing is still available in full.
- **Previews**: every preview's `<title>` and `<h1>` equal the registry item title, pinned by unit tests; the reasoning preview carries a long-line fence, a wide table and a wide formula so the Playwright sweep covers those regions at 375 px.
- **End to end**: every preview asserts no sideways page scroll at desktop and 375 px, the served HTML of the branch preview carries the selector and count, the response formula overflows its own box rather than the page, and each route's title starts with its item title.
- **Registry invariants**: every declared dependency is imported by a file or loaded by a `css` `@import`; no item repeats a `css` rule an `@uifiles/*` dependency ships.
- **Test hygiene**: the SSR test no longer charges first-import cost to its first case (a 1-in-2 timeout under full-suite load); temp directories are removed; nine cross-owner test pins migrated (chat tool parts, suggestion focus, six token-parser edges).

### Polish round (the critic's low notes)

- **Prompt input**: the submit button is named "Stop" only when `onStop` is wired, the same condition that turns it into a `type="button"` that stops; without `onStop` it keeps the Submit name, type and glyph while generating (before, a screen-reader user heard "Stop", pressed, and sent a message). In provider mode the text is now taken and cleared as a submit starts, like local mode, so a second submit during blob conversion no longer re-sends the draft; a rejected submit restores it unless the user typed since.
- **Inline citation**: a closed card is never pinned, so a controlled parent that refuses a press no longer gets a modal dialog on the next open; a parent that opens from `onOpenChange` in the same update still does.
- **Test infrastructure**: the repeated-css registry check compares selectors with `@layer` wrappers stripped; `@plugin` keys count as a dependency use; the code block's failed-highlight subscriber cleanup is pinned; the pre-bundling scan follows local imports into the preview pages browser tests render; the response phone-width e2e runs in both colour schemes with the page-problems collector; `e2e/origin.ts` returns a boolean for an unparsable origin instead of throwing inside a spec; `baseUrl()` is pinned silent outside production; two migrated pins gained axe scans.

## Owner decisions recorded (not changed)
- Light `--input`/`--border` stay at Nova's values (1.26:1); making field borders 3:1 (`oklch(0.66 0 0)`) is a visible design change.
- Chart tokens remain a grey ramp; a 5-hue categorical proposal is in the QA report.
- Reasoning: a second stream auto-opens and auto-closes once more (upstream never auto-closed a second time).
- Context rows are partitioned (Input excludes cached reads; Output excludes reasoning) so counts and costs agree.

## Release checklist
- Create the `v0.1.0` tag after merge (README pins `#v0.1.0`).
- Set `NEXT_PUBLIC_BASE_URL=https://uifiles.dev` on the Vercel project (the build now fails loudly in production without an origin).
- Submit the directory entry (in `docs/qa/RECOMMENDATIONS.md` §2) to `shadcn-ui/ui` `apps/v4/registry/directory.json`.

## Checklist

- [x] `pnpm gate` and `pnpm test:e2e` pass locally (format, lint, typecheck, registry validate and build with no generated-file drift, `pnpm test:coverage` 1,258 tests with per-file thresholds, `pnpm build`, 98 e2e against `pnpm start`)
- [x] Opened the affected `/preview/<name>` pages (every preview, light and dark, desktop and 375 px, through the Playwright sweep and the rendered-surface reviews)
- [x] Tests cover the change (browser tests with axe via `tests/a11y.ts` for every component; unit tests for the registry, tokens, site, tooling and CI)
- [ ] New item: none added (every existing item gained a retrieval-quality `description`, a titled preview page and a browser test)
- [x] AI Elements port: Apache header kept, `registry/ai/upstream.lock.json` keyed by shipped item, API changes in each item's `docs` and in `docs/architecture.md` §3
- [x] Tokens changed in `app/globals.css`, and the regenerated `registry/base/registry.json` is committed
- [x] Docs updated where a command, count or rule changed (`AGENTS.md`, `README.md`, `docs/`, `CHANGELOG.md`)
- [x] Conventional commit titles with a scope (twelve thematic commits)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_011c5Y9Tg3h1mMnLsFt4rqwg
