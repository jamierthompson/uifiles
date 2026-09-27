# fix-meta (round 3, attempt 1)

Scratch logs: `/docs/qa/round3/fix-meta/` (names below are relative to it).
No commits, no stash, no build/dev/e2e/server commands. Every file I touched is in my ownership list.

## Fixed

- rendered-surface:R3-1 (HIGH, WCAG 2.1.4) and R3-7 — the bare `d` theme hotkey is gone: `ThemeHotkey`, its exclusion selector and the `useTheme` wiring are removed from `components/theme-provider.tsx`; `components/theme-toggle.tsx` drops `THEME_HOTKEY`, `aria-keyshortcuts` and the `<kbd>` hint (and the now-pointless wrapper `<span>`/`className` prop; no caller passed one). The toggle is the only theme control. R3-7 (hotkey firing inside the pinned citation card) disappears with it. — `components/theme-provider.tsx:1-23`, `components/theme-toggle.tsx:16-43` — test: `tests/browser/theme.test.tsx` › "has no single-key shortcut: d and D leave the theme alone wherever focus is, and nothing advertises one" (failed before: `AssertionError: body: expected 'light' to be null` — `d` then `D` wrote the theme twice; passes after). It presses `d`/`D` with focus on body, a plain button, a link and the toggle, asserts next-themes never wrote localStorage (it does so synchronously inside `setTheme`) and the class never changed, asserts no `aria-keyshortcuts`/`<kbd>`, then clicks the toggle as a positive control. Also added "the toggle works from the keyboard with Enter and Space". Docs updated: `AGENTS.md` (layout table row, "Render it before you call it done"), `CHANGELOG.md` (0.1.0 "Added" no longer lists the hotkey; the "Fixed" clause about the hotkey is dropped since the feature does not ship), `docs/architecture.md` §4. `README.md` never mentioned the hotkey (grep: no hit), unchanged.

