# fix-tokens-css

Numbers below are WCAG 2.x ratios computed the way axe does (oklch → sRGB, per-channel gamut clip, alpha composited in gamma sRGB); "painted" means the 8-bit pixel Chromium actually rasterises, read back through a canvas in a throwaway browser probe (`scratchpad/qa/round1/fix-tokens-css/probe*.log`). Chromium clips out-of-gamut oklch exactly like axe for solid colours, but for `color-mix(... , transparent)` tints it composites the *unclipped* red channel, so tints of an out-of-gamut red paint a few units brighter than the model.

## Fixed

- tokens-css:F1 (high) — light `--destructive` `oklch(0.577 0.245 27.325)` → `oklch(0.52 0.245 27.325)`; dark `oklch(0.704 0.191 22.216)` → `oklch(0.74 0.191 22.216)` — `app/globals.css:70`, `:105`; `registry/base/registry.json` cssVars (regenerated) — tests: `tests/unit/tokens.test.ts` › "light text-destructive clears AA at rest, on the /10 tint and through /80 and /90 alpha with margin", › "dark text-destructive clears AA at rest, on the /20 tint, on the /30 hover tint and through /80 alpha", and the `it.each` rows "light destructive on destructive/10", "dark destructive on destructive/30", …; `tests/browser/tokens.test.tsx` › "button variants / badge variants / bubble variants / alert default and destructive / attachment error state › passes axe in the light theme" and "… in the dark theme" (failed before: axe `insufficient color contrast of 4 (foreground color: #e7000b, background color: #fde6e7)` on `<button data-slot="button">` and the destructive badge, `4.49 (#ea1a23 on #ffffff)` on the alert description, `4.11 (#ec333c)` / `4.36 (#d15457 on #171717)` on the attachment description; passes after — the original QA reproducer `tests/browser/qa-round1/tokens-css.test.tsx` went 3 failed/3 passed → 6/6 before I deleted it).
  Light, how the value was chosen: the binding row is `text-destructive/80` on card (F3, the attachment error description), which crosses 4.5 at L≈0.535. L=0.53 (the QA proposal) leaves 4.51–4.55 (painted 4.51), inside axe's ±0.03 compositing noise; L=0.52 is the highest 0.01 step with ≥0.1 margin on every at-rest row. Hover `/20` clears 4.5 only at L≤0.465 (painted 4.55 at 0.46, `#bc0000`), which is the floor the brief set and a visibly darker red, so hover stays below (transient state; see "Not fixed").
  Dark: the smallest 0.01 step that clears the `/30` hover by the clipped model is 0.735 (4.52); 0.74 gives 4.55 and fixes the F3 dark row (`/80` on card 4.37 → 4.66, painted 4.96). Chromium paints the `/30` hover tint at 4.43 for L=0.74 (unclipped-red compositing, above); painted ≥4.5 needs L≥0.78 (`#ff7d7e`, salmon, 4.58) or chroma 0.17 at L=0.74 (`#ff7979`, in gamut, 4.68). Left at 0.74 per the brief (lightness only, minimal); owner call in "Not fixed".
