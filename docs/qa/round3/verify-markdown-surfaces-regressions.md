# verify-markdown-surfaces-regressions (round 3b)

refuted: false

Lens: regressions and side effects on neighbours. Tree at `c282003`, working tree clean at the start; `82f6e83` is its parent, so `git diff 82f6e83` is exactly the round-3b checkpoint (both 3b groups plus queue-repair).

## Problems

1. **Order-dependent test, by design (observation, not a regression).** `tests/browser/ai/code-block.test.tsx:136-163` ("keeps the raw text when the highlighter fails to start…") asserts `shiki.instances === 0` at `:137` and only works when it runs before any other highlight in the file. Vitest 5.0.2 `--sequence.shuffle` reorders suites and tests within a file (`shuffle([suites, tests]).flatMap(...)` in the vitest chunk), and both shuffled runs failed exactly there: `AssertionError: no block in this file has highlighted yet: expected 1 to be +0` (`E-codeblock-shuffle-1.log:13`, `F-codeblock-shuffle-2.log`), 53/54 otherwise. The repo does not enable shuffle, the precondition fails loudly instead of vacuously, and the coder disclosed it; nothing else in the file is order-sensitive under shuffle. Acceptable, but it is the one test in the group that cannot survive a future `sequence.shuffle`.
2. **Concurrent mutation of this group's sources during my browser runs (environment, not the code).** My first chain recorded `git status` before/after each run: `M registry/ai/reasoning.tsx` during A/B/C and `M registry/ai/code-block.tsx` during C/D/E/F (`verify-ms-regressions/*.status-*`); a `verify-ms-tests` verifier was mutation-testing the same files. The two resulting failures reproduce the coder's own mutants, not HEAD: run B `reasoning.test.tsx:846` `locator.click: Timeout` waiting for `getByRole('button', { name: 'the caching guide' })` (a plain anchor = mutant R3 `linkSafety={{ enabled: false }}`); run D `code-block.test.tsx:215` `expected 12 to be 1` plus the console guard's `[Shiki] 10 instances…` warn (= mutant C0, the old per-language highlighter). HEAD `registry/ai/reasoning.tsx:250` is `<MessageResponse>{children}</MessageResponse>` and `code-block.tsx:224-260` is the shared highlighter. A guarded re-run chain (waits for a clean tree, samples `git status` every second, retries a contaminated run) is running: `verify-ms-regressions/rerun.sh`, results in `verify-ms-regressions/summary2.txt` (A2 reasoning+chat+response, B2/C2 reasoning, D2 code-block+tool+chat, E2/F2 shuffle, G per-file coverage of reasoning.tsx and code-block.tsx, H whole unit project). Lines read `PRISTINE` only when no dirty sample was seen.
3. **Transient unit failure outside the group.** First run of `tests/unit/tokens.test.ts` failed 2 tests in the `scripts/sync-tokens.ts parser` block (`:636` "reads an unquoted data: url()…", expected `url(data:image/svg+xml;charset=utf-8,%3Csvg%3E) center`, received `url(data:image/svg+xml`), a docs-previews-pins file; the immediate re-run and the later pristine four-file run passed (`Tests 259 passed (259)`), consistent with the docs-previews verifiers mutating `scripts/sync-tokens.ts` at that moment.

## Every hunk against 82f6e83, accounted for