- meta:F1 (medium) — the console guard now sees every console spy from the moment it is installed, so a swallowing spy restored before the check (file-level or describe-level `afterEach(() => vi.restoreAllMocks())`, or `spy.mockRestore()`, which clears the spy's `mock.calls`) is still charged. Design (`tests/console-guard.ts`):
  - one wrapper per level is installed at creation and stays for the guard's lifetime (records only while a start()/stop() window is open), so a spy restored after the check puts back a live wrapper, never a stale one;
  - `guard.console` is a `Proxy` over the target whose `defineProperty` and `get` traps remember every mock installed on, or read from, `error`/`warn` during the window, with every `mock.calls` array it used (the array a `mockClear()` swaps out keeps the earlier calls);
  - the wrapper marks the in-flight call of each spy that forwarded to it (`results.at(-1).type === "incomplete"`) in a `WeakSet`, so at stop() the calls that never reached a wrapper are exactly the swallowed ones (replaces the old "earliest N calls" heuristic; exact for `mockImplementationOnce`);
  - a spy already installed at start() (a `beforeAll` spy) is charged only with what it receives during the test; a plain replacement present at stop() is reported as replaced "during the test" or "before the test (in a beforeAll?)"; a transient swap put back before the end (React's `disableLogs`/`reenableLogs`) is not flagged.
  - `installConsoleGuard(hooks, cleanup, host = globalThis)` creates the guard, makes `host.console` the proxy, and registers the hooks; `tests/setup.ts` is now just that call behind the once-per-iframe `globalThis` store, plus `allowConsole`.
  — `tests/console-guard.ts:56-194, 221-240`, `tests/setup.ts:11-37` — tests: `tests/unit/test-setup.test.ts` › "still charges the calls a swallowing spy hid when the test file restores mocks in its own afterEach" (the migrated round-3 reproducer; failed before: `AssertionError: expected '' to match /hidden by the mock/`), "still charges them when the test restores the spy itself with mockRestore(), which clears the spy's record", "knows a spy from the moment it is installed, even when the code that logs holds the raw console object", "keeps what a swallowing spy received on both sides of a mockClear()", "charges a spy installed before the test (in a beforeAll) only with what it swallowed during the test", "leaves one live wrapper when a spy is restored after the check, so the next test records each call once", "fails every test while a console method replaced before it (in a beforeAll) is still in place", "does not flag a replacement that is put back before the test ends", "installConsoleGuard puts the guard's proxy in place of the host's console and wires both hooks", and the real-runner check › "fails every test whose swallowing spy was restored before the check, with sequence.hooks stack (the default)" / "… list": a child Vitest whose setup calls `installConsoleGuard` exactly as `tests/setup.ts` does runs a probe file (file-level restore, describe-level restore, explicit `mockRestore()`, plus two silent controls) and must report `3 failed | 2 passed` with each swallowed message.
  - Scratch browser proof (file `tests/browser/zz-fix-meta-guard-scratch.test.tsx`, deleted after each run; source kept at `guard-scratch.test.tsx`): A) React's missing-key warning swallowed by `vi.spyOn(console, "error").mockImplementation` with the file's `afterEach(vi.restoreAllMocks)`, B) same with a describe-level restore, C) `mockRestore()` in the test, D/E) controls. Old guard: `Tests 5 passed (5)` (`guard-scratch-before.log`, the bypass). New guard: `Tests 3 failed | 2 passed`, messages `console.error (swallowed by a mock implementation): Each child in a list should have a unique "key" prop…`, `…: B: hidden by a describe-level restore`, `console.warn (swallowed…): C: hidden then mockRestore` (`guard-scratch-after.log`, `guard-scratch-after2.log`).
  - Static check, `tests/unit/tooling.test.ts` › "no browser test silences console.error or console.warn with a mock implementation" (scans every file under `tests/browser/**`; today: none) with its own synthetic cases › "recognises a console spy given a swallowing implementation, and nothing else": chained `spyOn(console|globalThis.console|window.console, …)[.x(…)]*.mockImplementation|…Once|mockReturnValue*|mockResolved*|mockRejected*|mockThrow*|mockReturnThis|withImplementation(`, `vi.mocked(console.error).mock…(`, and a named spy (`const|let|var|using x = vi.spyOn(console, …)` … `x.mockImplementation(`) scoped to the next redeclaration of the name; pass-through spies and non-console spies are not flagged.
  - Wording: `AGENTS.md` (table row and Tests › "Console must be clean"), `CHANGELOG.md` ("a fail-on-console guard that also charges the calls a console spy's mock implementation swallowed, whether or not the spy is restored before the check"), `docs/architecture.md` §Tests, and the `tests/setup.ts` header now say what is true. `docs/porting-ai-elements.md` ("hides nothing: the calls the mock swallowed are charged to the test as well") is now accurate; not mine, no change needed.
  - **Not done as asked: `sequence: { hooks: "list" }` is not set in `vitest.config.ts`.** Verified in `node_modules/vitest/dist/chunks/run.C5UmxDPh.js:3544-3591`: `list` only reorders hooks within one suite; `callSuiteHook` runs a describe's own `afterEach` before its parent's regardless of the setting, so `list` cannot cover a describe-level `afterEach(restoreAllMocks)` (probe case B). With the guard now order-independent (proven under both orders by the child-runner test), `list` would buy nothing and cost two things: the guard would check before the file's own `afterEach` hooks, so output logged there would escape, and a spy restored after the check would re-install the wrapper it wrapped (harmless now, but churn). It would also reorder hooks in 23 browser files for no gain. If the lead still wants it, it is one line in the browser project; the guard and every test above pass either way.

- meta:F2 (medium) — `expectPinnedActions` is split into `unpinnedActions(text, doc)` with the comment rule `# v\d+(?:\.\d+){0,2}` (a major, minor or patch tag, which is what Dependabot writes) anchored to a `uses:` line. — `tests/unit/workflows.test.ts:51-110` — tests: › "the SHA-pin check" › "accepts the tag comment Dependabot writes: a major, or the most specific version such as # v5.0.1" (`v5`, `v5.0`, `v5.0.1`, `v12.3.45`) and "rejects a ref without a SHA, a missing comment, and a comment that is not a version tag" (`@v5`, no comment, `# 5`, `# v5.0.1.2`, `# latest`, a 7-char SHA). Failed before (old regex swapped back in: `AssertionError: v5.0: expected [ Array(1) ] to deeply equal []`, `workflows-oldregex.log`); the round-3 mirror reproducer failed with `…carries its version as a comment … # v\d+\s*$` (`before-repro.log`).