- tokens-css:F3 (medium) — fixed by the F1 token change without touching the vendored wrappers: `text-destructive/80` on card 4.12/4.37 → 4.64/4.66, `text-destructive/90` 4.52 (axe 4.49)/5.22 → 5.21/5.60 — same tests as F1 (`attachment error state`, `alert default and destructive`).
- tokens-css:F4 (medium, ring half) — light `--ring` `oklch(0.708 0 0)` (#a1a1a1, 2.59:1) → `oklch(0.64 0 0)` (#8c8c8c, 3.36:1 on white/card/popover, 3.08:1 on muted/secondary/accent) — `app/globals.css:73` — test: `tests/unit/tokens.test.ts` › "light ring is the lightest grey step that clears 3:1 on every light surface" (failed before: 2.593… ≥ 3), rows "light ring on background/card/muted"; `tests/browser/button.test.tsx` › "keyboard focus › shows a ring and a ring-coloured border on the <variant> variant" ×6. Why 0.64 and not 0.66: 0.66 (#929292, 3.11:1) is the lightest step that passes on white alone, but fields and buttons also sit on `bg-muted` panels where 0.66 is 2.85:1; 0.64 is the lightest 0.01 step that clears 3:1 on every light surface token (0.65 is 2.97 on muted). The `ring-ring/50` halo stays decoration (1.72:1 light, 1.87 dark); the 1px `border-ring` carries the indicator.
- tokens-css:F2 (medium) + registry-contract:F5 — `scripts/sync-tokens.ts` rewritten: string- and comment-aware brace-matching walker (`walkDeclarations`), `collectTokens(css, selector)` merges every `:root` / `.dark` rule in source order (cascade), sees through `@layer`, skips rules under conditional at-rules and declarations inside at-rules nested in the block, matches selector lists (`:root, .light`), collapses multi-line values, drops trailing comments; `extractCssVars` asserts the 18 wrapper tokens in both modes, `--radius` in light, light/dark parity (except `--radius`), ≥24 tokens per mode and a `--radius-*` scale, and throws `TokenError`; the CLI exits 1 with the list of problems **before** writing. Optional positional args `[globals.css] [registry.json]` so tests run the real binary on copies. Runs on Node 24 type stripping (no enums/namespaces/parameter properties), compiles under the strict flags. Byte-identical on today's CSS (`node scripts/sync-tokens.ts && git diff --stat registry/base/registry.json` → empty, run before the token edits) — tests: `tests/unit/tokens.test.ts` › "scripts/sync-tokens.ts parser" (10: trailing comment, nested at-rule, comment with `}`, multi-line value, `:root` in `@layer` + second `.dark` block in cascade order, selector list / `@media` exclusion, string containing `}`, drift + unbalanced braces throw, "exits non-zero without writing when the stylesheet drifts", "survives the robustness fixtures end to end") and › "sync-tokens is a no-op on the clean tree" (byte-equal). Failed before (QA reproducer): `expected undefined to be 'oklch(0.556 0 0)'`, `expected undefined to be defined`; the old script on the fixtures printed "32 light, 30 dark" / "32 light, 12 dark" and exited 0.
- tokens-css:F9 (low) — `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important } }` added to `@layer base` in `app/globals.css:134-146` and mirrored in the base item's `css["@layer base"]["@media (prefers-reduced-motion: reduce)"]["*, ::before, ::after"]` (shape checked against `registryItemCssSchema` and `processAtRule` → nested at-rule → `processRule` in `update-css.ts:453-487`; `pnpm registry:validate` passes). `!important` is deliberate: an important declaration in the earliest layer beats animation utilities and inline styles; Biome's `noImportantStyles` warning is suppressed with a `biome-ignore-start/end` range and a one-line why. Verified in the served CSS (`/_next/static/chunks/[root-of-the-server]__035ejkg._.css:617-623`) — test: `tests/unit/tokens.test.ts` › "ships the reduced-motion guard in both the stylesheet and the base item".
- tokens-css:F8 (low) — base item: `next-themes` removed from `dependencies`, `shadcn` from `devDependencies` (registry-contract:F10), `docs` rewritten for consumers (below). Removed the four dead `@source "../node_modules/@streamdown/{code,math,mermaid,cjk}/dist/*.js"` lines from `app/globals.css:8-12`: verified `grep -l className node_modules/@streamdown/*/dist/*.js` → nothing, and a broader grep for `bg-|text-|flex` class strings → nothing (the four dists are 391–1568-byte plugin shims); only `streamdown/dist/*.js` carries classes (`chunk-YOKDWASO.js`, `highlighted-body-*.js`). Served CSS after the change still contains `.list-disc`, `.border-collapse`, `.shimmer`, `[data-sd-animate]`. `streamdown/styles.css` kept: it provides the `sd-fadeIn` / `sd-blurIn` / `sd-slideUp` keyframes for `[data-sd-animate]` and the `::marker` fade for `[data-sd-animate-marker]` (`node_modules/streamdown/styles.css:1-56`); without it streamed markdown blocks pop in instead of fading — test: `tests/unit/tokens.test.ts` › "keeps the base item framework-agnostic and free of the CLI itself".
- rendered-surface:F2 (high) — `@import "katex/dist/katex.min.css";` added after `@import "streamdown/styles.css";` in `app/globals.css:5`. Resolution: `katex` is already a direct dependency (`package.json` `"katex": "^0.16.47"`, `node_modules/katex` → `.pnpm/katex@0.16.47`), so no `pnpm add` is needed; verified on the dev server (served CSS now has 230 `.katex` rules, the `.katex .katex-mathml` visually-hidden rule and 13 KaTeX `@font-face` entries with Next-bundled `/_next/static/media/KaTeX_*` URLs) and in the Vite test pipeline — tests: `tests/browser/tokens.test.tsx` › "token wiring › loads the KaTeX stylesheet, so a formula renders once and its MathML fallback is hidden" (`.katex-mathml` computed `position: absolute; height: 1px; width: 1px; overflow: hidden`), `tests/unit/tokens.test.ts` › "stylesheet imports › loads the KaTeX stylesheet streamdown's math output needs" and › "points Tailwind at streamdown's classes and nothing else".
- Docs (one placeholder bullet each, nothing else touched): `docs/architecture.md` §4 — the `LEAD: fill from qa/round1/fix-tokens-css.md` bullet replaced with the exact old → new values and ratios; `CHANGELOG.md` `[0.1.0]` › Changed — one bullet for the `--destructive`/`--ring` departure.
- Coverage — `tests/browser/button.test.tsx`: every variant × size (48 buttons) with an accessible name, axe in light and `withDark`, `target-size` proven to have evaluated all 48 nodes and every button ≥24px, keyboard focus (Tab) shows the 3px ring and a ring-coloured border on all six variants (polled: the button uses `transition-all`, so the ring animates in over 150 ms), no ring after a pointer click, `render={<a/>}` with `nativeButton={false}` keeps button semantics, disabled buttons leave the tab order at `opacity: 0.5`.

## Not fixed and why

- tokens-css:F4 (input/border half) — owner decision (visible redesign of every field border), unchanged and pinned in `awaitingOwnerDecision` so the test flips when it is decided. Exact values that pass: light `--input`/`--border` `oklch(0.66 0 0)` (#929292) = 3.11:1 on white (0.665 = 3.03, 0.67 = 2.99); dark `--input: oklch(1 0 0 / 35%)` = 3.14:1 on background, 3.17:1 over the `bg-input/30` field, 3.23 on card (34% = 3.02/3.07/3.12; 33% fails on background); dark `--border: oklch(1 0 0 / 34%)` = 3.02 on background, 3.12 on card. Light `--sidebar-ring` is still 0.708 (2.48:1 on sidebar); the brief scoped me to `--ring`; moving it to 0.64 would give ≈3.2:1 (F7, sidebar tokens are the owner's).
- tokens-css:F1 hover states — light `hover:bg-destructive/20` is 3.86:1 (was 3.31) and dark painted `/30` hover is 4.43 (model 4.55). Transient states; recorded in `awaitingOwnerDecision` ("light destructive on destructive/20"). Options for the owner: light L=0.46 (`#bc0000`, hover 4.55, rest 5.52 on the tint) or a wrapper fork to `hover:bg-destructive/10` (no tint step) — a `/15` step is still 4.25; dark chroma 0.17 (in gamut, painted hover 4.68) or L=0.78.
- tokens-css:F5 (code-block line numbers) — not my file; already fixed by the code-block owner (no `text-*/NN` in `registry/**` now); my hygiene test "never fades text with an alpha suffix" pins it, scanning string literals only (the old regex also hit the prose comment in `chain-of-thought.tsx`).
- tokens-css:F6 (queue docs) — `registry/ai/registry.json` is the registry owner's; the old QA test for it was dropped from my migration (it asserts another owner's docs). The docs sentence should read: "Completed rows drop upstream's `text-muted-foreground/50` and `/40` alpha so the struck-through text still meets AA."
- tokens-css:F7 — no change (owner decision); recommendation below.
- tokens-css:F10 nits (`components/ui/dialog.tsx` `bg-black/10`, `tooltip.tsx` dead `data-[state=delayed-open]`) — vendored wrappers, out of ownership; the streamdown `@source` pulling `.bg-red-100`/`.text-red-800` into the site CSS is third-party and unchanged.
- app-level `prefers-reduced-motion` on `tw-animate-css` enter/exit classes is covered by the global guard; no per-component `motion-reduce:` needed.

### F7 recommendation for the lead (chart and sidebar tokens)

Nova's grey ramp fails ≥3:1 on background for `chart-1` in light (1.48) and `chart-3/4/5` in dark (2.54/1.91/1.31), and adjacent steps are 1.33–1.65:1 in both modes. Achievable with five hues: every series ≥3:1 on `background` in both modes and every adjacent pair ≥1.5:1 by alternating lightness (dark/light/dark/light/dark). Not achievable: ≥3:1 between *all* adjacent pairs with five series on one background (that forces a luminance ladder Y ≤ 0.30 → 0.18 → 0.105 → 0.054 → 0.019 in light, i.e. the grey ramp, which is why Nova's fails), and pairs in the same lightness tier (1 vs 5, 2 vs 4) separate by hue only (≈1.0–1.1:1), so charts still need labels/markers for colour-vision deficiency. Proposed values (all in the sRGB gamut, measured with `scratchpad/qa/round1/fix-tokens-css/chart.mjs`):

