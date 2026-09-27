# verify-docs-previews-pins-tests (round 3b, lens: test quality and mutation resistance)

refuted: false

Evidence: `/docs/qa/round3/verify-dpp-tests/`
(`mutate.sh`, `M*.diff`, `pristine/*`, `logs/*`). Diffs were read against `82f6e83`; HEAD at verification
time was `0d70240`. Working tree clean before and after (`git status --short` empty, `git diff --stat` empty).
No tracked file was edited except mutations, each restored byte-identically (`cmp` OK, `git diff --stat -- <file>` empty).
No build/dev/e2e/server command was run; for the e2e spec only `tsc --noEmit` and `playwright test --list`.

## Migrated snippets (present, same assertions, behavioural names)

| Snippet | Where | Verbatim? |
| --- | --- | --- |
| `chat.test.tsx.snippet` (2 tests) | `tests/browser/blocks/chat.test.tsx:1348-1383`, inside `describe("ChatToolPart")`; `ToolUIPart` added to the `ai` type import (`:3-9`) | Yes, byte-for-byte |
| `suggestion.test.tsx.snippet` (1 test) | `tests/browser/ai/suggestion.test.tsx:214-243`, inside `describe("suggestions")`; `import { useState } from "react"` added (`:1`); the file's `afterEach` (`:17-20`) resets the viewport | Yes, byte-for-byte |
| `tokens.test.ts.snippet` (6 tests) | `tests/unit/tokens.test.ts:591-660`, inside `describe("scripts/sync-tokens.ts parser")` | 4 verbatim. "exits 1 and leaves the registry untouched…" uses the file's `runSyncTokens(css, malformed)` (`:175-200`, same `mkdtemp`/`spawnSync`/`rmSync`-in-`finally` shape) and keeps the three assertions (status 1, `stderr` regex, JSON unchanged). "collects no .dark tokens…" uses the module-level `css` (`:24`, the same `app/globals.css` read) with the same `replace`/`not.toBe`/`toEqual({})` assertions |

Names: all behavioural; the added lines contain no "QA", "round", "bug", "reproducer" or "fix" (grep over the `+` lines of the eight diffs; only false positives on "preview").

## Hygiene

- Fixtures in `<main>`: the two chat tests and the suggestion `Page` render inside `<main>`.
- Shared helpers: `expectNoViolations` from `@/tests/a11y` (`chat.test.tsx:39`); no `settle`/`axe.run` copies.
- No fixed sleeps, `.skip`, `.only`, `allowConsole` or `vi.spyOn(console…).mockImplementation` in any added hunk. The `sleep` helper (`chat.test.tsx:61`) and the `allowConsole("error")` calls are pre-existing lines outside the diff. `site.test.ts:194-223` console spies are pre-existing unit tests (not browser).
- `pnpm exec biome check` (8 files): "No fixes applied". `pnpm exec prettier --check`: all matched. `pnpm exec tsc --noEmit`: exit 0 (tsconfig includes `e2e/**`).
- `pnpm exec playwright test --list`: "Total: 96 tests in 3 files"; the two new previews tests listed in both projects.

## Three runs

- `pnpm exec vitest run --project unit tests/unit/{tokens,site,ssr,test-setup,tooling}.test.ts`: `Tests 279 passed (279)` ×3 (`logs/unit-run{1,2,3}.log`).
- `pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx tests/browser/ai/suggestion.test.tsx`: `Tests 85 passed (85)` (67 + 18) ×3 (`logs/browser-run{1,2,3}.log`).
- Temp-dir cleanup (`TMPDIR` isolated, test-setup + tooling): 46 passed, 0 `uifiles-*` dirs left; the three leftovers are Vite's module-runner `ssr/<hash>` transform cache (two random-named dirs) and Node's `node-compile-cache`, not the tests' `mkdtempSync` dirs.

## `ssr.test.ts` attribution

Hoisting keeps per-module failure attribution because `loaded()` (`:21-28`) turns each dynamic import into a promise that always resolves (to a getter that either returns the module or rethrows the load error), so `Promise.all` at `:52-72` never rejects and the throw happens inside the one case that calls the getter. Verified by two in-place mutations of the test file, both restored byte-identically:

