# verify-meta-tests (round 3, lens: test quality and mutation resistance)

refuted: false

Tree: fix commit was `1f57fb7` when I started; the lead amended the checkpoint to `82f6e83` mid-session (same content for the meta files; `registry/ai/response.tsx`, modified in the working tree at my start, was folded in). Scratch: `/docs/qa/round3/verify-meta-tests/` (`backup/` byte copies + `sha256.txt`, `logs/*.log`; log names below are relative to `logs/`).

## Migration of `tests/unit/qa-round3-meta.test.ts` (`git show ca6f2fd:` vs canonical files)

File deleted: yes (`ls tests/unit/qa-round3-meta.test.ts` → no such file; `tests/unit/` has 8 files).

| reproducer (ca6f2fd) | canonical home | status |
| --- | --- | --- |
| "still charges the calls a swallowing spy hid when the test file restores mocks in its own afterEach" | `tests/unit/test-setup.test.ts:119` | present, same hook-order model; spies through `guard.console` (the proxy the real setup makes `globalThis.console`) instead of the raw target. Backed by two child-Vitest tests (`:460`) that run a 5-case probe under the real runner with `sequence.hooks` stack and list |
| "accepts a full-version comment such as `# v5.0.1` next to a pinned SHA" (child-process mirror) | `tests/unit/workflows.test.ts:84` (+ negative cases `:90`) | present as a direct synthetic check of `unpinnedActions`; stronger than the mirror (covers v5, v5.0, v5.0.1, v12.3.45 and six rejections) |
| "every preview route sets a title: the page exports metadata, or a layout beside a client page does" | `tests/unit/site.test.ts:344` | present, tightened (title must be a non-empty string; a `"use client"` page must not export metadata) + `:365` imports each layout, checks `metadata.title === registry title`, renders it as a pass-through + `:385` 404 title |
| "installs the external-request block before the first navigation, aborting only foreign hosts" | `tests/unit/tooling.test.ts:171` | present verbatim |
| "stays silent for a Vercel preview build that advertises localhost, and warns off Vercel" | `tests/unit/site.test.ts:222` (describe `:179`) | present; split into three fresh-module tests, each ending with a call that must warn |
| "keeps every description under 900 characters and every docs string single-line…" | `tests/unit/registry.test.ts:131` | present verbatim |

## Mutation table (each: pre-`cmp` against backup → edit → run → restore from backup → `cmp`; `sha256sum -c backup/sha256.txt` → all OK at the end)

