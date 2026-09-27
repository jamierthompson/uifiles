# test-quality — QA round 1

## Summary

I attacked the test suite, the Vitest/Playwright/axe configuration and the CI wiring, not the
components. Method: 12 empirical mutations (component patched, single test file run, file
restored, `git diff` proven clean), a shuffled full run of the existing browser suite, an
inspection of every test file against the recipe in `docs/porting-ai-elements.md` §4, and two
new reproducer files (unit: 29 tests, all pass and pin invariants; browser: 6 tests, 1 fails by
design). Findings: 0 blocker, 2 high, 6 medium, 5 low, 1 nit. **The single worst thing: 7 of 12
mutations survived (58 %), and the reason is structural — upstream AI Elements ships 391 tests
for the items that were ported (including regression tests for its own issues #63 and #86) and
the port kept 47, so the port's `reasoning`, `confirmation`, `tool`, `context` and `chat` tests are
green on faith.** Second worst: CI's only failure artifact (`playwright-report`) is a directory the
configured reporter never writes, and e2e never runs against the production build it just made.

## Findings (most severe first)

### F1. The port dropped upstream's component test suite (391 tests → 47) — severity: high
- Where: `tests/browser/ai/*.test.tsx` (47 `it()`s across 19 files); upstream
  `scratchpad/upstream/ai-elements/packages/elements/__tests__/` (47 files; the 16 that cover
  ported items hold 391 `it()`s: prompt-input 81, model-selector 40, plan 38, message 30, queue 30,
  context 27, inline-citation 26, reasoning 18, confirmation 17, chain-of-thought 16, sources 11,
  code-block 9, suggestion 8, plus `image`, `task`, `tool` which the port also tests with 1–2 each).
- What: none of the upstream tests were carried over, including the regression tests for
  upstream bugs: `reasoning.test.tsx:204` "rounds sub-second durations up to 1 second - #63"
  (fake timers, asserts the `Math.ceil` in `registry/ai/reasoning.tsx:280`) and
  `reasoning.test.tsx:120` "does not auto-close old messages when manually opened - #86"
  (asserts the `hasEverStreamedRef` guard at `reasoning.tsx:293-298`). Mutations M3 and M4 (below)
  removed exactly these behaviours and the port's suite stayed green. Upstream also runs
  `vitest-fail-on-console` (`__tests__/setup.ts:17-24`), so React `act`/key/hydration warnings fail
  tests there and are silently printed here.
- Evidence: counts above (`grep -c -E '^\s*(it|test)\(' …`); mutation log M3/M4.
- Why it matters: every port claims "same public API" (porting doc §0); the only thing that could
  prove that on Base UI is the upstream behavioural suite, and it is absent. The directory
  listing PR will be reviewed by people who know what upstream tests look like.
- Proposed fix: port `__tests__/<name>.test.tsx` for each of the 18 items into
  `tests/browser/ai/<name>.test.tsx` (upstream already runs Vitest browser mode with
  `@testing-library/react`; `render`→`vitest-browser-react`, `screen`→`page`, keep the `<main>`
  wrapper and one axe pass per test), and add a fail-on-console setup file.

### F2. Seven vacuous assertions: the suite passes with the behaviour broken — severity: high
Each bullet is one surviving mutation (details and commands in **Mutation log**).
- **M2** `tests/browser/ai/tool.test.tsx:83-85` — `getByText("Error", { exact: true }).first()`
  is satisfied by the status *badge* ("Error"), so the `ToolOutput` "Error"/"Result" header at
  `registry/ai/tool.tsx:160` is untested; the mutation `{"Result"}` (never "Error") passes.
- **M3** `tests/browser/ai/reasoning.test.tsx:51-64` — the "auto-opens while streaming" test mounts
  with `isStreaming` already true, which `resolvedDefaultOpen` (`reasoning.tsx:241`) handles; the
  auto-open *effect* (`reasoning.tsx:286-290`, the transition from not streaming to streaming after
  mount) is never exercised; disabling it passes.
- **M4** `reasoning.test.tsx:78-91` — `/Thought for/` also matches "Thought for a few seconds"
  (`reasoning.tsx:346-347`), so `setDuration(undefined)` instead of the computed `Math.ceil(...)`
  passes. No test asserts a computed duration.
- **M7** `tests/browser/ai/context.test.tsx:76` — only `getByRole("progressbar")` visibility; the
  progress value (`context.tsx:194`, `usedPercent * PERCENT_MAX`) mutated to `usedPercent`
  (0.4 instead of 40) passes.
- **M10** `tests/browser/blocks/chat.test.tsx` — removing `autoScroll` from
  `MessageScrollerProvider` (`chat.tsx:127`) passes all 5 chat tests. Nothing tests the block's
  headline behaviours: follow streamed output, `scrollAnchor` on user turns (`chat.tsx:273`),
  `aria-busy` (`chat.tsx:177`), the scroll-to-bottom button.
- **M11** `chat.test.tsx:151-182` — the streaming test never checks the reasoning part; setting
  `isStreaming={false}` permanently (`chat.tsx:323`) passes.
- **M12** `tests/browser/ai/confirmation.test.tsx:63-97` — both outcomes are rendered in one tree
  and the test only checks both texts are visible, so swapping the `approved` conditions of
  `ConfirmationAccepted`/`ConfirmationRejected` (`confirmation.tsx:115-121`, `137-143`) passes.
- Also vacuous by inspection: `tests/browser/ai/response.test.tsx:66-73` "does not re-render when
  children and isAnimating are unchanged" has no render counter; it asserts that "world" is
  visible before and after `rerender`, which any implementation satisfies. Removing `memo` from
  `response.tsx:38` cannot fail it.
- Test written: `tests/browser/qa-round1/test-quality.test.tsx` does not re-test components
  (other lenses own behaviour); the mutation log is the evidence.

### F3. Five different `settle` helpers; prompt-input's hangs on any infinite animation — severity: medium
- Where: `tests/browser/ai/prompt-input.test.tsx:33-34` (no filter, no `.catch`);
  `tests/browser/ai/checkpoint.test.tsx:49-53` (popup subtree, no `.catch`);
  `context.test.tsx:21-22`, `model-selector.test.tsx:22-23`, `inline-citation.test.tsx:24-25`
  (`.catch` but no infinite filter); `reasoning`/`branch`/`chain-of-thought`/`response`
  (`iterations !== Infinity` filter, no timeline filter); `blocks/chat.test.tsx:21-32` (both
  filters + catch). The recipe in `docs/porting-ai-elements.md` §4 has *only* the timeline filter
  and matches none of the nine files. Ten files have no settle at all.
- What: `Promise.all(document.getAnimations().map(a => a.finished))` never resolves while an
  `animation: … infinite` runs (Spinner `animate-spin`, `components/ui/spinner.tsx:11`; the
  `shimmer` class; `animate-pulse` on `tool.tsx:62`) and rejects with `AbortError` when an
  animation is cancelled by an unmount or a class change. The prompt-input file survives today only
  because no test in it renders `status="submitted"`; the first one that does will hang until the
  15 s test timeout.
- Evidence: `tests/browser/qa-round1/test-quality.test.tsx` › "prompt-input's settleAnimations
  helper resolves while an infinite animation is on the page (expected FAIL: it hangs)":
  `AssertionError: expected 'hung' to be 'settled'` (3/3 runs).
- Proposed fix: one `tests/a11y.ts` with `settle()` = chat's version, used everywhere; update §4.
- Test written: the above (expected: FAIL now).

### F4. CI's only failure artifact is a directory the reporter never writes — severity: medium
- Where: `.github/workflows/ci.yml:24-28` uploads `playwright-report` on failure;
  `playwright.config.ts:8` sets `reporter: process.env.CI ? "github" : "list"`.
- What: the `github` reporter emits annotations only; `playwright-report/` is the **html**
  reporter's folder (`node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/lib/runner/index.js:3447`,
  `resolveReporterOutputPath("playwright-report", …)`). Traces (`trace: "on-first-retry"`) go to
  `outputDir`, default `test-results` (`node_modules/playwright/types/test.d.ts:1507,1538`).
  `actions/upload-artifact@v4` defaults `if-no-files-found: warn` (`action.yml` line 19,
  fetched from raw.githubusercontent.com), so a red e2e run uploads nothing and only warns.
