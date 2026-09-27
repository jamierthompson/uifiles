# verify-docs-previews-pins-regressions (round 3b)

refuted: false

Lens: regressions and side effects on neighbours. Baseline `git show 82f6e83` (not an
ancestor of HEAD; the lead re-cut the checkpoint, HEAD is `c282003` at report time). Every
hunk in the 22 files diffed against `82f6e83` is accounted for by the report or the brief;
the diff stat matches the report (22 files, 708 insertions, 274 deletions, of which the
lead's `docs/porting-ai-elements.md` +8/-... and `skills/uifiles/SKILL.md` +8/-...).

## Problems

None that refutes. Notes, in order of weight:

1. **e2e, deviation from the file's pattern (minor).** `e2e/previews.spec.ts:57` (branch
   served HTML) and `:67-90` (response at phone width) run in both Playwright projects
   (`--list` shows `[chromium]` and `[chromium-mobile]` entries for each) but do not loop
   over `COLOR_SCHEMES` and do not attach `collectPageProblems`, unlike the per-preview
   tests at `:28-52`. The branch test is a raw `request.get` (no page, so no scheme); the
   phone-width test measures geometry only (`.katex-display` overflow, `documentElement`
   widths) with no axe run, so a scheme loop would duplicate it. The title assertion
   (`:46`) does sit inside the per-preview × scheme loop. Not a regression; the lead asked
   for "both colour schemes as the file's existing pattern does", so recording the gap.
2. **Site test keeps one hard-coded list (by design).** `tests/unit/site.test.ts:552`
   `expect(namespaced).toEqual(["chat", "reasoning", "tool"])` pins the registry-derived
   list itself; the README clause (`:554-560`) is then compared against the registry-derived
   `namespaced`, so the README check reads the registry, and the hard-coded line is a
   deliberate pin that fails with a precise diff when the next namespaced dependency lands.
3. **Leftover wording outside the group (other owner).** `.claude/rules/registry.md:17-19`
   still calls "Streamdown's `@source` line and stylesheet, KaTeX's stylesheet for math"
   post-install steps to document; after this round only `@source` is manual. Not
   contradictory in effect (the `docs` still mention every line), but stale. `AGENTS.md:33`
   (`pnpm test:e2e` row) and `AGENTS.md:194` (End to end bullet) do not list the new e2e
   assertions that `docs/architecture.md` §5 now lists; omission, not contradiction.
4. **Working-tree state at report time.** `registry/blocks/chat/components/blocks/chat.tsx`
   carries an uncommitted verifier mutant (a second `<p>No input yet</p>` beside
   `ToolInput`, lines 549-557), outside this group. My `chat.test.tsx` run (67 passed)
   completed before it appeared (`git status` was clean apart from `reasoning.tsx` then).
   Earlier in my session HEAD was `0d70240` with `reasoning.tsx:250`
   `<MessageResponse linkSafety={{ enabled: false }}>` and the working tree removing it;
   HEAD `c282003` now has `<MessageResponse>{children}</MessageResponse>`, so the docs'
   "link-safety dialog" claim for reasoning matches HEAD. Check `git status` before the
   next checkpoint.

## Evidence

### (1) Preview pages
- `git diff 82f6e83 -- app/preview`: 8 files, 12 changed lines, every hunk is a
  `metadata.title` string (branch, inline-citation, model-selector, response) or the `<h1>`
  text (those four plus chain-of-thought, chat, prompt-input, reasoning). No import,
  fixture, className or layout change.
- `grep -c '<h1'` = 1 and `grep -c '<main'` = 0 for all 19 `app/preview/*/page.tsx`; the
  only `<main>` under `app/preview` is `app/preview/layout.tsx:10`. Layout titles beside
  client pages: chain-of-thought "Chain of Thought", chat "Chat", confirmation
  "Confirmation", prompt-input "Prompt Input", reasoning "Reasoning".
