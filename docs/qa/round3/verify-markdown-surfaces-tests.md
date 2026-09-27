# verify-markdown-surfaces — test quality and mutation resistance

refuted: true

Reviewed at HEAD `c282003` (working tree clean; `registry/ai/reasoning.tsx:250` is the correct `<MessageResponse>{children}</MessageResponse>`, so the R3 mutant the coder warned about in `0d70240` is not in this checkpoint). The three test files were diffed against `82f6e83` and every hunk read. Scratch: `/docs/qa/round3/verify-ms-tests/` (`orig/` pristine copies and `sha256`, `mutate.py`, `run.sh`, `mut/*.log`, `runs/*.log`).

## Problems

### P1 (medium, refuting): a one-line override in `reasoning.tsx` that drops the AA-safe shiki pair survives all 48 reasoning tests

The new `reasoning › docs` string (`registry/ai/registry.json`, reasoning entry) promises that reasoning content "shares [Message Response's] behaviour: the cjk, code, math and mermaid plugins; the github-light-high-contrast/github-dark-high-contrast shiki pair (Streamdown's default GitHub light theme fails AA on orange tokens); its named scroll regions (a code block, table or display formula …)". The coder's four new tests (`tests/browser/ai/reasoning.test.tsx:775-889`) pin Math, Table, the link dialog and formula-once. No test in the file renders a code fence inside `ReasoningContent` (`grep '```' tests/browser/ai/reasoning.test.tsx`: none), so nothing pins the shiki pair or the "Code" region on the reasoning surface.

Mutation M7 (`registry/ai/reasoning.tsx:250`, `<MessageResponse>` → `<MessageResponse shikiTheme={["github-light", "github-dark"]}>`):

```
M7-own-plain-github-themes: SURVIVED (0 failed) Tests  48 passed (48)
```

It is not an equivalent mutant. A probe test appended to `reasoning.test.tsx` (a `ts` fence inside `ReasoningContent`, the same `--sdm-c`/`--shiki-dark` assertion `tests/browser/ai/response.test.tsx:257-289` uses for `MessageResponse`) passes on the pristine source and fails under M7 with the plain GitHub colours:

```
M7probe-pristine-src: exit=0 Tests  1 passed | 48 skipped (49)
M7probe-mutated-src:  exit=1 Tests  1 failed | 48 skipped (49)
    AssertionError: expected [ '#D73A49', '#F97583' ] to deeply equal [ '#A0111F', '#FF9492' ]
```

So the reasoning tests catch a regression to bare Streamdown (M1) and to plain anchors (M2), but not a regression of a behaviour the same change documents as inherited. Fix: one test in the "reasoningContent markdown surfaces" describe that renders a fence and asserts the keyword's `--sdm-c`/`--shiki-dark` pair (the probe above, ~25 lines); it would also cover the "Code" scroll region if the line is made wider than the phone viewport.

## Confirmed

- **Names, fixtures, helpers, sleeps, guard.** Every added test name states a behaviour; no QA/round/BUG/verify words in the three files. All new fixtures sit in `<main>` (`reasoning.test.tsx:778`, `code-block.test.tsx:143,188`, `context.test.tsx:319`). The reasoning tests use `expectNoViolations` and `withDark` from `@/tests/a11y` (light and dark, Math/Table at 375 px, and with the dialog open); no local `settle`/`axe.run`. No fixed sleeps: `expect.poll`, `vi.waitFor` and the pre-existing rAF `flush` only. No `.skip`/`.only`, no `vi.spyOn(console…).mockImplementation`. The one new `allowConsole("error")` (`code-block.test.tsx:139`) is in the test that asserts the error (`toHaveBeenCalledWith("Failed to highlight code:", …)` and `toHaveBeenCalledTimes(1)`); the twelve-language test deliberately has none, so the console guard is the assertion for Shiki's warning (M3 shows it firing). `biome check` and `prettier --check` clean on the seven owned files.
- **The shiki mock exercises the real code path.** `vi.mock("shiki")` keeps `...actual` and replaces only `createHighlighter`, which after the optional injected start-up failure calls `actual.createHighlighter(options)` (real themes, real grammar registry) and then wraps the returned instance's `loadLanguage` and `codeToTokens` with recorders that delegate to the bound originals. Failures are injected in the mock before delegation (`requestGrammars` throws for `failNext`; `failStart` rejects the creation), so what recovers is code-block.tsx's own `.catch` branches. Evidence that it measures the real thing: M3's failure includes `[Shiki] 10 instances have been created…`, which is the real shiki's warning, and M4/M5 fail through the real retry path.
- **The "must run first" test.** Module-level state (`highlighterPromise`, `languageLoads`) makes a start-up failure reproducible only before any block in the file has highlighted; that is an inherent property of the singleton under test, and the dependency is confined to one test at the top of the file with a comment saying why. It is guarded: moved after the twelve-language test (M8) it fails immediately on its first line with `AssertionError: no block in this file has highlighted yet: expected 1 to be +0` (121 ms, `failStart` never set, the other 53 tests still pass). The twelve-language test's `instances === 1` does not depend on the order.
- **Mutation table** (each run over the whole relevant file; every restore checked byte-identical with `filecmp`, sha256 against `orig/sha256`, and `git diff --stat -- <file>` empty):

