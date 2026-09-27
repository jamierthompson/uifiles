# fix-markdown-surfaces (round 3b)

Scratch: `/docs/qa/round3/fix-markdown-surfaces/`
- `before/`: the pre-change copies of every file I own.
- `run.sh`: runs vitest and records whether `registry/ai/response.tsx` matched HEAD before and after each run. Every run below says "pristine".
- `mut/mutate.py`: backs up the file, applies one substitution or a whole-file swap, runs the test file and restores it. The restore is checked byte-identical with `filecmp`. Logs are in `mut/*.log`.
- `runs/*.log`: test runs.
- `cli-css.mjs` and `cli-css.log`: the shadcn CLI's own css transformer run on a sample `globals.css`.
- `apply-manifest.py`: the manifest edit. Each replacement asserts that its old text appears exactly once.
- `final-docs.txt`: the four final `docs` strings.

> **Lead, read first.** The checkpoint commit `0d70240` was amended while mutation R3 was applied, so `registry/ai/reasoning.tsx` in HEAD contains a mutant.
> - HEAD line 250: `<MessageResponse linkSafety={{ enabled: false }}>{children}</MessageResponse>`
> - The working tree has the correct line, `<MessageResponse>{children}</MessageResponse>`. `git diff` shows exactly that one line.
> - The next checkpoint must take the working-tree file.
> - Every other file I own is identical in HEAD and in the working tree.
> - `registry/ai/context.tsx` (mutated in place, restored) has an empty `git diff --stat`.

## Fixed

- **verify-response-branch-disclosure-regressions:P1 (medium, refuting): a wide display formula in ReasoningContent was a scroll region the keyboard could not reach (axe `[serious] scrollable-region-focusable`).**
  - What changed: `registry/ai/reasoning.tsx:250` now renders ReasoningContent's markdown through `MessageResponse` from `@/registry/ai/response` (import at `:23`), not through a bare `<Streamdown>`.
    - The formula box gets Message Response's "Math" marker: `tabindex=0`, `role="group"`, `aria-label="Math"`.
    - The duplicated `streamdownPlugins`/`shikiThemes` pair and the four `@streamdown/*` imports plus `streamdown` are gone. `MessageResponse` carries them, and nothing else in the file used them.
    - Public API unchanged: same exports, and `ReasoningContentProps` is still Collapsible content props plus `children: string`. All 44 existing reasoning tests pass unchanged.
  - Test: `tests/browser/ai/reasoning.test.tsx` › "reasoningContent markdown surfaces" › "scrolls the response preview's regularised logistic loss inside a named Math tab stop at 375 px instead of leaving an unreachable scroll region" (`:788`). This is the verifier's exact probe:
    - fixture: `<Reasoning open><ReasoningTrigger/><ReasoningContent>` holding the formula from `app/preview/response/page.tsx`, byte-compared with the page; viewport 375 px.
    - it asserts the page does not widen, `NAMED_MATH`, and `getByRole("group", { name: "Math" })`;
    - `expectNoViolations()` passes in light and under `withDark`;
    - Tab reaches the formula and ArrowRight scrolls it.
  - Failed before (pre-change `reasoning.tsx`): `AssertionError: expected { tabindex: null, role: null, …(1) } to deeply equal { tabindex: '0', role: 'group', …(1) }`.
    - I then ran the same probe with axe moved ahead of that assertion, on the pre-change source (`mut/P1-axe-before.log`). It gives the verifier's finding exactly: `AssertionError: [serious] scrollable-region-focusable: Scrollable region must have keyboard access`.
  - Passes after. Mutation R1 (swap the pre-change `<Streamdown>` source back in) fails it.