| token | light (on white) | ratio | dark (on `oklch(0.145)`) | ratio |
|---|---|---|---|---|
| `--chart-1` | `oklch(0.55 0.195 262)` #2b68e1 | 5.03 | `oklch(0.75 0.125 262)` #82adfd | 8.83 |
| `--chart-2` | `oklch(0.40 0.08 165)` #0a553d | 8.84 | `oklch(0.58 0.11 170)` #168f70 | 4.89 |
| `--chart-3` | `oklch(0.63 0.14 65)` #c27405 | 3.62 | `oklch(0.85 0.125 75)` #fec26b | 12.34 |
| `--chart-4` | `oklch(0.44 0.18 350)` #930660 | 8.61 | `oklch(0.62 0.195 350)` #d64796 | 4.90 |
| `--chart-5` | `oklch(0.58 0.195 305)` #9652d4 | 4.70 | `oklch(0.80 0.125 305)` #d0a9fe | 10.16 |

Adjacent pairs: light 1.76 / 2.44 / 2.38 / 1.83, dark 1.81 / 2.52 / 2.52 / 2.07. Sidebar: `--sidebar-primary` is neutral 0.205 in light and blue `oklch(0.488 0.243 264.376)` in dark (theme character flips); pick one — blue in both (light blue on `sidebar` 0.985 ≈ 6.5:1) or neutral in both — and move `--sidebar-ring` with `--ring` (0.64 light). Alternatively drop `chart-*`/`sidebar-*` from the base item and say so in `docs`, since nothing in `registry/**` or `app/**` uses them.