- M9a: `import("@/registry/ai/image")` → `"@/registry/ai/image-missing"`: `1 failed | 20 passed`, only "image renders to a non-empty string without throwing", `Error: Cannot find package '@/registry/ai/image-missing'`.
- M9b: the same import pointed at a scratch module whose top level is `throw new Error("boom at module load")`: `1 failed | 20 passed`, the same single case, `Error: boom at module load`. This is the module-level-`window` shape (evaluation-time throw), not only a resolution failure.

## Mutation table

Each row: source copied to `pristine/`, patched in place, the test file run, restored, `cmp` OK, `git diff --stat -- <file>` empty.

| # | Mutation (file) | Run | Result |
| --- | --- | --- | --- |
| M1 | `registry/blocks/chat/components/blocks/chat.tsx:552`: render a "Streaming input…" `<p>` next to `ToolInput` while `input-streaming` with no input | chat `-t ChatToolPart` | KILLED: 1 failed / 7 passed, only "shows exactly one 'No input yet' placeholder while the input is still undefined" (`AssertionError: expected <p …> to be null`) |
| M2 | `chat.tsx:521`: `part.state === "input-available" && !isLive(status)` → `false` (no Pending mapping) | chat `-t ChatToolPart` | KILLED: 2 failed, "shows a call still marked running as Pending…" and "shows a stopped call as Pending with the same single placeholder" (`expected 'readFileRunning' to contain 'Pending'`) |
| M2b | `chat.tsx:552`: a second literal `<p>No input yet</p>` before `ToolInput` (the round-1 double placeholder) | chat `-t ChatToolPart` | KILLED: 3 failed incl. both new pins (`expected [ <p>, <p> ] to have a length of 1 but got 2`) |
| M3 | `registry/ai/suggestion.tsx:55`: drop `block: "nearest"` | whole suggestion file | KILLED: 1 failed / 17 passed, "does not scroll the page when a chip that is already in view receives focus" (`expected 300 to be 200`) |
| M4 | `scripts/sync-tokens.ts:156`: `layers.set(name, layer)` → `if (!layers.has(name)) layers.set(name, layer)` | whole tokens file | KILLED: 1 failed / 166, "lets an unlayered declaration win over two different layers without refusing" (`--a is declared in both @layer a and @layer b`) |
| M5 | `sync-tokens.ts:147`: `outer.join(" ")` → `outer[0] ?? ""` | whole tokens file | KILLED: 1 failed / 166, "refuses a token declared in a layer and in one of its sublayers" (`expected [Function] to throw an error`) |
| M6 | `sync-tokens.ts:146`: keep rules nested under `@media` (`!prelude.startsWith("@layer") && !prelude.startsWith("@media")`) | whole tokens file | KILLED: 2 failed / 165, "matches :root in a selector list and not inside @media" and "collects no .dark tokens from a .dark block nested in a prefers-color-scheme media query" (`expected { …(31) } to deeply equal {}`) |
| M12 | `sync-tokens.ts:92`: disable the unquoted `url(` scan (`false && …`) | whole tokens file | KILLED: 2 failed / 165, incl. "reads an unquoted data: url() with ; and , inside it whole" (`{ a: 'url(data:image/svg+xml', b: '2' }`) |
| M7 | `app/globals.css:141`: `padding-block: 0.25em` → `0.3em` | whole tokens file | KILLED: 1 failed / 166, "ships the response item the stylesheet's two imports and its .katex-display rule" (diff on `.katex-display`) |
| M7b | `registry/ai/registry.json`: remove the `@import "streamdown/styles.css"` key from `response.css` | whole tokens file | KILLED: same pin (`expected [ Array(1) ] to deeply equal [ …(2) ]`) |
| M8 | `app/preview/plan/page.tsx:26`: `<h1>Plan</h1>` → `<h1>Plans</h1>` | whole site file | KILLED: 1 failed / 44, "every preview page has one <h1>, and it reads the registry item's title" |
| M8b | `plan/page.tsx:14`: `metadata.title` "Plan" → "Plans" | whole site file | KILLED: 1 failed / 44, "every preview route sets a title, the registry item's…" |
| M8c | `app/preview/chat/layout.tsx:5`: layout title "Chat" → "Chat preview" (the client-page/layout path) | whole site file | KILLED: 2 failed / 43, the title test plus the pre-existing "names a preview in its layout after the registry item…" (`chat: expected 'Chat preview' to be 'Chat'`) |
| M8d | `plan/page.tsx:26`: `<h1>` → `<p>` (no h1) | whole site file | KILLED: 1 failed / 44, the h1 test (`plan: []`) |
| M13 | all 19 `app/preview/*/page.tsx` from `82f6e83` (the coder's failed-first claim) | site `-t preview` | KILLED: 2 failed / 7 passed / 36 skipped: `{ branch: 'Branch', … }` vs `'Message Branch'` and `{ branch: [ 'branch' ] }` vs `[ 'Message Branch' ]`; all 19 restored, 0 `cmp` mismatches |
| M11 | `README.md:22-23`: "except `reasoning` and `tool`" → "except `tool`" | whole site file | KILLED: 1 failed / 44, "README's GitHub-path caveat names exactly the items that depend on @uifiles/*" (`expected [ 'tool' ] to deeply equal [ 'reasoning', 'tool' ]`) |
| M9a | `tests/unit/ssr.test.ts:58`: `image` import → missing module | ssr | 1 failed / 20 passed, only the image case (attribution kept) |
| M9b | `ssr.test.ts:58`: `image` import → scratch module throwing at load | ssr | 1 failed / 20 passed, only the image case (attribution kept) |

(A first attempt at M11 had a wrong anchor; the runner's node script wrote an empty file, the test ran against an empty README (4 failures, meaningless), and the runner restored the pristine copy: `cmp` OK, `git diff --stat -- README.md` empty. The runner was then hardened to abort on a failed patch and M11 rerun as above.)

## Problems (none refuting)

1. `tests/browser/blocks/chat.test.tsx:1368` ("stopped call as Pending…") and `tests/browser/ai/suggestion.test.tsx:214` run no axe scan. The snippets did not either and the coder pasted them verbatim; the open Pending tool state is a meaningful state the repo rule says to scan. Nit; the closed/open input-streaming state is scanned in the first pin.
2. `e2e/previews.spec.ts:67-90`: `test.use({ viewport: { width: 375, height: 812 } })` inside the describe makes the `chromium-mobile` project (already 375×812) run an identical copy of the phone-width test. Harmless duplication (the listing shows the same test twice), not a gap.
3. `e2e/previews.spec.ts` could not be executed here (forbidden). Static review: the title assertion (`:46`) regex-escapes the registry title and `titleOf` throws for an unlisted preview; the branch HTML regex `/>1<!-- --> of <!-- -->3</` (`:64`) matches React 19's SSR of the three adjacent text children at `registry/ai/branch.tsx:325` with the preview's three `MessageBranchContent` and `defaultBranch={0}`; the phone-width test (`:70-90`) is not vacuous because `Math.max()` over no `.katex-display` is `-Infinity` and `toBeGreaterThan(0)` then fails, and `app/preview/response/page.tsx:30-34` carries a display formula flagged as wider than a phone. The lead must still run `pnpm test:e2e` after a build (96 expected).
4. `tests/unit/tokens.test.ts:321` pins the `response` item's `css` only. Nothing pins the lead's decision that `reasoning` and `chat` inherit it and do not repeat it; a duplicate `css` on those items would go unnoticed here. Suggestion, not a defect of what was asked.

## Verdict

Every migrated snippet is present under its behavioural name with the same assertions; every one of the 17 mutants (8 required plus extras) is killed by the test the coder named, the ssr hoist keeps per-module attribution for both resolution and evaluation failures, the changed files are lint/format/typecheck clean, and each changed test file passed three consecutive runs. Not refuted.