| id | file | mutation | result |
| --- | --- | --- | --- |
| M1 | reasoning.tsx | `82f6e83` version swapped in (bare `<Streamdown>`) | caught (3): Math tab stop, Table tab stop, link dialog — `3 failed \| 45 passed (48)` |
| M2 | reasoning.tsx | `<MessageResponse linkSafety={{ enabled: false }}>` | caught (1): link dialog (the link is a plain anchor, `getByRole("button", { name: "the caching guide" })` times out) — `1 failed \| 47 passed (48)` |
| M3 | code-block.tsx | `82f6e83` version swapped in (per-language `createHighlighter`) | caught (1): twelve languages — `expected 12 to be 1` and the console guard's `console.warn: [Shiki] 10 instances…` — `1 failed \| 53 passed (54)` |
| M4 | code-block.tsx | `languageLoads.delete(language)` removed (failed load kept) | caught (20), incl. start-up, twelve languages, ruby retry — `20 failed \| 34 passed (54)` |
| M5 | code-block.tsx | `highlighterPromise = undefined` removed (failed start kept) | caught (52) — `52 failed \| 2 passed (54)` |
| M6 | context.tsx | `ContextIcon`: `percent = usedTokens === Infinity ? 1 : Math.min(1, usedPercent(…))` (full ring for an infinite used count, text still 0%) | caught (1): only the new pin, `expected +0 to be close to 62.83…` at `context.test.tsx:337` — `1 failed \| 50 passed (51)` |
| M7 | reasoning.tsx | `<MessageResponse shikiTheme={["github-light", "github-dark"]}>` (own) | **survived**: `48 passed (48)`; probe shows `#D73A49/#F97583` instead of `#A0111F/#FF9492` (P1) |
| M8 | code-block.test.tsx | start-up test moved after the twelve-language test (ordering probe) | fails loudly on its precondition — `1 failed \| 53 passed (54)` |

- **Three runs per file, on the pristine tree** (`runs/run{1,2,3}-*.log`; every owned source, `response.tsx` included, matched `orig/sha256` before and after each run):

```
run1-context  51 passed (51)   run1-code-block  54 passed (54)   run1-reasoning  48 passed (48)
run2-context  51 passed (51)   run2-code-block  54 passed (54)   run2-reasoning  48 passed (48)
run3-context  51 passed (51)   run3-code-block  54 passed (54)   run3-reasoning  48 passed (48)
```

  Unit project once: `8 passed (8)`, `331 passed (331)`. No run failed in or outside this group, so no re-run was needed.
- **Tree state after verification:** `git status --porcelain` empty, `git diff HEAD --stat` empty for the seven owned files, `sha256sum -c orig/sha256` OK for all seven.

## Notes (not counted)

- N1: the two new code-block tests run no axe; the raw-text state (failed start) and the fourteen-block page are visually the same states the existing ruby-retry and multi-block tests already scan, so this adds nothing new to fail.
- N2: M2 is caught by a 15 s locator timeout rather than an assertion; an explicit check that the link renders as Streamdown's safety button (`role=button`) before the click would fail in milliseconds with a clearer message.
- N3: "renders each formula once…" passed before the change too, as the coder disclosed; it is a guard against a plugin regression (M-R2 in the coder's table), not evidence of a fix.

## Verdict

refuted: true — on P1. The coder's own mutation table reproduces (7 of the brief's 7 mutations caught, the ordering guard fails loudly, the shiki mock measures the real highlighter), and all three files are 3/3 green, but the reasoning tests do not pin the shiki pair the new `docs` string promises reasoning inherits: a one-line `shikiTheme` override that reintroduces the AA-failing GitHub light theme survives 48/48. One test (the probe in `mut/M7probe-*.test.bak`, tail) closes it.