- Old strings in `tests/` and `e2e/`: `grep -rnE '>branch<|>response<|>reasoning<|>chat<|>chain-of-thought<|Prompt input|Inline citation|Model selector|"Branch"|"Response"'`
  hits only `tests/browser/ai/inline-citation.test.tsx:131` (`<h1>Inline citations</h1>`,
  the test's own fixture) and `chain-of-thought.test.tsx` button names ("Chain of Thought",
  the component's header text). `e2e/previews.spec.ts:41` asserts only that a level-1
  heading is visible; `e2e/registry.spec.ts:29,129` name the home and 404 headings, which
  did not change.
- Neighbour that renders a renamed page: `tests/browser/ai/response.test.tsx:7` imports
  `ResponsePreview` (`:951`); its heading assertions (`:141`, `:153`) are on the markdown,
  not the page `<h1>`. Run: `Test Files 1 passed (1)`, `Tests 31 passed (31)`.
  `model-selector.test.tsx:5` imports the demo, not the page.

### (2) README
- Registry (`node -e` over `registry/ai/registry.json` + `registry/blocks/registry.json`):
  `reasoning` deps `["collapsible","@uifiles/response"]`, `tool` deps
  `["badge","collapsible","@uifiles/code-block"]`, `chat` deps include `@uifiles/prompt-input`,
  `@uifiles/reasoning`, `@uifiles/response`, `@uifiles/suggestion`, `@uifiles/tool`; no other
  item has a `@uifiles/*` dependency. `README.md:22-25` "every AI component except
  `reasoning` and `tool`; not the `chat` block" is accurate.
- `response.css` = `{"@import \"streamdown/styles.css\"": {}, "@import \"katex/dist/katex.min.css\"": {}, "@layer base": {".katex-display": {"overflow": "auto hidden", "padding-block": "0.25em"}}}`;
  `reasoning.css` and `chat.css` are undefined and their `docs` say "the CLI adds
  @uifiles/response's stylesheet lines ... with this item/block" and "Add `@source ...`
  yourself". `README.md:31-35` (imports + `.katex-display` rule added by the CLI, `@source`
  by hand) matches.
- `tests/unit/site.test.ts:541-560`: `namespaced` is computed from `registry.items`
  (`loadRegistry()`), README backticked names parsed from the clause and compared to
  `namespaced.filter(name !== "chat")`.

### (3) Docs
- `scripts/sync-tokens.ts:216` `base.cssVars = cssVars` is the only field it writes, so
  `docs/architecture.md` §2 ("`css` ... kept by hand") is true; `tests/unit/tokens.test.ts:284`
  "ships the reduced-motion guard in both the stylesheet and the base item" is the pin §2
  names. §4 (`:243`) says sync-tokens copies the blocks into `cssVars`; appendix `:331`
  states the shadcn schema fields; `CHANGELOG.md:14`, `README.md:66`, `AGENTS.md:41` and
  `.claude/rules/registry.md:12` all say tokens/`cssVars` are generated. No "generated `css`"
  claim remains.
- Three-line CSS instruction: `grep -rnE "three lines|needs three|katex.min.css|streamdown/styles.css" --include=*.md`
  hits only the rewritten passages (AGENTS.md:100-101, CHANGELOG.md:41, architecture:156-157,
  porting-ai-elements.md:109-110, SKILL.md:41-42), all saying two imports + rule via the
  CLI, `@source` manual. `app/globals.css` holds all four (tokens.test.ts:317 pins `@source`;
  the new `:321` pin checks both imports and the rule against the stylesheet).
- Theme hotkey: no `d`-hotkey text remains; `AGENTS.md:47`, `CHANGELOG.md:38`,
  `docs/architecture.md:243`, `components/theme-toggle.tsx:18` all say "no character-key
  shortcut, WCAG 2.1.4".
- Highlighter: HEAD `registry/ai/code-block.tsx:161-236` has one `highlighterPromise` with
  on-demand `loadLanguage` (`:249`); `docs/architecture.md:112-116`, `CHANGELOG.md:130-133`
  and the code-block `docs` in `registry/ai/registry.json` describe the same; the item
  `description` "lazy-loaded per language" refers to grammars and stays true.