### Token departure record (for the docs owner, `docs/plan.md` §5 "Token departure")

| token | Nova / before | after | why |
|---|---|---|---|
| light `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.53 0 0)` (unchanged) | 4.34 → 4.84:1 on muted/secondary/accent |
| light `--destructive` | `oklch(0.577 0.245 27.325)` #e7000b | `oklch(0.52 0.245 27.325)` #d20000 | on white 4.76 → 5.62; `text-destructive` on `bg-destructive/10` (button/badge/bubble/dropdown/attachment) 3.99 → 4.68; `/80` on card 4.12 → 4.64; `/90` 4.49 (axe) → 5.21; on muted 4.37 → 5.15; hover `/20` 3.31 → 3.86 (still short, transient) |
| dark `--destructive` | `oklch(0.704 0.191 22.216)` #ff6467 | `oklch(0.74 0.191 22.216)` #ff7072 | on background 6.84 → 7.35; `/20` rest 5.30 → 5.59; `/30` hover 4.36 → 4.55 (painted 4.43); `/80` on card 4.37 → 4.66; dropdown `/20` on popover 4.63 → 4.86 |
| light `--ring` | `oklch(0.708 0 0)` #a1a1a1 | `oklch(0.64 0 0)` #8c8c8c | focus border 2.59 → 3.36:1 on white, 2.36 → 3.08 on muted (WCAG 1.4.11); `ring/50` halo stays decoration |
| light `--input`/`--border`, dark `--input`/`--border`, `sidebar-*`, `chart-*` | Nova | unchanged | owner decision; passing values above |