| # | mutation (file:line) | test run | caught? | evidence |
| --- | --- | --- | --- | --- |
| W1 | `tests/unit/workflows.test.ts:66` regex reverted to `# v\\d+$` | `vitest run --project unit tests/unit/workflows.test.ts` | yes | `× the SHA-pin check > accepts the tag comment Dependabot writes…` — `AssertionError: v5.0: expected [ Array(1) ] to deeply equal []`; `1 failed \| 15 passed` (W1.log) |
| S1 | scratch copy of `theme.test.tsx` at `tests/browser/zz-verify-meta-scratch.test.tsx` + `vi.spyOn(console, "error").mockImplementation(() => {})` | `tooling.test.ts -t "no browser test silences"` | yes | `+ "tests/browser/zz-verify-meta-scratch.test.tsx line 153: spyOn(console, \"error\").mockImplementation("` (S1.log) |
| S1b | same, named spy `const quiet = vi.spyOn(console, "error")` silenced 4 lines later | same | yes | `line 157: quiet.mockImplementation(` (S1b.log) |
| S1c | same, `const c = globalThis.console; vi.spyOn(c, "error").mockImplementation(…)` | same | **no (static)** — by design a regex cannot follow an alias; the runtime guard catches it (F1-browser case C below) | `1 passed` (S1c.log) |
| O1 | `e2e/origin.ts:34-36` → `return Boolean(env.CI \|\| env.NEXT_PUBLIC_BASE_URL?.trim())` (localhost counts as public) | `tooling.test.ts -t expectsPublicOrigin` | yes | `AssertionError: http://localhost:3000: expected true to be false` (O1.log) |
| H1 | `e2e/helpers.ts:77` `await blockExternalRequests(page)` removed from `gotoHydrated` | `tooling.test.ts -t gotoHydrated` | yes | `AssertionError: expected [ 'goto' ] to deeply equal [ 'route', 'goto' ]` (H1.log) |
| L | `app/preview/chat/layout.tsx:5` `export const metadata…` deleted | `site.test.ts` | yes, by unit tests (not only e2e) | `× every preview route sets a title…` `expected [ 'chat' ] to deeply equal []` and `× names a preview in its layout…` `TypeError: Cannot read properties of undefined (reading 'title')`; `2 failed \| 42 passed` (L-metadata.log) |
| G1 | `tests/console-guard.ts:167` `array.slice(from)` → `array.slice(array.length)` (swallowed-call recovery off) | `test-setup.test.ts` | yes | 10 failed (8 in-process guard tests + both child-runner tests: child reports `5 passed` instead of `3 failed \| 2 passed`) (G1.log) |
| T1 | `components/theme-provider.tsx`: a `ThemeHotkey` child re-added that flips the theme on a bare `d`/`D` keydown | `vitest run --project browser tests/browser/theme.test.tsx` | yes | `× has no single-key shortcut…` `AssertionError: body: expected 'light' to be null`; `1 failed \| 2 passed` (T1.log) |
| T2 | `components/theme-toggle.tsx`: `aria-keyshortcuts="D"` on the button | same | yes | same test, `expected true to be false` (T2.log) |
| F1-browser | scratch `tests/browser/zz-verify-meta-guard.test.tsx` under the real setup (`tests/setup.ts`): A) React missing-key warning swallowed by a spy + file-level `afterEach(vi.restoreAllMocks)`; B) describe-level restore; C) spy through `const c = globalThis.console` on `warn`, then `spy.mockRestore()`; D) silent control | `vitest run --project browser <file>` | guard fails A, B, C; D passes | `3 failed \| 1 passed`; messages `console.error (swallowed by a mock implementation): Each child in a list should have a unique "key" prop…`, `…: B: hidden by a describe-level restore`, `console.warn (swallowed…): C: hidden then mockRestore` (F1-browser.log). Scratch file deleted afterwards |