- **fix-response-branch-disclosure request (reasoning): ReasoningContent now has named table and code scroll regions and the accessible link-safety dialog.** Same change as P1. Tests in the same describe:
  - "scrolls a table wider than a phone inside a named Table tab stop" (`:818`): 375 px, page not widened, `role="group"` named "Table", axe clean in light and dark.
    - Failed before: `expected { tabindex: null, role: null, …(1) } to deeply equal { tabindex: '0', role: 'group', …(1) }`.
  - "confirms a link in a modal dialog that takes focus and gives it back to the link on Escape" (`:841`):
    - `getByRole("dialog", { name: "Open external link?" })`, with focus inside it and on Close;
    - the whole URL is visible and Streamdown's own `link-safety-modal` is absent;
    - whole-page axe passes in light and dark with the dialog open;
    - Escape closes it and the link has focus again.
    - Failed before: `VitestBrowserElementError: Cannot find element with locator: getByRole('dialog', { name: 'Open external link?' })`.
  - "renders each formula once, with KaTeX's MathML copy visually hidden" (`:871`): one `.katex`, one `.katex-display` and one `<math>`, no literal `$$`, `.katex-html` `aria-hidden` and painted, and the MathML box ≤ 1×1 px.
    - **This one passed before as well.** Pre-change reasoning also rendered KaTeX, and the test page imports `app/globals.css` with KaTeX's stylesheet. Here "twice" only happens without that stylesheet. So it is a guard that routing through Message Response kept the math plugin and did not double-render, not proof of a fix.
    - Mutations R2 (`plugins={{}}`) and R4 (two renderers) fail it.
- **fix-citation-chat request (code-block): one Shiki highlighter instead of one per language string.** `registry/ai/code-block.tsx:158-260`:
  - `getSharedHighlighter()` creates one highlighter lazily, with both themes and `langs: []`. It resets on a failed start.
  - `getHighlighter(language)` calls `highlighter.loadLanguage(language)` on demand.
  - The load promise is cached per resolved language string in `languageLoads` and deleted on failure, as the old per-language cache did.
  - Unknown languages still resolve to `text` first. `loadLanguage("text"/"plaintext"/…)` is a no-op in Shiki: `resolveLang` returns `[]` for special languages (`@shikijs/core` `createBundledHighlighter`). A grammar already loaded under another alias is skipped (`Registry.loadLanguage`: `if (this.getGrammar(lang.name)) return`).
  - Test: `tests/browser/ai/code-block.test.tsx` › "shared highlighter" › "highlights blocks in twelve languages with one highlighter, loading each grammar once, and Shiki logs nothing" (`:167`). It renders `ts`, `typescript`, `tsx`, `js`, `bash`, `sh`, `yml`, `json`, `css`, `html`, `python` and `plaintext`, plus a second `ts` and a second `python` block. It asserts:
    - each block is highlighted (theme background);
    - every non-plaintext first line has more than one token colour, and plaintext has one;
    - `codeToTokens` ran with that language;
    - `shiki.instances === 1`, and no grammar was requested twice.
    - There is no `allowConsole`, so the console guard fails the test if Shiki warns.
  - Failed before (old `code-block.tsx` swapped in): `console.warn: [Shiki] 10 instances have been created. Shiki is supposed to be used as a singleton…`, plus `expected 12 to be 1` on the instance count (`mut/code-block-before2.log`). Passes after.
- **fix-citation-chat request: the remaining alias cases.** `bash` → "Shell code", `tsx` → "TSX code", `js` → "JavaScript code", `yml` → "YAML code" and `plaintext` → "Code" joined › "names the scroll container after the language or its shiki alias and falls back to Code" (`:828`). The test now covers 10 cases, each asserting `role="group"`. Its existing `toHaveBeenCalledExactlyOnceWith('"nonsense-lang"')` would also catch a Shiki warning.
- **Start-up failure path of the shared highlighter (new code, so newly tested).** › "keeps the raw text when the highlighter fails to start and starts it on the next mount" (`:136`).
  - The mock's `failStart` makes `createHighlighter` reject once. The block keeps its raw text and logs "Failed to highlight code:" once. A remount highlights, with exactly one instance.
  - Module state means this test must run before any other highlight in the file. It sits first and asserts its own precondition (`shiki.instances` is 0), so moving it fails loudly instead of passing vacuously.
  - It passed on the old source too, which recreated per language. It exists for the new reset branch, and mutation C2 fails it.
- **fix-citation-chat request (context): pin "draws an empty ring for NaN, infinite and negative counts on either side".** Added verbatim to `tests/browser/ai/context.test.tsx:317`; the file's `dashOffset` and `CIRCUMFERENCE` helpers matched as they were.
  - It passes on the current source.
  - Mutations X1 (ring guards only an unknown window) and X2 (ring uses the raw ratio, so it draws NaN) fail it.
  - Mutation X3 fails only this pin: the ring is full for an infinite used count and has no NaN, so the existing test's console guard stays quiet.
  - `context.tsx` was restored byte-identically (`sha256sum -c` OK), and `git diff --stat -- registry/ai/context.tsx` is empty.