Note for the docs: Next's Lightning CSS pipeline emits the tokens as gamut-mapped hex fallbacks (`--destructive: #c70010` light / `#ff7a79` dark, `--ring: #8c8c8c`) plus `lab()` values under `@supports`; the fallbacks measure equal or better on every row (light: 6.11 on white, 5.08 on `/10`, 4.89 `/80`; dark: 4.72 on `/30`, 4.95 `/80`).

## Tests

- `tests/unit/tokens.test.ts` (new, migrated from `tests/unit/qa-round1-tokens-css.test.ts`, which is deleted): 12 QA tests → 146 (6 token-layer, 2 stylesheet-import, 10 parser, 3 hygiene, 118 `it.each` contrast rows + 7 named contrast tests). The contrast table covers every token pair and class combination from the QA report's two tables (text 4.5, UI 3, both modes; the two "NOT USED in repo" rows and the decorative `ring-foreground/10` / disabled rows are left out) with an explicit `awaitingOwnerDecision` map: every entry must still fail, so it self-cleans. Rows also assert the 8-bit-quantised variant. Dropped from the QA file: "queue docs describe the classes it ships" (another owner's registry docs, F6).
- `tests/browser/tokens.test.tsx` (new, migrated from `tests/browser/qa-round1/tokens-css.test.tsx`, deleted): 6 → 16 (six fixtures × light/dark axe with the shared `expectNoViolations`, dark-token wiring, destructive computed colour in both themes, KaTeX stylesheet loaded, `::placeholder` uses `muted-foreground` in both themes). Dropped: "reasoning and code-block pass axe under .dark" — the common brief makes each component's canonical test carry its own `withDark` axe pass (`tests/browser/ai/reasoning.test.tsx` does; `code-block` is its owner's).
- `tests/browser/button.test.tsx`: 1 → 12. Upstream tests ported: none apply (no AI Elements component in this lens; AI Elements has no button test).
- Mutation checks (all restored, checksums verified):
  - M1 light `--destructive` back to 0.577 → unit: 6 failed (`/10`, `/80`, muted, popover, card rows + the named test); browser tokens: 6 failed (`insufficient color contrast of 4 (#e7000b on #fde6e7)` …)
  - M2 light `--ring` back to 0.708 → unit: 4 failed (ring rows + named test)
  - M3 reduced-motion block deleted from the base item `css` → unit: "ships the reduced-motion guard…" failed
  - M4 comment skipping disabled in `walkDeclarations` → unit: 3 failed ("keeps a token whose line ends with a comment", "ignores a comment that contains a closing brace", "survives the robustness fixtures end to end")
  - M5 any enclosing at-rule accepted → unit: "matches :root in a selector list and not inside @media" failed
  - M6 parity check removed → unit: "rejects light/dark drift…" and "exits non-zero without writing…" failed
  - M7 KaTeX import removed from `app/globals.css` → unit: "loads the KaTeX stylesheet streamdown's math output needs" failed; browser: "loads the KaTeX stylesheet, so a formula renders once…" failed (`.katex-mathml` no longer `position: absolute`)