Not mutated: `lib/registry.ts` (not the coder's; reasoned instead, below).

## `site.test.ts` "baseUrl() production warning" (fresh modules): reasoned

`freshBaseUrl()` (`:185`) does `vi.resetModules()` then `import("@/lib/registry")`, so `warnedLocalProductionBuild` (`lib/registry.ts:120`) starts `false` for each test; the static `baseUrl` import at `:11` is a different instance and unused in this describe. Each of the three tests ends with a call that must warn and asserts `toHaveBeenCalledTimes(1)` (`:207`, `:219`, `:236`): if the module were stale with a tripped flag, that final assertion fails, so the `not.toHaveBeenCalled()` before it (`:217`, `:231`) can only hold because of the condition under test. Dropping `!env.VERCEL &&` (`lib/registry.ts:153`) makes the Vercel test's first call warn → `:231` fails. Not vacuous. Gap outside this round's findings: nothing pins silence when `NODE_ENV !== "production"` (dropping `env.NODE_ENV === "production" &&` at `:152` would survive; the `baseUrl()` describe never passes `NODE_ENV`).

## Repeated runs (`export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; pnpm exec vitest run --project unit`)

| run | result | note |
| --- | --- | --- |
| unit 1 | `8 passed (8)`, `323 passed (323)`, 4.38 s | |
| unit 2 | `1 failed \| 322 passed` | **not the coder's tests**: `tooling.test.ts › no browser test silences…` named `tests/browser/zz-verify-guard.test.tsx` lines 36/51/62 — a sibling verifier's transient scratch file (mine were `zz-verify-meta-*`, both removed before this loop; the file was gone by the time I looked). The static check did exactly its job |
| unit 3 | same as 2 | same file |
| unit 4 | `323 passed (323)`, 16.04 s | clean tree, no stray files before/after (checked) |
| unit 5 | `323 passed (323)`, 11.36 s | " |
| unit 6 | `323 passed (323)`, 6.11 s | " |
| theme 1-3 (`--project browser tests/browser/theme.test.tsx`) | `3 passed (3)` ×3, 2.5-3.7 s | |

Three consecutive clean runs of each on an unmodified tree (unit 4-6, theme 1-3); no flake attributable to the coder's files.

## Test-quality scan (owned files: test-setup, tooling, workflows, site, registry, theme)

- Names behavioural: yes (every added test names the behaviour and the failure mode).
- Sleeps: none (`setTimeout|sleep|waitForTimeout|delay(` → no hits).
- Skips: none added (`registry.test.ts:478,507` `it.skipIf(!built && !inCI)` is the round-2 built-output gate, unchanged this round).
- Console mocks:
  - `tests/unit/site.test.ts:194,211,223` `vi.spyOn(console, "warn").mockImplementation(() => {})` — the letter of "never `vi.spyOn(console, …).mockImplementation`" is not met, the spirit is (each test asserts the call count and message; unit project, no guard to bypass; two instances predate this round at ca6f2fd `:179,195`, one added in the same shape). Nit, not refuting.
  - `tests/unit/test-setup.test.ts` spies are on fake consoles / on the guard under test; the child probe's silencers are the subject under test. Fine.
  - `tests/browser/theme.test.tsx:21-32` plain replacement of `console.error` in `beforeAll` (pre-existing), outside the guard window, restored in `finally`, asserts the captured message. Fine.
- Static check gaps (reasoned from `tooling.test.ts:524-561`, not run to spare sibling runs a transient failure): a keyword-less reassignment (`let spy` at describe scope, `spy = vi.spyOn(console, "error")` in `beforeEach`, `spy.mockImplementation` in a test) is not matched by `named` (needs `const|let|var|using` before `= vi.spyOn`) nor by `chained`; an alias of `console` (S1c) likewise. Both are caught at runtime by the proxy guard (F1-browser case C proves the alias path). Acceptable for a review-time aid; the runtime guard is the enforcement and is proven under the real runner in both hook orders.
- `sequence.hooks: "list"` deliberately not set; the child-runner test covers both orders, so the guard does not depend on it. Reasonable; lead's call.
- e2e title assertions (`e2e/previews.spec.ts:33`, `e2e/registry.spec.ts:120-131`) are unrun here (forbidden) but the unit tests alone catch a deleted layout `metadata` (mutation L), so title coverage does not rest on e2e.

## Problems

None refuting. Nits: site.test.ts console `mockImplementation` (letter vs spirit, above); static-check evasions (alias / keyword-less reassignment) caught only at runtime; no non-production silence pin for the warning (outside round 3's findings).

## Tree state

All mutated files restored byte-identically (`sha256sum -c` OK for `tests/unit/workflows.test.ts e2e/origin.ts e2e/helpers.ts app/preview/chat/layout.tsx tests/console-guard.ts components/theme-provider.tsx components/theme-toggle.tsx`; `git diff --stat -- <those>` empty; no `tests/browser/zz-*` left). Tree-wide `git status` was never stable during this session because other owners are working concurrently: at my start `registry/ai/response.tsx` was modified (then folded into `82f6e83`), later `registry/ai/registry.json` + `registry/blocks/registry.json`, then `app/globals.css`, and at the very end `registry/ai/response.tsx` again (` M`, not mine). None of these is a file I touched; `git diff --stat` restricted to my seven files is empty. Left untouched.