- meta:F3 / rendered-surface:R3-4 (low) — titles: new `app/preview/{chain-of-thought,chat,confirmation,prompt-input,reasoning}/layout.tsx` export `metadata = { title }` with the registry item title ("Chain of Thought", "Chat", "Confirmation", "Prompt Input", "Reasoning") and pass `children` through; `app/not-found.tsx` exports `metadata = { title: "Page not found" }` (matches its `<h1>` and rendered-surface's proposal; the lead's sketch said "Not found"). Next 16 support verified: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md:108` ("Metadata can be added to `layout.js` and `page.js` files", server components only) and, for not-found, `node_modules/next/dist/lib/metadata/resolve-metadata.js:415-446` (`collectMetadata` reads `getDefinedMetadata(errorMod)` from the `not-found` convention module). Rendered HTML could not be checked (the :3000 server serves the pre-change build; build is off-limits). — tests: `tests/unit/site.test.ts` › "every preview route sets a title: the page exports metadata, or a layout beside a client page does" (migrated reproducer; failed before: `expected [ 'chain-of-thought', 'chat', …(3) ] to deeply equal []`), "names a preview in its layout after the registry item, and the layout only passes the page through" (imports each layout, compares `metadata.title` with the registry title, renders it), "titles the 404 page after its heading"; e2e: `e2e/previews.spec.ts:33` `await expect(page).toHaveTitle(/^\S.* · uifiles$/)` in every preview × scheme test, and `e2e/registry.spec.ts:117-131` "/nope and /preview/nope answer 404 with the not-found page under its own title" (`toHaveTitle("Page not found · uifiles")`). The e2e changes are typechecked (`tsc` clean) but not run (forbidden here).

- meta:F4 (low) — the production-warning tests now live in `describe("baseUrl() production warning")`, each importing `lib/registry` afresh (`vi.resetModules()` + dynamic import) and ending with a call that must warn, so silence cannot come from a tripped flag: "warns once, without throwing, …", "stays silent for a production build with a public origin", "stays silent for a Vercel preview build that advertises localhost". — `tests/unit/site.test.ts:176-237` — mutation M1 (drop `!env.VERCEL &&` in `lib/registry.ts`, run in a mirror so the non-owned file was never touched): the Vercel test fails (`mut/M1.log`); the mirror control fails only an unrelated mirror artefact ("nothing refers to the retired docs/plan.md", `mut/M1-control.log`), identical in both.

- meta:F5 (low) — `expectsPublicOrigin` is true in CI, else only when `NEXT_PUBLIC_BASE_URL` is set to a non-loopback origin (`isLocalRequest`), so exporting the `.env.example` value locally no longer demands a localhost-free page. — `e2e/origin.ts:27-37` — test: `tests/unit/tooling.test.ts` › "expectsPublicOrigin is true in CI and locally once the origin is a public host" (failed before: `http://localhost:3000: expected true to be false`; also covers `127.0.0.1`, `[::1]`, `*.localhost`, blank, and CI with a localhost value → still true).

- meta:F6 (low) — `tests/unit/tooling.test.ts` › "e2e/helpers.ts gotoHydrated" › "installs the external-request block before the first navigation, aborting only foreign hosts" (migrated; fake page records `route` before `goto`, the matcher blocks `models.dev` and keeps localhost, the handler aborts with `blockedbyclient`). Mutation H1 (drop `await blockExternalRequests(page)`) caught.

- meta:N1 — `NOTICE` AI Elements paragraph reflowed (no mid-sentence break). N3 — guard sentences (part of F1). Registry-strings pin from the reproducer file migrated to `tests/unit/registry.test.ts` › "keeps every description under 900 characters, gives every item a title, and keeps every docs string one paragraph with balanced quotes and backticks".