- Why it matters: the first e2e failure on GitHub will be undiagnosable from the run page.
- Proposed fix: `reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list"`
  and upload both `playwright-report` and `test-results`. Corrected workflow in **Coverage plan**.

### F5. e2e never tests the production build it just made; registry is built twice — severity: medium
- Where: `ci.yml:21-23` runs `pnpm build` (= `registry:build && next build`) then `pnpm test:e2e`;
  `playwright.config.ts:11-16` `webServer.command: "pnpm registry:build && pnpm dev"`.
- What: CI compiles the app with `next build`, discards it, rebuilds the registry a second time and
  runs the suite against `next dev` (compile-on-demand, dev-only overlays and warnings). Locally,
  `reuseExistingServer: !process.env.CI` skips the *whole* command when a dev server is up, so
  `public/r` is not rebuilt and `e2e/registry.spec.ts` can test stale JSON.
- Why it matters: SSR/streaming/`force-static` behaviour of `/llms.txt` and `/preview/*` under the
  production server is never exercised; AGENTS.md says "server rendering and hydration are not
  exercised by the browser tests", and e2e is the only place they could be.
- Proposed fix: `command: process.env.CI ? "pnpm start" : "pnpm registry:build && pnpm dev"`
  (CI already ran `pnpm build`); keep `reuseExistingServer` false in CI.

### F6. axe configuration: no WCAG 2.2 rule ever runs; `region` disabled instead of scoped; dark mode untested — severity: medium
- Where: every `axe.run(document.body)` call and both `new AxeBuilder({ page }).analyze()` calls
  (`e2e/*.spec.ts`), all with default options (`@axe-core/playwright/dist/index.mjs:106`
  `this.option = {}`).