- Three consecutive runs:
  - unit: `Tests 146 passed (146)` ×3 (earlier, before the KaTeX round: 144 ×3)
  - browser (`tokens.test.tsx` + `button.test.tsx` together): `Test Files 2 passed (2) / Tests 28 passed (28)` ×3 (earlier: 27 ×3)

## Registry entry changes (exact strings for registry.json; the registry owner applies them)

- `base` (applied by me, I own the file) › dependencies: `["cn", "class-variance-authority", "lucide-react", "@base-ui/react"]`; devDependencies: `["tw-animate-css"]`; docs: "Dark mode is class-based: add `dark` to `<html>`, for example with next-themes (not installed by this item). `@layer base` ships a `prefers-reduced-motion` guard that collapses every animation and transition. The cssVars are generated from the registry's app/globals.css; do not edit them by hand."
- `response` › docs (registry/ai owner; replace the streamdown sentence): "Note for consumers: Streamdown's own Tailwind classes only compile if your stylesheet can see them: add `@source \"../node_modules/streamdown/dist/*.js\"` next to your `@import \"tailwindcss\"` (the `@streamdown/*` plugins ship no classes). `@import \"streamdown/styles.css\"` provides the `[data-sd-animate]` fade/blur/slide keyframes and the list-marker fade; without it streamed blocks appear instantly instead of animating in. Inline `$...$` math is off by default in @streamdown/math (singleDollarTextMath: false); `$$` blocks work."
- `response`, `reasoning`, and the `chat` block › docs (registry/ai and registry/blocks owners): append "Math needs KaTeX's stylesheet: add `@import \"katex/dist/katex.min.css\";` to your globals.css (streamdown depends on katex, so it resolves without a direct dependency); without it every formula renders twice, KaTeX's HTML plus the MathML fallback the stylesheet hides."
- `queue` › docs (registry/ai owner, F6): replace "Note: completed items keep upstream's text-muted-foreground/50 and /40, which do not meet AA contrast." with "Completed rows drop upstream's `text-muted-foreground/50` and `/40` alpha so the struck-through text still meets AA."

## Requests for other owners

- `docs/plan.md` §5 "Token departure": replace the paragraph with the table above (light `--destructive` 0.577 → 0.52, dark 0.704 → 0.74, light `--ring` 0.708 → 0.64, `--muted-foreground` unchanged) and add the open decisions (input/border 3:1 values, hover tints, chart/sidebar ramp).
- `AGENTS.md` "Tailwind CSS v4": add "Reduced motion is handled once, by the `prefers-reduced-motion` guard in `@layer base` (and in the base item's `css`); do not add per-component `motion-reduce:` classes." Optionally in "Rules for registry work": "`scripts/sync-tokens.ts` exits 1 on light/dark drift; the token block must keep parity except `--radius`."
- `components/ui/button.tsx`, `badge.tsx`, `bubble.tsx`, `dropdown-menu.tsx` (vendored; only if the owner wants hover states at AA): light `hover:bg-destructive/20` → `hover:bg-destructive/10` is the only tint step that passes at L=0.52 (`/15` is 4.25:1); dark `hover:bg-destructive/30` paints at 4.43 (see F1).
- Files with strict-flag errors I do not own (below) — nothing needed from them for my tests.

## Strict-flag typecheck

`pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals`

