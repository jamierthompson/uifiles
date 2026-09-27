# verify-markdown-surfaces-correctness (round 3b)

refuted: false

Lens: correctness of the fix. HEAD is `c282003` (the checkpoint was amended twice more after the coder's `0d70240`); every file of this group is byte-identical between HEAD and the working tree, and HEAD line 250 of `registry/ai/reasoning.tsx` is `<MessageResponse>{children}</MessageResponse>` (the R3 mutant the coder warned about is gone). Scratch: `/docs/qa/round3/verify-ms-correctness/` (`runs/`, `mut/`, `pristine-run3.sh`, `mutate.sh`, `mutations.sh`).

## Problems

None that refute. Observations, none blocking:

1. (info, environment) Another verifier mutated this group's files in place during my session: `registry/ai/reasoning.tsx` (mtime 04:17:46, hash back to HEAD `e884e78`), `registry/ai/code-block.tsx` ("failed start kept" mutant, seen in `git diff` at 04:19–04:20), `tests/browser/ai/code-block.test.tsx`, `registry/ai/context.tsx`, and `registry/blocks/chat/components/blocks/chat.tsx` (`part.state === "input-available" && !isLive(status)` → `false`). My first `prettier --check` on the seven files therefore printed `[warn] registry/ai/reasoning.tsx` (04:17); the re-check at 04:18:18 is clean and `prettier --stdin-filepath` on the file gives an empty diff. All evidence below was gathered with hash+mtime snapshots, and every run reported is pristine.
2. (low, not this group) The manifest diff against `82f6e83` has a `queue › docs` hunk; it comes from `fix-queue-repair` (present in `0d70240`), not from this coder. All other hunks are this group's.
3. (low, documented behaviour) The CLI's `@import` dedupe compares postcss `params` exactly, so a consumer whose file has `@import 'streamdown/styles.css'` in single quotes gets a second, harmless import. The coder noted it.
4. (not verifiable here) `shadcn build` with the two `@import` keys, and `add @uifiles/reasoning --dry-run` reporting the `globals.css` update, need the forbidden build/dev; `registry:validate` (which parses each item with `registryItemSchema`) passes, and the CLI's own transformer and resolver code paths are quoted below. Lead to confirm after the next build, as the coder also asked.

## Diff vs `82f6e83`, every hunk accounted for

`git diff --stat 82f6e83 -- <7 files>`: code-block.tsx 50, reasoning.tsx 21, registry/ai/registry.json 31, registry/blocks/registry.json 2, code-block.test.tsx 140, context.test.tsx 24, reasoning.test.tsx 148.

- `registry/ai/reasoning.tsx`: removes the four `@streamdown/*` imports, `streamdown`, `streamdownPlugins` and `shikiThemes`; adds `import { MessageResponse } from "@/registry/ai/response"` (`:23`); `ReasoningContent` renders `<MessageResponse>{children}</MessageResponse>` (`:250`) with a comment. Nothing else.
- `registry/ai/code-block.tsx` (`:158-260`): `highlighterCache` (per language) → `highlighterPromise` (one) + `languageLoads` (per language); `getSharedHighlighter()` and a new `getHighlighter(language)` that chains `loadLanguage`. Nothing else.
- `registry/ai/registry.json`: `code-block › docs` (+ shared-highlighter clause); `reasoning › dependencies`, `registryDependencies`, `css` (removed), `docs`; `response › css` (+ two `@import` keys), `docs`; `queue › docs` (fix-queue-repair, see above). Item-level JSON comparison confirms no other item changed.
- `registry/blocks/registry.json`: `chat › docs` only.
- `tests/browser/ai/reasoning.test.tsx`: `page` import, `WIDE_FORMULA`/`WIDE_TABLE`/`scrollRegion`/`NAMED_*` helpers, viewport reset in `afterEach`, and the `describe("reasoningContent markdown surfaces")` with four tests.
- `tests/browser/ai/code-block.test.tsx`: mock gains `instances`, `grammars` (creation + `loadLanguage`), `failStart`; `describe("shared highlighter")` with two tests; four `shiki.createHighlighter` → `shiki.grammars` renames; five alias cases added to the naming test.
- `tests/browser/ai/context.test.tsx`: the requested pin, verbatim from `fix-citation-chat.md`.

## (1) reasoning.tsx

- Current file and HEAD: `grep -n linkSafety registry/ai/reasoning.tsx` → nothing; line 250 is `<MessageResponse>{children}</MessageResponse>` in both (`git hash-object` = `git rev-parse HEAD:…` = `e884e78…`).
- The test that catches `linkSafety={{ enabled: false }}`: `tests/browser/ai/reasoning.test.tsx:841` "confirms a link in a modal dialog that takes focus and gives it back to the link on Escape". Under that mutant (my R3) it fails: `locator.click: Timeout 14836ms exceeded` on `getByRole("button", { name: "the caching guide" })` (a plain `<a>` is rendered instead), `1 failed | 47 skipped`. Under bare Streamdown (R1) the same test fails with `Cannot find element with locator: getByRole('dialog', { name: 'Open external link?' })`.
- Public API unchanged: exports in `82f6e83` and now are `useReasoning`, `ReasoningProps`, `Reasoning`, `ReasoningTriggerProps`, `ReasoningTrigger`, `ReasoningContentProps`, `ReasoningContent`; `ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & { children: string }` in both.
- No dead imports: every imported name is used (grep counts ≥ 2 for each, `useMemo` 2), and `pnpm exec tsc --noEmit` exits 0 with `noUnusedLocals: true` (`tsconfig.json:10`).
- `MessageResponse` (`registry/ai/response.tsx:247-343`) supplies `plugins={streamdownPlugins}` (`{ cjk, code, math, mermaid }`, `:22`), `shikiTheme={shikiThemes}` (`["github-light-high-contrast", "github-dark-high-contrast"]`, `:25-27`), `linkSafety={safety}` (`enabled: true` + `renderModal: <LinkSafetyDialog>` with the consumer's `linkSafety` spread last, `:253-263`), and the scroller marking (`findScrollers` queries `CODE_BLOCK_BODY`, `TABLE`, `.katex-display` under its `data-slot="message-response"` root, `:75-91`; `markScrollable` sets `tabIndex=0`, `role="group"`, `aria-label` only while `scroller.overflows(element)`, `:102-113`; `MATH.overflows` requires computed `overflow-x` auto/scroll and `scrollWidth > clientWidth`, `:58-66`). The chat block routes reasoning parts through `ReasoningContent` (`registry/blocks/chat/components/blocks/chat.tsx:435`), so the P1 surface is closed there too.

## (2) code-block.tsx

- Exactly one highlighter, lazily: `let highlighterPromise` (`:161`); `getSharedHighlighter()` returns it when set, else `createHighlighter({ langs: [], themes: [light, dark] })` (`:224-236`).
- Grammars on demand: `getHighlighter(language)` → `getSharedHighlighter().then(async h => { await h.loadLanguage(language); return h })` (`:239-258`), cached in `languageLoads` per resolved language string.
- Failed grammar load dropped: `.catch(error => { languageLoads.delete(language); throw error })` (`:251-255`); the ruby retry test asserts two requests.
- Failed start reset: `.catch(error => { highlighterPromise = undefined; throw error })` (`:231-234`); the start-up test asserts raw text + one `console.error`, then a remount highlights with `instances === 1`.
- Unknown languages fall back as before: `resolveLanguage` unchanged (`:203-221`, `Object.hasOwn(bundledLanguages, …) || SPECIAL_LANGUAGES.has(…)`, one `console.warn`, `FALLBACK_LANGUAGE = "text"`).
- Races, read against Shiki 4.4.3 (`node_modules/.pnpm/@shikijs+core@4.4.3/…/index.mjs:1121-1160`, `@shikijs+primitive@4.4.3/…/index.mjs:202-204, 269-320, 437-439`):
  - Two blocks, same language at once: the second `getHighlighter` hits `languageLoads.get` and shares the promise; no second `loadLanguage`.
  - Two blocks, `ts` and `typescript` at once: two `loadLanguage` calls; each `resolveLangs` awaits the same bundle import, then `loadLanguageSync` runs synchronously and `Registry.loadLanguage` returns early on `if (this.getGrammar(lang.name)) return;` for the second (aliases registered by the first). No interleaving inside the registry mutation.
  - A language requested while the highlighter is still starting: it chains on the pending `highlighterPromise`; if the start rejects, every chained `languageLoads` entry rejects and deletes its own key, and `highlighterPromise` is reset, so the next block starts over. A stale catch cannot clobber a newer promise because a new promise is only created after the reset (`get` returns the old one until then); the same holds for `languageLoads.delete`.
  - Special languages: `resolveLang("text"|"plaintext"|"ansi")` returns `[]` and `resolveLangs` filters them, so `loadLanguage` is a no-op; `codeToTokens` handles plain/ansi without a grammar (the twelve-languages test covers `plaintext`).
  - Shiki's warning is `instancesCount >= 10 && instancesCount % 10 === 0` in `createShikiPrimitive` (`primitive/dist/index.mjs:383-384`); with one instance it cannot fire from this file.

## (3) Manifests and docs strings

- `reasoning`: `dependencies: ["cn", "lucide-react"]` = bare imports of `reasoning.tsx` computed with the unit test's regex (`cn`, `lucide-react`, `react`; react exempt). `registryDependencies: ["collapsible", "@uifiles/response"]`. No `css` key (keys: name, type, title, description, dependencies, registryDependencies, files, docs, categories).
- `response › css` = `{"@import \"streamdown/styles.css\"": {}, "@import \"katex/dist/katex.min.css\"": {}, "@layer base": {".katex-display": {"overflow": "auto hidden", "padding-block": "0.25em"}}}`; `dependencies` still has `katex@^0.16`, `streamdown@^2.6`, the four `@streamdown/*`.
- `code-block`: unchanged deps (`cn`, `lucide-react`, `shiki@^4.4`); `chat`: no `css`, `registryDependencies` include `@uifiles/reasoning` and `@uifiles/response`.
- shadcn CLI 4.21.0, `node_modules/shadcn/dist/chunk-B2MD6U5O.js`:
  - `@import` insertion, plugin `update-css` (`Ld`), quoted: `if(i==="import"){if(!t.nodes?.find(c=>c.type==="atrule"&&c.name==="import"&&c.params===o)){let c=O.atRule({name:"import",params:o,raws:{semicolon:true}}),f=t.nodes?.filter(l=>l.type==="atrule"&&l.name==="import");if(f&&f.length>0){let l=f[f.length-1];c.raws.before=`\n`,t.insertAfter(l,c);}else !t.nodes||t.nodes.length,c.raws.before="",t.prepend(c);}}` — after the last existing `@import`, else prepended, skipped on identical params.
  - Merge across the tree: `tt` (resolveTree) pushes each fetched item and, for `registryDependencies`, `let{items:R,registryNames:I}=await et(v,t,r,new Set(o));n$1.push(...R)`; `et` handles `o.startsWith("@")&&t?.registries` by fetching the item, `n.push(f)`, and recursing into `f.registryDependencies`; then `let d={};s.forEach(y=>{d=Xe(d,y.css??{});})` with `import Xe from'deepmerge'`, and `docs` concatenated (`p+=`${y.docs}\n``). `add-components` writes it: `await an(s.css,t,{silent:r.silent,cssVars:s.cssVars,…})`, where `an` reads `t.resolvedPaths.tailwindCss` and `s&&(c=await Dd(c,e))` runs `Ld`. So `add @uifiles/reasoning` and `add @uifiles/chat` write response's css.
  - The coder's `cli-css.mjs` ran that transformer (`La`) on a shadcn v4 `globals.css`; its log shows the two imports inserted after `@import "shadcn/tailwind.css";`, the `@layer base` rule appended, a byte-identical second run, and a prepend on an empty file.
- Docs sentences, each against the code:
  - reasoning: "ReasoningContent renders the reasoning text with MessageResponse from @uifiles/response (installed with this item) instead of upstream's bare Streamdown" → `reasoning.tsx:23,250`, `registryDependencies`. "the cjk, code, math and mermaid plugins" → `response.tsx:22`. "the github-light-high-contrast/github-dark-high-contrast shiki pair" → `response.tsx:25-27`. "its named scroll regions (a code block, table or display formula that overflows becomes a keyboard tab stop, role=\"group\" named \"Code\", \"Table\" or \"Math\")" → `response.tsx:55-66,102-113`. "its link-safety dialog (a native modal <dialog> named \"Open external link?\" that takes focus and gives it back to the link)" → `response.tsx:174-178` (`<dialog aria-labelledby>`), `:211` (`translations.openExternalLink`), `showModal()` and the focus-return comment at `:150-153`; asserted by the test at `:841`. "The trigger row is min-h-6 (24px)" → `reasoning.tsx:212`. "CSS: the CLI adds @uifiles/response's stylesheet lines to your globals.css with this item: `@import \"streamdown/styles.css\"`, `@import \"katex/dist/katex.min.css\"` and the `.katex-display` overflow rule." → response `css` + the CLI merge above. "Add `@source \"../node_modules/streamdown/dist/*.js\"` yourself, next to your `@import \"tailwindcss\"` and with the path relative to your CSS file" → `app/globals.css:9`, not in any `css` field.
  - response: "installing this item adds three things to your globals.css through its `css` field" → three keys. "`@import \"streamdown/styles.css\"` provides the `[data-sd-animate]` fade/blur/slide keyframes and the list-marker fade" → `streamdown/styles.css` has `data-sd-animate` and `@keyframes sd-fade|sd-blur|sd-slide|sd-marker`. "`@import \"katex/dist/katex.min.css\"` is KaTeX's stylesheet (this item installs katex…)" → `katex@^0.16` in `dependencies`. "The CLI places each import after your last `@import` (or at the top of the file) and skips it when an identical `@import` is already there." → `Ld` quoted above. "`@layer base { .katex-display { overflow: auto hidden; padding-block: 0.25em; } }`" → the `css` key and `app/globals.css:139-142`. "Add one line yourself: `@source …`" / "If you copy the file by hand, add all four lines." → consistent (three keys + `@source`).
  - code-block: "every block on the page shares one Shiki highlighter, created with both themes on first use, and each grammar loads on demand the first time its language appears (a failed start or grammar load is retried by the next block that needs it), so a transcript in many languages loads the themes once and never trips Shiki's console warning about ten or more highlighter instances (upstream creates a highlighter per language string, so `ts` and `typescript` count twice)" → `code-block.tsx:224-258`, the two `.catch` resets, `primitive/dist/index.mjs:383-384`, and `82f6e83`'s `highlighterCache.get(language)`.
  - chat: "CSS: the CLI adds @uifiles/response's stylesheet lines to your globals.css with this block: … and the `.katex-display` overflow rule. Add `@source …` yourself" → chat's `registryDependencies` include `@uifiles/response`; `et` recursion + deepmerge above.

## (4) Runs

Pristine triple run (`pristine-run3.sh`: waits until the nine files equal HEAD, snapshots `git hash-object` + mtime before and after each run, `--reporter=verbose`):
```
=== run 1 done 04:21:12:  Test Files  3 passed (3)  Tests  153 passed (153) exit=0  pristine (hashes==HEAD, mtimes unchanged)
=== run 2 done 04:21:23:  Test Files  3 passed (3)  Tests  153 passed (153) exit=0  pristine (hashes==HEAD, mtimes unchanged)
=== run 3 done 04:21:33:  Test Files  3 passed (3)  Tests  153 passed (153) exit=0  pristine (hashes==HEAD, mtimes unchanged)
per file, each run: reasoning=48 code-block=54 context=51 failed=0
```
(An earlier unguarded triple run at 04:16 also gave 153/153/153; kept in `runs/browser-run{1,2,3}.log`.)

- `pnpm exec vitest run --project unit`: `Test Files 8 passed (8)  Tests 331 passed (331)  exit=0`.
- `pnpm registry:validate`: `√ Registry is valid. √ Checked 8 registry files and 83 items.` exit 0.
- `pnpm exec tsc --noEmit`: exit 0 (no output).
- `pnpm exec biome check <7 files>`: `Checked 7 files in 58ms. No fixes applied.` exit 0.
- `pnpm exec prettier --check <7 files>`: first pass `[warn] registry/ai/reasoning.tsx` at 04:17 while another verifier's mutant was in place (see Problems 1); `prettier --check registry/ai/reasoning.tsx` at 04:18:18: `All matched files use Prettier code style!` exit 0; `prettier --stdin-filepath` vs the file: empty diff.

## (5) Mutations (`mutate.sh`: refuses to start unless the target equals HEAD, checks the mutant hash after the run, restores from `git show HEAD:<file>`, asserts hash == HEAD and `cmp` with the backup)

| id | mutation | result |
| --- | --- | --- |
| R | `reasoning.tsx` from `82f6e83` (bare `<Streamdown plugins shikiTheme>`) | `3 failed \| 45 passed (48)`: P1 test → `expected { tabindex: null, role: null, …(1) } to deeply equal { tabindex: '0', role: 'group', …(1) }` (the missing tab stop); Table test → same; link test → `Cannot find element with locator: getByRole('dialog', { name: 'Open external link?' })`. Restored byte-identical, `git diff --stat` empty. |
| R3 | `<MessageResponse linkSafety={{ enabled: false }}>` | `1 failed \| 47 skipped (48)`: `locator.click: Timeout 14836ms exceeded` (no link button; plain anchor). Restored byte-identical. |
| C | `code-block.tsx` from `82f6e83` (per-language `createHighlighter`) | `1 failed \| 53 passed (54)`: "highlights blocks in twelve languages with one highlighter…" → `expected 12 to be 1` and the console guard: `console.warn: [Shiki] 10 instances have been created. Shiki is supposed to be used as a singleton…`. Restored byte-identical. |
| X | `context.tsx:170` ring `percent = usedTokens === Number.POSITIVE_INFINITY ? 1 : Math.min(1, usedPercent(…))` | `1 failed \| 50 passed (51)`: only "draws an empty ring for NaN, infinite and negative counts on either side" → `expected +0 to be close to 62.83185307179586`. Restored byte-identical. |

Final state: `git status --short` empty; `git diff --stat HEAD -- <9 files incl. context.tsx, response.tsx>` empty.

## Commands run

```bash
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH; cd <repo>
git diff 82f6e83 -- registry/ai/reasoning.tsx registry/ai/code-block.tsx registry/ai/registry.json registry/blocks/registry.json tests/browser/ai/{reasoning,code-block,context}.test.tsx
git show 82f6e83:registry/ai/reasoning.tsx | grep -n '^export'; grep -n '^export' registry/ai/reasoning.tsx
node -e '…'   # extract Ld (update-css), tt/et (resolveTree), Xe=deepmerge, an(s.css,…) from node_modules/shadcn/dist/chunk-B2MD6U5O.js
sed -n … node_modules/.pnpm/@shikijs+core@4.4.3/…/index.mjs node_modules/.pnpm/@shikijs+primitive@4.4.3/…/index.mjs
$V/run3.sh; $V/pristine-run3.sh                       # 3 + 3 runs of the three browser files
pnpm exec vitest run --project unit; pnpm registry:validate; pnpm exec tsc --noEmit
pnpm exec biome check <7 files>; pnpm exec prettier --check <7 files>; pnpm exec prettier --check registry/ai/reasoning.tsx
$V/mutations.sh                                        # R, R3, C, X through mutate.sh
git status --short; git diff --stat HEAD -- <9 files>
```
