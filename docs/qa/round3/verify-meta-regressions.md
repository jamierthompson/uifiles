# verify-meta-regressions (round 3, lens: regressions and side effects on neighbours)

refuted: false

Tree verified: HEAD `82f6e83` (the lead re-cut the checkpoint from `1f57fb7` while I was running;
`git diff --stat 1f57fb7 82f6e83` touches only `registry/ai/registry.json`, `registry/ai/response.tsx`,
`registry/blocks/registry.json`; every meta-owned file is byte-identical across the two, so every
command below was re-run on `82f6e83`). `git status --porcelain` is empty at the end. No file was
edited; one throwaway browser probe (`tests/browser/zz-verify-meta-probe.test.tsx`) was created,
run and deleted in the same command.

## Commands (all on `82f6e83`, `PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH`)

```
pnpm exec tsc --noEmit                      -> exit 0
pnpm lint                                   -> "Checked 151 files in 369ms. No fixes applied." exit 0
pnpm format:check                           -> "All matched files use Prettier code style!" exit 0
pnpm exec vitest run --project unit         -> Test Files 8 passed (8)  Tests 323 passed (323)   (twice: 11.04 s, 6.53 s)
pnpm exec vitest run --project browser      -> Test Files 23 passed (23) Tests 890 passed (890)  (twice: 43.23 s, 52.36 s)
git status --porcelain                      -> (empty)
```

## Problems found

None that refutes. Three nits, none a regression:

1. Temp-dir leak (pre-existing pattern, now two more per run): `tests/unit/test-setup.test.ts:386`
   `runGuardProbe` does `mkdtempSync(join(tmpdir(), "uifiles-guard-"))` and never removes the directory
   (`grep -n "rmSync" tests/unit/test-setup.test.ts tests/unit/tooling.test.ts` -> no hits). 70
   `/tmp/uifiles-guard-*` directories were present when I looked (each: a `node_modules` symlink + 3
   small files). `tests/unit/tooling.test.ts:257,337,427` already leak the same way, so this is repo
   style, not new behaviour. Suggest `rmSync(dir, { recursive: true, force: true })` in a `finally`.
2. `components/ui/kbd.tsx` is now unused by application code after the `<kbd>` hint was removed
   (`grep -rn "components/ui/kbd\|<Kbd" app components registry tests` -> none). Vendored, harmless.
3. `sequence.hooks: "list"` was NOT set in `vitest.config.ts` (file identical to `ca6f2fd`), against
   the lead's instruction. The coder's reason checks out against
   `node_modules/vitest/dist/chunks/run.C5UmxDPh.js:3574-3591`: `callSuiteHook` runs a suite's own
   `afterEach` hooks, then (line 3590) the parent's, whatever `sequence.hooks` is; `list` only reverses
   the order inside one level, so it cannot put the setup file's hook before a describe-level
   `afterEach(restoreAllMocks)`. With `list`, output logged in a file's own `afterEach` would also fall
   outside the guard window. The guard is now order-independent (see below), so this is a decision
   for the lead, not a regression. Since it is not set, there is no hook-order side effect on the 15
   browser files that register `afterEach` (`grep -rln afterEach tests/browser` -> 15 files).

## Confirmed

Console guard (`tests/console-guard.ts`, `tests/setup.ts`)
- `git diff ca6f2fd -- tests/console-guard.ts tests/setup.ts`: every hunk read. Wrappers are installed
  once per level at `createConsoleGuard` and stay; `globalThis.console` becomes a `Proxy` whose
  `defineProperty`/`get` traps remember mocks; `stop()` charges calls that never reached a wrapper.
  `registerConsoleGuard` (unchanged): `await cleanup()` then `guard.stop()` in `finally`.
- Double cleanup is safe: `vitest-browser-react/dist/index.js` registers its own `beforeEach(cleanup)`;
  `cleanup()` in `pure-C_qo4W4L.js:112-120` iterates `mountedRootEntries` then clears it, so the
  guard's `afterEach(cleanup)` followed by the library's `beforeEach(cleanup)` unmounts each root once.
  Whole browser project green twice.