- What (verified with `axe.getRules()` on the installed axe-core 4.13.0): the default run is
  "every enabled rule"; `target-size` — the only rule tagged `wcag22aa` — is `enabled: false` by
  default, as are `color-contrast-enhanced` (AAA) and 7 `experimental` rules. So no test checks
  WCAG 2.2 AA. Best-practice rules (30, incl. `region`, `heading-order`,
  `landmark-one-main`, `page-has-heading-one`) do run, which is good. Three tests turn `region` off
  wholesale to cope with a portaled popup (`code-block.test.tsx:120`, `prompt-input.test.tsx:144`,
  `checkpoint.test.tsx:57`), which also stops checking the rest of the page; `queue.test.tsx:96`
  turns off `color-contrast` for the completed state (documented as inherited design; note the
  plan says muted-foreground was darkened for AA, so the exemption should be re-measured).
  Impact levels are not filtered anywhere (good: `violations` asserted `toEqual([])`).
  **Nothing renders under `.dark`** in `tests/` or `e2e/`; the shiki dark theme, `dark:invert`
  logos, and every `.dark` token are unmeasured.
- Evidence: rule dump in **Commands run**; my two dark-mode axe passes (tool+code-block, chat
  transcript) pass today, so this is a gap, not a bug.
- Proposed fix: `tests/a11y.ts` with `runAxe(context = document.body, opts?)` that pins
  `runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"] }`,
  `rules: { "target-size": { enabled: true } }`, and reports `impact` per violation; for popups use
  `exclude`/scoping of the landmark check rather than disabling `region`; a `withDark()` helper;
  in e2e `AxeBuilder.withTags([...])` + `page.emulateMedia({ colorScheme: "dark" })` (next-themes
  `enableSystem`, `components/theme-provider.tsx:12-14`).
- Test written: `tests/browser/qa-round1/test-quality.test.tsx` › "dark mode" ×2 (expected: PASS,
  pins).

### F7. Registry sources do not compile under `exactOptionalPropertyTypes` — severity: medium
- Where: `registry/ai/context.tsx:61`, `registry/blocks/chat/components/blocks/chat.tsx:128,137,180,229,342,349,480`,
  `lib/registry.ts:38` (`pnpm exec tsc --noEmit --exactOptionalPropertyTypes`: 9 errors in
  registry/lib code, 3 more in tests). `noUncheckedIndexedAccess` adds 8 (0 in `registry/`, 3 in
  `app/preview/{model-selector,prompt-input}/page.tsx`, 4 in `scripts/`, 1 in
  `tests/browser/ai/prompt-input.test.tsx:62`). `noUnusedLocals`: 1 (generated `components/ui`).
- What: `tsconfig.json` has `strict` only. Consumers copy these files into their project; a
  consumer with `exactOptionalPropertyTypes: true` gets a red build after `shadcn add @uifiles/chat`.
  Pattern: passing `x={maybeUndefined}` to an optional prop typed `x?: T`.
- Proposed fix: enable both flags in `tsconfig.json`; fix by `...(x !== undefined && { x })` or
  typing the props `x?: T | undefined` in the ported files.

