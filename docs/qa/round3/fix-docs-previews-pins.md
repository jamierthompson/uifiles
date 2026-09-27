# fix-docs-previews-pins (round 3b)

Evidence: `/docs/qa/round3/fix-docs-previews-pins/`
- `before/`: my owned files as they were before I edited them.
- `docs.diff`, `tests.diff`, `pages.diff`: my changes.
- `mutate.sh`, `mut/<name>.{diff,log}`, `mut/results.log`: mutations.
- Run logs: `*-run{1,2,3}.log`, `leak-*.log`, `ssr-*.log`, `site-*.log`, `pw-list.log`, `final-*.log`.

Checkpoint note: while I worked, the lead re-cut the checkpoint twice (`d816915`, then `38fe0a6`, then `f30c104`). Each cut picked up my edits made up to that point. Everything except the last `tests/unit/tokens.test.ts` addition is already in `f30c104`. Nothing was lost; I verified each file against HEAD.

Ordering constraint: I did tasks 1 and 6 and the six non-verified preview pages first. I touched `app/preview/{response,branch}/page.tsx`, `tests/unit/ssr.test.ts` and `e2e/previews.spec.ts` only after all three `verify-response-branch-disclosure-{correctness,tests,regressions}.md` existed; the last one appeared at about 03:47. `tests/unit/site.test.ts` was tightened only after all 19 previews carried their registry title.

## Fixed

- **Task 1, test pins (three snippets pasted, adapted only where the file's helpers required it).**
  - `tests/browser/blocks/chat.test.tsx:1348, :1368`: two tests in `describe("ChatToolPart")`, plus `ToolUIPart` added to the `ai` type import (`:3-9`). Pasted verbatim.
  - `tests/browser/ai/suggestion.test.tsx:214`: one test in `describe("suggestions")`, plus `import { useState } from "react"`. Pasted verbatim.
  - `tests/unit/tokens.test.ts:591-660`: six tests at the end of `describe("scripts/sync-tokens.ts parser")`. Two adaptations:
    - The malformed-JSON test uses the file's own `runSyncTokens(css, malformed)` helper instead of a hand-rolled `mkdtemp`/`spawnSync` copy. The helper already removes its temp dir in a `finally` and writes the `.prettierrc`.
    - Both tests use the module's `css` instead of re-reading `app/globals.css`.
- **Task 2, preview pages.** Every `<title>` and `<h1>` now reads the registry item's `title`:
  - `inline-citation`: title and h1 "Inline Citation"
  - `model-selector`: title and h1 "Model Selector"
  - `response`: title and h1 "Message Response"
  - `branch`: title and h1 "Message Branch"
  - h1 only: `chain-of-thought` "Chain of Thought", `chat` "Chat", `reasoning` "Reasoning", `prompt-input` "Prompt Input"
  - A script check found all 19 pages OK (`title == h1 == registry title`).
  - Only the metadata `title` string and the `<h1>` text changed (`pages.diff`: 12 lines).
  - Grep of `tests/` and `e2e/` for the old strings: no test or e2e assertion pins a preview `<h1>` text. `e2e/previews.spec.ts` only checks that a level-1 heading is visible. Nothing to report for other owners.
- **Task 3, `tests/unit/site.test.ts`.**
  - `:344` "every preview route sets a title, the registry item's: …" now captures the page's (or else the layout's) title with `/^export const metadata\b[^=]*=\s*\{\s*title:\s*"([^"]+)"/m`. It compares the whole `{ name: title }` map with `{ name: byName(name).title }`, so every mismatch shows in one diff.
  - New `:374` "every preview page has one <h1>, and it reads the registry item's title": every `<h1>…</h1>` in each `page.tsx`, whitespace-normalised, must equal `[byName(name).title]`. A second `<h1>` or nested markup also fails it.
  - Both fail on the old pages. I swapped in all 19 `page.tsx` from `82f6e83`, ran, then restored and `cmp`'d each file (`site-old-pages.log`):
    - `Tests 2 failed | 7 passed | 36 skipped`
    - `expected { branch: 'Branch', …(18) } to deeply equal { branch: 'Message Branch', …(18) }`, with diffs on inline-citation, model-selector and response
    - `expected { branch: [ 'branch' ], …(18) } to deeply equal { branch: [ 'Message Branch' ], …(18) }`, with diffs on six h1s
  - Both pass after.