- **Manifest (`registry/ai/registry.json`: reasoning, code-block, response; `registry/blocks/registry.json`: chat docs).** See "Docs strings" for the exact text.
  - reasoning:
    - `dependencies` is now exactly what `reasoning.tsx` imports: `["cn", "lucide-react"]` (react is exempt).
    - `registryDependencies` is now `["collapsible", "@uifiles/response"]`.
    - `css` is removed; it comes from response through the CLI merge (verified below).
    - `docs`: the shiki sentence and C4 ("ReasoningContent renders Streamdown directly…") are replaced by the Message Response sentence, and the CSS sentence is rewritten.
  - response: `css` gains `"@import \"streamdown/styles.css\"": {}` and `"@import \"katex/dist/katex.min.css\"": {}`, placed ahead of the unchanged `@layer base` rule. The CSS part of `docs` is rewritten.
  - code-block: `docs` gains the shared-highlighter clause.
  - chat: the CSS sentence in `docs` is rewritten.
  - Descriptions are unchanged, and the Base UI sentence is still first in every `docs`.
  - Items are still sorted. `apply-manifest.py` round-trips through `json` + prettier byte-identically before editing.
- **CLI evidence for the `css` decisions** (shadcn 4.21.0; `node_modules/shadcn/dist/chunk-B2MD6U5O.js`):
  - Updater `@import` branch (plugin `update-css`, function `Ld`), quoted from the dist: `if(i==="import"){if(!t.nodes?.find(c=>c.type==="atrule"&&c.name==="import"&&c.params===o)){let c=O.atRule({name:"import",params:o,raws:{semicolon:true}}),f=t.nodes?.filter(l=>l.type==="atrule"&&l.name==="import");if(f&&f.length>0){let l=f[f.length-1];c.raws.before=`\n`,t.insertAfter(l,c);}else …,t.prepend(c);}}`
    - Source: `packages/shadcn/src/utils/updaters/update-css.ts:124-161`, "Insert after the last existing import" / "insert at beginning".
    - The dedupe is on identical params, so an existing `@import 'streamdown/styles.css'` in single quotes would not match.
  - Merge across the dependency tree: the resolver `tt` (`resolveTree`) collects every item, including those `et` pulls in recursively through `@`-registry `registryDependencies`, then runs `let d={};s.forEach(y=>{d=Xe(d,y.css??{});})`. `Xe` is deepmerge (source: `registry/resolver.ts:348-350` `css = deepmerge(css, item.css ?? {})`). So `add @uifiles/reasoning` and `add @uifiles/chat` write response's `css`.
    - `docs` are concatenated the same way (`p+=docs`), so installing reasoning prints response's docs too.
  - Run on a real file (`cli-css.mjs`, the CLI's exported transformer `La` = `Dd` = `transformCss`, with reasoning's merged css) on a shadcn v4 `globals.css`:
    - it inserts `@import "streamdown/styles.css";` and `@import "katex/dist/katex.min.css";` right after `@import "shadcn/tailwind.css";`;
    - it appends `@layer base { .katex-display { … } }`;
    - a second install is byte-identical (idempotent);
    - on an empty file the import is prepended.

## Not fixed and why

- Nothing in scope is left open.
- Not verifiable here: the real CLI round trip (`pnpm registry:build`, `pnpm dev`, `shadcn add @uifiles/reasoning --dry-run`). Build and dev are forbidden, so I ran the CLI's own transformer and resolver code instead (above). The lead should confirm after the next build that `view @uifiles/response` shows the two `@import` keys, and that `add @uifiles/reasoning --dry-run` reports the `globals.css` update.
- Mutation C6 (`langs: ["typescript"]` at creation instead of `[]`) survives. It is equivalent in behaviour (one grammar preloaded early), so no test should pin it.

## Tests

- `tests/browser/ai/reasoning.test.tsx`: 44 → 48 (the four tests above). The 44 pre-existing tests, the upstream ports among them, pass unchanged. No new upstream API applies.
- `tests/browser/ai/code-block.test.tsx`: 52 → 54 (start-up failure, twelve languages; naming test extended from 5 to 10 cases).
  - The shiki mock now counts `instances`, records `grammars` from `createHighlighter` and `loadLanguage` (it was `createHighlighter` only), and gains `failStart`.
  - Its four existing uses were renamed to `shiki.grammars`, and the ruby retry test still expects two requests.
- `tests/browser/ai/context.test.tsx`: 50 → 51 (the pin).