### F8. Docs promise test tooling that does not exist — severity: medium
- Where/what:
  - `docs/plan.md:150-151` says the gate is `… → build → test → e2e`; `package.json` `gate` has no
    e2e (AGENTS.md's table is right). `pnpm gate` cannot be "run before every PR" and cover e2e.
  - `docs/plan.md` §6 "Visual: Playwright `toHaveScreenshot` on `/preview/*` (light+dark)": no
    `toHaveScreenshot` anywhere (`grep -rn toHaveScreenshot e2e tests` → 0). §7 Phase 2 says each
    port ships "browser test with axe + screenshot": none has a screenshot.
  - §6 "Registry CI … every item `add --dry-run`s into a scratch consumer": not in `ci.yml`.
  - §6 "Component tests … axe-core per component": true, but no coverage tool exists
    (`node_modules/@vitest/` holds only `browser-playwright`; `@vitest/coverage-v8` not installed,
    no thresholds).
  - `docs/porting-ai-elements.md` §4 says "following `tests/browser/button.test.tsx`" and gives a
    settle snippet: no file matches it (F3), and the snippet's code fence is malformed (opens
    ```` ```ts ````, closes with "``` If the component needs interaction…", then a stray ```` ```` ````),
    so the prose renders inside the block.
- Proposed fix: make the docs true or delete the claims; add `test:e2e` to `gate` or state that CI
  runs it.

### F9. e2e relies on `networkidle`, full parallelism against one dev server, and 2 retries — severity: low
- Where: `e2e/previews.spec.ts:17` `waitForLoadState("networkidle")`; `playwright.config.ts:5-7`
  `fullyParallel: true`, `retries: process.env.CI ? 2 : 0`, no `workers`.
- What: Playwright marks `networkidle` **DISCOURAGED**
  (`node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/types/types.d.ts:3429`);
  with `next dev` (HMR websocket, on-demand compiles) it is both slow and non-deterministic. The
  default `workers` is half the logical cores (`node_modules/playwright/types/test.d.ts:2025`), so
  ~20 preview routes compile concurrently on a dev server whose first hit per route is slow;
  `retries: 2` then hides the timeouts. The hydration wait the comment asks for is better expressed
  as waiting for a hydration-only signal (e.g. `page.locator("main")` plus a data attribute set in
  an effect, or `page.waitForFunction(() => window.__NEXT_HYDRATED)`), not network idleness.
- Proposed fix: `pnpm start` in CI (F5) removes most of it; set `workers: process.env.CI ? 2 : undefined`,
  `retries: 1`, and replace `networkidle` with an explicit hydration signal.

### F10. `context.test.tsx` scopes axe on a wrong premise; a whole-body run is intermittently red — severity: low
- Where: `tests/browser/ai/context.test.tsx:101-104` ("the previous test's hover card can still be
  animating out in `<body>`, outside any landmark" → `axe.run(screen.container)`).
- What: `vitest-browser-react@2.3.0` runs `cleanup()` in `beforeEach`
  (`node_modules/vitest-browser-react/dist/index.js:11-13`), which `root.unmount()`s inside `act`
  and removes the container (`dist/pure-C_qo4W4L.js` `cleanup`); the portaled popup is gone
  synchronously. My probe "unmounting removes a portaled hover-card popup from `<body>`
  immediately" passes 4/4. Scoping to `screen.container` drops every page-level rule (`region`,
  `landmark-*`, `page-has-heading-one`). A whole-body run of the same near-full fixture passed in
  3 of 4 full-file runs and reported `['region']` once (node HTML not captured on that run; passes
  4/4 in isolation). Hypothesis, not verified: the pointer is still parked over the trigger's
  position from the previous hover test and Chromium's synthetic mouse-move after layout re-opens
  the `delay={0}` hover card, so the *current* test's popup lands in `<body>` — the symptom the
  comment describes, with a different cause. Either way the fix is the same.
- Proposed fix: end hover tests with `await userEvent.unhover(trigger)` (or move the pointer to
  0,0), then run axe on `document.body`.
- Test written: `tests/browser/qa-round1/test-quality.test.tsx` › "a context render after a hover
  test passes axe on the whole body (no scoping needed)" (expected: PASS; flaked once in 4).

### F11. `tests/unit/registry.test.ts` asserts less than it says — severity: low
- Where: `registry.test.ts:18-33` "references forked primitives by namespace": with zero forked
  `registry:ui` items today (`registry/ui/registry.json`: 63 items, 0 with `files`), `forked` is
  empty and the inner `expect` never runs; the test is a future guard, not a present check.
  `:12-16` "gives every item a description agents can search on": `/\S{10,}/` accepts
  `"xxxxxxxxxx"`. `:37` hard-codes `>= 63` rather than deriving from upstream's list.
- Proposed fix: assert a minimum length and a sentence (`/\w+\s+\w+.*\./`) for descriptions;
  for the fork rule, also assert the inverse (every `@uifiles/x` dependency names an item that has
  `files`), which is checkable today.

### F12. CI hygiene — severity: low
- Where: `.github/workflows/ci.yml`, `.github/` (only `workflows/`).
- What: actions pinned to major tags, not SHAs (`git ls-remote` today: `actions/checkout@v5` =
  `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09`, `actions/setup-node@v5` = `a0853c24544627f65ddf259abe73b1d18a591444`,
  `actions/upload-artifact@v4` = `ea165f8d65b6e75b540449e92b4886f43607fa02`, `pnpm/action-setup@v4` =
  `f40ffcd9367d9f12939873eb1018b921a783ffaa`); no `permissions:` block; no `concurrency` group;
  no `timeout-minutes`; Playwright browsers reinstalled every run (no cache of
  `~/.cache/ms-playwright`); no Dependabot/Renovate config; no `pnpm audit` step (clean today:
  `pnpm audit --prod` → "No known vulnerabilities found"). `env: CI: "true"` on the e2e step is
  redundant (Actions sets `CI`) but harmless.
- Verified OK in the same file: `pnpm/action-setup@v4` without `version` reads `packageManager`
  (README lines 15 and 96); `setup-node` `cache: pnpm` after pnpm is installed; Node from
  `.nvmrc` (24) matches `engines >=24`; `playwright install --with-deps chromium` precedes
  `pnpm test` so Vitest browser mode has a browser.
- Proposed fix: corrected workflow in **Coverage plan**.

### F13. Recipe drift and weak test names — severity: low
- `<main>` wrapper: `confirmation.test.tsx` (all tests), `model-selector.test.tsx`,
  `suggestion.test.tsx:14-29`, `button.test.tsx` run whole-body axe with no landmark and pass. The
  porting doc's rationale ("axe's `region` rule needs a landmark and the test page has none") is
  imprecise: `region` exempts buttons and live regions (`node_modules/axe-core/axe.js:24347-24348`,
  `isRegion` at `:24374-24383` treats `role="alert"` as a region), so these fixtures pass only
  because they contain nothing else. Add a `<p>` to any of them and `region` fires. They are
  therefore weaker than the recipe, and the doc should say why `<main>` matters.
- `reasoning.test.tsx:94-104`, `branch.test.tsx:85-100`, `response.test.tsx:66-73`,
  `code-block.test.tsx:45-69` render without `<main>` and run no axe: fine, but inconsistent.
- Names that do not say what they assert: `context.test.tsx:92` "renders the near-full state"
  (asserts a `/95%/` button label only); `response.test.tsx:66` "does not re-render…" (cannot
  detect re-renders); `checkpoint.test.tsx:14` "…and passes axe" / `plan.test.tsx:47,60`,
  `task.test.tsx:31` (the a11y-smoke suffix hides that nothing behavioural is asserted).
- Static-string assertions: `image.test.tsx:29-30` re-asserts the fixture's own `base64`/`className`
  (legitimate: it proves prop pass-through); `sources.test.tsx:38` likewise. No pure fixture
  echo found elsewhere.
- Vitest facts every test silently depends on (pinned by my file): `browser.locators.exact`
  defaults to **true** (`node_modules/vitest/dist/chunks/plugin.d.My_z-jmU.d.ts:646-650`), so
  `getByText("Then:")` is whole-string/case-sensitive — unlike Playwright; the browser viewport
  defaults to **414×896** (`:628-633`), so every component test runs at phone width and none at
  desktop width; `expect.poll`/`expect.element` document a 1 000 ms default (`:4021-4030`,
  `index.DGdajAO2.js:7138`) but a failing `expect.element` without an explicit `timeout` waits
  until the browser `testTimeout` of 15 000 ms (`index.C-uw7tH9.js:14671`; observed: every caught
  mutation failed at 15.0 s), so red runs are slow; `isolate` defaults to true (`:3593-3599`), so
  module singletons such as `code-block.tsx`'s `tokensCache` are per file, not per test.

### F14. Timer and stub hygiene — severity: nit
- `code-block.test.tsx:46-50` redefines `navigator.clipboard` and never restores it (leaks within
  the file; `isolate: true` contains it). The 2 s `isCopied` reset (`code-block.tsx:488-491`) and
  `onError` path are untested. `vi.useFakeTimers` is used nowhere; `reasoning.test.tsx:81-91` waits
  a real second (upstream uses fake timers for #63). `Date.now` in `reasoning.tsx:277-280` is
  unasserted (M4).

## Coverage gaps (behaviours with no test today; no bug found, but untested)
- `reasoning` › auto-open on a not-streaming→streaming transition after mount; computed duration
  (`Math.ceil`, sub-second → 1); `onOpenChange`; controlled `open`; #86 guard — port upstream tests.
- `tool` › `ToolOutput` header/colour for `errorText`; string vs object vs ReactElement output
  branches (`tool.tsx:147-155`); `statusIcons` per state; `dynamic-tool` name derivation.
- `confirmation` › accepted vs rejected rendered *separately*; `approval-responded` state;
  `ConfirmationActions` hidden in every non-requested state.
- `context` › progress bar value; per-line cost text (`getUsage`) and "—" for undefined tokens;
  zero/NaN `maxTokens`; `modelId` unknown to tokenlens.
- `chat` block › auto-follow while streaming; `scrollAnchor` on user turns; scroll-to-bottom
  button appears when scrolled up; `aria-busy`; `onStop` mid-stream; file attachments round-trip
  (`ChatComposerAttachments`, Backspace removes last attachment); system-role marker; empty submit
  swallowed (documented in AGENTS.md, untested).
- `code-block` › copy resets after `timeout`; `onError` when clipboard missing; language
  fallback to `text`; dark theme tokens.
- `response` › memo actually skips re-render (render counter); `isAnimating` prop.
- Structural: dark mode (now 2 tests), RTL (`components.json` `rtl: false`; nothing tests `dir="rtl"`),
  reduced motion (no `motion-reduce`/`prefers-reduced-motion` anywhere in `app/globals.css`,
  `components/ui`, `registry/ai`), desktop viewport in Vitest, mobile viewport in Playwright,
  keyboard-only flows end to end, type-level prop contracts (`expectTypeOf`), visual regression,
  CLI round-trip in CI, coverage thresholds.

## Verified OK (claims you checked that hold; one line each, so the fixer does not re-check)
- Shuffled run of the existing browser suite (`--sequence.shuffle`, seed 1790460282144): 20 files /
  48 tests pass in 31 s; no order-dependent failure at that seed; no "optimized dependencies
  changed"/"Invalid hook call" message, so `optimizeDeps.include` is sufficient on a warm cache.
- Every `registry/ai/*.tsx` has `tests/browser/ai/<name>.test.tsx` and `app/preview/<name>/page.tsx`;
  every item with `files` (except `base`) has a preview; every preview dir is a registry item;
  every `registry/ai/*.tsx` is declared in `registry/ai/registry.json` (my unit tests, pass).
- `public/r/registry.json` item names equal `loadRegistry()`; every item has `public/r/<name>.json`.
- `/llms.txt` (`app/llms.txt/route.ts` `GET()`) lists every item's `/r/<name>.json` and description.
- All 18 `registry/ai` root compositions plus the `chat` block `renderToString` in the node
  project without touching `window`/`document` (19 SSR tests pass; `code-block.tsx:389-393`'s
  `useSyncExternalStore` server snapshot works).
- Dark mode: expanded `Tool` + highlighted `CodeBlock`, and the full chat transcript (reasoning,
  tool, markdown table/code, composer) pass axe under `.dark` at rest.
- `optimizeDeps.include` names only installed packages; the bare imports it does not list
  (`@base-ui/react/{button,input,merge-props,separator,use-render}`, `ai`,
  `class-variance-authority`, `cn`, `lucide-react`) are statically imported and were discovered
  without a re-optimize in the full run.
- `vitest-browser-react` cleanup is automatic per test (`beforeEach`), unmounts through `act`, and
  removes portaled Base UI popups immediately.
- axe `violations` are asserted with `toEqual([])` in every test (no impact filtering, no
  unasserted runs); AGENTS.md's claim that e2e catches page-level rules holds (default rule set
  includes `region`, `heading-order`, `landmark-one-main`, `scrollable-region-focusable`).
- `pnpm audit --prod`: no known vulnerabilities today.
- `pnpm/action-setup@v4` reads `packageManager` (`pnpm@11.18.0`) when `version` is omitted.
- `.vitest/attachments` (Vitest failure screenshots) is gitignored (`.gitignore:49`), so failing
  browser tests do not dirty the tree.

## Could not reach
- Cold-cache behaviour of `optimizeDeps` (a mid-run re-optimize only shows with an empty
  `node_modules/.vite`); clearing it would have slowed/flaked other reviewers running concurrently.
- The node that caused the single intermittent `region` violation in F10 (the assertion at that
  time printed ids only; the version that prints node HTML has not reproduced it in 3 runs).
- `pnpm test:e2e`, `pnpm build`, the CI workflow itself (forbidden/slow); CI findings are from
  reading `ci.yml`, `playwright.config.ts` and the installed Playwright/actions sources.
- Why `model-selector.test.tsx`'s open dialog passes `region` with no landmark (not traced; it is
  outside this lens's finding, noted in F13 as "passes only because…" for the other three files).
- Whether the `runOnly` tag set I propose flags anything today (not run; the helper is a proposal).

## Commands run (for the fixer to reproduce)
```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
# mutation helper (backs up, patches with perl -0, runs one test file, restores, proves git diff clean)
SCR=/docs/qa/round1/test-quality
$SCR/mutate.sh "<label>" <component-file> <test-file> '<perl substitution>'     # see Mutation log
# reproducers
pnpm exec vitest run --project unit tests/unit/qa-round1-test-quality.test.ts --reporter=verbose
pnpm exec vitest run --project browser tests/browser/qa-round1/test-quality.test.tsx --reporter=verbose
# order-dependence probe over the pre-existing suite
pnpm exec vitest run --project browser --sequence.shuffle --reporter=verbose tests/browser/ai tests/browser/blocks tests/browser/button.test.tsx
# axe defaults
node -e 'const axe=require("./node_modules/axe-core");const r=axe.getRules();console.log(r.filter(x=>!x.enabled).map(x=>x.ruleId));console.log(r.filter(x=>x.tags.includes("wcag22aa")).map(x=>x.ruleId))'
# strictness probes
pnpm exec tsc --noEmit --exactOptionalPropertyTypes | grep "error TS"
pnpm exec tsc --noEmit --noUncheckedIndexedAccess   | grep "error TS"
pnpm exec tsc --noEmit --noUnusedLocals             | grep "error TS"
pnpm audit --prod
# style on the new files
pnpm exec biome check tests/unit/qa-round1-test-quality.test.ts tests/browser/qa-round1/test-quality.test.tsx
pnpm exec prettier --check tests/unit/qa-round1-test-quality.test.ts tests/browser/qa-round1/test-quality.test.tsx
```
Reproducer output (final runs):
```
unit    : Test Files 1 passed (1) / Tests 29 passed (29)          (all pins; SSR ×19, invariants ×10)
browser : Tests 1 failed | 5 passed (6)
  × settle helpers > prompt-input's settleAnimations helper resolves while an infinite animation is on the page (expected FAIL: it hangs)
      AssertionError: expected 'hung' to be 'settled'
  ✓ cleanup between tests > unmounting removes a portaled hover-card popup from <body> immediately
  ✓ cleanup between tests > a context render after a hover test passes axe on the whole body (no scoping needed)   (3/4 runs; once: ['region'])
  ✓ locator semantics > getByText is whole-string and case-sensitive by default; exact: false opts into substring
  ✓ dark mode > an expanded tool call with highlighted JSON passes axe under .dark
  ✓ dark mode > the chat block transcript with reasoning, tool, markdown and composer passes axe under .dark
shuffle : Test Files 20 passed (20) / Tests 48 passed (48) / Duration 31.13s
```

## Mutation log

Command for every row: `$SCR/mutate.sh "<label>" <file> <test> '<perl -0pi substitution>'`; each run
printed the `git diff` of the mutation, the test result, and `restored: git diff clean for <file>`.

| # | Mutation (file → change) | Test file | Caught? | Failure / note |
|---|---|---|---|---|
| M1 | `tool.tsx:54` `"Completed"` → `"Done"` | `ai/tool.test.tsx` | **yes** | `expected 'get_weatherDone' to contain 'Completed'` (3.1 s) |
| M2 | `tool.tsx:160` `{errorText ? "Error" : "Result"}` → `{"Result"}` | `ai/tool.test.tsx` | **no** | 2/2 pass; badge "Error" satisfies `getByText("Error").first()` |
| M3 | `reasoning.tsx:287` auto-open condition → `false && …` | `ai/reasoning.test.tsx` | **no** | 3/3 pass; mount-time `defaultOpen ?? isStreaming` masks the effect |
| M4 | `reasoning.tsx:280` `setDuration(Math.ceil(…))` → `setDuration(undefined)` | `ai/reasoning.test.tsx` | **no** | 3/3 pass; `/Thought for/` matches "a few seconds" |
| M5 | `branch.tsx:492` next wrap `: 0` → `: currentBranch` | `ai/branch.test.tsx` | **yes** | `Cannot find element with locator: page.getByText('1 of 3')` (15.0 s) |
| M6 | `code-block.tsx:426` `asyncTokens ?? syncTokens` → `syncTokens` (highlight never shown) | `ai/code-block.test.tsx` | **yes** | `Cannot find element … getByText('const')` (15.1 s) |
| M7 | `context.tsx:194` `value={usedPercent * PERCENT_MAX}` → `value={usedPercent}` | `ai/context.test.tsx` | **no** | 2/2 pass; only progressbar presence asserted |
| M8 | `model-selector.tsx:530` `ModelSelectorItem` drops `onSelect` | `ai/model-selector.test.tsx` | **yes** | `expected document not to contain element` (dialog stays open, 15.1 s) |
| M9 | `prompt-input.tsx:857` `if (!usingProvider) form.reset()` → `if (false)` | `ai/prompt-input.test.tsx` | **yes** | `toHaveValue()` … `Matcher did not succeed in time` (15.0 s) |
| M10 | `chat.tsx:127` `<MessageScrollerProvider autoScroll>` → no `autoScroll` | `blocks/chat.test.tsx` | **no** | 5/5 pass incl. the streaming test |
| M11 | `chat.tsx:323` `isStreaming={part.state === "streaming"}` → `{false}` | `blocks/chat.test.tsx` | **no** | 5/5 pass |
| M12 | `confirmation.tsx:116,138` Accepted/Rejected `approved` conditions swapped | `ai/confirmation.test.tsx` | **no** | 3/3 pass; both outcomes rendered in one tree |

Caught 5 / survived 7. After the last batch: `git status --porcelain` showed only untracked
`tests/browser/qa-round1/` and `tests/unit/qa-round1-*.test.ts` (mine and other lenses'); no
tracked file differed. The lead has since committed the round-1 reproducers
(`51374d7 test(qa): round 1 adversarial reproducers`); my two files equal HEAD
(`git diff --quiet HEAD -- <file>` for both), and the only working-tree modifications now belong
to other lenses' files. No file I mutated appears in `git status`.

## Coverage plan

Priority order; each item names the installed/published version verified today
(`pnpm view <pkg> version`) and the doc line it rests on.

**P0 — before the public share / directory PR**
1. **Port upstream's tests** (F1): for each of the 18 items copy
   `scratchpad/upstream/ai-elements/packages/elements/__tests__/<name>.test.tsx` into
   `tests/browser/ai/<name>.test.tsx`, adapting `render`/`screen` to `vitest-browser-react@2.3.0`
   (`render`, `page`, `expect.element`) and keeping one `<main>` + axe pass per composition. Start
   with `reasoning` (18, incl. #63/#86 with `vi.useFakeTimers`), `prompt-input` (81),
   `model-selector` (40), `plan` (38), `message` (30 → `branch`/`response`), `context` (27). This
   alone would have caught M2, M3, M4, M12.
2. **`tests/a11y.ts` shared helper** (F3, F6):
   ```ts
   export async function settle() { /* chat.test.tsx:21-32 verbatim: timeline + iterations filter + catch */ }
   export const A11Y_TAGS = ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"]
   export async function runAxe(context: Element = document.body, opts: axe.RunOptions = {}) {
     await settle()
     const r = await axe.run(context, { runOnly: { type: "tag", values: A11Y_TAGS },
       rules: { "target-size": { enabled: true }, ...opts.rules }, ...opts })
     return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target.join(" ")) }))
   }
   export async function withDark<T>(fn: () => Promise<T>) { document.documentElement.classList.add("dark"); try { return await fn() } finally { document.documentElement.classList.remove("dark") } }
   ```
   (`axe.RunOptions.runOnly`: `node_modules/axe-core/axe.d.ts:125`; `target-size` is the sole
   `wcag22aa` rule and is off by default.) Every test asserts `expect(await runAxe()).toEqual([])`
   once light, once inside `withDark`. Replace the 5 settle variants and the 3 `region: false`
   calls (use `axe.run(popupEl)` for the popup plus `runAxe()` with the popup excluded).
3. **Fix CI wiring** (F4, F5, F9, F12). Proposed `ci.yml`:
   ```yaml
   name: CI
   on: { push: { branches: [main] }, pull_request: }
   permissions: { contents: read }
   concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
   jobs:
     gate:
       runs-on: ubuntu-latest
       timeout-minutes: 30
       steps:
         - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
         - uses: pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa # v4
         - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5
           with: { node-version-file: .nvmrc, cache: pnpm }
         - run: pnpm install --frozen-lockfile
         - run: pnpm audit --prod --audit-level high
         - run: pnpm format:check && pnpm lint && pnpm typecheck && pnpm registry:validate
         - id: pw
           run: echo "version=$(node -p "require('@playwright/test/package.json').version")" >> "$GITHUB_OUTPUT"
         - uses: actions/cache@<sha> # v4
           with: { path: ~/.cache/ms-playwright, key: pw-${{ runner.os }}-${{ steps.pw.outputs.version }} }
         - run: pnpm exec playwright install --with-deps chromium
         - run: pnpm test -- --coverage
         - run: pnpm build
         - run: pnpm test:e2e            # webServer: pnpm start (CI), built above
         - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
           if: failure()
           with: { name: e2e-failure, path: |
                     playwright-report
                     test-results
                     .vitest/attachments }
   ```
   with `playwright.config.ts`: `reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list"`,
   `workers: process.env.CI ? 2 : undefined`, `retries: process.env.CI ? 1 : 0`,
   `webServer.command: process.env.CI ? "pnpm start" : "pnpm registry:build && pnpm dev"`.
4. **TypeScript strictness** (F7): add `"exactOptionalPropertyTypes": true`,
   `"noUncheckedIndexedAccess": true`, `"noUnusedLocals": true` to `tsconfig.json`; fix the 9+8+1
   errors listed in F7. Consumers' stricter tsconfigs then cannot break on installed files.

**P1 — bug-catching infrastructure as the registry grows**
5. **Coverage with thresholds**: `pnpm add -D @vitest/coverage-v8@5.0.2` (matches `vitest@5.0.2`);
   `test.coverage: { provider: "v8", include: ["registry/**/*.tsx", "lib/**/*.ts"], reporter: ["text","json-summary"], thresholds: { perFile: true, lines: 80, branches: 70, functions: 80 } }`
   (`thresholds`/`perFile`/`autoUpdate`: `node_modules/vitest/dist/chunks/plugin.d.My_z-jmU.d.ts:1853-1990`).
   Branch coverage is what flags `tool.tsx:147-155` and `confirmation.tsx` branches never taken.
6. **Type-level contract tests**: `tests/unit/types.test-d.ts` with `expectTypeOf`
   (`node_modules/vitest/dist/index.d.ts:13`) asserting the public prop unions ported from
   upstream (e.g. `ToolHeaderProps` discriminant, `PromptInputSubmitProps["status"]`,
   `ReasoningProps["duration"]`), run via `test.typecheck.enabled` in the unit project.
7. **Fail on console**: `setupFiles` for the browser project that throws on `console.error`/`warn`
   (React `act`, missing keys, hydration warnings), as upstream's `__tests__/setup.ts` does with
   `vitest-fail-on-console`. Keep `screenshotFailures` (already default).
8. **SSR + hydration**: keep `tests/unit/qa-round1-test-quality.test.ts` "renders on the server"
   as a permanent invariant (rename to `tests/unit/ssr.test.ts`); in `e2e/previews.spec.ts` also
   collect `page.on("console")` messages matching `/hydrat/i` and assert none.
9. **Dark mode in e2e**: run each preview twice with `page.emulateMedia({ colorScheme })`
   (`next-themes` `enableSystem`, `components/theme-provider.tsx:12-14`), AxeBuilder
   `.withTags(A11Y_TAGS)`; add `page.emulateMedia({ reducedMotion: "reduce" })` once nothing in
   `app/globals.css` honours it (add `motion-reduce:` variants first).
10. **Visual regression** (plan §6): `expect(page).toHaveScreenshot(\`${name}-${scheme}.png\`)`
    per preview and scheme (`node_modules/playwright/types/test.d.ts` declares `toHaveScreenshot`),
    with `maxDiffPixelRatio: 0.01`, snapshots committed, `--update-snapshots` documented in AGENTS.md.
11. **Viewports**: Vitest browser already runs at 414×896; add a second instance
    `{ browser: "chromium", viewport: { width: 1280, height: 800 } }` (or `page.viewport()` in a
    few tests) so desktop layouts are covered; Playwright: add a `mobile` project with
    `devices["iPhone 15"]` over the previews.
12. **Keyboard-only e2e flow** on `/preview/chat`: Tab to composer, type, Enter, Tab to the tool
    header, Enter to expand, Escape closes menus; assert focus order with `toBeFocused()`.
13. **CLI round-trip in CI** (plan §6 "Registry CI"): after `pnpm build`, `pnpm start &`, then in a
    scratch dir `pnpm dlx shadcn@latest create -t next -b base --preset nova …` and a matrix
    `for item in $(node -e 'console.log(require("./public/r/registry.json").items.map(i=>i.name).join(" "))'); do pnpm dlx shadcn@latest add "http://localhost:3000/r/$item.json" --dry-run --yes; done`
    (upstream hosts are reachable on GitHub runners, unlike here); fail on any non-zero exit.
14. **Registry consistency unit tests** (keep from my file): built `public/r` vs `loadRegistry()`,
    every item's JSON exists, `/llms.txt` lists every item; add "every `@uifiles/x` dependency
    names an item with `files`" (F11).
15. **Dead code and drift**: `knip@6.38.0` (dead exports/deps; the ported files export many
    sub-components nothing imports; Knip needs an `entry` list covering `registry/**` targets);
    `publint@0.3.24` is not applicable (no npm package) — the registry's equivalent is
    `shadcn registry validate` plus item 13. Add Renovate (or Dependabot for `github-actions` +
    `npm` weekly) so the SHA pins and `streamdown@^2.6`-style ranges are kept current.
16. **Flake detection**: a weekly workflow running the browser suite with `--sequence.shuffle`
    and `--retry=0`, and `e2e` with `retries: 0`, reporting rather than masking.