- Reasoning: HEAD `registry/ai/reasoning.tsx:250` `<MessageResponse>{children}</MessageResponse>`;
  `tests/browser/ai/reasoning.test.tsx:841` asserts the "Open external link?" dialog; the
  `reasoning` `docs` say the same. Architecture §3 `reasoning`, CHANGELOG and the AGENTS.md
  rule agree with each other and with HEAD.
- AGENTS.md table rows vs architecture: `registry/base/` (cssVars generated) = §2;
  theme-provider row = §4; "Each new component ships with" = the two site tests
  (`site.test.ts:344`, `:374`). `AGENTS.md` mentions of e2e omit the new assertions (note 3).

### (4) rmSync
- Scratch experiment `.../round3/verify-rmsync` (node v24.21.0): temp dir containing a
  symlink to a directory (`target/` with `sub/file.txt`, `top.txt`), a symlink to a file and
  an own file; `rmSync(dir, { recursive: true, force: true })`. Output:
  `after: dir exists? false` / `target entries [ 'sub', 'top.txt' ] sub [ 'file.txt' ] top.txt keep2`.
  Symlinks are removed as links; targets untouched.
- Sites: `tests/unit/test-setup.test.ts:418-420`, `tests/unit/tooling.test.ts:295-297`,
  `:381-383`, `:503-505`, each `rmSync(dir, ...)` on the `mkdtempSync` dir only, in
  `finally`. Remaining hunks are the try/finally re-indent; the template literals' column-0
  continuation lines (setup.ts content, stub-fetch content) are unchanged.

### (5) ssr.test.ts
- 19 top-level getters; awk over the file maps each case to its same-named getter
  (`"branch" -> branch()`, ..., `"chat (block)" -> chat()`); the prompt-input server test
  reuses `promptInput()`. `registry/ai/registry.json` has 18 items
  (branch ... tool), plus the chat block = 19. `loaded()` defers a load error to the case
  that calls the getter; `expect(typeof window).toBe("undefined")` still runs per case.

### (6) e2e
- `pnpm exec playwright test --list`: `Total: 96 tests in 3 files`; the two new tests are
  listed under `[chromium]` and `[chromium-mobile]`. `pnpm exec tsc --noEmit`: exit 0.
- Title assertion `:46` is inside `for (name) for (scheme of COLOR_SCHEMES)`; root layout
  template is `"%s · uifiles"` (`app/layout.tsx:21`); `titleOf` reads `loadRegistry()`
  (`lib/registry.ts` imports only `node:fs`/`node:path`).
- Branch pins: `registry/ai/branch.tsx:296` `aria-label="Next branch"`, `:325`
  `{currentBranch + 1} of {totalBranches}`; preview has 3 branches; React 19 SSR emits
  `1<!-- --> of <!-- -->3` (verified: `renderToString(h("span",null,1," of ",3))`).

### (7) Runs (PATH set to node v24.21.0)
- `pnpm exec vitest run --project unit` ×2: `Test Files 8 passed (8)`, `Tests 331 passed (331)` both times.
- `pnpm exec vitest run --project browser tests/browser/blocks/chat.test.tsx tests/browser/ai/suggestion.test.tsx`: `Test Files 2 passed (2)`, `Tests 85 passed (85)`.
- `pnpm exec biome check <16 changed code/test files>`: `Checked 16 files in 64ms. No fixes applied.`
- `pnpm exec prettier --check <16 files + docs/architecture.md AGENTS.md CHANGELOG.md README.md docs/porting-ai-elements.md skills/uifiles/SKILL.md>`: `All matched files use Prettier code style!`
- `pnpm lint`: `Checked 151 files in 273ms. No fixes applied.` `pnpm format:check`: clean.
- No failure in `registry/ai/reasoning.tsx`/`code-block.tsx` or their tests was observed; no re-run needed.
- Coder's evidence: `fix-docs-previews-pins/mut/results.log` shows M1-M7 with
  `restored=OK diffstat=[]`; `site-old-pages.log` shows `2 failed | 7 passed` with the
  old pages; `leak-after-run{1,2,3}.log` present.