Mutation checks. Each restore was byte-identical, and response.tsx was pristine during every run.

| id | mutation | result |
| --- | --- | --- |
| R1 | pre-change `reasoning.tsx` (bare `<Streamdown>`) swapped in | caught (3): Math, Table, link dialog |
| R2 | `<MessageResponse plugins={{}}>` | caught (2): Math, formula-once |
| R3 | `<MessageResponse linkSafety={{ enabled: false }}>` | caught (1): link dialog |
| R4 | two `MessageResponse` renderers | caught (11) |
| C0 | pre-change `code-block.tsx` (per-language `createHighlighter`) swapped in | caught (1): twelve languages (`[Shiki] 10 instances…` + `expected 12 to be 1`) |
| C1 | shared highlighter not cached | caught (1): twelve languages |
| C2 | failed start not reset | caught (52) |
| C3 | failed grammar load not dropped | caught (20), incl. the ruby retry and start-up tests |
| C4 | no `loadLanguage` | caught (47) |
| C5 | no per-language load cache | caught (1): twelve languages (grammar requested twice) |
| C6 | `langs: ["typescript"]` at creation | survived (equivalent) |
| X1 | ring: `maxTokens > 0 ? used / max : 0` | caught (2): the pin and the existing 0%/NaN test, the latter via React's NaN-attribute console.error |
| X2 | ring: raw `used / max` (NaN ring) | caught (2), same two |
| X3 | ring full for an infinite used count (no NaN) | caught (1): **only the new pin** |
| P1 | pre-change reasoning + axe run first in the P1 test | `[serious] scrollable-region-focusable` (the verifier's finding) |

Three consecutive runs (`runs/run{1,2,3}-*.log`, each file on its own, response.tsx pristine in each):

```
run1-reasoning  Tests  48 passed (48)   run1-code-block  Tests  54 passed (54)   run1-context  Tests  51 passed (51)
run2-reasoning  Tests  48 passed (48)   run2-code-block  Tests  54 passed (54)   run2-context  Tests  51 passed (51)
run3-reasoning  Tests  48 passed (48)   run3-code-block  Tests  54 passed (54)   run3-context  Tests  51 passed (51)
```

Unit project, three runs: `Tests  331 passed (331)` each time. This includes `tests/unit/registry.test.ts`, which checks undeclared imports, `@uifiles/response` declared for the `@/registry/ai/response` import, one-paragraph docs with balanced quotes and backticks, and descriptions ≤ 900 characters; and `tests/unit/ssr.test.ts` (reasoning SSR).

Neighbours, once: `tests/browser/blocks/chat.test.tsx`, `tool.test.tsx` and `response.test.tsx` together gave `Tests 134 passed (134)`.

## Docs strings

For the docs group. The shipped `docs` strings are in `final-docs.txt`. Sentences for the three documents:

- `docs/architecture.md` §3, "Intentional divergences":
  - reasoning: "`reasoning`: `ReasoningContent` renders its text through `MessageResponse` (`@uifiles/response`, now a registry dependency) instead of upstream's bare Streamdown, so reasoning content gets Message Response's plugins, high-contrast shiki pair, named \"Code\"/\"Table\"/\"Math\" scroll regions, KaTeX requirement and accessible link-safety dialog; `reasoning` declares only `cn` and `lucide-react` and ships no `css` of its own, since the CLI merges `@uifiles/response`'s."
  - code-block: "`code-block`: every block shares one Shiki highlighter, created lazily with both themes and no grammars, and each grammar is loaded on demand with `loadLanguage` (the load promise is cached per language and dropped on failure, as is a failed start); upstream created a highlighter per language string, so ten fence languages meant ten highlighters, the themes loaded ten times and Shiki's \"10 instances\" `console.warn`."
  - response css: "`response`: the item's `css` field ships `@import \"streamdown/styles.css\"`, `@import \"katex/dist/katex.min.css\"` (empty-object keys, which the CLI's `update-css` inserts after the consumer's last `@import`, or at the top, and skips when an identical `@import` exists) and the `.katex-display` rule; items that depend on `@uifiles/response` (`reasoning`, the `chat` block) inherit it through the CLI's deepmerge of every resolved item's `css`. `@source \"../node_modules/streamdown/dist/*.js\"` stays manual because its path is relative to the consumer's CSS file."
- `AGENTS.md` › "Markdown needs CSS…": the docs group's current wording already matches the code, as far as I have read it (only response renders Streamdown; reasoning and chat depend on `@uifiles/response`; the `css` field ships the three pieces; `@source` stays manual). If it is rewritten, keep these facts:
  - "(each `@import` after the file's last one, or at the top, and skipped when an identical `@import` is there)";
  - "items depending on `@uifiles/response` inherit it and must not repeat it".
- `CHANGELOG.md`, one line each:
  - "`reasoning` renders its content through `MessageResponse` and depends on `@uifiles/response`: a wide table, code block or display formula in reasoning is now a named keyboard tab stop (a wide formula was an unreachable scroll region, axe `scrollable-region-focusable`), and links open the accessible link-safety dialog."
  - "`code-block` shares one Shiki highlighter and loads grammars on demand, so a transcript in ten or more languages no longer logs Shiki's instance warning or loads the themes once per language."
  - "Installing `response`, `reasoning` or the `chat` block now adds `@import \"streamdown/styles.css\"` and `@import \"katex/dist/katex.min.css\"` to your `globals.css`; only the `@source \"../node_modules/streamdown/dist/*.js\"` line is still yours to add."

## Requests for other owners

- **Lead:** the next checkpoint must take `registry/ai/reasoning.tsx` from the working tree. HEAD `0d70240` captured mutant R3 (`linkSafety={{ enabled: false }}` at line 250). Take the manifests and my three test files as they are too; they already match HEAD.
- **Lead (optional, preview):**
  - No preview puts a table, formula or link inside reasoning, so e2e never sees P1's surface at page level. A one-line addition to `app/preview/reasoning/page.tsx` would let the Playwright axe sweep cover it: a `$$…$$` formula in `fullText`, or a static `defaultOpen` example with the logistic loss. The preview is not mine, and the docs group owns only its title and `<h1>`.
  - The component test above covers the 375 px state in both themes.
- **`tests/unit/registry.test.ts` owner (optional):** the "both directions" check is really one direction plus the cross-item rule. Nothing fails when an item declares a package it no longer imports (reasoning kept seven stale entries until now). A reverse check needs an allow-list for packages used only through CSS or at runtime by a sibling package (`katex` in response, which the `css` field and `@streamdown/math` need).
- `registry/ai/response.tsx`: no change needed. `MessageResponse` already has everything reasoning uses.

## Strict-flag typecheck

- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`: exit 0.
- Errors remaining in files I own: none.
- Errors in files I do not own: none at the time of the run.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
S=/docs/qa/round3/fix-markdown-surfaces
# library facts: shiki primitive instance warning (@shikijs/primitive/dist/index.mjs createShikiPrimitive),
# createBundledHighlighter.loadLanguage/resolveLang (@shikijs/core), Registry.loadLanguage skip;
# shadcn dist update-css (Ld) and resolver (tt/et, deepmerge of css), plus upstream update-css.ts / resolver.ts
$S/run.sh reasoning-before --project browser tests/browser/ai/reasoning.test.tsx      # 3 failed | 45 passed
$S/run.sh reasoning-after  --project browser tests/browser/ai/reasoning.test.tsx      # 48 passed
$S/run.sh code-block-after3 --project browser tests/browser/ai/code-block.test.tsx    # 54 passed
python3 $S/mut/mutate.py <label> <source> <test> (--swap <file> | <old> <new>)        # R1-R4, C0-C6, X1-X3
# P1 axe evidence: pre-change reasoning.tsx + axe moved first, -t "regularised logistic loss", restored + cmp
python3 $S/apply-manifest.py; pnpm exec prettier --write registry/ai/registry.json registry/blocks/registry.json
pnpm registry:validate                                                                # Registry is valid (8 files, 83 items)
node $S/cli-css.mjs                                                                   # CLI transformer on a sample globals.css
pnpm exec tsc --noEmit; pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals
pnpm exec biome check <7 files>; pnpm exec prettier --check <7 files>                # clean
for i in 1 2 3; do for f in reasoning code-block context; do $S/run.sh run$i-$f --project browser tests/browser/ai/$f.test.tsx; done; done
pnpm exec vitest run --project unit   (x3)                                            # 331 passed x3
$S/run.sh neighbours-chat --project browser tests/browser/blocks/chat.test.tsx tests/browser/ai/tool.test.tsx tests/browser/ai/response.test.tsx   # 134 passed
sha256sum -c $S/mut/context.sha; git diff --stat -- registry/ai/context.tsx           # OK; empty
```