- `registry/ai/reasoning.tsx` (4 hunks): drop `@streamdown/{cjk,code,math,mermaid}` and `streamdown` imports; add `import { MessageResponse } from "@/registry/ai/response"`; drop the local `streamdownPlugins`/`shikiThemes`; render `<MessageResponse>{children}</MessageResponse>` with a comment. Exports, `ReasoningContentProps`, the Collapsible classes, `data-slot="collapsible-content"`, the animation classes and the auto-open/auto-close code are untouched.
- `registry/ai/code-block.tsx` (2 hunks): `highlighterCache` Map replaced by `highlighterPromise` (one instance, `langs: []`, both themes, reset on a failed start) plus `languageLoads` (per-language `loadLanguage` promise, deleted on failure). Shiki `resolveLang` returns `[]` for special languages (core `bundle-factory` `:1126-1135`), so `loadLanguage("text")` is a no-op, as the code comment says.
- `registry/ai/registry.json` (4 hunks): `code-block` docs gain the shared-highlighter clause; `reasoning` deps `["cn","lucide-react"]`, registryDeps `["collapsible","@uifiles/response"]`, `css` removed, docs rewritten; `response` css gains the two `@import` keys ahead of `@layer base`, docs rewritten; the fourth hunk (`queue` docs) is the queue-repair group's (`fix-queue-repair.md:46-54`), not this group's.
- `registry/blocks/registry.json` (1 hunk): `chat` docs CSS sentence.
- `tests/browser/ai/reasoning.test.tsx` (4 hunks): `page` import; fixtures/helpers; `afterEach` resets the viewport to 414×896 after `vi.useRealTimers()`; new describe with four tests. `tests/browser/ai/code-block.test.tsx`: mock counts `instances`, records `grammars` from creation and `loadLanguage`, `failStart`; two new tests; four `createHighlighter`→`grammars` renames; naming cases 5→10. `tests/browser/ai/context.test.tsx`: one added pin.

## Confirmed

(1) Reasoning through MessageResponse
- Consumers: only `registry/blocks/chat/components/blocks/chat.tsx:435` and `app/preview/reasoning/page.tsx:45,79,89` render `ReasoningContent`; both pass a string only, so `MessageResponse`'s memo comparator (`children`/`isAnimating`) never blocks an update. `ReasoningContent`'s own `className` still lands on the Collapsible content, as before.
- Layout: `MessageResponse` wraps Streamdown in `<div class="contents" data-slot="message-response">` (no box) and passes `size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`; Streamdown's root already carries `space-y-4 whitespace-normal [&>*:first-child]:mt-0 [&>*:last-child]:mb-0` (`node_modules/streamdown/dist/chunk-YOKDWASO.js`), so the only addition is `size-full`, which resolves to auto height inside the panel. No visible change to reasoning content.
- Selectors: the only test counting `[data-slot='message-response']` (`tests/browser/blocks/chat.test.tsx:965`) renders text parts only (expects 0), so the extra slot inside reasoning parts changes no assertion; e2e's `.katex-display` check (`e2e/previews.spec.ts:70-89`) is scoped to `/preview/response`; no preview puts a table, link or formula in reasoning.
- Timers: the reasoning tests fake only `setTimeout/clearTimeout/setInterval/clearInterval/Date` (`reasoning.test.tsx:88-95`); `MessageResponse`'s effect uses `ResizeObserver`, `MutationObserver` and `requestAnimationFrame` only while an element is not yet claimed by React (never in a client render), and its `setTimeout` lives in the link dialog only. In my contaminated-but-informative runs every fake-timer test passed (47/48 with the one mutant-caused failure; 48/48 in C).
- Side effect to know: each mounted `ReasoningContent` now registers one `MutationObserver` on `document.body` (`response.tsx:309-320`, fullscreen-table detection) plus the root observers, disconnected on unmount (the panel unmounts when closed, as before). A transcript with N open reasoning parts has N body observers; each callback only scans added/removed nodes for `[data-streamdown="table-fullscreen"]`.
- SSR: `tests/unit/ssr.test.ts:321-329` renders `ReasoningContent` on the server; passed in the pristine four-file unit run (`unit4: Tests 259 passed (259)`).