- The `reached` marking relies on `@vitest/spy` pushing the call and an `{type: "incomplete"}` result
  before the implementation runs: confirmed in
  `node_modules/.pnpm/@vitest+spy@5.0.2/node_modules/@vitest/spy/dist/index.js:320-335`
  (`registerCalls(args)` then `registerResult({type:"incomplete"})` before `implementation` is chosen).
- Independent in-browser probe (file created and deleted in one command; `git status` clean after):
  A) `vi.spyOn(console,"error").mockImplementation` + file-level `afterEach(vi.restoreAllMocks)` around
  a keyless list render, B) plain `console.error`, C) `mockRestore()` inside the test, D) silent control
  -> `Tests 3 failed | 1 passed (4)` with
  `console.error (swallowed by a mock implementation): Each child in a list should have a unique "key" prop.`,
  `console.error: B: plain call`, `console.warn (swallowed by a mock implementation): C: hidden then mockRestore`.
- The child-runner tests in `tests/unit/test-setup.test.ts` ("... with sequence.hooks stack (the default)"
  and "... list") passed in both unit runs, so the guard holds under either hook order.
- `tests/browser/theme.test.tsx` `beforeAll` assigns `console.error = fn` on the proxy (no `set` trap ->
  OrdinarySet -> the `defineProperty` trap, non-mock value ignored); the test is green, so the swap and
  the restore work through the proxy.

Theme hotkey removal
- `components/theme-provider.tsx`: `ThemeHotkey`, `HOTKEY_EXCLUDED_SELECTOR`, `isTypingTarget`, the
  `useTheme` import and the `React` value import are gone; provider otherwise unchanged.
- `components/theme-toggle.tsx`: `THEME_HOTKEY`, `aria-keyshortcuts`, `<Kbd>`, the wrapper `<span>` and
  the `className` prop are gone. Callers pass no props: `app/page.tsx:25`, `app/preview/layout.tsx:23`
  (`<ThemeToggle />`). `setTheme` is used only in `components/theme-toggle.tsx:35`, so the toggle is the
  only theme control, as the docs now say.