- **Task 3, additional finding: the README caveat and `tests/unit/site.test.ts` "README's GitHub-path caveat names exactly the items that depend on @uifiles/*" went red on HEAD.**
  - Cause: `reasoning` now depends on `@uifiles/response` (the markdown-surfaces change). The failure was `expected [ 'chat', 'reasoning', 'tool' ] to deeply equal [ 'chat', 'tool' ]`.
  - `README.md:22-25` now reads "(every AI component except `reasoning` and `tool`; not the `chat` block)". `docs/architecture.md` appendix now says "cannot install `tool`, `reasoning` or `chat`".
  - The test now expects `["chat", "reasoning", "tool"]`. It also derives the README clause's backticked names from the registry instead of matching a fixed string, so the next namespaced dependency fails with a precise diff.
- **Task 4, `e2e/previews.spec.ts`.** I typechecked these and ran `playwright test --list` only; I did not run them.
  - `:46`, inside the per-preview loop: `toHaveTitle(new RegExp(`^${escapeRegExp(titleOf(name))} · `))`. The existing `/^\S.* · uifiles$/` stays. Titles come from `loadRegistry()` (`../lib/registry`, which has no side effects).
  - `:57` "preview/branch serves its branch selector and count in the HTML": `request.get("/preview/branch")` must contain `aria-label="Next branch"` and match `/>1<!-- --> of <!-- -->3</`.
  - `:67-90` `describe("at phone width")` with `test.use({ viewport: { width: 375, height: 812 } })`: `/preview/response` must have at least one `.katex-display` with `scrollWidth > clientWidth`, so the check is not vacuous, and `documentElement.scrollWidth <= clientWidth`.
    - Viewport choice: I pinned the width explicitly rather than relying on the project, so the test checks 375 px in both projects without a `skip`.
  - `--list` shows 96 tests in 3 files (92 before, plus the 2 new tests × 2 projects).
  - Failed-first evidence, read from the stale production server on :3000 (read-only `curl`; running e2e is forbidden):
    - titles served are "Branch · uifiles", "Response · uifiles", "Inline citation · uifiles" and "Model selector · uifiles", so the new title assertion fails there;
    - `/preview/branch` serves 0 `aria-label="Next branch"` and no `>N<!-- --> of <!-- -->N<` counter, so both branch assertions fail on the old build.
- **Task 5, `tests/unit/ssr.test.ts` P2.**
  - All 19 modules are imported once while the file loads (`:21-72`: a top-level `await Promise.all([...])`), so no test is charged a cold transform.
  - Each import is wrapped in `loaded()`. It resolves to a getter that returns the module, or rethrows the load error, so a module that cannot load on the server still fails only its own case.
  - Cases became synchronous (`Case = [name, () => ReactNode]`). The prompt-input server test reuses `promptInput()`.
  - Evidence (`ssr-before-verbose.log` vs `ssr-after-verbose.log`):
    - Before: branch 321 ms, reasoning 665 ms; `--testTimeout=400` fails reasoning (562 ms, `ssr-before-400ms.log`).
    - After: branch 16 ms, reasoning 35 ms, maximum 35 ms; `--testTimeout=400` gives 21/21.
  - Attribution check: pointing the `image` import at a missing module failed only "image renders…" (`Cannot find package '@/registry/ai/image-missing'`, 1 failed | 20 passed). I restored the file and `cmp`'d it.
- **Task 6, temp-dir leak.** Every temp dir these tests create is now removed with `rmSync(dir, { recursive: true, force: true })` in a `finally`:
  - `tests/unit/test-setup.test.ts:385-423` (`runGuardProbe`);
  - `tests/unit/tooling.test.ts:257-299` (`runWithoutBuild`), `:340-384` (sync-upstream `run`), `:443-506` (generate-aliases `run`).
  - The template-literal stub in generate-aliases is byte-identical. `rmSync` was probed in scratch first: it removes symlinks, not their targets. This matters because these dirs symlink the repo's `node_modules`, `app`, `tests` and so on.
  - Before the fix, one run with `TMPDIR` isolated left 11 dirs: 2 `uifiles-guard`, 2 `uifiles-no-build`, 5 `uifiles-sync-upstream`, 2 `uifiles-generate-aliases` (`leak-before.log`).
  - After the fix, three runs left 0. A run with the default `/tmp` had 868 `uifiles-*` before and 868 after, with no new entries (`comm` of the two listings is empty). The 868 are old leaks from earlier runs; I did not delete them because they are not mine.