(2) The `reasoning` → `@uifiles/response` dependency
- `tests/unit/registry.test.ts:263-318` (cross-item `@/registry/...` import needs a declared `@uifiles/<x>`), `:351-356` (every bare import declared), `:379-394` (`@/components/ui/<x>` ↔ bare dep): all pass. There is no declared-but-unimported check (coder's note is accurate). `response` declares `cn, katex@^0.16, streamdown@^2.6, @streamdown/{cjk,code,math,mermaid}@^1`, so a consumer of `reasoning` still receives them.
- `README.md:22-24` already excepts `reasoning` and `tool` from the GitHub-path install (the only two items with `@uifiles/*` registryDependencies, `registry/ai/registry.json:222,325`) and `:32-35` matches the css split; `docs/architecture.md:112-116,131-134,156-164`, `AGENTS.md:95-108`, `CHANGELOG.md:39-43,83-85,131-133`, `skills/uifiles/SKILL.md:41-44`, `docs/porting-ai-elements.md:109-111` all say the same thing.
- `registry/ai/upstream.lock.json`: unchanged (`git diff --stat 82f6e83` empty), correctly so: it records upstream sources, not our edits; the keys still equal the 18 shipped items.

(3) Shared highlighter
- Renderers of `CodeBlock`: `tests/browser/ai/code-block.test.tsx` directly, `tool.test.tsx` and `blocks/chat.test.tsx` through `registry/ai/tool.tsx:24` (`import { CodeBlock } from "./code-block"`); `response` uses Streamdown's own code plugin, not this module. Run D (code-block+tool+chat together): tool and chat files passed; the only failure was the mutant-C0 one above. Vitest browser mode isolates module state per file, so the cross-file "together" risk is resource contention only.
- Disposal: neither version ever calls `highlighter.dispose()`; the old per-language `Map` kept every instance for the page's life, the new code keeps one. Shiki's `instancesCount` (`@shikijs/primitive/dist/index.mjs:383-384`) is module-level, increments on every `createShikiPrimitive` and warns at 10, 20, …; it is never decremented, so fewer instances is the only lever, and this change pulls it.

(4) Manifest `css` on `response`
- `scripts/sync-tokens.ts` writes only the base item's `cssVars` (`:208-216`); `registry/base/registry.json` contains no `katex`/`streamdown` string, so the CLI's `@import` dedupe never meets a duplicate from the base. `tests/unit/tokens.test.ts:321-351` pins the two `@import` keys and the `.katex-display` declarations to `app/globals.css`; pass. `pnpm registry:validate`: valid, 8 files / 83 items.

(5) Static
- `pnpm exec tsc --noEmit` exit 0; `pnpm lint` (`biome check`, 151 files) clean; `pnpm format:check` clean; unit `tokens`+`registry`+`site`+`ssr`: 259 passed on a pristine tree.

## Pristine re-run results (`verify-ms-regressions/summary2.txt`)

```
A2-reasoning-chat-response attempt=1 PRISTINE exit=0 | Test Files  3 passed (3) | Tests  146 passed (146)
B2-reasoning attempt=1 CONTAMINATED (1 dirty samples: registry/ai/reasoning.tsx ) exit=0 | Tests  48 passed (48)
B2-reasoning attempt=2 PRISTINE exit=0 | Test Files  1 passed (1) | Tests  48 passed (48)
C2-reasoning attempt=1 CONTAMINATED (1 dirty samples: tests/browser/ai/reasoning.test.tsx ) exit=0 | Tests  48 passed (48)
C2-reasoning attempt=2 PRISTINE exit=0 | Test Files  1 passed (1) | Tests  48 passed (48)
D2-codeblock-tool-chat attempt=1 PRISTINE exit=0 | Test Files  3 passed (3) | Tests  157 passed (157)
E2-codeblock-shuffle-1 attempt=1 PRISTINE exit=1 | Test Files  1 failed (1) | Tests  1 failed | 53 passed (54)
```

## Commands (all with `export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH`)

```
git diff 82f6e83 -- <group files>; git show HEAD:registry/ai/reasoning.tsx | grep -n MessageResponse
pnpm exec tsc --noEmit; pnpm lint; pnpm format:check; pnpm registry:validate
pnpm exec vitest run --project unit tests/unit/tokens.test.ts tests/unit/registry.test.ts tests/unit/site.test.ts tests/unit/ssr.test.ts   # 2 failed once (sync-tokens parser, outside group), then 259 passed twice
verify-ms-regressions/run-browser.sh   # A: 146 passed; B: 47/48 (mutant R3 present); C: 48/48; D: 156/157 (mutant C0 present); E, F: 53/54 (shuffle precondition)
verify-ms-regressions/rerun.sh         # guarded pristine re-runs, summary2.txt
```

No tracked file was edited; the only files written are under the scratchpad `qa/round3/verify-ms-regressions/`.