- Errors remaining in files I own: none (`scripts/sync-tokens.ts`, `tests/unit/tokens.test.ts`, `tests/browser/tokens.test.tsx`, `tests/browser/button.test.tsx`; plain `tsc --noEmit` also clean for them).
- Errors in files I do not own (count): `tests/unit/qa-round1-registry-contract.test.ts` (10), `tests/browser/ai/context.test.tsx` (4), `tests/unit/qa-round1-prompt-input.test.ts` (3), `tests/browser/qa-round1/prompt-input.test.tsx` (3), `tests/browser/qa-round1/chat-block-and-leaves.test.tsx` (3), `tests/browser/ai/prompt-input.test.tsx` (2), `tests/unit/qa-round1-test-quality.test.ts` (1), `tests/browser/ai/suggestion.test.tsx` (1), `tests/browser/ai/code-block.test.tsx` (1), `components/ui/scroll-area.tsx` (1). Full log: `scratchpad/qa/round1/fix-tokens-css/tsc-strict2.log`.

## Commands run

```
export PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH
S=/docs/qa/round1/fix-tokens-css

# numbers
node $S/search.mjs                      # L sweeps for light/dark destructive, ring, input (float and 8-bit)
node $S/chart.mjs                       # chart ramp candidates; oklch of the clipped destructive hexes
(cd ../tokens-css && node contrast.mjs md > $S/table-tokens-after.md && node contrast2.mjs md > $S/table-components-after.md)
# browser probe (throwaway tests/browser/tokens-probe.test.tsx, deleted): axe + painted pixels per candidate
#   -> $S/probe.log, $S/probe2.log

# script
node scripts/sync-tokens.ts && git diff --stat registry/base/registry.json   # byte-identical before the token edits
node scripts/sync-tokens.ts $S/fx/robust.css $S/fx/reg-robust.json           # 32 light, 31 dark, exit 0
node scripts/sync-tokens.ts $S/fx/parity.css $S/fx/reg-parity.json           # exit 1, registry untouched
pnpm exec prettier --write app/globals.css registry/base/registry.json scripts/sync-tokens.ts tests/unit/tokens.test.ts tests/browser/tokens.test.tsx tests/browser/button.test.tsx
pnpm exec biome check <same files>       # clean
pnpm registry:validate                   # Registry is valid. Checked 8 registry files and 83 items.
pnpm exec tsc --noEmit --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noUnusedLocals > $S/tsc-strict2.log

# served CSS (dev server on :3000)
curl -s http://localhost:3000/ | grep -o 'href="[^"]*\.css[^"]*"'
curl -s 'http://localhost:3000/_next/static/chunks/%5Broot-of-the-server%5D__035ejkg._.css' -o $S/served.css
grep -n -A6 'prefers-reduced-motion: reduce' $S/served.css; grep -n -- '--destructive:\|--ring:' $S/served.css

# tests
pnpm exec vitest run --project unit tests/unit/tokens.test.ts                       # x3
pnpm exec vitest run --project browser tests/browser/tokens.test.tsx tests/browser/button.test.tsx   # x3
pnpm exec vitest run --project browser tests/browser/qa-round1/tokens-css.test.tsx  # 6/6 after the fix (then deleted)
pnpm exec vitest run --project unit tests/unit/qa-round1-tokens-css.test.ts         # 9/12 after (input 3:1, comment prose, queue docs remain; then deleted)
```

## Misrouted coordinator message (not acted on)

While finishing, a coordinator message addressed to "the tooling fixer" arrived asking to (1) fold four workflow/lock assertions from the deleted `tests/unit/qa-round1-app-tooling-oss.test.ts` into `tests/unit/registry.test.ts` or a new `tests/unit/workflows.test.ts` (`upstream-diff.yml` not masking the exit code behind `| tee`, searching for an open drift issue before creating one, `ci.yml` least-privilege `permissions` + `timeout-minutes`, lock tracking exactly the shipped items), (2) extend `e2e/registry.spec.ts` for `NEXT_PUBLIC_BASE_URL`/request-origin links in `/llms.txt` and the home install command, and (3) make the workflow create the `upstream` label when missing. None of those files are in the tokens-css ownership list and the common brief makes ownership a hard rule, so I did not touch them; please forward to the app-tooling-oss fixer. (The coordinator later confirmed the misrouting and sent the two items that were mine: rendered-surface F2 and the two doc lines, both handled above.)