- **Task 7, docs.** Written from the code and the current manifests (see "Docs strings").
  - `AGENTS.md`: the markdown rule is reworded. The "each new component ships with" rule now says the title and `<h1>` are the registry `title` and that `site.test.ts` enforces both.
  - `docs/architecture.md`:
    - §2: corrects the pre-existing claim that the base item's `css` is generated. `sync-tokens` writes only `cssVars`, so `css` is now described as hand-kept, with the guard pinned by `tokens.test.ts`.
    - §3 bullets updated: `code-block`, `reasoning`, `branch`, `response`, `queue`, `inline-citation`.
    - §5: the e2e bullet gains the new assertions.
    - Appendix: the GitHub-path list.
  - `CHANGELOG.md`: lines folded into `[0.1.0]` (see "Not fixed and why" for the reason).
  - `README.md`: the GitHub-path caveat and the markdown-CSS paragraph, which had implied the KaTeX import was a manual step.
- **Coordinator item, queue title.**
  - Verified against `registry/ai/queue.tsx:73-96` in `f30c104`: `title={typeof children === "string" ? children : undefined}` sits before `{...props}`. The chip is at `:184-185`.
  - Added to `docs/architecture.md` §3 `queue` and to CHANGELOG › Changed.
  - Caveat: at report time the working tree has a verifier mutant in `queue.tsx` (`children.slice(0, 20)`). My sentence describes HEAD, not the mutant.
- **Extra pin backing the new AGENTS rule** ("keep the `css` field in step with it"): `tests/unit/tokens.test.ts:321` "ships the response item the stylesheet's two imports and its .katex-display rule".
  - It checks that the response item's `@import` keys are exactly the two stylesheets and that each appears as a line in `app/globals.css`.
  - It checks that its `@layer base` equals `{ ".katex-display": <the declarations parsed from globals.css> }`.

## Not fixed and why

- e2e not run (forbidden). The lead must `pnpm build` and then run `pnpm test:e2e`; 96 tests are expected. Against the stale :3000 build these fail by design, and a rebuild clears them:
  - the title assertion, for every route whose title changed in round 3 (the four renamed here plus the five that gained a layout);
  - the branch HTML test ×2.
- CHANGELOG "hotkey removed": no v0.1.0 tag exists, and every earlier round (including round-3 meta, which deleted "(also the `d` hotkey)") edits the unreleased `[0.1.0]` entry in place. A "removed" line would therefore describe a feature no release had. Instead, the Added docs-site line now says "a theme toggle as the only theme control (no character-key shortcut, WCAG 2.1.4)". If the lead prefers an explicit line, the natural place is `[Unreleased]` › Removed, once 0.1.0 is tagged.
- `fix-markdown-surfaces.md` did not exist at any point while I worked; I checked at the start, before the docs, and at the end. I wrote the docs from the code (`registry/ai/{response,reasoning,code-block}.tsx`) and the manifest entries as they stand in `registry/ai/registry.json` and `registry/blocks/registry.json`. I also used that coder's CLI evidence (`fix-markdown-surfaces/cli-css.log`: installing `@uifiles/reasoning` writes both imports and the rule, idempotently).
  - **Claims that depend on their unfinished work:**
    - `reasoning` renders through `MessageResponse` and depends on `@uifiles/response`. This covers the AGENTS rule, architecture §3 `reasoning` plus the appendix, CHANGELOG Changed, the README caveat, and the site-test expectation.
    - `response`'s `css` field carries both imports and is inherited by `reasoning`/`chat`. This covers AGENTS, architecture §3 `response`, the CHANGELOG Added line, README, and the new tokens pin.
    - `code-block` shares one Shiki highlighter. This covers architecture §3 `code-block` and CHANGELOG Fixed.
  - **Important:** HEAD `f30c104` holds the OLD per-language `highlighterCache` in `registry/ai/code-block.tsx`. The shared-highlighter version is only in the working tree, as an uncommitted diff, probably mid-way through that coder's before/after checks. The docs match the working tree and the manifest `docs`; the lead should make sure the checkpoint that ships has the new `code-block.tsx`.

## Tests

- File counts:
  - `tests/browser/blocks/chat.test.tsx`: 65 → 67
  - `tests/browser/ai/suggestion.test.tsx`: 17 → 18
  - `tests/unit/tokens.test.ts`: 160 → 167 (6 pins + 1 css-field pin)
  - `tests/unit/site.test.ts`: 44 → 45 (1 new, 2 tightened)
  - `tests/unit/ssr.test.ts`: 21 → 21 (restructured)
  - `test-setup`/`tooling`: 46 → 46 (cleanup only)
  - `e2e/previews.spec.ts`: 38 + 2 → 38 + 4 listed, with the title assertion added to each of the 38 existing tests
  - Unit project: 323 → 331.