- Reproducer file `tests/unit/qa-round3-meta.test.ts`: all six tests migrated (F1 → test-setup, F2 → workflows as a direct synthetic check instead of a child-process mirror, F3 and F4 → site, F6 → tooling, registry strings → registry) and the file deleted.

## Not fixed and why

- meta:N2 / R3-4 casing for pages I do not own: `app/preview/inline-citation/page.tsx` ("Inline citation"), `app/preview/model-selector/page.tsx` ("Model selector"), `app/preview/response/page.tsx` ("Response" vs item title "Message Response"), `app/preview/branch/page.tsx` ("Branch" vs "Message Branch"). See Requests. My five layouts use the registry titles.
- `sequence.hooks: "list"`: deliberately not set (see F1 above for the evidence and trade-off); flagging for the lead's decision.
- e2e title/404 assertions: written and typechecked, not run (forbidden). Against the current :3000 build they would fail (it predates the layouts); they need the lead's rebuild.

## Tests

- `tests/browser/theme.test.tsx`: 8 → 3 tests (7 hotkey tests removed with the feature; kept the toggle/axe test; added the Enter/Space test and the no-shortcut test). No upstream counterpart.
- `tests/unit/test-setup.test.ts`: 15 → 26 tests (guard: 12 → 22 in-process + 2 child-runner; config: 3 unchanged).
- `tests/unit/tooling.test.ts`: 17 → 20. `tests/unit/workflows.test.ts`: 14 → 16. `tests/unit/site.test.ts`: 40 → 44. `tests/unit/registry.test.ts`: +1.
- Unit project: 323 tests in 8 files (the deleted reproducer file's 6 are now inside the canonical files).
- Mutation checks (harness `mutate.sh` / `mirror-mutate.sh`, each restored and `cmp`-verified; logs in `mut/`), all caught:
  - G1 hidden-call recovery off (`array.slice(array.length)`) → 10 guard tests fail
  - G2 `defineProperty` trap not remembering → "knows a spy from the moment it is installed…"
  - G3 `get` trap not remembering → "keeps what a swallowing spy received on both sides of a mockClear()"
  - G4 no `reached` marking → "counts a call once when a pass-through spy forwards it…", "recovers only the calls a one-shot…"
  - G5 / G10 `fromNow` ignored / start() not remembering the installed spy → "charges a spy installed before the test (in a beforeAll)…"
  - G7 stop() not putting back what start() found → "fails a test that replaced a console method…"
  - G8 `installConsoleGuard` not replacing `host.console` → the install test and both child-runner tests (stack and list)
  - G9b replaced-method detection off → both replacement tests; G11 before/during always "during" → the beforeAll-replacement test
  - T1 a bare `d` keydown listener re-added to `ThemeProvider` → theme "has no single-key shortcut…"; T2 `aria-keyshortcuts="D"` re-added to the toggle → same test
  - S1 `vi.spyOn(console, "error").mockImplementation(() => {})` added to a browser test → tooling "no browser test silences…"
  - W1 old pin regex `# v\d+` → workflows "accepts the tag comment Dependabot writes…"
  - O1 old `expectsPublicOrigin` → tooling origin test; H1 `gotoHydrated` without the route block → tooling gotoHydrated test
  - L1 delete `app/preview/chat/layout.tsx` → site "every preview route sets a title…"; L2 title "chat" → site layout test; L3 layout `return null` → site layout test; N1 not-found `metadata = {}` → site "titles the 404 page after its heading"
  - M1 (`lib/registry.ts`, mirror) drop `!env.VERCEL &&` → site "stays silent for a Vercel preview build that advertises localhost"
- Three consecutive runs:
  - `pnpm exec vitest run --project unit` ×3: `Test Files 8 passed (8) Tests 323 passed (323)` ×3 (`unit-run{1,2,3}.log`)
  - owned unit files (`test-setup, tooling, workflows, site, registry`) ×3: `Test Files 5 passed (5) Tests 132 passed (132)` ×3 (`mine-run{1,2,3}.log`)
  - `tests/browser/theme.test.tsx` ×3: `Tests 3 passed (3)` ×3 (`theme-run{1,2,3}.log`)
- Whole browser project with the proxied console (all 23 files, other owners' in-progress edits included), run twice, the second after the last guard edit: `Test Files 23 passed (23) Tests 890 passed (890)` both times (`browser-full-{1,2}.log`, 44-45 s). Replacing `globalThis.console` with the proxy broke nothing (React 19 captures `console.createTask` unbound; its `disableLogs` swaps go through the trap and are ignored).

## Registry entry changes

None.

## Requests for other owners

- `app/preview/inline-citation/page.tsx`: `export const metadata: Metadata = { title: "Inline Citation" }` (was "Inline citation"); `app/preview/model-selector/page.tsx`: `{ title: "Model Selector" }` (was "Model selector"); `app/preview/response/page.tsx`: `{ title: "Message Response" }`; `app/preview/branch/page.tsx`: `{ title: "Message Branch" }` — each preview titled with its registry item title, as the five new layouts are (meta N2). Once in, the site test can be tightened (I did not, to keep the tree green): in `tests/unit/site.test.ts` › "every preview route sets a title…", capture the title string with `/^export const metadata\b[^=]*=\s*\{\s*title:\s*"([^"]+)"/m` and `expect(title, name).toBe(byName(name).title)`.
- Same pages, `<h1>` text: `branch`, `chain-of-thought`, `chat`, `reasoning`, `response` use the lowercase item name and `prompt-input` reads "Prompt input", while the others use the title; suggest the registry title in every `<h1>` (not a finding in the reports; noticed while matching titles).
- Lead: after `pnpm build`, run `pnpm test:e2e`; the new assertions are in `e2e/previews.spec.ts` (title per preview × scheme × project) and `e2e/registry.spec.ts` (two 404 tests × project), 4 more tests than before (92).
- Lead: decide on `sequence.hooks: "list"` (not set; reasoning under Fixed › meta:F1).

## Strict-flag typecheck

- `tsconfig.json` already carries `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`; `pnpm exec tsc --noEmit` exit 0.
- Errors remaining in files I own: none. Errors in files I do not own: none at the final run (an earlier run showed `registry/ai/prompt-input.tsx(1416,9) TS6133 'keyShortcuts'` from another owner's in-progress edit; gone by the final run).

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
pnpm exec vitest run --project unit tests/unit/qa-round3-meta.test.ts            # before: 3 failed | 3 passed (before-repro.log)
pnpm exec vitest run --project browser tests/browser/theme.test.tsx              # new test before fix: "body: expected 'light' to be null" (theme-before.log); after: 3 passed
pnpm exec vitest run --project browser tests/browser/zz-fix-meta-guard-scratch.test.tsx   # old guard 5 passed; new guard 3 failed | 2 passed; file deleted each time
pnpm exec vitest run --project unit tests/unit/{test-setup,tooling,workflows,site,registry}.test.ts
pnpm exec vitest run --project browser                                            # full browser project, twice (browser-full-{1,2}.log)
mutate.sh <label> <file> <project> <test> <spec.py>                               # G1-G11, T1, T2, S1, W1, O1, H1, L1-L3, N1 (mut/*.log)
mirror-mutate.sh M1 lib/registry.ts tests/unit/site.test.ts mut/m1.py             # plus a no-op control
pnpm exec prettier --write <my files>; pnpm exec biome check <my files>
pnpm exec tsc --noEmit; pnpm lint; pnpm format:check                               # all exit 0 (tsc.log, lint.log, format.log)
for i in 1 2 3; do pnpm exec vitest run --project unit; done                     # 323 passed x3
for i in 1 2 3; do pnpm exec vitest run --project browser tests/browser/theme.test.tsx; done
for i in 1 2 3; do pnpm exec vitest run --project unit tests/unit/{test-setup,tooling,workflows,site,registry}.test.ts; done
```

Workflows and Dependabot files were not changed, so actionlint was not needed.