- No stale reference: `grep -rniE "hotkey|THEME_HOTKEY|aria-keyshortcuts|<kbd|press \`d\`"` over
  `*.md, *.tsx, *.ts, *.json, *.txt` (excluding node_modules/.next/public/r) leaves only
  `components/ui/kbd.tsx` (the primitive), `tests/browser/ai/prompt-input.test.tsx:3203-3243`
  (PromptInput's own `Alt+M` tooltip shortcut), `tests/browser/theme.test.tsx:143` (asserts absence),
  and `.claude/skills/**` (Radix toast `hotkey` prop table; a `<kbd>` in a skill script). `README.md`,
  `skills/`, `docs/` have no hotkey mention.
- `tests/browser/theme.test.tsx`: 8 -> 3 tests; the `Select` import removed with the tests that used it.

Preview layouts and 404
- `app/preview/{chain-of-thought,chat,confirmation,prompt-input,reasoning}/layout.tsx` are each
  `export const metadata = { title }` + `return children`: no element, no second `<main>`.
  `app/preview/layout.tsx` (unchanged) still provides the one `<main>`. `tests/unit/site.test.ts:363-382`
  renders each layout with `renderToStaticMarkup` and requires exactly `<p>page</p>`, and matches
  `metadata.title` to the registry title (`registry/ai/registry.json:24,75,177,219`,
  `registry/blocks/registry.json:7`). All five pages start with `"use client"`, and Next's docs
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md:110`) say
  `metadata` is server-component only, so a sibling layout is the right vehicle.
- `app/not-found.tsx`: the only change is `export const metadata: Metadata = { title: "Page not found" }`;
  one `<main>`, one `<h1>Page not found</h1>`. Next 16.3.6 uses it:
  `node_modules/next/dist/server/app-render/app-render.js:1176-1181` sets metadata `errorType` to
  `'not-found'` when there is no `global-not-found` (`ls app/` -> only `not-found.tsx`), and
  `node_modules/next/dist/lib/metadata/resolve-metadata.js:438-444,529-532` reads the not-found
  module's metadata and pushes it as the leaf item, so the root template yields `Page not found · uifiles`.

e2e (typechecked, not run; forbidden here)
- `e2e/helpers.ts`, `e2e/chat-keyboard.spec.ts`, `README.md`, `vitest.config.ts`: `git diff ca6f2fd` is
  empty for all four. `chat-keyboard.spec.ts` uses `gotoHydrated` + `waitForIdle` exactly as helpers
  define them (route block before the first `goto`, busy-region wait, then `settle`).
- `e2e/registry.spec.ts:1-9` imports `blockExternalRequests`, which `e2e/helpers.ts:36` exports; the two
  404 tests block external requests before `page.goto`, assert status 404, the title and the `<h1>`.
- `e2e/previews.spec.ts:33` `toHaveTitle(/^\S.* · uifiles$/)` after `waitForIdle`; the middle dot is
  `c2 b7` in `app/layout.tsx`, `e2e/previews.spec.ts` and `e2e/registry.spec.ts` (`od -An -tx1`), so the
  regex and the literal match the template `%s · uifiles`. `app/preview/page.tsx` (the index) exports
  its own metadata and is not in the `previews` loop (directories only).
- `e2e/origin.ts` `expectsPublicOrigin`: CI -> true; else a non-empty, non-loopback
  `NEXT_PUBLIC_BASE_URL` (via the existing `isLocalRequest`). Unit-pinned in `tests/unit/tooling.test.ts:121-148`.
- The lead must rebuild and run `pnpm test:e2e` (92 expected) before merge; against the stale :3000
  build the five titles and the 404 title would fail, as the coder says.

Other owned files
- `tests/unit/workflows.test.ts:51-110`: `unpinnedActions` regex `# v\d+(?:\.\d+){0,2}\s*$` anchored to
  `^\s*(?:- )?uses: <ref>`; the SHA-pin describe covers `v5`, `v5.0`, `v5.0.1`, `v12.3.45` and rejects
  `@v5`, no comment, `# 5`, `# v5.0.1.2`, `# latest`, a 7-char SHA. `.github/**` untouched.
- `tests/unit/site.test.ts:176-237`: the three `baseUrl()` production-warning tests each
  `vi.resetModules()` + dynamic import and end with a call that must warn.
- `tests/unit/registry.test.ts:128-144`: the migrated registry-strings pin; green against the manifest
  stage's edits in `82f6e83`.
- `tests/unit/qa-round3-meta.test.ts` (6 tests at `ca6f2fd`) is deleted; each test has a named
  counterpart in test-setup, workflows, site, tooling, registry.
- `NOTICE`: `diff <(git show ca6f2fd:NOTICE | tr -s ' \n' '\n') <(tr -s ' \n' '\n' < NOTICE)` ->
  identical word sequence (whitespace-only reflow); `site.test.ts` NOTICE/README tests pass.

Docs claims spot-checked against the code (all true)
1. `AGENTS.md` layout row: toggle "rendered in the home header and the preview layout: the only theme
   control" -> `app/page.tsx:25`, `app/preview/layout.tsx:23`; sole `setTheme` call site is the toggle.
2. `AGENTS.md` app row: a `"use client"` preview page cannot export `metadata`, a `layout.tsx` beside it
   sets the title -> Next docs line 110; five client pages, five layouts.
3. `AGENTS.md` "Each new component ships with ... a title ...; `tests/unit/site.test.ts` [fails] without
   the title" -> `site.test.ts:342-361` "every preview route sets a title ...".
4. `AGENTS.md` Tests: "`tests/unit/tooling.test.ts` rejects the pattern in any file under
   `tests/browser/`" -> `tooling.test.ts:591-608` walks `tests/browser` recursively.
5. `AGENTS.md`/`CHANGELOG.md`/`docs/architecture.md`/`tests/setup.ts` header: the global `console` is the
   guard's proxy and swallowed calls are charged even when the spy is restored before the check ->
   `installConsoleGuard(..., host = globalThis)` sets `host.console = guard.console`; proven by the
   child-runner tests and my browser probe. `AGENTS.md` "the guard unmounts the test's tree before it
   checks" -> `registerConsoleGuard`. `docs/porting-ai-elements.md:211-212` ("hides nothing ...") is
   now accurate. `docs/architecture.md` §4 "only theme control is a visible toggle" -> as in 1.