- No upstream tests to port (pins and site tests only).
- Mutation checks. Non-owned sources were saved to `pristine/`, mutated in place, run, then restored and checked with `git diff --quiet`; every `restored=OK diffstat=[]` is in `mut/results.log`. Mutations of my own files were restored and `cmp`'d.

| # | Mutation | Test file / filter | Result |
| --- | --- | --- | --- |
| M1 | `chat.tsx`: render a second "Streaming input…" placeholder next to `ToolInput` while `input-streaming` with no input (the round-1 shape) | chat › ChatToolPart | 1 failed / 7 passed: only "shows exactly one 'No input yet' placeholder…". The canonical placeholder test survives, which is why the pin exists |
| M2 | `chat.tsx`: `part.state === "input-available" && !isLive(status)` → `false` | chat › ChatToolPart | 2 failed: "shows a call still marked running as Pending…", "shows a stopped call as Pending with the same single placeholder" |
| M3 | `suggestion.tsx`: drop `block: "nearest"` from `scrollIntoView` | whole suggestion file | 1 failed / 17 passed: "does not scroll the page when a chip that is already in view receives focus" |
| M4 | `sync-tokens.ts`: `layers.set(name, layer)` → `if (!layers.has(name)) layers.set(name, layer)` | whole tokens file | 1 failed / 165: "lets an unlayered declaration win over two different layers without refusing" |
| M5 | `sync-tokens.ts`: `const layer = outer.join(" ")` → `outer[0] ?? ""` | whole tokens file | 1 failed / 165: "refuses a token declared in a layer and in one of its sublayers" |
| M6 | `sync-tokens.ts`: keep rules under `@media (prefers-color-scheme…)` | whole tokens file | 2 failed: "matches :root in a selector list and not inside @media", "collects no .dark tokens from a .dark block nested in a prefers-color-scheme media query" |
| M7 | `app/globals.css`: `.katex-display` `padding-block: 0.25em` → `0.3em` | tokens › stylesheet imports | 1 failed: the css-field pin (`- "padding-block": "0.3em"` / `+ "0.25em"`) |
| M8 (own) | `app/preview/plan/page.tsx`: add a second `<h1>Plan</h1>` | site › "one <h1>" | 1 failed: `"plan": ["Plan", "Plan"]` |
| M9 (own) | all 19 `page.tsx` from `82f6e83` | site › preview | 2 failed (titles, h1s), see Fixed |
| M10 (own) | `ssr.test.ts`: `image` import → a missing module | ssr | 1 failed / 20 passed (attribution kept) |

- Three consecutive runs:
  - `tests/browser/blocks/chat.test.tsx`: Tests 67 passed (67) ×3 (`chat-run{1,2,3}.log`)
  - `tests/browser/ai/suggestion.test.tsx`: Tests 18 passed (18) ×3
  - `tests/unit/tokens.test.ts`: 166 passed ×3 (before the css-field pin); after it, it is included in the three full unit runs below
  - `tests/unit/test-setup.test.ts` + `tests/unit/tooling.test.ts` (TMPDIR isolated): Tests 46 passed (46) ×3, 0 `uifiles-*` left each time
  - `tests/unit/ssr.test.ts` + `tests/unit/site.test.ts`: Tests 66 passed (66) ×3
  - `pnpm exec vitest run --project unit` (final): `Test Files 8 passed (8)`, `Tests 331 passed (331)` ×3 (4.71 s, 4.90 s, 6.11 s)
- Console guard: no `allowConsole`, no console spies added.

## Docs strings

Full text: `docs.diff`. The sentences that carry the round-3/3b decisions:

