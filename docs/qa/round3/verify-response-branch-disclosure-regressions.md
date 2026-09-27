# verify-response-branch-disclosure — regressions and side effects on neighbours

refuted: true

Reviewed against HEAD `82f6e83` (the lead re-checkpointed while I worked; it holds every hunk of this group plus the applied manifests). Every owned file was diffed against `ca6f2fd` and every hunk read. Logs: `<scratchpad>/verify3-rbd/` (`static.log`, `vitest-all.log`, `vitest-all-2.log`, `ssr-reruns.log`, `branch-unit-verbose.log`, `browser-three-verbose.log`, `registry-validate.log`, `probe-reasoning.log`, `status-poll.log`).

## Problems

### P1 (medium, refuting): the global `.katex-display` rule turns a wide formula in `ReasoningContent` into a scroll region no keyboard can reach — measured

`app/globals.css:139-142` adds `@layer base { .katex-display { overflow: auto hidden; padding-block: 0.25em } }`. Only `registry/ai/response.tsx:40-63` marks that box as a tab stop. `registry/ai/reasoning.tsx:257` renders `<Streamdown>` directly with the same `math` plugin and no marker, and `registry/blocks/chat/components/blocks/chat.tsx:435` routes every reasoning part through `ReasoningContent`, so the state below is reachable from the chat block.

Throwaway probe (`tests/browser/qa-round3/_verify-reasoning-math.test.tsx`, run once and deleted; the same method the QA reviewer used): `<Reasoning open><ReasoningTrigger/><ReasoningContent>` holding the preview's regularised logistic loss, viewport 375 px, `runAxe()` from `tests/a11y.ts`:

```
"overflowX": "auto", "overflowY": "hidden",
"scrollWidth": 503, "clientWidth": 343,
"tabindex": null, "role": null, "focusableInside": 0,
"pageWidens": false,
"violations": "[serious] scrollable-region-focusable: Scrollable region must have keyboard access"
```

Before this round the same content widened the page (WCAG 1.4.10, not an axe rule; keyboard users could still reach it by scrolling the document). After it, the formula is a WCAG 2.1.1 keyboard trap that axe rates `serious`. No suite catches it: no fixture or preview puts display math inside reasoning (grep `$$` over `app/preview`, `registry/blocks`, `tests/browser/ai/reasoning.test.tsx`: none), which is also why the tree stays green. The coder listed it under "Not fixed" with a request to the reasoning owner; the manifest pass then went further and gave `reasoning` the same `css` field (`registry/ai/registry.json`, `reasoning › css`), with `registryDependencies: ["collapsible"]`, so `add @uifiles/reasoning` alone now writes the rule into a project where nothing marks the box. The added docs sentence ("ReasoningContent renders Streamdown directly, so unlike @uifiles/response it does not make overflowing code blocks, tables or formulas keyboard tab stops") discloses the gap; it does not make shipping a serious violation to a neighbour's consumers acceptable.

Either of these closes it: scope the rule to the component that marks the box (`[data-slot="message-response"] .katex-display`) and drop `reasoning › css` until reasoning renders through `MessageResponse`; or land the reasoning request (render through `MessageResponse`, or add the marker there) in this round with a test at 375 px.

### P2 (low, not caused by this group's diff): `tests/unit/ssr.test.ts › branch renders to a non-empty string without throwing` went red once under full-suite load

Full run 1 (`vitest-all.log`, started 03:24:26): `Tests 1 failed | 1212 passed (1213)`, `Error: Test timed out in 5000ms` at `tests/unit/ssr.test.ts:387`, that case `5040ms`, the file `14873ms`. Full run 2 (`vitest-all-2.log`): `31 passed (31)`, `1213 passed (1213)`, `EXIT=0`. The file alone, three runs: 21/21 each (`ssr-reruns.log`). Mechanism: `cases[0]` is `branch` and its `await import("@/registry/ai/branch")` (`tests/unit/ssr.test.ts:20`) runs inside the test body, so the first Vite transform counts against the default 5 s timeout while Chromium and the unit pool share the CPU. `branch.tsx` gained no imports, and the new `tests/unit/branch.test.ts` with its `spawnSync` Flight child takes 966 ms in total (`branch-unit-verbose.log`), so this is a pre-existing fragility of an owned-but-unchanged test that the coder judged "no change needed", not a hang and not introduced by the fix. It is still a 1-in-2 red `pnpm test` here; hoisting the imports out of the case bodies or giving the `it.each` a timeout removes it. Noted for the lead; not counted toward the refutation.

### P3 (process, for the lead): the working tree was not stable during verification