- **AGENTS.md** (replaces "Markdown needs CSS the consumer must add"): "**Markdown needs CSS in the consumer's `globals.css`.** Only `response` renders Streamdown; `reasoning` and the `chat` block render markdown through its `MessageResponse` and depend on `@uifiles/response`. The `response` item's `css` field ships three pieces, which the CLI writes into the consumer's `globals.css` (each `@import` after the file's last one, and not at all when an identical one is there) and which items depending on `@uifiles/response` inherit, so they do not repeat them: `@import "streamdown/styles.css"` (the `[data-sd-animate]` keyframes), `@import "katex/dist/katex.min.css"` (without it every formula renders twice: KaTeX's HTML plus the MathML fallback the stylesheet hides) and `@layer base { .katex-display { overflow: auto hidden; padding-block: 0.25em } }` (a wide formula scrolls in its own box instead of widening the page). The fourth, `@source "../node_modules/streamdown/dist/*.js"` (Tailwind v4 emits only classes it can see; the `@streamdown/*` plugins ship none), stays a manual step because its path is relative to the consumer's CSS file. `app/globals.css` has all four; keep the `css` field in step with it and say in the item's `docs` which lines the CLI adds and which one is manual."
- **AGENTS.md** (each new component): "…a preview page under `app/preview/<name>/` with one `<h1>` and a title, both the item's registry `title` (`metadata` in the page, or in a `layout.tsx` beside a client page), and a description; `tests/unit/registry.test.ts` fails without the test and the preview, and `tests/unit/site.test.ts` when the title or the `<h1>` is missing or differs from the registry `title`."
- **architecture §3 `response`**: code blocks, tables (inline and the fullscreen view portaled to `document.body`) and display formulas become "Code"/"Table"/"Math" groups (a formula only sideways, and only once the `.katex-display` rule lets it scroll). The link-safety modal is replaced through `linkSafety.renderModal` by a native modal `<dialog>` named "Open external link?", which is inert-making, takes focus, shows and copies the whole URL, closes on Escape, its close button or the backdrop, and returns focus; `enabled: false`, `renderModal` and `onLinkCheck` still win. The `css` field (two imports plus the rule, with the WCAG 1.4.10 reason) and the CLI placement and dedupe. `reasoning`/`chat` inherit. `@source` stays manual.
- **architecture §3 `reasoning`**: "`ReasoningContent` renders its text through `MessageResponse` (`@uifiles/response`, installed with it) instead of upstream's bare Streamdown, so reasoning gets the same plugins, shiki pair, named scroll regions, link-safety dialog and stylesheet lines as `response`."
- **architecture §3 `code-block`**: "every block shares one Shiki highlighter, created with both themes on first use, and each grammar loads the first time its language appears (a failed start or grammar load is retried by the next block), where upstream created a highlighter per language string, so a transcript in ten languages loaded the themes ten times and tripped Shiki's warning about ten or more instances." Upstream verified at `scratchpad/upstream/ai-elements/packages/elements/src/code-block.tsx:150-163` (`createHighlighter({ langs: [language], themes: [...] })` per language).
- **architecture §3 `branch`**: the count is in server HTML "also when `MessageBranchContent` is wrapped in `memo` or `forwardRef` or handed over by a Server Component as a client reference (a reference whose module is still loading suspends `MessageBranch` until it loads)". `onBranchChange` is called "once (under StrictMode too)".
- **architecture §3 `queue`**: "`QueueItemContent` and the `QueueItemFile` chip copy string children into a `title` attribute (a consumer's `title` wins, composed children get none), so a title clamped under WCAG 1.4.12 text spacing or a truncated file name stays readable on hover."
- **architecture §3 `inline-citation`**: "Prev/Next are `aria-disabled`, not `disabled`, at the ends unless `opts.loop`, so an arrow that pages to the last slide keeps focus, and have 24 px hit areas; the badge carries `aria-expanded` (and `aria-controls` while open) and a pinned card is a `role="dialog"` named by its badge". This replaces "Prev/Next are disabled at the ends", which is no longer true.
- **CHANGELOG `[0.1.0]`**:
  - Added:
    - the preview titles and h1s;
    - the toggle as the only theme control;
    - the `response` `css` field, with `@source` still manual.
  - Changed:
    - citation arrows `aria-disabled`, keeping focus, plus `aria-expanded`/`aria-controls` and the pinned dialog;
    - reasoning through `MessageResponse`;
    - queue `title` mirrors;
    - Code/Table/Math scroll groups, including the fullscreen view;
    - the link-safety `<dialog>`;
    - checkpoint "unless it repeats the button's name (its `aria-label`, or else the text its children render)";
    - tooltip `shortcut` as `aria-keyshortcuts`.
  - Fixed:
    - the code-block highlighter per language;
    - prompt-input `maxFiles` after `remove()`/`clear()`, and the double submit sending attachments twice;
    - branch served HTML without selector or count on App Router client references, memo/forwardRef, and the StrictMode double report;
    - response formula widening the page;
    - chat rejected `onSubmit` unhandled.
  - Each clause was checked against the round-3 QA findings (`components-a.md` F3/F4/F5, `components-b` F1-F5) and the code lines cited above.
- **README**: the caveat now names `reasoning` and `tool`. Markdown paragraph: "Items that render markdown (`response`, `reasoning`, the `chat` block) need Streamdown's `@source` line in your `globals.css`, which you add yourself; the CLI adds the Streamdown and KaTeX stylesheet imports and a `.katex-display` overflow rule when it installs them. The post-install notes are in the `docs` of [`@uifiles/response`](https://uifiles.dev/r/response.json)."

## Requests for other owners

- `docs/porting-ai-elements.md:107-110` (porting-doc owner): "Anything that renders Streamdown needs the consumer's `globals.css` to carry `@source …`, `@import "streamdown/styles.css"` and, for math, `@import "katex/dist/katex.min.css"`; say so in `docs`." Replace with: "Render markdown through `MessageResponse` (`@uifiles/response`) rather than Streamdown directly: its `css` field installs `@import "streamdown/styles.css"`, `@import "katex/dist/katex.min.css"` and the `.katex-display` rule, and an item that depends on it inherits them; the consumer still adds `@source "../node_modules/streamdown/dist/*.js"` by hand, so say so in `docs`."
- `skills/uifiles/SKILL.md:41-43` (skill owner): same point. The CLI now adds the two `@import`s and the `.katex-display` rule with `response`/`reasoning`/`chat`; only the `@source` line is manual. The current text reads as if all three are manual steps.
- Lead:
  - rebuild and run `pnpm test:e2e` (96 expected; new: per-route titles, branch served HTML ×2, response at 375 px ×2);
  - make sure the shipped checkpoint has the shared-highlighter `registry/ai/code-block.tsx` (HEAD `f30c104` has the old per-language cache, see "Not fixed");
  - the working tree currently carries a verifier mutant in `registry/ai/queue.tsx` (`children.slice(0, 20)`), so check `git diff HEAD --stat` before the next checkpoint;
  - 868 stale `/tmp/uifiles-*` dirs from earlier runs can be deleted (`rm -rf /tmp/uifiles-*` while no test runs); no new ones are created now.

## Strict-flag typecheck

- `pnpm exec tsc --noEmit` (the repo tsconfig has `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `noUnusedLocals`): exit 0, no output. Run after every group of changes, last after the tokens pin.
- Errors remaining in files I own: none. Errors in files I do not own: none at the time of the runs.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH   # before every command
# task 1
pnpm exec prettier --check / pnpm exec biome check <chat, suggestion, tokens tests>
pnpm exec vitest run --project unit tests/unit/tokens.test.ts                  # x3: 166 passed
pnpm exec vitest run --project browser tests/browser/ai/suggestion.test.tsx    # x3: 18 passed
pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx      # x3: 67 passed
fix-docs-previews-pins/mutate.sh M1..M7 …                                       # table above
# task 6
TMPDIR=<scratch>/tmp-before pnpm exec vitest run --project unit tests/unit/test-setup.test.ts tests/unit/tooling.test.ts   # 11 leaked dirs
TMPDIR=<scratch>/tmp-after  pnpm exec vitest run --project unit <same>          # x3: 46 passed, 0 dirs
pnpm exec vitest run --project unit <same>  (default /tmp)                      # 868 -> 868 uifiles-* dirs
# task 2/3
pnpm exec vitest run --project unit tests/unit/site.test.ts                     # red on README caveat before README fix, then 45 passed
(swap 19 pages from 82f6e83) pnpm exec vitest run --project unit tests/unit/site.test.ts -t preview   # 2 failed; restored, cmp OK
# task 5
pnpm exec vitest run --project unit tests/unit/ssr.test.ts --reporter=verbose  # before/after timings
pnpm exec vitest run --project unit tests/unit/ssr.test.ts --testTimeout=400   # before: 1 failed; after: 21 passed
pnpm exec vitest run --project unit tests/unit/ssr.test.ts tests/unit/site.test.ts   # x3: 66 passed
# task 4
pnpm exec tsc --noEmit; pnpm exec playwright test --list                        # 96 tests in 3 files
curl -s http://localhost:3000/preview/{branch,response,inline-citation,model-selector,chat}   # read-only, old build
# task 7
pnpm exec prettier --check AGENTS.md CHANGELOG.md README.md docs/architecture.md
# task 8
pnpm exec biome check <16 changed code/test files>                               # Checked 16 files. No fixes applied.
pnpm exec prettier --check <16 files + 4 docs>                                  # All matched files use Prettier code style!
pnpm exec tsc --noEmit                                                          # exit 0
pnpm exec vitest run --project unit                                             # x3: 331 passed (331)
```