`git status --porcelain` was empty at HEAD `82f6e83` at 03:31, then `status-poll.log` (03:33:14-03:34:19) shows `registry/ai/response.tsx`, `registry/ai/checkpoint.tsx`, `registry/ai/queue.tsx` and `app/globals.css` cycling through modified and restored states, with `ps` showing `qa/round3/verify-rb-tests/mutate.sh M19-no-portal-observer` and `M20-no-renderModal` on `response.tsx`. Those are sibling verifiers' mutants, not this group's hunks, but "other agents are read-only now" did not hold, and a mutant left behind would be a real regression (M20 removes the F4 line: five link-safety tests red and `LinkSafetyDialog` dead code). Before the next checkpoint: `git diff HEAD --stat` must be empty. All of my evidence for HEAD predates that activity (static checks 03:24, full runs 03:24-03:28, `verify-rb-tests/` created 03:30); the verbose run of the three browser files (03:30-03:31) may have overlapped and is green, so it adds nothing a mutant could have hidden.

## Confirmed

- Every source hunk maps to a finding: `response.tsx` → F1 (Math scroller `:40-63`), F3 (fullscreen table `:38-40, :309-321`), F4 (`LinkSafetyDialog` `:123-240`, spread order `:250-264`, `linkSafety={safety}` `:339`); `globals.css` → F1; `branch.tsx` → F2 (`componentOf` `:70-90`), N1 (`reportedClampRef` `:142-152`); `checkpoint.tsx` → F5 (`textOf`/`normalize` `:53-78`, name `:104-109`); `queue.tsx` → R3-5 (`title` `:185`); `app/preview/response/page.tsx` → F1's wide formula plus a link to exercise F4; `confirmation.tsx`, `app/preview/branch/page.tsx`, `tests/unit/ssr.test.ts` unchanged as reported. No unexplained hunk.
- `app/globals.css`: the rule sits in `@layer base`; `katex.min.css` is imported unlayered (`globals.css:5`) but sets only `display/margin/text-align` on `.katex-display`, no overflow or padding, so nothing overrides it; KaTeX's own `overflow:hidden` rules are on inner parts (`.katex-mathml`, `.stretchy`, braces) and unaffected. Inline math (`.katex` without `.katex-display`) is untouched. No `@media print` rules exist. Code-block bodies and inline tables keep the previous either-axis logic (`response.tsx:51-53`).
- `response.tsx` on its own page: `scrollable code blocks › leaves server-rendered code blocks untouched until React has hydrated them` passes; `display math › scrolls a formula wider than a phone inside a named tab stop instead of widening the page` passes at 375 px with axe clean in light and dark; `adds no tab stop to a formula that cannot scroll because the stylesheet rule is missing` passes; the Math label is applied only after `isClaimedByReact`, so the `.katex-display` box is React-owned and the hydration poll does not spin.
- Neighbours of `branch.tsx` and `response.tsx`: `tests/browser/blocks/chat.test.tsx`, `tests/browser/ai/branch.test.tsx`, `tests/browser/ai/response.test.tsx` green together (`browser-three-verbose.log`: 146/146, incl. `renders client references' selector on the server and hydrates it without a warning`, `reports a controlled clamp once under StrictMode's replayed effects`). `componentOf` descends only through fragments and host elements, so a `<Suspense>` child is not force-loaded; a direct `React.lazy` child now suspends `MessageBranch` itself, which is what React would do for that element in the same pass. `tests/unit/branch.test.ts` 10/10.
- `checkpoint.tsx` behaviour change (aria-label + children + equal tooltip now gets the description) does not touch `app/preview/checkpoint/page.tsx`, which passes only `tooltip`.
- Manifest strings in HEAD `82f6e83` match the code for `response` (Math label, fullscreen view, dialog, sideways-only, rule-gated), `branch` (memo/forwardRef/lazy, StrictMode once), `checkpoint` (collapsed-text comparison, component child, `aria-labelledby`), `queue` (`max-w-[100px] truncate`, `title` before spread, `line-clamp-2`); `confirmation` unchanged and still matches. Only `reasoning › css` is disputed (P1).
- Static: `pnpm exec tsc --noEmit` exit 0; `pnpm lint` (`biome check`, 151 files) exit 0; `pnpm format:check` exit 0; `pnpm registry:validate` exit 0.
- Full suite: run 2 `31 passed (31)`, `1213 passed (1213)`, `EXIT=0`; run 1 identical except P2.
- Tests: no `allowConsole`, `.only`, `.skip` or `vi.spyOn(console…).mockImplementation` added; the two bare `vi.spyOn(console, "error")` in `tests/unit/branch.test.ts` call through and are asserted `not.toHaveBeenCalled()`; the `window.open` mocks are the dialog's confirm path.

## Verdict

refuted: true — on P1. Everything the coder ran is green, every hunk is accounted for, and the applied manifest strings match the code; but the global CSS rule converts a neighbour's untested reflow bug into a serious keyboard-access violation, and the manifest now ships that rule to consumers of `reasoning` on its own. Scope the rule (and drop `reasoning › css`) or land the reasoning change in this round; then confirm `git diff HEAD` is empty (P3) before the next checkpoint.
